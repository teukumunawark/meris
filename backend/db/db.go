package db

import (
	"fmt"
	"log"
	"os"
	"meris-backend/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=meris password=password dbname=merisdb port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate models
	err = db.AutoMigrate(&models.Session{}, &models.Participant{}, &models.Item{}, &models.Claim{})
	if err != nil {
		log.Fatalf("Failed to auto-migrate: %v", err)
	}

	DB = db
	fmt.Println("Database initialized and migrated.")
}
