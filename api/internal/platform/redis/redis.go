package redis

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/redis/go-redis/extra/redisotel/v9"
	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

func InitRedis() error {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return fmt.Errorf("failed to parse redis url: %w", err)
	}

	RDB = redis.NewClient(opt)

	if err := redisotel.InstrumentTracing(RDB); err != nil {
		slog.Error("Failed to instrument Redis with OTel", "error", err)
	}

	ctx := context.Background()
	if err := RDB.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to ping redis: %w", err)
	}

	slog.Info("Redis initialized successfully.")
	return nil
}
