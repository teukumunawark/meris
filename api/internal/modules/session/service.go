package session

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"meris-backend/internal/modules/session/db"
	"meris-backend/internal/platform/ai"
	"meris-backend/internal/platform/sse"
)

type Service struct {
	repo *Repository
	hub  *sse.Hub
}

func NewService(repo *Repository, hub *sse.Hub) *Service {
	return &Service{repo: repo, hub: hub}
}

func (s *Service) ExtractAndCreateSession(ctx context.Context, imageBytes []byte, payerName, payerBankName, payerBankAccount string) (*db.Session, []db.Item, []db.Participant, uint, string, error) {
	extracted, err := ai.ExtractReceiptData(imageBytes)
	if err != nil {
		return nil, nil, nil, 0, "", fmt.Errorf("AI extraction failed: %w", err)
	}

	sessionID := uuid.New().String()
	now := time.Now()
	session := db.Session{
		ID:               sessionID,
		PayerName:        payerName,
		PayerBankName:    payerBankName,
		PayerBankAccount: payerBankAccount,
		Tax:              extracted.Tax,
		ServiceCharge:    extracted.ServiceCharge,
		GrandTotal:       extracted.GrandTotal,
		CreatedAt:        now,
	}

	var items []db.Item
	for _, it := range extracted.Items {
		items = append(items, db.Item{
			ID:        uuid.New().String(),
			SessionID: sessionID,
			Name:      it.Name,
			Price:     it.Price,
			Quantity:  int32(it.Quantity),
		})
	}

	var payerID uint
	var payerToken string

	err = s.repo.WithTx(ctx, func(q *db.Queries) error {
		err := q.CreateSession(ctx, db.CreateSessionParams{
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
			err := q.CreateItem(ctx, db.CreateItemParams{
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
			p, err := q.CreateParticipant(ctx, db.CreateParticipantParams{
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

	var participants []db.Participant
	if payerName != "" {
		participants = append(participants, db.Participant{
			ID:        int64(payerID),
			SessionID: sessionID,
			Name:      payerName,
			Token:     payerToken,
		})
	}

	return &session, items, participants, payerID, payerToken, nil
}

func (s *Service) JoinSession(ctx context.Context, sessionID, name, clientToken string) (*db.Participant, error) {
	q := s.repo.GetQueries()

	existing, err := q.GetParticipantByName(ctx, db.GetParticipantByNameParams{
		SessionID: sessionID,
		Name:      name,
	})
	if err == nil {
		if clientToken != "" && existing.Token == clientToken {
			return &existing, nil
		}
		return nil, ErrNameConflict
	}

	newToken := uuid.New().String()
	p, err := q.CreateParticipant(ctx, db.CreateParticipantParams{
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
	err := s.repo.WithTx(ctx, func(q *db.Queries) error {
		p, err := q.GetParticipant(ctx, int64(participantID))
		if err != nil {
			return err
		}

		if p.Token != token {
			return ErrUnauthorized
		}

		itemInfo, err := db.New(s.repo.pool).GetItemsBySession(ctx, sessionID)
		if err != nil {
			return err
		}
		var targetItem db.Item
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

		otherShares, err := q.GetOtherClaimsSum(ctx, db.GetOtherClaimsSumParams{
			ItemID:        itemID,
			ParticipantID: int64(participantID),
		})
		if err != nil {
			return err
		}

		if otherShares+shares > float64(targetItem.Quantity) {
			return ErrQuantityExceeded
		}

		_, err = q.GetClaimByItemAndParticipant(ctx, db.GetClaimByItemAndParticipantParams{
			ItemID:        itemID,
			ParticipantID: int64(participantID),
		})

		if err == nil {
			return q.UpdateClaimShares(ctx, db.UpdateClaimSharesParams{
				Shares:        shares,
				ItemID:        itemID,
				ParticipantID: int64(participantID),
			})
		}

		return q.CreateClaim(ctx, db.CreateClaimParams{
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
	err := q.UpdateItemName(ctx, db.UpdateItemNameParams{
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
	session, err := s.repo.GetQueries().GetSession(ctx, sessionID)
	if err != nil {
		return err
	}

	payer, err := s.repo.GetQueries().GetParticipantByName(ctx, db.GetParticipantByNameParams{
		SessionID: sessionID,
		Name:      session.PayerName,
	})
	if err != nil || payer.Token != callerToken {
		return ErrUnauthorized
	}

	err = s.repo.GetQueries().DeleteParticipant(ctx, db.DeleteParticipantParams{
		ID:        int64(targetParticipantID),
		SessionID: sessionID,
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

	s.hub.Broadcast(string(data))
}

func (s *Service) GetCompiledSession(ctx context.Context, sessionID string) (CompiledSession, error) {
	session, items, participants, claims, err := s.repo.FetchFullSession(ctx, sessionID)
	if err != nil {
		return CompiledSession{}, err
	}

	// Build per-item claims index
	itemClaimsMap := make(map[string][]CompiledClaim)
	for _, c := range claims {
		itemClaimsMap[c.ItemID] = append(itemClaimsMap[c.ItemID], CompiledClaim{
			ID:            c.ID,
			ItemID:        c.ItemID,
			ParticipantID: c.ParticipantID,
			Shares:        c.Shares,
		})
	}

	// Build per-participant claims index
	participantClaimsMap := make(map[int64][]CompiledClaim)
	for _, c := range claims {
		participantClaimsMap[c.ParticipantID] = append(participantClaimsMap[c.ParticipantID], CompiledClaim{
			ID:            c.ID,
			ItemID:        c.ItemID,
			ParticipantID: c.ParticipantID,
			Shares:        c.Shares,
		})
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
		compiledParticipants = append(compiledParticipants, CompiledParticipant{
			ID:        p.ID,
			SessionID: p.SessionID,
			Name:      p.Name,
			Claims:    claims,
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
		CreatedAt:        session.CreatedAt.Format(time.RFC3339),
		Items:            compiledItems,
		Participants:     compiledParticipants,
	}, nil
}
