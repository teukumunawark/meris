package ai

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
)

var (
	ErrInvalidJSON         = errors.New("invalid JSON format")
	ErrCalculationMismatch = errors.New("subtotal mismatch with sum of items")
)

func (r *ExtractedReceipt) Validate() error {
	var sum float64
	for _, item := range r.Items {
		sum += item.Price * float64(item.Quantity)
	}

	if math.Abs(r.Subtotal-sum) > 0.01 {
		return fmt.Errorf("%w: subtotal is %.2f, sum of items is %.2f", ErrCalculationMismatch, r.Subtotal, sum)
	}

	return nil
}

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

func ParseReceiptWithRetry(rawJSON []byte, maxRetries int) (*ExtractedReceipt, error) {
	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		receipt, err := ParseReceipt(rawJSON)
		if err == nil {
			return receipt, nil
		}
		lastErr = err
		log.Printf("[AI Client] Parsing failed (Attempt %d/%d): %v. Retrying API call...", attempt, maxRetries, err)
	}
	return nil, fmt.Errorf("parsing failed after %d attempts: %w", maxRetries, lastErr)
}
