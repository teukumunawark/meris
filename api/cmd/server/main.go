package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/riandyrn/otelchi"

	"meris-backend/internal/modules/session"
	"meris-backend/internal/platform/config"
	"meris-backend/internal/platform/database"
	"meris-backend/internal/platform/httpserver"
	generated "meris-backend/internal/platform/httpserver/generated"
	"meris-backend/internal/platform/i18n"
	"meris-backend/internal/platform/logger"
	"meris-backend/internal/platform/redis"
	"meris-backend/internal/platform/sse"
	"meris-backend/internal/platform/telemetry"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	appLogger := logger.New(cfg.Env)
	slog.SetDefault(appLogger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	shutdownTele, err := telemetry.Init(ctx, "meris-api", cfg.Telemetry.OTLPEndpoint)
	if err != nil {
		slog.Error("Failed to initialize OpenTelemetry", "error", err)
	} else {
		defer func() {
			if err := shutdownTele(context.Background()); err != nil {
				slog.Error("Failed to shutdown telemetry", "error", err)
			}
		}()
	}

	if err := redis.InitRedis(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB); err != nil {
		slog.Error("Critical error initializing Redis", "error", err)
		os.Exit(1)
	}

	dbPool, err := database.Open(ctx, cfg.Database)
	if err != nil {
		slog.Error("Critical database initialization error", "error", err)
		os.Exit(1)
	}
	defer dbPool.Close()

	if err := database.RunMigrations(ctx, dbPool); err != nil {
		slog.Error("Database migrations failed", "error", err)
		os.Exit(1)
	}

	hub := sse.NewHub()

	repo := session.NewRepository(dbPool)
	svc := session.NewService(repo, hub)
	sessionHandler := session.NewHandler(svc)

	translator := i18n.NewTranslator()

	r := httpserver.NewRouter()
	r.Use(translator.Middleware)
	otelMW := otelchi.Middleware("meris-api", otelchi.WithChiRoutes(r))
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if req.URL.Path == "/healthz" || req.URL.Path == "/health" || req.URL.Path == "/metrics" || req.URL.Path == "/favicon.ico" || req.URL.Path == "/robots.txt" {
				next.ServeHTTP(w, req)
				return
			}
			otelMW(next).ServeHTTP(w, req)
		})
	})
	r.Use(httpserver.RequestLogger(appLogger))
	r.Use(httpserver.CORS(cfg.CORS.AllowedOrigins))

	httpserver.RegisterSystemRoutes(r, hub)

	sessionRateLimiter := httpserver.RateLimiter("session", 5, 8*time.Hour)

	openAPIServer := httpserver.NewOpenAPIServer(sessionHandler)
	generated.HandlerWithOptions(openAPIServer, generated.ChiServerOptions{
		BaseRouter: r,
		Middlewares: []generated.MiddlewareFunc{
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

	server := httpserver.New(
		cfg.HTTP.Addr,
		5*time.Second,
		cfg.HTTP.ReadTimeout,
		cfg.HTTP.WriteTimeout,
		cfg.HTTP.IdleTimeout,
		cfg.ShutdownTimeout,
		appLogger,
		r,
	)

	if err := server.Run(ctx); err != nil {
		slog.Error("Server exited with error", "error", err)
		os.Exit(1)
	}
}
