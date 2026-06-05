package database

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/exaring/otelpgx"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"meris-backend/sql/migrations"
)

// InitPool initializes a connection pool and executes goose migrations programmatically
func InitPool(ctx context.Context) (*pgxpool.Pool, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=password dbname=merisdb port=5432 sslmode=disable"
	}

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	// Read connection pool parameters from environment with defaults
	maxConns := 25
	if mc, err := strconv.Atoi(os.Getenv("DB_MAX_CONNS")); err == nil && mc > 0 {
		maxConns = mc
	}
	minConns := 5
	if mc, err := strconv.Atoi(os.Getenv("DB_MIN_CONNS")); err == nil && mc >= 0 {
		minConns = mc
	}

	config.MaxConns = int32(maxConns)
	config.MinConns = int32(minConns)
	config.MaxConnLifetime = 1 * time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	// OpenTelemetry tracing setup
	config.ConnConfig.Tracer = otelpgx.NewTracer()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create pgxpool: %w", err)
	}

	// Verify connections
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}

	slog.Info("Database connection pool initialized successfully.")

	// Execute migrations
	if err := runMigrations(pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	return pool, nil
}

func runMigrations(pool *pgxpool.Pool) error {
	// Goose requires stdlib sql.DB
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()

	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}

	slog.Info("Running pending goose database migrations...")
	if err := goose.Up(db, "."); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}
	slog.Info("Database migrations completed successfully.")
	return nil
}
