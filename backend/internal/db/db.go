package db

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"
	"meris-backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

type GormSlogLogger struct {
	LogLevel gormlogger.LogLevel
}

func (l *GormSlogLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	newLogger := *l
	newLogger.LogLevel = level
	return &newLogger
}

func (l *GormSlogLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= gormlogger.Info {
		slog.InfoContext(ctx, fmt.Sprintf(msg, data...))
	}
}

func (l *GormSlogLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= gormlogger.Warn {
		slog.WarnContext(ctx, fmt.Sprintf(msg, data...))
	}
}

func (l *GormSlogLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= gormlogger.Error {
		slog.ErrorContext(ctx, fmt.Sprintf(msg, data...))
	}
}

func (l *GormSlogLogger) Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	if l.LogLevel <= gormlogger.Silent {
		return
	}
	elapsed := time.Since(begin)
	sql, rows := fc()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if l.LogLevel >= gormlogger.Warn {
				slog.WarnContext(ctx, "database record not found", "sql", sql, "rows", rows, "error", err, "elapsed", elapsed)
			}
		} else {
			if l.LogLevel >= gormlogger.Error {
				slog.ErrorContext(ctx, "database query error", "sql", sql, "rows", rows, "error", err, "elapsed", elapsed)
			}
		}
		return
	}
	if elapsed > 200*time.Millisecond {
		if l.LogLevel >= gormlogger.Warn {
			slog.WarnContext(ctx, "slow database query", "sql", sql, "rows", rows, "elapsed", elapsed)
		}
		return
	}
	if l.LogLevel >= gormlogger.Info {
		slog.DebugContext(ctx, "database query", "sql", sql, "rows", rows, "elapsed", elapsed)
	}
}

func InitDB() (*gorm.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=meris password=password dbname=merisdb port=5432 sslmode=disable"
	}

	var level gormlogger.LogLevel
	env := os.Getenv("APP_ENV")
	if env == "production" || env == "prod" {
		level = gormlogger.Error
	} else {
		level = gormlogger.Info
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: &GormSlogLogger{LogLevel: level},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	err = db.AutoMigrate(&models.Session{}, &models.Participant{}, &models.Item{}, &models.Claim{})
	if err != nil {
		return nil, fmt.Errorf("failed to auto-migrate: %w", err)
	}

	slog.Info("Database initialized and migrated.")
	return db, nil
}
