package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestExtractReceiptData_EmptyEndpoint(t *testing.T) {
	origEndpoint := os.Getenv("AI_ENDPOINT")
	origAPIKey := os.Getenv("AI_API_KEY")
	defer func() {
		os.Setenv("AI_ENDPOINT", origEndpoint)
		os.Setenv("AI_API_KEY", origAPIKey)
	}()

	os.Setenv("AI_ENDPOINT", "")
	os.Setenv("AI_API_KEY", "test-key")

	_, err := ExtractReceiptData(context.Background(), []byte("fake-image"))
	if err == nil {
		t.Fatal("expected error with empty endpoint, got nil")
	}

	expectedErr := "AI_ENDPOINT environment variable is not set"
	if !strings.Contains(err.Error(), expectedErr) {
		t.Errorf("expected error containing %q, got %v", expectedErr, err)
	}
}

func TestExtractReceiptData_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"choices": [{
				"message": {
					"content": "{\"items\": [{\"name\": \"item1\", \"price\": 100, \"quantity\": 1}], \"subtotal\": 100, \"tax\": 0, \"service_charge\": 0, \"grand_total\": 100}"
				}
			}]
		}`))
	}))
	defer server.Close()

	origEndpoint := os.Getenv("AI_ENDPOINT")
	origAPIKey := os.Getenv("AI_API_KEY")
	defer func() {
		os.Setenv("AI_ENDPOINT", origEndpoint)
		os.Setenv("AI_API_KEY", origAPIKey)
	}()

	os.Setenv("AI_ENDPOINT", server.URL)
	os.Setenv("AI_API_KEY", "test-key")

	receipt, err := ExtractReceiptData(context.Background(), []byte("fake-image"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if receipt.Subtotal != 100 {
		t.Errorf("expected subtotal 100, got %f", receipt.Subtotal)
	}
}

func TestExtractReceiptData_Hierarchical(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"choices": [{
				"message": {
					"content": "{\"items\": [{\"name\": \"Parent\", \"price\": 100, \"quantity\": 1, \"sub_items\": [{\"name\": \"Child\", \"price\": 0, \"quantity\": 1}]}], \"subtotal\": 100, \"tax\": 0, \"service_charge\": 0, \"grand_total\": 100}"
				}
			}]
		}`))
	}))
	defer server.Close()

	origEndpoint := os.Getenv("AI_ENDPOINT")
	origAPIKey := os.Getenv("AI_API_KEY")
	defer func() {
		os.Setenv("AI_ENDPOINT", origEndpoint)
		os.Setenv("AI_API_KEY", origAPIKey)
	}()

	os.Setenv("AI_ENDPOINT", server.URL)
	os.Setenv("AI_API_KEY", "test-key")

	receipt, err := ExtractReceiptData(context.Background(), []byte("fake-image"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(receipt.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(receipt.Items))
	}

	parent := receipt.Items[0]
	if parent.Name != "Parent" {
		t.Errorf("expected parent name 'Parent', got %s", parent.Name)
	}

	if len(parent.SubItems) != 1 {
		t.Fatalf("expected 1 sub-item, got %d", len(parent.SubItems))
	}

	child := parent.SubItems[0]
	if child.Name != "Child" {
		t.Errorf("expected child name 'Child', got %s", child.Name)
	}
}
