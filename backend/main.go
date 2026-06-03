package main

import (
	"encoding/json"
	"log"
	"net/http"

	"meris-backend/db"
	"meris-backend/handlers"
	"meris-backend/sse"
)

type HealthResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

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
	db.InitDB()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthCheckHandler)
	mux.HandleFunc("/session", handlers.CreateSession)

	hub := sse.NewHub()
	mux.HandleFunc("/stream", hub.StreamHandler)

	port := ":8080"
	log.Printf("Starting health check and SSE server on port %s...", port)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
