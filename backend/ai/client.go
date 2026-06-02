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

// Validate checks if the receipt calculations are consistent.
// It checks that Subtotal is close to the sum of all items (Price * Quantity).
func (r *ExtractedReceipt) Validate() error {
	var sum float64
	for _, item := range r.Items {
		sum += item.Price * float64(item.Quantity)
	}

	// Subtotal check (allow epsilon of 0.01 for float comparisons)
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

// ParseReceiptWithRetry tries to parse and validate a receipt.
// If it fails, it simulates a retry by printing a retry message and trying again.
// In a real API context, this would invoke the AI API call again with the input.
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
