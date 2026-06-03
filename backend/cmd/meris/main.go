package main

import (
	"encoding/json"
	"log"
	"net/http"

	"meris-backend/internal/db"
	"meris-backend/internal/handlers"
	"meris-backend/internal/sse"
)

type HealthResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	response := HealthResponse{
		Status:  "OK",
		Message: "Meris Backend is running",
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding health check response: %v", err)
	}
}

func main() {
	database, err := db.InitDB()
	if err != nil {
		log.Fatalf("Critical error during database initialization: %v", err)
	}

	hub := sse.NewHub()
	sessionHandler := handlers.NewSessionHandler(hub, database)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthCheckHandler)
	mux.HandleFunc("POST /session", sessionHandler.CreateSession)
	mux.HandleFunc("GET /session/{id}", sessionHandler.GetSession)
	mux.HandleFunc("POST /session/{id}/join", sessionHandler.JoinSession)
	mux.HandleFunc("POST /session/{id}/claim", sessionHandler.ClaimItem)
	mux.HandleFunc("GET /stream", hub.StreamHandler)

	port := ":8080"
	log.Printf("Starting Meris Backend on port %s...", port)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
