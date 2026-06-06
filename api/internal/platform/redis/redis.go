package redis

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/redis/go-redis/extra/redisotel/v9"
	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

func InitRedis(addr string, password string, db int) error {
	RDB = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

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
