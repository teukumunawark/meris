package db

import (
	"fmt"
	"os"
	"meris-backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func InitDB() (*gorm.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=meris password=password dbname=merisdb port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Auto-migrate models
	err = db.AutoMigrate(&models.Session{}, &models.Participant{}, &models.Item{}, &models.Claim{})
	if err != nil {
		return nil, fmt.Errorf("failed to auto-migrate: %w", err)
	}

	fmt.Println("Database initialized and migrated.")
	return db, nil
}
