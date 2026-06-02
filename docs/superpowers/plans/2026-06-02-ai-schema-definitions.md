# AI Service Standardized Schema Definitions Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement strict schema validation, retry logic, and calculation validation for AI receipt extraction in the backend.

**Architecture:** Create `backend/ai/schema.go` to define standard JSON output shapes. Create `backend/ai/client.go` to parse, validate (subtotal calculation matching sum of items), and implement retry wrapper. Create tests in `backend/ai/client_test.go` to verify correctness.

**Tech Stack:** Go (Golang) Standard Library (`encoding/json`, `math`, `fmt`, `testing`).

---

### Task 1: Define Schemas

**Files:**
- Create: `backend/ai/schema.go`

- [x] **Step 1: Write `backend/ai/schema.go`**
Define the standard schema structures `ExtractedItem` and `ExtractedReceipt`.

```go
package ai

type ExtractedItem struct {
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Quantity int     `json:"quantity"`
}

type ExtractedReceipt struct {
	Items         []ExtractedItem `json:"items"`
	Subtotal      float64         `json:"subtotal"`
	Tax           float64         `json:"tax"`
	ServiceCharge float64         `json:"service_charge"`
	GrandTotal    float64         `json:"grand_total"`
}
```

---

### Task 2: Implement Client Parser, Validator & Retry Wrapper

**Files:**
- Create: `backend/ai/client.go`

- [x] **Step 1: Write `backend/ai/client.go`**
Implement JSON parsing, calculation validation, and retry logic.

```go
package ai

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
)

var (
	ErrInvalidJSON       = errors.New("invalid JSON format")
	ErrCalculationMismatch = errors.New("subtotal mismatch with sum of items")
)

// Validate checks if the receipt parsed correctly and calculations are consistent.
func (r *ExtractedReceipt) Validate() error {
	sum := 0.0
	for _, item := range r.Items {
		sum += item.Price * float64(item.Quantity)
	}

	// Subtotal check (allow tiny epsilon for float comparisons)
	if math.Abs(r.Subtotal-sum) > 0.01 {
		return fmt.Errorf("%w: subtotal is %.2f, sum of items is %.2f", ErrCalculationMismatch, r.Subtotal, sum)
	}

	return nil
}

// ParseReceipt parses raw JSON bytes into ExtractedReceipt and validates the calculations.
func ParseReceipt(rawJSON []byte) (*ExtractedReceipt, error) {
	var receipt ExtractedReceipt
	if err := json.Unmarshal(rawJSON, &receipt); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidJSON, err)
	}

	if err := receipt.Validate(); err != nil {
		return nil, err
	}

	return &receipt, nil
}

// ParseReceiptWithRetry tries to parse and validate receipt.
// If it fails, it prints a retry message and retries up to maxRetries times.
func ParseReceiptWithRetry(rawJSON []byte, maxRetries int) (*ExtractedReceipt, error) {
	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		receipt, err := ParseReceipt(rawJSON)
		if err == nil {
			return receipt, nil
		}
		lastErr = err
		log.Printf("[AI Client] Parse attempt %d/%d failed: %v. Retrying...", attempt, maxRetries, err)
	}
	return nil, fmt.Errorf("parsing failed after %d attempts: %w", maxRetries, lastErr)
}
```

---

### Task 3: Write Unit Tests

**Files:**
- Create: `backend/ai/client_test.go`

- [x] **Step 1: Write `backend/ai/client_test.go`**
Implement unit tests covering correct JSON, mismatch JSON, corrupted JSON, and retry execution verification.

```go
package ai

import (
	"bytes"
	"log"
	"strings"
	"testing"
)

func TestParseReceipt_Success(t *testing.T) {
	raw := []byte(`{
		"items": [
			{"name": "Nasi Goreng", "price": 25000, "quantity": 2},
			{"name": "Es Teh", "price": 5000, "quantity": 3}
		],
		"subtotal": 65000,
		"tax": 7150,
		"service_charge": 3250,
		"grand_total": 75400
	}`)

	receipt, err := ParseReceipt(raw)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if len(receipt.Items) != 2 {
		t.Errorf("Expected 2 items, got %d", len(receipt.Items))
	}

	if receipt.Subtotal != 65000 {
		t.Errorf("Expected subtotal 65000, got %f", receipt.Subtotal)
	}
}

func TestParseReceipt_Mismatch(t *testing.T) {
	// 2 * 25000 + 3 * 5000 = 65000, but subtotal is declared as 60000
	raw := []byte(`{
		"items": [
			{"name": "Nasi Goreng", "price": 25000, "quantity": 2},
			{"name": "Es Teh", "price": 5000, "quantity": 3}
		],
		"subtotal": 60000,
		"tax": 7150,
		"service_charge": 3250,
		"grand_total": 70400
	}`)

	_, err := ParseReceipt(raw)
	if err == nil {
		t.Fatal("Expected error due to mismatch, but got nil")
	}

	if !strings.Contains(err.Error(), "subtotal mismatch") {
		t.Errorf("Expected mismatch error, got: %v", err)
	}
}

func TestParseReceipt_CorruptJSON(t *testing.T) {
	raw := []byte(`{ invalid json }`)

	_, err := ParseReceipt(raw)
	if err == nil {
		t.Fatal("Expected error due to corrupt JSON, but got nil")
	}
}

func TestParseReceiptWithRetry(t *testing.T) {
	// Capturing log output
	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(nil) // reset default behavior if needed, or just let test restore it

	// Test success path
	rawSuccess := []byte(`{
		"items": [{"name": "Item A", "price": 100, "quantity": 1}],
		"subtotal": 100,
		"tax": 10,
		"service_charge": 5,
		"grand_total": 115
	}`)
	_, err := ParseReceiptWithRetry(rawSuccess, 3)
	if err != nil {
		t.Fatalf("Expected success, got: %v", err)
	}

	// Test failure path triggering retries
	rawFail := []byte(`{ invalid json }`)
	_, err = ParseReceiptWithRetry(rawFail, 3)
	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	logContent := buf.String()
	logLines := strings.Count(logContent, "Parse attempt")
	if logLines != 3 {
		t.Errorf("Expected 3 retry attempts logged, got %d in logs:\n%s", logLines, logContent)
	}
}
```

---

### Task 4: Commit Code and Update TODO

- [x] **Step 1: Run all tests in the package**
Run: `go test ./...` in the backend directory.
Verify all tests pass.

- [x] **Step 2: Commit backend/ai/ changes**
Commit message: `"feat: define strict structs for AI output standardization"`

- [x] **Step 3: Update `TODO.md`**
Mark Task 3 as completed in `TODO.md` and commit with message `"docs: update TODO.md task 3 completed"`
