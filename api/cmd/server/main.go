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
	otelchimetric "github.com/riandyrn/otelchi/metric"

	"meris-backend/internal/modules/session"
	"meris-backend/internal/platform/ai"
	"meris-backend/internal/platform/config"
	"meris-backend/internal/platform/database"
	"meris-backend/internal/platform/httpserver"
	generated "meris-backend/internal/platform/httpserver/generated"
	"meris-backend/internal/platform/i18n"
	"meris-backend/internal/platform/logger"
	"meris-backend/internal/platform/redis"
	"meris-backend/internal/platform/sse"
	"meris-backend/internal/platform/storage"
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

	ai.SetConfig(ai.Config{
		APIKey:          cfg.AI.APIKey,
		Endpoint:        cfg.AI.Endpoint,
		Model:           cfg.AI.Model,
		EscalationModel: cfg.AI.EscalationModel,
	})

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	shutdownTele, err := telemetry.Init(ctx, "meris-api", cfg.Env, cfg.Telemetry.OTLPEndpoint, cfg.Telemetry.Enabled)
	if err != nil {
		slog.Error("Failed to initialize OpenTelemetry", "error", err)
	} else {
		defer func() {
			if err := shutdownTele(context.Background()); err != nil {
				slog.Error("Failed to shutdown telemetry", "error", err)
			}
		}()
	}

	if err := redis.InitRedis(cfg.Redis.URL, cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB); err != nil {
		slog.Error("Critical error initializing Redis", "error", err)
		os.Exit(1)
	}

	dbPool, err := database.Open(ctx, cfg.Database)
	if err != nil {
		slog.Error("Critical database initialization error", "error", err)
		os.Exit(1)
	}
	defer dbPool.Close()

	if err := database.RunMigrations(ctx, dbPool, cfg.Database.DirectURL); err != nil {
		slog.Error("Database migrations failed", "error", err)
		os.Exit(1)
	}

	hub := sse.NewHub()

	storageClient, err := storage.NewClient(cfg.Storage)
	if err != nil {
		slog.Error("Invalid object storage configuration", "error", err)
		os.Exit(1)
	}
	if storageClient != nil {
		if err := storageClient.EnsureBucket(ctx); err != nil {
			slog.Warn("Could not ensure object storage bucket at startup", "bucket", cfg.Storage.Bucket, "error", err)
		} else {
			slog.Info("Object storage initialized", "endpoint", cfg.Storage.Endpoint, "bucket", cfg.Storage.Bucket)
		}
	}

	repo := session.NewRepository(dbPool)
	svc := session.NewService(repo, hub).WithStorage(storageClient)
	sessionHandler := session.NewHandler(svc)

	translator := i18n.NewTranslator()

	r := httpserver.NewRouter()
	r.Use(translator.Middleware)
	otelMW := otelchi.Middleware("meris-api", otelchi.WithChiRoutes(r))
	durationMW := otelchimetric.NewServerRequestDuration(otelchimetric.NewBaseConfig("meris-api"))
	r.Use(func(next http.Handler) http.Handler {
		instrumented := durationMW(otelMW(next))
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if req.URL.Path == "/healthz" || req.URL.Path == "/health" || req.URL.Path == "/metrics" || req.URL.Path == "/favicon.ico" || req.URL.Path == "/robots.txt" {
				next.ServeHTTP(w, req)
				return
			}
			instrumented.ServeHTTP(w, req)
		})
	})
	r.Use(httpserver.RequestLogger(appLogger))
	r.Use(httpserver.CORS(cfg.CORS.AllowedOrigins))

	httpserver.RegisterSystemRoutes(r, hub)

	sessionRateLimiter := httpserver.RateLimiter("session", cfg.RateLimit.SessionMax, cfg.RateLimit.SessionWindow)
	slog.Info("Session rate limiter configured", "max", cfg.RateLimit.SessionMax, "window", cfg.RateLimit.SessionWindow.String())

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
