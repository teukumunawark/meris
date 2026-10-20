package main

import (
	"context"
	"database/sql"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"meris-backend/internal/platform/config"
	"meris-backend/internal/platform/database"
	"meris-backend/internal/platform/logger"
	"meris-backend/sql/migrations"
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

	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	goose.SetBaseFS(migrations.FS)
	goose.SetLogger(&database.GooseLogger{Log: appLogger})

	if err := goose.SetDialect("postgres"); err != nil {
		slog.Error("Failed to set goose dialect", "error", err)
		os.Exit(1)
	}

	var db *sql.DB
	if cfg.Database.DirectURL != "" {
		connConfig, err := pgx.ParseConfig(cfg.Database.DirectURL)
		if err != nil {
			slog.Error("Failed to parse direct migration url", "error", err)
			os.Exit(1)
		}
		db = stdlib.OpenDB(*connConfig)
	} else {
		dbPool, err := database.Open(ctx, cfg.Database)
		if err != nil {
			slog.Error("Critical database initialization error", "error", err)
			os.Exit(1)
		}
		defer dbPool.Close()
		db = stdlib.OpenDBFromPool(dbPool)
	}
	defer func() { _ = db.Close() }()

	slog.Info("Running goose command", "command", command)
	switch command {
	case "up":
		err = goose.UpContext(ctx, db, ".")
	case "down":
		err = goose.DownContext(ctx, db, ".")
	case "status":
		err = goose.StatusContext(ctx, db, ".")
	default:
		slog.Error("Unknown command, supported: up, down, status", "command", command)
		os.Exit(1)
	}

	if err != nil {
		slog.Error("Goose command failed", "command", command, "error", err)
		os.Exit(1)
	}

	slog.Info("Goose command completed successfully", "command", command)
}
