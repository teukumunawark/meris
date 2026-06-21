package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

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

	dbPool, err := database.Open(ctx, cfg.Database)
	if err != nil {
		slog.Error("Critical database initialization error", "error", err)
		os.Exit(1)
	}
	defer dbPool.Close()

	goose.SetBaseFS(migrations.FS)

	if err := goose.SetDialect("postgres"); err != nil {
		slog.Error("Failed to set goose dialect", "error", err)
		os.Exit(1)
	}

	db := stdlib.OpenDBFromPool(dbPool)
	defer db.Close()

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
		slog.Error(fmt.Sprintf("Goose command %s failed", command), "error", err)
		os.Exit(1)
	}

	slog.Info(fmt.Sprintf("Goose command %s completed successfully.", command))
}
