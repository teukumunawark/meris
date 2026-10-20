package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"

	"meris-backend/internal/platform/database"
)

type Config struct {
	Env             string
	HTTP            HTTPConfig
	Database        database.Config
	Redis           RedisConfig
	AI              AIConfig
	Telemetry       TelemetryConfig
	CORS            CORSConfig
	ShutdownTimeout time.Duration
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
	OTLPEndpoint string
}

type AIConfig struct {
	APIKey   string
	Endpoint string
	Model    string
}

type CORSConfig struct {
	AllowedOrigins string
}

func Load() (Config, error) {
	if err := godotenv.Load(); err != nil {
		if err := godotenv.Load("../.env"); err != nil {
			// Ignore if .env doesn't exist
		}
	}

	cfg := Config{
		Env: getEnv("APP_ENV", "local"),
		HTTP: HTTPConfig{
			Addr:         getEnv("BIND_ADDRESS", "127.0.0.1") + ":" + getEnv("PORT", "8080"),
			ReadTimeout:  5 * time.Second,
			WriteTimeout: 0, // Disable write timeout to support SSE streaming
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
			APIKey:   getEnv("AI_API_KEY", ""),
			Endpoint: getEnv("AI_ENDPOINT", ""),
			Model:    getEnv("AI_MODEL", "gemini-2.5-flash"),
		},
		Telemetry: TelemetryConfig{
			OTLPEndpoint: getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317"),
		},
		CORS: CORSConfig{
			AllowedOrigins: getEnv("ALLOWED_ORIGINS", "*"),
		},
		ShutdownTimeout: 5 * time.Second,
	}

	var err error

	if cfg.Database.MaxConns, err = getInt32("DB_MAX_CONNS", cfg.Database.MaxConns); err != nil {
		return Config{}, err
	}

	if cfg.Database.MinConns, err = getInt32("DB_MIN_CONNS", cfg.Database.MinConns); err != nil {
		return Config{}, err
	}

	if redisDB, err := getInt("REDIS_DB", cfg.Redis.DB); err == nil {
		cfg.Redis.DB = redisDB
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
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
