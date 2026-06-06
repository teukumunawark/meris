package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

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
	session := sqlc.Session{
		ID:               sessionID,
		PayerName:        payerName,
		PayerBankName:    payerBankName,
		PayerBankAccount: payerBankAccount,
		Tax:              extracted.Tax,
		ServiceCharge:    extracted.ServiceCharge,
		GrandTotal:       extracted.GrandTotal,
		CreatedAt:        sqlcutil.Timestamptz(now),
	}

	var items []sqlc.Item
	for _, it := range extracted.Items {
		items = append(items, sqlc.Item{
			ID:        uuid.New().String(),
			SessionID: sessionID,
			Name:      it.Name,
			Price:     it.Price,
			Quantity:  int32(it.Quantity),
		})
	}

	var payerID uint
	var payerToken string

	err = s.repo.WithTx(ctx, func(q *sqlc.Queries) error {
		err := q.CreateSession(ctx, sqlc.CreateSessionParams{
			ID:               session.ID,
			PayerName:        session.PayerName,
			PayerBankName:    session.PayerBankName,
			PayerBankAccount: session.PayerBankAccount,
			Tax:              session.Tax,
			ServiceCharge:    session.ServiceCharge,
			GrandTotal:       session.GrandTotal,
			CreatedAt:        session.CreatedAt,
		})
		if err != nil {
			return err
		}

		for _, item := range items {
			err := q.CreateItem(ctx, sqlc.CreateItemParams{
				ID:        item.ID,
				SessionID: item.SessionID,
				Name:      item.Name,
				Price:     item.Price,
				Quantity:  item.Quantity,
			})
			if err != nil {
				return err
			}
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

	var participants []sqlc.Participant
	if payerName != "" {
		participants = append(participants, sqlc.Participant{
			ID:        int64(payerID),
			SessionID: sessionID,
			Name:      payerName,
			Token:     payerToken,
		})
	}

	return &session, items, participants, payerID, payerToken, nil
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
		return nil, ErrNameConflict
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
		// Pessimistic lock the session to serialize concurrent mutations
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
			return ErrItemNotFound
		}

		// If shares is 0 or less, delete the claim if it exists
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
			return ErrQuantityExceeded
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
		// Pessimistic lock the session to serialize concurrent mutations
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

	// Map participant ID to name
	participantNameMap := make(map[int64]string)
	for _, p := range participants {
		participantNameMap[p.ID] = p.Name
	}

	// Calculate overall subtotal
	var totalSubtotal float64
	for _, it := range items {
		totalSubtotal += it.Price * float64(it.Quantity)
	}

	// Build per-item claims index
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

	// Map items by ID for easy lookup
	itemsMap := make(map[string]sqlc.Item)
	for _, it := range items {
		itemsMap[it.ID] = it
	}

	// Build per-participant claims index and calculate individual subtotal
	participantClaimsMap := make(map[int64][]CompiledClaim)
	participantSubtotalMap := make(map[int64]float64)
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

		if item, ok := itemsMap[c.ItemID]; ok {
			participantSubtotalMap[c.ParticipantID] += item.Price * c.Shares
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

		pSubtotal := participantSubtotalMap[p.ID]
		breakdown := CalculateShare(pSubtotal, totalSubtotal, session.Tax, session.ServiceCharge)

		compiledParticipants = append(compiledParticipants, CompiledParticipant{
			ID:            p.ID,
			SessionID:     p.SessionID,
			Name:          p.Name,
			TotalOwed:     breakdown.Total,
			Subtotal:      breakdown.Subtotal,
			Tax:           breakdown.Tax,
			ServiceCharge: breakdown.ServiceCharge,
			Claims:        claims,
		})
	}

	return CompiledSession{
		ID:               session.ID,
		PayerName:        session.PayerName,
		PayerBankName:    session.PayerBankName,
		PayerBankAccount: session.PayerBankAccount,
		Tax:              session.Tax,
		ServiceCharge:    session.ServiceCharge,
		GrandTotal:       session.GrandTotal,
		CreatedAt:        sqlcutil.Time(session.CreatedAt).Format(time.RFC3339),
		Items:            compiledItems,
		Participants:     compiledParticipants,
	}, nil
}
