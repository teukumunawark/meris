package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
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
	payerBank := r.FormValue("payerBank")

	imageBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read image", http.StatusInternalServerError)
		return
	}

	extracted, err := ai.ExtractReceiptData(imageBytes)
	if err != nil {
		http.Error(w, "AI extraction failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	sessionID := uuid.New().String()
	session := models.Session{
		ID:            sessionID,
		PayerName:     payerName,
		PayerBank:     payerBank,
		Tax:           extracted.Tax,
		ServiceCharge: extracted.ServiceCharge,
		GrandTotal:    extracted.GrandTotal,
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

	if err := h.DB.Create(&session).Error; err != nil {
		http.Error(w, "Failed to save session", http.StatusInternalServerError)
		return
	}

	// Auto-join the payer as the first participant
	if payerName != "" {
		participant := models.Participant{
			SessionID: sessionID,
			Name:      payerName,
		}
		if err := h.DB.Create(&participant).Error; err != nil {
			// Non-critical error, log and continue
			log.Printf("Failed to auto-join payer: %v", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
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
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	claim := models.Claim{
		ItemID:        payload.ItemID,
		ParticipantID: payload.ParticipantID,
		Shares:        payload.Shares,
	}

	// Upsert: Find if claim already exists for this participant and item
	var existing models.Claim
	err := h.DB.Where("item_id = ? AND participant_id = ?", claim.ItemID, claim.ParticipantID).First(&existing).Error
	if err == nil {
		// Update
		existing.Shares = claim.Shares
		if err := h.DB.Save(&existing).Error; err != nil {
			http.Error(w, "Failed to update claim", http.StatusInternalServerError)
			return
		}
	} else {
		// Create
		if err := h.DB.Create(&claim).Error; err != nil {
			http.Error(w, "Failed to create claim", http.StatusInternalServerError)
			return
		}
	}

	// Trigger broadcast
	go h.broadcastFullState(sessionID)

	w.WriteHeader(http.StatusOK)
}

func (h *SessionHandler) JoinSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	if sessionID == "" {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var payload struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	participant := models.Participant{
		SessionID: sessionID,
		Name:      payload.Name,
	}

	if err := h.DB.Create(&participant).Error; err != nil {
		http.Error(w, "Failed to join session", http.StatusInternalServerError)
		return
	}

	// Trigger broadcast
	go h.broadcastFullState(sessionID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(participant)
}

func (h *SessionHandler) broadcastFullState(sessionID string) {
	var session models.Session
	err := h.DB.Preload("Items").
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
	err := h.DB.Preload("Items").
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
