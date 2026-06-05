# End-to-End Meris Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the end-to-end flow for Meris, from receipt upload to AI extraction, database persistence, and real-time claim synchronization via SSE using Full State Snapshots.

**Architecture:** 
- **Persistence:** GORM with PostgreSQL for normalized data storage (Sessions, Participants, Items, Claims).
- **AI Extraction:** Xiaomi MiMo API (OpenAI-compatible) integrated via a custom Go client to extract structured receipt data from images.
- **Real-time Sync:** Server-Sent Events (SSE) broadcasting a "Full State Snapshot" (entire session state) on every claim update to ensure consistency across all clients.

**Tech Stack:** Go (GORM, net/http), PostgreSQL, Next.js, Xiaomi MiMo API.

---

### Task 1: Setup GORM Models and Connection

**Files:**
- Modify: `backend/go.mod`
- Create: `backend/models/models.go`
- Create: `backend/db/db.go`

- [ ] **Step 1: Install GORM dependencies**
Run in `backend` directory:
```bash
go get -u gorm.io/gorm gorm.io/driver/postgres
```

- [ ] **Step 2: Define GORM Models**
Create `backend/models/models.go`:
```go
package models

import (
	"time"
)

type Session struct {
	ID            string    `gorm:"primaryKey;type:varchar(50)" json:"id"`
	Tax           float64   `json:"tax"`
	ServiceCharge float64   `json:"serviceCharge"`
	GrandTotal    float64   `json:"grandTotal"`
	CreatedAt     time.Time `json:"createdAt"`
	Items         []Item    `gorm:"foreignKey:SessionID" json:"items"`
}

type Participant struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	SessionID string `gorm:"index;type:varchar(50)" json:"sessionId"`
	Name      string `json:"name"`
	Claims    []Claim `gorm:"foreignKey:ParticipantID" json:"claims"`
}

type Item struct {
	ID        string  `gorm:"primaryKey;type:varchar(50)" json:"id"`
	SessionID string  `gorm:"index;type:varchar(50)" json:"sessionId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
	Claims    []Claim `gorm:"foreignKey:ItemID" json:"claims"`
}

type Claim struct {
	ID            uint        `gorm:"primaryKey" json:"id"`
	ItemID        string      `gorm:"index;type:varchar(50)" json:"itemId"`
	ParticipantID uint        `gorm:"index" json:"participantId"`
	Participant   Participant `gorm:"foreignKey:ParticipantID" json:"participant"`
	Shares        float64     `json:"shares"`
}
```

- [ ] **Step 3: Implement Database Connection**
Create `backend/db/db.go`:
```go
package db

import (
	"fmt"
	"log"
	"os"
	"split-bill-backend/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=splitbill password=password dbname=splitbilldb port=5432 sslmode=disable"
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
```

- [ ] **Step 4: Commit**
```bash
git add backend/go.mod backend/models/models.go backend/db/db.go
git commit -m "feat: setup GORM models and postgres connection"
```

---

### Task 2: Implement Xiaomi MiMo AI Client

**Files:**
- Modify: `backend/ai/client.go`
- Modify: `backend/ai/schema.go`

- [ ] **Step 1: Update `backend/ai/client.go` with MiMo implementation**
Implement the client to call `platform.xiaomimimo.com` using OpenAI-compatible payload and `api-key` header.

```go
package ai

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type MiMoRequest struct {
	Model    string        `json:"model"`
	Messages []MiMoMessage `json:"messages"`
}

type MiMoMessage struct {
	Role    string        `json:"role"`
	Content []MiMoContent `json:"content"`
}

type MiMoContent struct {
	Type     string         `json:"type"`
	Text     string         `json:"text,omitempty"`
	ImageURL *MiMoImageURL `json:"image_url,omitempty"`
}

type MiMoImageURL struct {
	URL string `json:"url"`
}

func ExtractReceiptData(imageBytes []byte) (*ExtractedReceipt, error) {
	apiKey := os.Getenv("MIMO_API_KEY")
	endpoint := os.Getenv("MIMO_ENDPOINT") // e.g., https://token-plan-sgp.xiaomimimo.com/v1/chat/completions

	base64Image := base64.StdEncoding.EncodeToString(imageBytes)
	dataURL := fmt.Sprintf("data:image/jpeg;base64,%s", base64Image)

	prompt := `Extract receipt items, prices, quantities, subtotal, tax, and service_charge. 
	Return valid JSON following this schema: 
	{"items": [{"name": string, "price": number, "quantity": number}], "subtotal": number, "tax": number, "service_charge": number, "grand_total": number}`

	payload := MiMoRequest{
		Model: "mimo-v2.5-pro",
		Messages: []MiMoMessage{
			{
				Role: "user",
				Content: []MiMoContent{
					{Type: "text", Text: prompt},
					{Type: "image_url", ImageURL: &MiMoImageURL{URL: dataURL}},
				},
			},
		},
	}

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	
	// Parse OpenAI-style response
	var completion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &completion); err != nil {
		return nil, err
	}

	if len(completion.Choices) == 0 {
		return nil, fmt.Errorf("no choices returned from AI")
	}

	return ParseReceipt([]byte(completion.Choices[0].Message.Content))
}
```

- [ ] **Step 2: Commit**
```bash
git add backend/ai/client.go
git commit -m "feat: implement Xiaomi MiMo AI client for receipt extraction"
```

---

### Task 3: Implement Backend API Endpoints

**Files:**
- Create: `backend/handlers/session.go`
- Modify: `backend/main.go`

- [ ] **Step 1: Create Session Handler (`POST /session`)**
Implement logic to receive image, call AI, and save to GORM.

- [ ] **Step 2: Update `backend/main.go` to use DB and new routes**
Initialize DB and register handlers.

- [ ] **Step 3: Commit**
```bash
git add backend/handlers backend/main.go
git commit -m "feat: implement session creation and claim endpoints"
```

---

### Task 4: Frontend Landing Page Upload & Client-Side Compression

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Install browser-image-compression**
Run in `frontend` directory:
```bash
npm install browser-image-compression
```

- [ ] **Step 2: Implement Compression and Upload Logic in `page.tsx`**
Update the upload input to compress the image before sending `FormData` to the new `POST /session` backend endpoint.

```tsx
// Inside frontend/src/app/page.tsx
import imageCompression from 'browser-image-compression';

// ... existing code ...
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const options = {
                              maxSizeMB: 1,
                              maxWidthOrHeight: 1600,
                              useWebWorker: true
                            };
                            const compressedFile = await imageCompression(file, options);
                            
                            const formData = new FormData();
                            formData.append("receipt", compressedFile);
                            
                            const response = await fetch("http://localhost:8080/session", {
                              method: "POST",
                              body: formData,
                            });
                            
                            if (response.ok) {
                              const data = await response.json();
                              router.push(`/session/${data.id}`);
                            } else {
                              console.error("Upload failed");
                            }
                          } catch (error) {
                            console.error("Error compressing/uploading image:", error);
                          }
                        }
                      }}
// ... existing code ...
```

- [ ] **Step 3: Commit**
```bash
git add frontend/package.json frontend/package-lock.json frontend/src/app/page.tsx
git commit -m "feat: implement client-side image compression and connect upload API"
```
