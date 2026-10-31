package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"meris-backend/internal/platform/ai"
	"meris-backend/internal/platform/sse"
	"meris-backend/internal/platform/storage"
	"meris-backend/internal/store/sqlc"
	"meris-backend/internal/store/sqlcutil"
)

const postgresUniqueViolation = "23505"

type ReceiptStorage interface {
	UploadReceipt(ctx context.Context, imageBytes []byte) (imageKey string, sha256Hex string, err error)
	GetReceipt(ctx context.Context, imageKey string) ([]byte, error)
	PresignReceiptURL(imageKey string) string
}

type Service struct {
	repo    *Repository
	hub     *sse.Hub
	storage ReceiptStorage
}

func NewService(repo *Repository, hub *sse.Hub) *Service {
	return &Service{repo: repo, hub: hub}
}

func (s *Service) WithStorage(st ReceiptStorage) *Service {
	s.storage = st
	return s
}

func (s *Service) uploadReceiptBestEffort(ctx context.Context, imageBytes []byte) (string, string) {
	sha256Hex, _, _ := storage.ReceiptImageHashAndKey(imageBytes)
	if s.storage == nil {
		return "", sha256Hex
	}
	key, hash, err := s.storage.UploadReceipt(ctx, imageBytes)
	if err != nil {
		slog.WarnContext(ctx, "Failed to upload receipt image to object storage", "error", err)
		return "", sha256Hex
	}
	return key, hash
}

func (s *Service) presignBillImage(imageKey string) string {
	if s.storage == nil || strings.TrimSpace(imageKey) == "" {
		return ""
	}
	return s.storage.PresignReceiptURL(imageKey)
}

func ocrMetadataOf(extracted *ai.ExtractedReceipt, skipOCR bool) ([]byte, string, string) {
	if skipOCR || extracted == nil {
		return nil, "manual", "manual_fallback"
	}
	rawJSON, _ := json.Marshal(extracted)
	status := "success"
	if !extracted.MatchesPrintedTotal {
		status = "reconciled_mismatch"
	}
	return rawJSON, extracted.ExtractedByModel, status
}

func (s *Service) recordOCRLogBestEffort(ctx context.Context, q *sqlc.Queries, imageKey, sha256Hex, sessionID, billID, status, model string, rawJSON []byte, errMsg string, now time.Time) {
	if q == nil {
		if s.repo == nil || s.repo.pool == nil {
			return
		}
		q = s.repo.GetQueries()
	}
	var sessText, billText pgtype.Text
	if sessionID != "" {
		sessText = sqlcutil.String(sessionID)
	}
	if billID != "" {
		billText = sqlcutil.String(billID)
	}
	_ = q.CreateOCRLog(ctx, sqlc.CreateOCRLogParams{
		ID:           uuid.New().String(),
		ImageKey:     imageKey,
		ImageSha256:  sha256Hex,
		SessionID:    sessText,
		BillID:       billText,
		Status:       status,
		Model:        model,
		RawResponse:  rawJSON,
		ErrorMessage: errMsg,
		CreatedAt:    sqlcutil.Timestamptz(now),
	})
}

func (s *Service) ExtractAndCreateSession(ctx context.Context, imageBytes []byte, payerName, payerBankName, payerBankAccount string, skipOCR bool) (*sqlc.Session, []sqlc.Item, []sqlc.Participant, uint, string, error) {
	imageKey, sha256Hex := s.uploadReceiptBestEffort(ctx, imageBytes)
	now := time.Now()

	var extracted *ai.ExtractedReceipt
	if skipOCR {
		extracted = &ai.ExtractedReceipt{
			ExtractedByModel:    "manual",
			MatchesPrintedTotal: true,
		}
	} else {
		var err error
		extracted, err = extractReceipt(ctx, imageBytes)
		if err != nil {
			s.recordOCRLogBestEffort(ctx, nil, imageKey, sha256Hex, "", "", "failed", "", nil, err.Error(), now)
			return nil, nil, nil, 0, "", err
		}
	}

	sessionID := uuid.New().String()
	rawJSON, ocrModel, ocrStatus := ocrMetadataOf(extracted, skipOCR)

	var payerID uint
	var payerToken string

	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		err := q.CreateSession(ctx, sqlc.CreateSessionParams{
			ID:               sessionID,
			PayerName:        payerName,
			PayerBankName:    payerBankName,
			PayerBankAccount: payerBankAccount,
			Tax:              extracted.Tax,
			ServiceCharge:    extracted.ServiceCharge,
			GrandTotal:       extracted.GrandTotal,
			CreatedAt:        sqlcutil.Timestamptz(now),
		})
		if err != nil {
			return err
		}

		initialBillID := sessionID
		billName := extracted.MerchantName
		if billName == "" {
			billName = "Initial Stop"
		}

		err = q.CreateBill(ctx, sqlc.CreateBillParams{
			ID:             initialBillID,
			SessionID:      sessionID,
			PayerName:      payerName,
			Name:           billName,
			Tax:            extracted.Tax,
			ServiceCharge:  extracted.ServiceCharge,
			Discount:       extracted.Discount,
			OtherCharges:   extracted.OtherCharges,
			GrandTotal:     extracted.GrandTotal,
			ImageKey:       imageKey,
			OcrRawResponse: rawJSON,
			OcrModel:       ocrModel,
			OcrStatus:      ocrStatus,
			CreatedAt:      sqlcutil.Timestamptz(now),
		})
		if err != nil {
			return err
		}

		s.recordOCRLogBestEffort(ctx, q, imageKey, sha256Hex, sessionID, initialBillID, ocrStatus, ocrModel, rawJSON, "", now)

		if err := s.saveItemsRecursive(ctx, q, sessionID, sessionID, nil, extracted.Items); err != nil {
			return err
		}

		if payerName != "" {
			payerToken = uuid.New().String()
			p, err := q.CreateParticipant(ctx, sqlc.CreateParticipantParams{
				SessionID: sessionID,
				Name:      payerName,
				Token:     payerToken,
			})
			if err != nil {
				return err
			}
			payerID = uint(p.ID)

			if payerBankName != "" || payerBankAccount != "" {
				err = q.UpdateParticipantBankInfo(ctx, sqlc.UpdateParticipantBankInfoParams{
					BankName:    payerBankName,
					BankAccount: payerBankAccount,
					ID:          p.ID,
					SessionID:   sessionID,
				})
				if err != nil {
					return err
				}
			}
		}

		return nil
	})

	if err != nil {
		return nil, nil, nil, 0, "", err
	}

	createdSession := &sqlc.Session{
		ID:               sessionID,
		PayerName:        payerName,
		PayerBankName:    payerBankName,
		PayerBankAccount: payerBankAccount,
		Tax:              extracted.Tax,
		ServiceCharge:    extracted.ServiceCharge,
		GrandTotal:       extracted.GrandTotal,
		CreatedAt:        sqlcutil.Timestamptz(now),
	}

	return createdSession, nil, nil, payerID, payerToken, nil
}

func extractReceipt(ctx context.Context, imageBytes []byte) (*ai.ExtractedReceipt, error) {
	extracted, err := ai.ExtractReceiptData(ctx, imageBytes)
	if errors.Is(err, ai.ErrUnreadableReceipt) {
		return nil, NewUnreadableReceiptError()
	}
	if err != nil {
		return nil, NewReceiptServiceError(fmt.Errorf("extract receipt: %w", err))
	}
	return extracted, nil
}

func extractReceiptWithEscalation(ctx context.Context, imageBytes []byte) (*ai.ExtractedReceipt, error) {
	extracted, err := ai.ExtractReceiptDataWithEscalation(ctx, imageBytes)
	if errors.Is(err, ai.ErrUnreadableReceipt) {
		return nil, NewUnreadableReceiptError()
	}
	if err != nil {
		return nil, NewReceiptServiceError(fmt.Errorf("rescan receipt: %w", err))
	}
	return extracted, nil
}

func (s *Service) saveItemsRecursive(ctx context.Context, q *sqlc.Queries, sessionID string, billID string, parentID *string, extractedItems []ai.ExtractedItem) error {
	for _, it := range extractedItems {
		itemID := uuid.New().String()
		var pID pgtype.Text
		if parentID != nil {
			pID = sqlcutil.String(*parentID)
		}
		err := q.CreateItem(ctx, sqlc.CreateItemParams{
			ID:        itemID,
			SessionID: sessionID,
			BillID:    billID,
			ParentID:  pID,
			Name:      it.Name,
			Price:     it.Price,
			Quantity:  int32(it.Quantity),
		})
		if err != nil {
			return err
		}
		if len(it.SubItems) > 0 {
			if err := s.saveItemsRecursive(ctx, q, sessionID, billID, &itemID, it.SubItems); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Service) JoinSession(ctx context.Context, sessionID, name, clientToken string) (*sqlc.Participant, error) {
	q := s.repo.GetQueries()

	existing, err := q.GetParticipantByNameFold(ctx, sqlc.GetParticipantByNameFoldParams{
		SessionID: sessionID,
		Name:      name,
	})
	if err == nil {
		if clientToken != "" && existing.Token == clientToken {
			return &existing, nil
		}
		return nil, NewNameConflictError(existing.Name)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	newToken := uuid.New().String()
	p, err := q.CreateParticipant(ctx, sqlc.CreateParticipantParams{
		SessionID: sessionID,
		Name:      name,
		Token:     newToken,
	})
	if err != nil {
		return nil, err
	}

	sess, err := q.GetSession(ctx, sessionID)
	sessionHasNoPayerYet := err == nil && sess.PayerName == ""
	if sessionHasNoPayerYet {
		_ = q.UpdateSessionPayerName(ctx, sqlc.UpdateSessionPayerNameParams{
			PayerName: name,
			ID:        sessionID,
		})
		_ = q.UpdateBillPayerName(ctx, sqlc.UpdateBillPayerNameParams{
			PayerName: name,
			ID:        sessionID,
			SessionID: sessionID,
		})
	}
	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)

	return &p, nil
}

func (s *Service) ClaimItem(ctx context.Context, sessionID string, participantID uint, itemID string, shares float64, token string) error {
	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		_, err := q.GetSessionForUpdate(ctx, sessionID)
		if err != nil {
			return err
		}

		p, err := q.GetParticipant(ctx, int64(participantID))
		if err != nil {
			return err
		}

		if p.Token != token {
			return ErrUnauthorized
		}

		if p.SessionID != sessionID {
			return ErrUnauthorized
		}

		itemInfo, err := q.GetItemsBySession(ctx, sessionID)
		if err != nil {
			return err
		}
		var targetItem sqlc.Item
		found := false
		for _, it := range itemInfo {
			if it.ID == itemID {
				targetItem = it
				found = true
				break
			}
		}
		if !found {
			return NewItemNotFoundError(itemID)
		}

		if shares <= 0 {
			_, err = q.GetClaimByItemAndParticipant(ctx, sqlc.GetClaimByItemAndParticipantParams{
				ItemID:        itemID,
				ParticipantID: int64(participantID),
			})
			if err == nil {
				return q.DeleteClaim(ctx, sqlc.DeleteClaimParams{
					ItemID:        itemID,
					ParticipantID: int64(participantID),
				})
			}
			if errors.Is(err, pgx.ErrNoRows) {
				return nil
			}
			return err
		}

		otherShares, err := q.GetOtherClaimsSum(ctx, sqlc.GetOtherClaimsSumParams{
			ItemID:        itemID,
			ParticipantID: int64(participantID),
		})
		if err != nil {
			return err
		}

		if otherShares+shares > float64(targetItem.Quantity) {
			return NewQuantityExceededError()
		}

		_, err = q.GetClaimByItemAndParticipant(ctx, sqlc.GetClaimByItemAndParticipantParams{
			ItemID:        itemID,
			ParticipantID: int64(participantID),
		})
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}

		if err == nil {
			return q.UpdateClaimShares(ctx, sqlc.UpdateClaimSharesParams{
				Shares:        shares,
				ItemID:        itemID,
				ParticipantID: int64(participantID),
			})
		}

		return q.CreateClaim(ctx, sqlc.CreateClaimParams{
			ItemID:        itemID,
			ParticipantID: int64(participantID),
			Shares:        shares,
		})
	})

	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) RenameItem(ctx context.Context, sessionID, itemID, newName string) error {
	q := s.repo.GetQueries()
	err := q.UpdateItemName(ctx, sqlc.UpdateItemNameParams{
		Name:      newName,
		ID:        itemID,
		SessionID: sessionID,
	})
	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) DeleteParticipant(ctx context.Context, sessionID string, targetParticipantID uint, callerToken string) error {
	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		_, err := q.GetSessionForUpdate(ctx, sessionID)
		if err != nil {
			return err
		}

		session, err := q.GetSession(ctx, sessionID)
		if err != nil {
			return err
		}

		payer, err := q.GetParticipantByName(ctx, sqlc.GetParticipantByNameParams{
			SessionID: sessionID,
			Name:      session.PayerName,
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrUnauthorized
			}
			return err
		}

		if payer.Token != callerToken {
			return ErrUnauthorized
		}

		if targetParticipantID == uint(payer.ID) {
			return ErrCannotRemoveOwner
		}

		return q.DeleteParticipant(ctx, sqlc.DeleteParticipantParams{
			ID:        int64(targetParticipantID),
			SessionID: sessionID,
		})
	})
	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) UpdatePaymentInfo(ctx context.Context, sessionID string, bankName, bankAccount, token string) error {
	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		_, err := q.GetSessionForUpdate(ctx, sessionID)
		if err != nil {
			return err
		}

		session, err := q.GetSession(ctx, sessionID)
		if err != nil {
			return err
		}

		payer, err := q.GetParticipantByName(ctx, sqlc.GetParticipantByNameParams{
			SessionID: sessionID,
			Name:      session.PayerName,
		})
		if err != nil {
			return err
		}

		if payer.Token != token {
			return ErrUnauthorized
		}

		return q.UpdateSessionPaymentInfo(ctx, sqlc.UpdateSessionPaymentInfoParams{
			PayerBankName:    bankName,
			PayerBankAccount: bankAccount,
			ID:               sessionID,
		})
	})

	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) AddItem(ctx context.Context, sessionID string, billID string, name string, price float64, quantity int32, token string) error {
	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		_, err := q.GetSessionForUpdate(ctx, sessionID)
		if err != nil {
			return err
		}

		targetBillID := strings.TrimSpace(billID)
		if targetBillID == "" {
			targetBillID = sessionID
		}

		targetBill, caller, session, err := s.loadBillAndCaller(ctx, q, sessionID, targetBillID, token)
		if errors.Is(err, ErrBillNotFound) && strings.TrimSpace(billID) == "" {
			bills, bErr := q.GetBillsBySession(ctx, sessionID)
			if bErr == nil && len(bills) > 0 {
				targetBill, caller, session, err = s.loadBillAndCaller(ctx, q, sessionID, bills[0].ID, token)
			}
		}
		if err != nil {
			return err
		}

		if !canManageBill(caller.Name, targetBill.PayerName, session.PayerName) {
			return ErrUnauthorized
		}

		return q.CreateItem(ctx, sqlc.CreateItemParams{
			ID:        uuid.New().String(),
			SessionID: sessionID,
			BillID:    targetBill.ID,
			Name:      name,
			Price:     price,
			Quantity:  quantity,
		})
	})

	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) authorizeItemBillManager(ctx context.Context, q *sqlc.Queries, sessionID, itemID, token string) error {
	items, err := q.GetItemsBySession(ctx, sessionID)
	if err != nil {
		return err
	}
	var targetItem *sqlc.Item
	for _, it := range items {
		if it.ID == itemID {
			itemCopy := it
			targetItem = &itemCopy
			break
		}
	}
	if targetItem == nil {
		return NewItemNotFoundError(itemID)
	}

	targetBill, caller, session, err := s.loadBillAndCaller(ctx, q, sessionID, targetItem.BillID, token)
	if errors.Is(err, ErrBillNotFound) {
		sessionVal, sErr := q.GetSession(ctx, sessionID)
		if sErr != nil {
			return sErr
		}
		payer, pErr := q.GetParticipantByName(ctx, sqlc.GetParticipantByNameParams{
			SessionID: sessionID,
			Name:      sessionVal.PayerName,
		})
		if pErr != nil || payer.Token != token {
			return ErrUnauthorized
		}
		return nil
	}
	if err != nil {
		return err
	}

	if !canManageBill(caller.Name, targetBill.PayerName, session.PayerName) {
		return ErrUnauthorized
	}
	return nil
}

func (s *Service) UpdateItem(ctx context.Context, sessionID string, itemID string, name string, price float64, quantity int32, token string) error {
	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		_, err := q.GetSessionForUpdate(ctx, sessionID)
		if err != nil {
			return err
		}

		if err := s.authorizeItemBillManager(ctx, q, sessionID, itemID, token); err != nil {
			return err
		}

		return q.UpdateItem(ctx, sqlc.UpdateItemParams{
			Name:      name,
			Price:     price,
			Quantity:  quantity,
			ID:        itemID,
			SessionID: sessionID,
		})
	})

	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) DeleteItem(ctx context.Context, sessionID string, itemID string, token string) error {
	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		_, err := q.GetSessionForUpdate(ctx, sessionID)
		if err != nil {
			return err
		}

		if err := s.authorizeItemBillManager(ctx, q, sessionID, itemID, token); err != nil {
			return err
		}

		return q.DeleteItem(ctx, sqlc.DeleteItemParams{
			ID:        itemID,
			SessionID: sessionID,
		})
	})

	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) broadcastFullState(ctx context.Context, sessionID string) {
	sessionData, err := s.GetCompiledSession(ctx, sessionID)
	if err != nil {
		return
	}

	data, err := json.Marshal(sessionData)
	if err != nil {
		return
	}

	s.hub.Broadcast(sessionID, string(data))
}

func fetchSessionError(sessionID string, err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return NewSessionNotFoundError(sessionID)
	}
	return fmt.Errorf("fetch session %s: %w", sessionID, err)
}

func (s *Service) GetCompiledSession(ctx context.Context, sessionID string) (CompiledSession, error) {
	session, items, participants, claims, err := s.repo.FetchFullSession(ctx, sessionID)
	if err != nil {
		return CompiledSession{}, fetchSessionError(sessionID, err)
	}

	dbBills, err := s.repo.GetQueries().GetBillsBySession(ctx, sessionID)
	if err != nil {
		return CompiledSession{}, fmt.Errorf("fetch bills of session %s: %w", sessionID, err)
	}

	participantNameMap := make(map[int64]string)
	for _, p := range participants {
		participantNameMap[p.ID] = p.Name
	}

	itemClaimsMap := make(map[string][]CompiledClaim)
	for _, c := range claims {
		name := participantNameMap[c.ParticipantID]
		itemClaimsMap[c.ItemID] = append(itemClaimsMap[c.ItemID], CompiledClaim{
			ID:            c.ID,
			ItemID:        c.ItemID,
			ParticipantID: c.ParticipantID,
			Name:          name,
			Shares:        c.Shares,
		})
	}

	participantClaimsMap := make(map[int64][]CompiledClaim)
	for _, c := range claims {
		name := participantNameMap[c.ParticipantID]
		compiled := CompiledClaim{
			ID:            c.ID,
			ItemID:        c.ItemID,
			ParticipantID: c.ParticipantID,
			Name:          name,
			Shares:        c.Shares,
		}
		participantClaimsMap[c.ParticipantID] = append(participantClaimsMap[c.ParticipantID], compiled)
	}

	pSubtotalMap := make(map[int64]float64)
	pTaxMap := make(map[int64]float64)
	pServiceChargeMap := make(map[int64]float64)
	pDiscountMap := make(map[int64]float64)
	pOtherChargesMap := make(map[int64]float64)
	pTotalOwedMap := make(map[int64]float64)
	pTotalPaidMap := make(map[int64]float64)

	for _, p := range participants {
		pSubtotalMap[p.ID] = 0.0
		pTaxMap[p.ID] = 0.0
		pServiceChargeMap[p.ID] = 0.0
		pTotalOwedMap[p.ID] = 0.0
		pTotalPaidMap[p.ID] = 0.0
	}

	billItemsMap := make(map[string][]sqlc.Item)
	for _, it := range items {
		billItemsMap[it.BillID] = append(billItemsMap[it.BillID], it)
	}

	var sessionTax float64
	var sessionServiceCharge float64
	var sessionDiscount float64
	var sessionOtherCharges float64
	var sessionGrandTotal float64

	for _, bill := range dbBills {
		sessionTax += bill.Tax
		sessionServiceCharge += bill.ServiceCharge
		sessionDiscount += bill.Discount
		sessionOtherCharges += bill.OtherCharges
		sessionGrandTotal += bill.GrandTotal

		billItems := billItemsMap[bill.ID]
		var billSubtotal float64
		for _, it := range billItems {
			billSubtotal += it.Price * float64(it.Quantity)
		}

		pBillSubtotalMap := make(map[int64]float64)
		for _, it := range billItems {
			itemClaims := itemClaimsMap[it.ID]
			for _, claim := range itemClaims {
				pBillSubtotalMap[claim.ParticipantID] += it.Price * claim.Shares
			}
		}

		for _, p := range participants {
			pBillSubtotal := pBillSubtotalMap[p.ID]
			share := CalculateShare(pBillSubtotal, billSubtotal, chargesOf(bill))

			pSubtotalMap[p.ID] += share.Subtotal
			pTaxMap[p.ID] += share.Tax
			pServiceChargeMap[p.ID] += share.ServiceCharge
			pDiscountMap[p.ID] += share.Discount
			pOtherChargesMap[p.ID] += share.OtherCharges
			pTotalOwedMap[p.ID] += share.Total

			if bill.PayerName == p.Name {
				pTotalPaidMap[p.ID] += bill.GrandTotal
			}
		}
	}

	compiledItems := make([]CompiledItem, 0, len(items))
	for _, it := range items {
		claims := itemClaimsMap[it.ID]
		if claims == nil {
			claims = []CompiledClaim{}
		}
		compiledItems = append(compiledItems, CompiledItem{
			ID:        it.ID,
			SessionID: it.SessionID,
			BillID:    it.BillID,
			ParentID:  sqlcutil.TextPtr(it.ParentID),
			Name:      it.Name,
			Price:     it.Price,
			Quantity:  it.Quantity,
			Claims:    claims,
		})
	}

	compiledParticipants := make([]CompiledParticipant, 0, len(participants))
	for _, p := range participants {
		claims := participantClaimsMap[p.ID]
		if claims == nil {
			claims = []CompiledClaim{}
		}

		compiledParticipants = append(compiledParticipants, CompiledParticipant{
			ID:            p.ID,
			SessionID:     p.SessionID,
			Name:          p.Name,
			TotalOwed:     pTotalOwedMap[p.ID],
			Subtotal:      pSubtotalMap[p.ID],
			Tax:           pTaxMap[p.ID],
			ServiceCharge: pServiceChargeMap[p.ID],
			Discount:      pDiscountMap[p.ID],
			OtherCharges:  pOtherChargesMap[p.ID],
			BankName:      p.BankName,
			BankAccount:   p.BankAccount,
			Claims:        claims,
		})
	}

	balances := make(map[string]float64)
	for _, p := range participants {
		balances[p.Name] = pTotalPaidMap[p.ID] - pTotalOwedMap[p.ID]
	}
	transfers := SimplifyDebts(balances)

	var rawDebts []BilateralTransfer
	for _, bill := range dbBills {
		billItems := billItemsMap[bill.ID]
		var billSubtotal float64
		for _, it := range billItems {
			billSubtotal += it.Price * float64(it.Quantity)
		}
		pBillSubtotalMap2 := make(map[int64]float64)
		for _, it := range billItems {
			for _, claim := range itemClaimsMap[it.ID] {
				pBillSubtotalMap2[claim.ParticipantID] += it.Price * claim.Shares
			}
		}
		for _, p := range participants {
			if p.Name == bill.PayerName {
				continue
			}
			consumedAtStop := pBillSubtotalMap2[p.ID]
			if consumedAtStop <= 0 {
				continue
			}
			amount := math.Round(CalculateShare(consumedAtStop, billSubtotal, chargesOf(bill)).Total)
			rawDebts = append(rawDebts, BilateralTransfer{
				From:     p.Name,
				To:       bill.PayerName,
				BillName: bill.Name,
				Amount:   amount,
			})
		}
	}

	compiledBills := make([]CompiledBill, 0, len(dbBills))
	for _, b := range dbBills {
		compiledBills = append(compiledBills, CompiledBill{
			ID:            b.ID,
			SessionID:     b.SessionID,
			PayerName:     b.PayerName,
			Name:          b.Name,
			Tax:           b.Tax,
			ServiceCharge: b.ServiceCharge,
			Discount:      b.Discount,
			OtherCharges:  b.OtherCharges,
			GrandTotal:    b.GrandTotal,
			ImageURL:      s.presignBillImage(b.ImageKey),
			CreatedAt:     sqlcutil.Time(b.CreatedAt).Format(time.RFC3339),
		})
	}

	return CompiledSession{
		ID:               session.ID,
		PayerName:        session.PayerName,
		PayerBankName:    session.PayerBankName,
		PayerBankAccount: session.PayerBankAccount,
		Tax:              sessionTax,
		ServiceCharge:    sessionServiceCharge,
		Discount:         sessionDiscount,
		OtherCharges:     sessionOtherCharges,
		GrandTotal:       sessionGrandTotal,
		CreatedAt:        sqlcutil.Time(session.CreatedAt).Format(time.RFC3339),
		Items:            compiledItems,
		Participants:     compiledParticipants,
		Bills:            compiledBills,
		Transfers:        transfers,
		RawDebts:         rawDebts,
	}, nil
}

func (s *Service) AddBillToSession(ctx context.Context, sessionID string, imageBytes []byte, payerName string, billName string, token string, skipOCR bool) error {
	imageKey, sha256Hex := s.uploadReceiptBestEffort(ctx, imageBytes)
	now := time.Now()

	var extracted *ai.ExtractedReceipt
	if skipOCR {
		extracted = &ai.ExtractedReceipt{
			ExtractedByModel:    "manual",
			MatchesPrintedTotal: true,
		}
	} else {
		var err error
		extracted, err = extractReceipt(ctx, imageBytes)
		if err != nil {
			s.recordOCRLogBestEffort(ctx, nil, imageKey, sha256Hex, sessionID, "", "failed", "", nil, err.Error(), now)
			return err
		}
	}

	if billName == "" {
		if extracted.MerchantName != "" {
			billName = extracted.MerchantName
		} else {
			billName = fmt.Sprintf("Stop %s", now.Format("2006-01-02 15:04:05"))
		}
	}

	rawJSON, ocrModel, ocrStatus := ocrMetadataOf(extracted, skipOCR)

	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		participants, err := q.GetParticipantsBySession(ctx, sessionID)
		if err != nil {
			return err
		}

		var authorizedParticipant *sqlc.Participant
		for _, p := range participants {
			if p.Token == token {
				authorizedParticipant = &p
				break
			}
		}

		if authorizedParticipant == nil {
			return ErrUnauthorized
		}

		if payerName == "" {
			payerName = authorizedParticipant.Name
		}

		billID := uuid.New().String()

		err = q.CreateBill(ctx, sqlc.CreateBillParams{
			ID:             billID,
			SessionID:      sessionID,
			PayerName:      payerName,
			Name:           billName,
			Tax:            extracted.Tax,
			ServiceCharge:  extracted.ServiceCharge,
			Discount:       extracted.Discount,
			OtherCharges:   extracted.OtherCharges,
			GrandTotal:     extracted.GrandTotal,
			ImageKey:       imageKey,
			OcrRawResponse: rawJSON,
			OcrModel:       ocrModel,
			OcrStatus:      ocrStatus,
			CreatedAt:      sqlcutil.Timestamptz(now),
		})
		if err != nil {
			return err
		}

		s.recordOCRLogBestEffort(ctx, q, imageKey, sha256Hex, sessionID, billID, ocrStatus, ocrModel, rawJSON, "", now)

		if err := s.saveItemsRecursive(ctx, q, sessionID, billID, nil, extracted.Items); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) RescanBill(ctx context.Context, sessionID string, billID string, token string) error {
	q := s.repo.GetQueries()
	targetBill, caller, session, err := s.loadBillAndCaller(ctx, q, sessionID, billID, token)
	if err != nil {
		return err
	}
	if !canManageBill(caller.Name, targetBill.PayerName, session.PayerName) {
		return ErrUnauthorized
	}
	if strings.TrimSpace(targetBill.ImageKey) == "" || s.storage == nil {
		return ErrBillImageNotFound
	}

	imageBytes, err := s.storage.GetReceipt(ctx, targetBill.ImageKey)
	if err != nil {
		slog.WarnContext(ctx, "Failed to download receipt image for rescan", "billId", billID, "imageKey", targetBill.ImageKey, "error", err)
		return ErrBillImageNotFound
	}

	sha256Hex, _, _ := storage.ReceiptImageHashAndKey(imageBytes)
	now := time.Now()

	extracted, err := extractReceiptWithEscalation(ctx, imageBytes)
	if err != nil {
		s.recordOCRLogBestEffort(ctx, nil, targetBill.ImageKey, sha256Hex, sessionID, billID, "rescan_failed", "", nil, err.Error(), now)
		return err
	}

	rawJSON, ocrModel, _ := ocrMetadataOf(extracted, false)
	ocrStatus := "rescan_success"
	if !extracted.MatchesPrintedTotal {
		ocrStatus = "rescan_reconciled_mismatch"
	}

	err = s.repo.WithTx(ctx, func(txQ *sqlc.Queries) error {
		freshBill, freshCaller, freshSession, txErr := s.loadBillAndCaller(ctx, txQ, sessionID, billID, token)
		if txErr != nil {
			return txErr
		}
		if !canManageBill(freshCaller.Name, freshBill.PayerName, freshSession.PayerName) {
			return ErrUnauthorized
		}

		if err := txQ.DeleteItemsByBill(ctx, sqlc.DeleteItemsByBillParams{
			BillID:    billID,
			SessionID: sessionID,
		}); err != nil {
			return err
		}

		updatedName := freshBill.Name
		if extracted.MerchantName != "" && (updatedName == "" || updatedName == "Initial Stop" || strings.HasPrefix(updatedName, "Stop ")) {
			updatedName = extracted.MerchantName
		}

		if err := txQ.UpdateBillOCRResult(ctx, sqlc.UpdateBillOCRResultParams{
			Name:           updatedName,
			Tax:            extracted.Tax,
			ServiceCharge:  extracted.ServiceCharge,
			Discount:       extracted.Discount,
			OtherCharges:   extracted.OtherCharges,
			GrandTotal:     extracted.GrandTotal,
			OcrRawResponse: rawJSON,
			OcrModel:       ocrModel,
			OcrStatus:      ocrStatus,
			ID:             billID,
			SessionID:      sessionID,
		}); err != nil {
			return err
		}

		s.recordOCRLogBestEffort(ctx, txQ, freshBill.ImageKey, sha256Hex, sessionID, billID, ocrStatus, ocrModel, rawJSON, "", now)

		return s.saveItemsRecursive(ctx, txQ, sessionID, billID, nil, extracted.Items)
	})
	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) UpdateBill(ctx context.Context, sessionID string, billID string, name string, payerName string, charges BillCharges, grandTotal float64, token string) error {
	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		targetBill, caller, session, err := s.loadBillAndCaller(ctx, q, sessionID, billID, token)
		if err != nil {
			return err
		}

		if !canManageBill(caller.Name, targetBill.PayerName, session.PayerName) {
			return ErrUnauthorized
		}

		return q.UpdateBill(ctx, sqlc.UpdateBillParams{
			ID:            billID,
			SessionID:     sessionID,
			PayerName:     payerName,
			Name:          name,
			Tax:           charges.Tax,
			ServiceCharge: charges.ServiceCharge,
			Discount:      charges.Discount,
			OtherCharges:  charges.OtherCharges,
			GrandTotal:    grandTotal,
		})
	})

	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func canManageBill(callerName, billPayerName, sessionPayerName string) bool {
	return callerName == billPayerName || callerName == sessionPayerName
}

func (s *Service) loadBillAndCaller(ctx context.Context, q *sqlc.Queries, sessionID, billID, token string) (*sqlc.Bill, *sqlc.Participant, *sqlc.Session, error) {
	bills, err := q.GetBillsBySession(ctx, sessionID)
	if err != nil {
		return nil, nil, nil, err
	}

	var targetBill *sqlc.Bill
	for _, b := range bills {
		if b.ID == billID {
			targetBill = &b
			break
		}
	}
	if targetBill == nil {
		return nil, nil, nil, ErrBillNotFound
	}

	participants, err := q.GetParticipantsBySession(ctx, sessionID)
	if err != nil {
		return nil, nil, nil, err
	}

	var caller *sqlc.Participant
	for _, p := range participants {
		if token != "" && p.Token == token {
			caller = &p
			break
		}
	}
	if caller == nil {
		return nil, nil, nil, ErrUnauthorized
	}

	session, err := q.GetSession(ctx, sessionID)
	if err != nil {
		return nil, nil, nil, err
	}

	return targetBill, caller, &session, nil
}

func (s *Service) DeleteBill(ctx context.Context, sessionID string, billID string, token string) error {
	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		targetBill, caller, session, err := s.loadBillAndCaller(ctx, q, sessionID, billID, token)
		if err != nil {
			return err
		}

		if !canManageBill(caller.Name, targetBill.PayerName, session.PayerName) {
			return ErrUnauthorized
		}

		return q.DeleteBill(ctx, sqlc.DeleteBillParams{
			ID:        billID,
			SessionID: sessionID,
		})
	})

	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) UpdateParticipantBankInfo(ctx context.Context, sessionID string, participantID int64, bankName string, bankAccount string, token string) error {
	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		p, err := q.GetParticipant(ctx, participantID)
		if err != nil {
			return err
		}

		if p.Token != token || p.SessionID != sessionID {
			return ErrUnauthorized
		}

		return q.UpdateParticipantBankInfo(ctx, sqlc.UpdateParticipantBankInfoParams{
			BankName:    bankName,
			BankAccount: bankAccount,
			ID:          participantID,
			SessionID:   sessionID,
		})
	})

	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) RenameParticipant(ctx context.Context, sessionID string, participantID int64, newName, token string) (*sqlc.Participant, error) {
	var renamed sqlc.Participant

	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		p, err := q.GetParticipant(ctx, participantID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUnauthorized
		}
		if err != nil {
			return err
		}

		if p.Token != token || p.SessionID != sessionID {
			return ErrUnauthorized
		}

		renamed = p
		if p.Name == newName {
			return nil
		}

		existing, err := q.GetParticipantByNameFold(ctx, sqlc.GetParticipantByNameFoldParams{
			SessionID: sessionID,
			Name:      newName,
		})
		if err == nil && existing.ID != p.ID {
			return NewNameConflictError(existing.Name)
		} else if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}

		if err := q.UpdateParticipantName(ctx, sqlc.UpdateParticipantNameParams{
			Name:      newName,
			ID:        participantID,
			SessionID: sessionID,
		}); err != nil {
			if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == postgresUniqueViolation {
				return NewNameConflictError(newName)
			}
			return err
		}

		if err := q.RenameSessionPayer(ctx, sqlc.RenameSessionPayerParams{
			NewName:   newName,
			SessionID: sessionID,
			OldName:   p.Name,
		}); err != nil {
			return err
		}

		if err := q.RenameBillsPayer(ctx, sqlc.RenameBillsPayerParams{
			NewName:   newName,
			SessionID: sessionID,
			OldName:   p.Name,
		}); err != nil {
			return err
		}

		renamed.Name = newName
		return nil
	})

	if err != nil {
		return nil, err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return &renamed, nil
}
