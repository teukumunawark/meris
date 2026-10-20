package database

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"meris-backend/sql/migrations"
)

type GooseLogger struct {
	Log *slog.Logger
}

func (l *GooseLogger) Fatalf(format string, v ...any) {
	l.Log.Error(fmt.Sprintf(format, v...))
	os.Exit(1)
}

func (l *GooseLogger) Printf(format string, v ...any) {
	l.Log.Info(fmt.Sprintf(format, v...))
}

func RunMigrations(ctx context.Context, pool *pgxpool.Pool, directURL string) error {
	goose.SetBaseFS(migrations.FS)
	goose.SetLogger(&GooseLogger{Log: slog.Default()})

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}

	var db *sql.DB
	if directURL != "" {
		connConfig, err := pgx.ParseConfig(directURL)
		if err != nil {
			return fmt.Errorf("parse direct migration url: %w", err)
		}
		db = stdlib.OpenDB(*connConfig)
	} else {
		db = stdlib.OpenDBFromPool(pool)
	}
	defer func() { _ = db.Close() }()

	slog.Info("Running pending goose database migrations...")
	if err := goose.UpContext(ctx, db, "."); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}
	slog.Info("Database migrations completed successfully.")

	return nil
}
