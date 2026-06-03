package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"meris-backend/ai"
	"meris-backend/db"
	"meris-backend/models"
	"github.com/google/uuid"
)

func CreateSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	file, _, err := r.FormFile("receipt")
	if err != nil {
		http.Error(w, "Invalid receipt image", http.StatusBadRequest)
		return
	}
	defer file.Close()

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

	if err := db.DB.Create(&session).Error; err != nil {
		http.Error(w, "Failed to save session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}
