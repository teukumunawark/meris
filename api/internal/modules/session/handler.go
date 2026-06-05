package session

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"meris-backend/internal/modules/session/openapi"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) GetHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "OK",
		"message": "Meris Backend is running",
	})
}

func (h *Handler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	// Handled by prometheus endpoint directly in main
}

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 5*1024*1024)

	file, _, err := r.FormFile("receipt")
	if err != nil {
		if err.Error() == "http: request body too large" || strings.Contains(err.Error(), "too large") {
			http.Error(w, "Upload size exceeded the 5MB limit", http.StatusRequestEntityTooLarge)
			return
		}
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

	contentType := http.DetectContentType(imageBytes)
	if !strings.HasPrefix(contentType, "image/") {
		http.Error(w, "Uploaded file must be a valid image", http.StatusBadRequest)
		return
	}

	session, _, _, payerID, payerToken, err := h.service.ExtractAndCreateSession(
		r.Context(),
		imageBytes,
		payerName,
		payerBankName,
		payerBankAccount,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	resp, err := h.service.GetCompiledSession(r.Context(), session.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	result := CreateSessionResult{CompiledSession: resp}
	if payerName != "" {
		result.PayerID = &payerID
		result.PayerToken = &payerToken
	}

	json.NewEncoder(w).Encode(result)
}

func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request, id string) {
	resp, err := h.service.GetCompiledSession(r.Context(), id)
	if err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) JoinSession(w http.ResponseWriter, r *http.Request, id string) {
	var payload struct {
		Name  string `json:"name"`
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	p, err := h.service.JoinSession(r.Context(), id, payload.Name, payload.Token)
	if err != nil {
		if errors.Is(err, ErrNameConflict) {
			http.Error(w, err.Error(), http.StatusConflict)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":        p.ID,
		"sessionId": p.SessionID,
		"name":      p.Name,
		"token":     p.Token,
	})
}

func (h *Handler) ClaimItem(w http.ResponseWriter, r *http.Request, id string) {
	var payload struct {
		ParticipantID uint    `json:"participantId"`
		ItemID        string  `json:"itemId"`
		Shares        float64 `json:"shares"`
		Token         string  `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	err := h.service.ClaimItem(r.Context(), id, payload.ParticipantID, payload.ItemID, payload.Shares, payload.Token)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			http.Error(w, err.Error(), http.StatusUnauthorized)
		} else if errors.Is(err, ErrQuantityExceeded) || errors.Is(err, ErrItemNotFound) {
			http.Error(w, err.Error(), http.StatusBadRequest)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) RenameItem(w http.ResponseWriter, r *http.Request, id string, itemId string) {
	var payload struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if payload.Name == "" {
		http.Error(w, "Name cannot be empty", http.StatusBadRequest)
		return
	}

	err := h.service.RenameItem(r.Context(), id, itemId, payload.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) DeleteParticipant(w http.ResponseWriter, r *http.Request, id string, participantId string, params openapi.DeleteParticipantParams) {
	callerToken := params.Token
	if callerToken == "" {
		http.Error(w, "Missing token parameter", http.StatusBadRequest)
		return
	}

	pID, err := strconv.ParseUint(participantId, 10, 32)
	if err != nil {
		http.Error(w, "Invalid participant ID", http.StatusBadRequest)
		return
	}

	err = h.service.DeleteParticipant(r.Context(), id, uint(pID), callerToken)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			http.Error(w, err.Error(), http.StatusUnauthorized)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) GetStream(w http.ResponseWriter, r *http.Request) {
	// Stream handler is bound directly to sse hub
}
