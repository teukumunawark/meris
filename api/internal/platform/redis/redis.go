package redis

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/redis/go-redis/extra/redisotel/v9"
	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

func InitRedis(rawURL, addr, password string, db int) error {
	var opt *redis.Options
	if rawURL != "" {
		var err error
		opt, err = redis.ParseURL(rawURL)
		if err != nil {
			return fmt.Errorf("failed to parse redis url: %w", err)
		}
	} else {
		opt = &redis.Options{
			Addr:     addr,
			Password: password,
			DB:       db,
		}
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
