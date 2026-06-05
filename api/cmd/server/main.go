package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/riandyrn/otelchi"

	"meris-backend/internal/modules/session"
	"meris-backend/internal/modules/session/openapi"
	"meris-backend/internal/platform/database"
	"meris-backend/internal/platform/logger"
	"meris-backend/internal/platform/middleware"
	"meris-backend/internal/platform/redis"
	"meris-backend/internal/platform/sse"
	"meris-backend/internal/platform/telemetry"
)

func main() {
	// Initialize logger
	logger.Init(os.Getenv("APP_ENV"), os.Getenv("LOG_LEVEL"))

	// Load configuration
	if err := godotenv.Load(); err != nil {
		if err := godotenv.Load("../.env"); err != nil {
			slog.Info("No .env file found, relying on system environment variables")
		}
	}

	// Create parent cancelable context
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Initialize OpenTelemetry
	otlpEndpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if otlpEndpoint == "" {
		otlpEndpoint = "alloy:4317"
	}
	shutdownTele, err := telemetry.Init(ctx, "meris-api", otlpEndpoint)
	if err != nil {
		slog.Error("Failed to initialize OpenTelemetry", "error", err)
	} else {
		defer func() {
			if err := shutdownTele(context.Background()); err != nil {
				slog.Error("Failed to shutdown telemetry", "error", err)
			}
		}()
	}

	// Initialize Redis
	if err := redis.InitRedis(); err != nil {
		slog.Error("Critical error initializing Redis", "error", err)
		os.Exit(1)
	}

	// Initialize Database Pool & Run Migrations
	dbPool, err := database.InitPool(ctx)
	if err != nil {
		slog.Error("Critical database initialization error", "error", err)
		os.Exit(1)
	}
	defer dbPool.Close()

	// Initialize SSE Hub
	hub := sse.NewHub()

	// Initialize Repository, Service, and HTTP Handler
	repo := session.NewRepository(dbPool)
	srv := session.NewService(repo, hub)
	h := session.NewHandler(srv)

	// Setup Router
	r := chi.NewRouter()

	// Middlewares
	r.Use(otelchi.Middleware("meris-api", otelchi.WithChiRoutes(r)))
	r.Use(middleware.RequestLogger)
	r.Use(middleware.CORS)

	// Rate limiters
	sessionRateLimiter := middleware.RateLimiter("session", 5, 8*time.Hour)

	// Register OpenAPI endpoints
	openapi.HandlerWithOptions(h, openapi.ChiServerOptions{
		BaseRouter: r,
		Middlewares: []openapi.MiddlewareFunc{
			func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
					if req.URL.Path == "/session" && req.Method == "POST" {
						sessionRateLimiter(next).ServeHTTP(w, req)
						return
					}
					next.ServeHTTP(w, req)
				})
			},
		},
	})

	// Add special/auxiliary endpoints manually (metrics and health check)
	r.Handle("/metrics", promhttp.Handler())
	r.HandleFunc("/stream", hub.StreamHandler)

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
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      0,
		IdleTimeout:       120 * time.Second,
	}

	// Start server in background
	go func() {
		slog.Info("Starting Meris Backend on " + bindAddr + ":" + port + "...")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown listener
	<-ctx.Done()
	slog.Info("Shutting down HTTP server gracefully...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server shutdown error", "error", err)
	}
	slog.Info("Server exit clean.")
}
