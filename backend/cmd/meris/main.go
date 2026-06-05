package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"

	"meris-backend/internal/db"
	"meris-backend/internal/handlers"
	"meris-backend/internal/logger"
	"meris-backend/internal/middleware"
	"meris-backend/internal/redis"
	"meris-backend/internal/sse"

	"github.com/joho/godotenv"
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
		slog.InfoContext(r.Context(), "Error encoding health check response", "error", err)
	}
}

func main() {
	logger.Init(os.Getenv("APP_ENV"), os.Getenv("LOG_LEVEL"))

	if err := godotenv.Load(); err != nil {
		slog.Info("No .env file found, relying on system environment variables")
	}

	if err := redis.InitRedis(); err != nil {
		slog.Error("Critical error during Redis initialization", "error", err)
		os.Exit(1)
	}

	database, err := db.InitDB()
	if err != nil {
		slog.Error("Critical error during database initialization", "error", err)
		os.Exit(1)
	}

	hub := sse.NewHub()
	sessionHandler := handlers.NewSessionHandler(hub, database)

	sessionRateLimiter := middleware.RateLimiter("session", 5, 8*time.Hour)
	generalRateLimiter := middleware.RateLimiter("general", 100, 1*time.Minute)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthCheckHandler)
	mux.Handle("POST /session", sessionRateLimiter(http.HandlerFunc(sessionHandler.CreateSession)))
	mux.HandleFunc("GET /session/{id}", sessionHandler.GetSession)
	mux.HandleFunc("POST /session/{id}/join", sessionHandler.JoinSession)
	mux.HandleFunc("POST /session/{id}/claim", sessionHandler.ClaimItem)
	mux.HandleFunc("PUT /session/{id}/item/{itemId}/rename", sessionHandler.RenameItem)
	mux.HandleFunc("DELETE /session/{id}/participant/{participantId}", sessionHandler.DeleteParticipant)
	mux.HandleFunc("GET /stream", hub.StreamHandler)

	handlerWithLogging := middleware.RequestLogger(handlers.CORS(generalRateLimiter(mux)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	bindAddr := os.Getenv("BIND_ADDRESS")
	if bindAddr == "" {
		bindAddr = "127.0.0.1"
	}

	server := &http.Server{
		Addr:              bindAddr + ":" + port,
		Handler:           handlerWithLogging,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      0,
		IdleTimeout:       120 * time.Second,
	}

	slog.Info("Starting Meris Backend on " + bindAddr + ":" + port + "...")
	if err := server.ListenAndServe(); err != nil {
		slog.Error("Server failed to start", "error", err)
		os.Exit(1)
	}
}
