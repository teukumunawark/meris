package ai

import (
	"strings"
	"testing"
)

func TestParseReceipt_Success(t *testing.T) {
	raw := []byte(`{
		"items": [
			{"name": "Nasi Goreng", "price": 25000.0, "quantity": 2},
			{"name": "Es Teh", "price": 5000.0, "quantity": 3}
		],
		"subtotal": 65000.0,
		"tax": 7150.0,
		"service_charge": 3250.0,
		"grand_total": 75400.0
	}`)

	receipt, err := ParseReceipt(raw)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if len(receipt.Items) != 2 {
		t.Errorf("Expected 2 items, got %d", len(receipt.Items))
	}

	if receipt.Subtotal != 65000.0 {
		t.Errorf("Expected subtotal 65000.0, got %f", receipt.Subtotal)
	}

	if receipt.Tax != 7150.0 {
		t.Errorf("Expected tax 7150.0, got %f", receipt.Tax)
	}

	if receipt.ServiceCharge != 3250.0 {
		t.Errorf("Expected service charge 3250.0, got %f", receipt.ServiceCharge)
	}

	if receipt.GrandTotal != 75400.0 {
		t.Errorf("Expected grand total 75400.0, got %f", receipt.GrandTotal)
	}
}

func TestParseReceipt_Mismatch(t *testing.T) {
	// Subtotal is 60000, but sum of items is 2*25000 + 3*5000 = 65000.
	raw := []byte(`{
		"items": [
			{"name": "Nasi Goreng", "price": 25000.0, "quantity": 2},
			{"name": "Es Teh", "price": 5000.0, "quantity": 3}
		],
		"subtotal": 60000.0,
		"tax": 7150.0,
		"service_charge": 3250.0,
		"grand_total": 70400.0
	}`)

	_, err := ParseReceipt(raw)
	if err == nil {
		t.Fatal("Expected mismatch error, got nil")
	}

	if !strings.Contains(err.Error(), "subtotal mismatch") {
		t.Errorf("Expected subtotal mismatch error message, got: %v", err)
	}
}

func TestParseReceipt_InvalidJSON(t *testing.T) {
	raw := []byte(`{ invalid json }`)

	_, err := ParseReceipt(raw)
	if err == nil {
		t.Fatal("Expected invalid JSON error, got nil")
	}

	if !strings.Contains(err.Error(), "invalid JSON format") {
		t.Errorf("Expected invalid JSON error message, got: %v", err)
	}
}

func TestParseReceipt_WithMarkdownBackticks(t *testing.T) {
	raw := []byte("```json\n{\n\t\"items\": [\n\t\t{\"name\": \"Nasi Goreng\", \"price\": 25000.0, \"quantity\": 2}\n\t],\n\t\"subtotal\": 50000.0,\n\t\"tax\": 5000.0,\n\t\"service_charge\": 2500.0,\n\t\"grand_total\": 57500.0\n}\n```")

	receipt, err := ParseReceipt(raw)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if len(receipt.Items) != 1 {
		t.Errorf("Expected 1 item, got %d", len(receipt.Items))
	}

	if receipt.Subtotal != 50000.0 {
		t.Errorf("Expected subtotal 50000.0, got %f", receipt.Subtotal)
	}
}

