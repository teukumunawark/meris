package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"

	"meris-backend/internal/platform/database"
	"meris-backend/internal/platform/storage"
)

type Config struct {
	Env             string
	HTTP            HTTPConfig
	Database        database.Config
	Redis           RedisConfig
	AI              AIConfig
	Storage         storage.Config
	Telemetry       TelemetryConfig
	CORS            CORSConfig
	RateLimit       RateLimitConfig
	ShutdownTimeout time.Duration
}

type RateLimitConfig struct {
	SessionMax    int
	SessionWindow time.Duration
}

type HTTPConfig struct {
	Addr         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

type RedisConfig struct {
	URL      string
	Addr     string
	Password string
	DB       int
}

type TelemetryConfig struct {
	Enabled      bool
	OTLPEndpoint string
}

type AIConfig struct {
	APIKey          string
	Endpoint        string
	Model           string
	EscalationModel string
}

type CORSConfig struct {
	AllowedOrigins string
}

func Load() (Config, error) {
	if err := godotenv.Load(); err != nil {
		_ = godotenv.Load("../.env")
	}

	appEnv := getEnv("APP_ENV", "local")
	otlpEndpoint := getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
	isDevEnv := appEnv == "local" || appEnv == "dev" || appEnv == "development"
	otelEnabledDefault := !isDevEnv && otlpEndpoint != ""

	cfg := Config{
		Env: appEnv,
		HTTP: HTTPConfig{
			Addr:         getEnv("BIND_ADDRESS", "127.0.0.1") + ":" + getEnv("PORT", "8080"),
			ReadTimeout:  5 * time.Second,
			WriteTimeout: 0,
			IdleTimeout:  120 * time.Second,
		},
		Database: database.Config{
			RawURL:            getEnv("DATABASE_URL", ""),
			DirectURL:         getEnv("DATABASE_DIRECT_URL", ""),
			Host:              getEnv("DB_HOST", "localhost"),
			Port:              getEnv("DB_PORT", "5432"),
			User:              getEnv("DB_USER", "postgres"),
			Password:          getEnv("DB_PASSWORD", "password"),
			Name:              getEnv("DB_NAME", "merisdb"),
			Schema:            getEnv("DB_SCHEMA", "public"),
			SSLMode:           getEnv("DB_SSLMODE", "disable"),
			MaxConns:          25,
			MinConns:          5,
			MaxConnLifetime:   1 * time.Hour,
			MaxConnIdleTime:   30 * time.Minute,
			HealthCheckPeriod: 1 * time.Minute,
			ConnectTimeout:    5 * time.Second,
		},
		Redis: RedisConfig{
			URL:      getEnv("REDIS_URL", ""),
			Addr:     getEnv("REDIS_ADDR", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       0,
		},
		AI: AIConfig{
			APIKey:          getEnv("AI_API_KEY", ""),
			Endpoint:        getEnv("AI_ENDPOINT", ""),
			Model:           getEnv("AI_MODEL", "ag/gemini-3.8-flash-low"),
			EscalationModel: getEnv("AI_ESCALATION_MODEL", "ag/gemini-3.8-flash-high"),
		},
		Storage: storage.Config{
			Endpoint:       getEnv("S3_ENDPOINT", "http://localhost:9000"),
			PublicEndpoint: getEnv("S3_PUBLIC_ENDPOINT", "http://localhost:9000"),
			AccessKey:      getEnv("S3_ACCESS_KEY", "rustfsadmin"),
			SecretKey:      getEnv("S3_SECRET_KEY", "rustfsadmin"),
			Bucket:         getEnv("S3_BUCKET", "meris-receipts"),
			Region:         getEnv("S3_REGION", "us-east-1"),
			PresignExpiry:  24 * time.Hour,
		},
		Telemetry: TelemetryConfig{
			Enabled:      getBool("OTEL_ENABLED", otelEnabledDefault),
			OTLPEndpoint: otlpEndpoint,
		},
		CORS: CORSConfig{
			AllowedOrigins: getEnv("ALLOWED_ORIGINS", "*"),
		},
		RateLimit: RateLimitConfig{
			SessionMax:    5,
			SessionWindow: 8 * time.Hour,
		},
		ShutdownTimeout: 5 * time.Second,
	}

	var err error

	if cfg.RateLimit.SessionMax, err = getInt("RATE_LIMIT_SESSION_MAX", cfg.RateLimit.SessionMax); err != nil {
		return Config{}, err
	}

	if cfg.RateLimit.SessionWindow, err = getDuration("RATE_LIMIT_SESSION_WINDOW", cfg.RateLimit.SessionWindow); err != nil {
		return Config{}, err
	}

	if cfg.RateLimit.SessionMax < 0 {
		return Config{}, fmt.Errorf("RATE_LIMIT_SESSION_MAX must be 0 (off) or greater, got %d", cfg.RateLimit.SessionMax)
	}

	if cfg.RateLimit.SessionMax > 0 && cfg.RateLimit.SessionWindow <= 0 {
		return Config{}, fmt.Errorf("RATE_LIMIT_SESSION_WINDOW must be greater than zero, got %s", cfg.RateLimit.SessionWindow)
	}

	if cfg.Database.MaxConns, err = getInt32("DB_MAX_CONNS", cfg.Database.MaxConns); err != nil {
		return Config{}, err
	}

	if cfg.Database.MinConns, err = getInt32("DB_MIN_CONNS", cfg.Database.MinConns); err != nil {
		return Config{}, err
	}

	if redisDB, err := getInt("REDIS_DB", cfg.Redis.DB); err == nil {
		cfg.Redis.DB = redisDB
	}

	if cfg.Storage.PresignExpiry, err = getDuration("S3_PRESIGN_EXPIRY", cfg.Storage.PresignExpiry); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}

func getBool(key string, fallback bool) bool {
	raw, ok := os.LookupEnv(key)
	if !ok || raw == "" {
		return fallback
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return value
}

func getInt32(key string, fallback int32) (int32, error) {
	raw, ok := os.LookupEnv(key)
	if !ok || raw == "" {
		return fallback, nil
	}

	value, err := strconv.ParseInt(raw, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}

	return int32(value), nil
}

func getDuration(key string, fallback time.Duration) (time.Duration, error) {
	raw, ok := os.LookupEnv(key)
	if !ok || raw == "" {
		return fallback, nil
	}

	value, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}

	return value, nil
}

func getInt(key string, fallback int) (int, error) {
	raw, ok := os.LookupEnv(key)
	if !ok || raw == "" {
		return fallback, nil
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}

	return value, nil
}
