package database

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"meris-backend/sql/migrations"
)

func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	goose.SetBaseFS(migrations.FS)

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}

	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()

	slog.Info("Running pending goose database migrations...")
	if err := goose.UpContext(ctx, db, "."); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}
	slog.Info("Database migrations completed successfully.")

	return nil
}
