package handlers

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"meris-backend/internal/ai"
	"meris-backend/internal/models"
	"meris-backend/internal/sse"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SessionHandler struct {
	Hub *sse.Hub
	DB  *gorm.DB
}

func NewSessionHandler(hub *sse.Hub, db *gorm.DB) *SessionHandler {
	return &SessionHandler{Hub: hub, DB: db}
}

func (h *SessionHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("receipt")
	if err != nil {
		http.Error(w, "Invalid receipt image", http.StatusBadRequest)
		return
	}
	defer file.Close()

	payerName := r.FormValue("payerName")
	payerBankName := r.FormValue("payerBankName")
	payerBankAccount := r.FormValue("payerBankAccount")

	imageBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read image", http.StatusInternalServerError)
		return
	}

	extracted, err := ai.ExtractReceiptData(imageBytes)
	if err != nil {
		slog.ErrorContext(r.Context(), "AI extraction failed", slog.Any("error", err))
		http.Error(w, "AI extraction failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	sessionID := uuid.New().String()
	session := models.Session{
		ID:               sessionID,
		PayerName:        payerName,
		PayerBankName:    payerBankName,
		PayerBankAccount: payerBankAccount,
		Tax:              extracted.Tax,
		ServiceCharge:    extracted.ServiceCharge,
		GrandTotal:       extracted.GrandTotal,
	}

	for _, it := range extracted.Items {
		item := models.Item{
			ID:        uuid.New().String(),
			SessionID: sessionID,
			Name:      it.Name,
			Price:     it.Price,
			Quantity:  it.Quantity,
		}
		session.Items = append(session.Items, item)
	}

	if err := h.DB.WithContext(r.Context()).Create(&session).Error; err != nil {
		slog.ErrorContext(r.Context(), "Failed to save session", slog.Any("error", err))
		http.Error(w, "Failed to save session", http.StatusInternalServerError)
		return
	}

	var payerID uint
	var payerToken string
	if payerName != "" {
		payerToken = uuid.New().String()
		participant := models.Participant{
			SessionID: sessionID,
			Name:      payerName,
			Token:     payerToken,
		}
		if err := h.DB.WithContext(r.Context()).Create(&participant).Error; err == nil {
			payerID = participant.ID
		} else {
			slog.ErrorContext(r.Context(), "Failed to auto-join payer", "error", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	var resp struct {
		models.Session
		PayerID    uint   `json:"payerId,omitempty"`
		PayerToken string `json:"payerToken,omitempty"`
	}
	resp.Session = session
	resp.PayerID = payerID
	resp.PayerToken = payerToken
	json.NewEncoder(w).Encode(resp)
}

func (h *SessionHandler) ClaimItem(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	if sessionID == "" {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var payload struct {
		ParticipantID uint    `json:"participantId"`
		ItemID        string  `json:"itemId"`
		Shares        float64 `json:"shares"`
		Token         string  `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	tx := h.DB.WithContext(r.Context()).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var participant models.Participant
	if err := tx.First(&participant, payload.ParticipantID).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Participant not found", http.StatusNotFound)
		return
	}

	if participant.Token != payload.Token {
		tx.Rollback()
		http.Error(w, "Unauthorized claim verification token", http.StatusUnauthorized)
		return
	}

	var item models.Item
	if err := tx.First(&item, "id = ? AND session_id = ?", payload.ItemID, sessionID).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	var otherShares float64
	tx.Model(&models.Claim{}).
		Where("item_id = ? AND participant_id != ?", payload.ItemID, payload.ParticipantID).
		Select("COALESCE(SUM(shares), 0)").
		Row().
		Scan(&otherShares)

	if otherShares+payload.Shares > float64(item.Quantity) {
		tx.Rollback()
		http.Error(w, "Item quantity limit exceeded", http.StatusBadRequest)
		return
	}

	claim := models.Claim{
		ItemID:        payload.ItemID,
		ParticipantID: payload.ParticipantID,
		Shares:        payload.Shares,
	}

	var existing models.Claim
	err := tx.Where("item_id = ? AND participant_id = ?", claim.ItemID, claim.ParticipantID).First(&existing).Error
	if err == nil {
		existing.Shares = claim.Shares
		if err := tx.Save(&existing).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to update claim", http.StatusInternalServerError)
			return
		}
	} else {
		if err := tx.Create(&claim).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to create claim", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		http.Error(w, "Transaction commit failed", http.StatusInternalServerError)
		return
	}

	go h.broadcastFullState(context.WithoutCancel(r.Context()), sessionID)

	w.WriteHeader(http.StatusOK)
}

func (h *SessionHandler) JoinSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	if sessionID == "" {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var payload struct {
		Name  string `json:"name"`
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	trimmedName := payload.Name
	if trimmedName == "" {
		http.Error(w, "Name cannot be empty", http.StatusBadRequest)
		return
	}

	var existing models.Participant
	err := h.DB.WithContext(r.Context()).Where("session_id = ? AND name = ?", sessionID, trimmedName).First(&existing).Error
	if err == nil {
		if payload.Token != "" && existing.Token == payload.Token {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			var resp struct {
				ID        uint   `json:"id"`
				SessionID string `json:"sessionId"`
				Name      string `json:"name"`
				Token     string `json:"token"`
			}
			resp.ID = existing.ID
			resp.SessionID = existing.SessionID
			resp.Name = existing.Name
			resp.Token = existing.Token
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.Error(w, "Name already taken in this session", http.StatusConflict)
		return
	}

	newToken := uuid.New().String()
	participant := models.Participant{
		SessionID: sessionID,
		Name:      trimmedName,
		Token:     newToken,
	}

	if err := h.DB.WithContext(r.Context()).Create(&participant).Error; err != nil {
		http.Error(w, "Failed to join session", http.StatusInternalServerError)
		return
	}

	go h.broadcastFullState(context.WithoutCancel(r.Context()), sessionID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	var resp struct {
		ID        uint   `json:"id"`
		SessionID string `json:"sessionId"`
		Name      string `json:"name"`
		Token     string `json:"token"`
	}
	resp.ID = participant.ID
	resp.SessionID = participant.SessionID
	resp.Name = participant.Name
	resp.Token = participant.Token
	json.NewEncoder(w).Encode(resp)
}

func (h *SessionHandler) broadcastFullState(ctx context.Context, sessionID string) {
	var session models.Session
	err := h.DB.WithContext(ctx).Preload("Items").
		Preload("Items.Claims").
		Preload("Items.Claims.Participant").
		Preload("Participants").
		Preload("Participants.Claims").
		First(&session, "id = ?", sessionID).Error

	if err != nil {
		return
	}

	data, err := json.Marshal(session)
	if err != nil {
		return
	}

	h.Hub.Broadcast(string(data))
}

func (h *SessionHandler) GetSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "Missing session ID", http.StatusBadRequest)
		return
	}

	var session models.Session
	err := h.DB.WithContext(r.Context()).Preload("Items").
		Preload("Items.Claims").
		Preload("Items.Claims.Participant").
		Preload("Participants").
		Preload("Participants.Claims").
		First(&session, "id = ?", id).Error

	if err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}

func (h *SessionHandler) RenameItem(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	itemID := r.PathValue("itemId")
	if sessionID == "" || itemID == "" {
		http.Error(w, "Invalid parameters", http.StatusBadRequest)
		return
	}

	var payload struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if payload.Name == "" {
		http.Error(w, "Name cannot be empty", http.StatusBadRequest)
		return
	}

	var item models.Item
	err := h.DB.WithContext(r.Context()).Where("id = ? AND session_id = ?", itemID, sessionID).First(&item).Error
	if err != nil {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	item.Name = payload.Name
	if err := h.DB.WithContext(r.Context()).Save(&item).Error; err != nil {
		http.Error(w, "Failed to update item name", http.StatusInternalServerError)
		return
	}

	go h.broadcastFullState(context.WithoutCancel(r.Context()), sessionID)

	w.WriteHeader(http.StatusOK)
}

func (h *SessionHandler) DeleteParticipant(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	targetParticipantID := r.PathValue("participantId")
	callerToken := r.URL.Query().Get("token")

	if sessionID == "" || targetParticipantID == "" || callerToken == "" {
		http.Error(w, "Invalid parameters", http.StatusBadRequest)
		return
	}

	targetID, err := strconv.ParseUint(targetParticipantID, 10, 32)
	if err != nil {
		http.Error(w, "Invalid participant ID format", http.StatusBadRequest)
		return
	}

	var session models.Session
	if err := h.DB.WithContext(r.Context()).First(&session, "id = ?", sessionID).Error; err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	var payer models.Participant
	if err := h.DB.WithContext(r.Context()).Where("session_id = ? AND name = ?", sessionID, session.PayerName).First(&payer).Error; err != nil || payer.Token != callerToken {
		http.Error(w, "Unauthorized caller token", http.StatusUnauthorized)
		return
	}

	tx := h.DB.WithContext(r.Context()).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Where("participant_id = ?", targetID).Delete(&models.Claim{}).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to delete claims", http.StatusInternalServerError)
		return
	}

	if err := tx.Delete(&models.Participant{}, targetID).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to delete participant", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit().Error; err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	go h.broadcastFullState(context.WithoutCancel(r.Context()), sessionID)

	w.WriteHeader(http.StatusOK)
}
