package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"meris-backend/internal/platform/ai"
	"meris-backend/internal/platform/sse"
	"meris-backend/internal/store/sqlc"
	"meris-backend/internal/store/sqlcutil"
)

type Service struct {
	repo *Repository
	hub  *sse.Hub
}

func NewService(repo *Repository, hub *sse.Hub) *Service {
	return &Service{repo: repo, hub: hub}
}

func (s *Service) ExtractAndCreateSession(ctx context.Context, imageBytes []byte, payerName, payerBankName, payerBankAccount string) (*sqlc.Session, []sqlc.Item, []sqlc.Participant, uint, string, error) {
	extracted, err := ai.ExtractReceiptData(imageBytes)
	if err != nil {
		return nil, nil, nil, 0, "", fmt.Errorf("AI extraction failed: %w", err)
	}

	sessionID := uuid.New().String()
	now := time.Now()

	var payerID uint
	var payerToken string

	err = s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
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

		billName := "Initial Stop"

		err = q.CreateBill(ctx, sqlc.CreateBillParams{
			ID:            sessionID, // Default bill ID is the session ID
			SessionID:     sessionID,
			PayerName:     payerName,
			Name:          billName,
			Tax:           extracted.Tax,
			ServiceCharge: extracted.ServiceCharge,
			GrandTotal:    extracted.GrandTotal,
			CreatedAt:     sqlcutil.Timestamptz(now),
		})
		if err != nil {
			return err
		}

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
		}

		return nil
	})

	if err != nil {
		return nil, nil, nil, 0, "", err
	}

	// We return a simplified session object as it's mostly used for ID
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

	existing, err := q.GetParticipantByName(ctx, sqlc.GetParticipantByNameParams{
		SessionID: sessionID,
		Name:      name,
	})
	if err == nil {
		if clientToken != "" && existing.Token == clientToken {
			return &existing, nil
		}
		return nil, NewNameConflictError(name)
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
			return fmt.Errorf("cannot delete the session owner")
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

func (s *Service) AddItem(ctx context.Context, sessionID string, name string, price float64, quantity int32, token string) error {
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

		return q.CreateItem(ctx, sqlc.CreateItemParams{
			ID:        uuid.New().String(),
			SessionID: sessionID,
			BillID:    sessionID,
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

func (s *Service) UpdateItem(ctx context.Context, sessionID string, itemID string, name string, price float64, quantity int32, token string) error {
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

func (s *Service) GetCompiledSession(ctx context.Context, sessionID string) (CompiledSession, error) {
	session, items, participants, claims, err := s.repo.FetchFullSession(ctx, sessionID)
	if err != nil {
		return CompiledSession{}, err
	}

	dbBills, err := s.repo.GetQueries().GetBillsBySession(ctx, sessionID)
	if err != nil {
		return CompiledSession{}, err
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
	pTotalOwedMap := make(map[int64]float64)
	pTotalPaidMap := make(map[int64]float64)

	for _, p := range participants {
		pSubtotalMap[p.ID] = 0.0
		pTaxMap[p.ID] = 0.0
		pServiceChargeMap[p.ID] = 0.0
		pTotalOwedMap[p.ID] = 0.0
		pTotalPaidMap[p.ID] = 0.0
	}

	itemsMap := make(map[string]sqlc.Item)
	billItemsMap := make(map[string][]sqlc.Item)
	for _, it := range items {
		itemsMap[it.ID] = it
		billItemsMap[it.BillID] = append(billItemsMap[it.BillID], it)
	}

	var sessionTax float64
	var sessionServiceCharge float64
	var sessionGrandTotal float64

	for _, bill := range dbBills {
		sessionTax += bill.Tax
		sessionServiceCharge += bill.ServiceCharge
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
			var proportion float64
			if billSubtotal > 0 {
				proportion = pBillSubtotal / billSubtotal
			}

			pConsumedTax := proportion * bill.Tax
			pConsumedServiceCharge := proportion * bill.ServiceCharge
			pConsumedGrandTotal := pBillSubtotal + pConsumedTax + pConsumedServiceCharge

			pSubtotalMap[p.ID] += pBillSubtotal
			pTaxMap[p.ID] += pConsumedTax
			pServiceChargeMap[p.ID] += pConsumedServiceCharge
			pTotalOwedMap[p.ID] += pConsumedGrandTotal

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

	return CompiledSession{
		ID:               session.ID,
		PayerName:        session.PayerName,
		PayerBankName:    session.PayerBankName,
		PayerBankAccount: session.PayerBankAccount,
		Tax:              sessionTax,
		ServiceCharge:    sessionServiceCharge,
		GrandTotal:       sessionGrandTotal,
		CreatedAt:        sqlcutil.Time(session.CreatedAt).Format(time.RFC3339),
		Items:            compiledItems,
		Participants:     compiledParticipants,
		Bills:            dbBills,
		Transfers:        transfers,
	}, nil
}

func (s *Service) AddBillToSession(ctx context.Context, sessionID string, imageBytes []byte, payerName string, billName string, token string) error {
	extracted, err := ai.ExtractReceiptData(imageBytes)
	if err != nil {
		return fmt.Errorf("AI extraction failed: %w", err)
	}

	if billName == "" {
		billName = fmt.Sprintf("Stop %s", time.Now().Format("2006-01-02 15:04:05"))
	}

	err = s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
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
		now := time.Now()

		err = q.CreateBill(ctx, sqlc.CreateBillParams{
			ID:            billID,
			SessionID:     sessionID,
			PayerName:     payerName,
			Name:          billName,
			Tax:           extracted.Tax,
			ServiceCharge: extracted.ServiceCharge,
			GrandTotal:    extracted.GrandTotal,
			CreatedAt:     sqlcutil.Timestamptz(now),
		})
		if err != nil {
			return err
		}

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

func (s *Service) UpdateBill(ctx context.Context, sessionID string, billID string, name string, payerName string, tax float64, serviceCharge float64, grandTotal float64, token string) error {
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

		return q.UpdateBill(ctx, sqlc.UpdateBillParams{
			ID:            billID,
			SessionID:     sessionID,
			PayerName:     payerName,
			Name:          name,
			Tax:           tax,
			ServiceCharge: serviceCharge,
			GrandTotal:    grandTotal,
		})
	})

	if err != nil {
		return err
	}

	go s.broadcastFullState(context.WithoutCancel(ctx), sessionID)
	return nil
}

func (s *Service) DeleteBill(ctx context.Context, sessionID string, billID string, token string) error {
	err := s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		bills, err := q.GetBillsBySession(ctx, sessionID)
		if err != nil {
			return err
		}

		var targetBill *sqlc.Bill
		for _, b := range bills {
			if b.ID == billID {
				targetBill = &b
				break
			}
		}
		if targetBill == nil {
			return errors.New("bill not found")
		}

		participants, err := q.GetParticipantsBySession(ctx, sessionID)
		if err != nil {
			return err
		}

		var caller *sqlc.Participant
		for _, p := range participants {
			if p.Token == token {
				caller = &p
				break
			}
		}
		if caller == nil {
			return ErrUnauthorized
		}

		session, err := q.GetSession(ctx, sessionID)
		if err != nil {
			return err
		}

		if caller.Name != targetBill.PayerName && caller.Name != session.PayerName {
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
