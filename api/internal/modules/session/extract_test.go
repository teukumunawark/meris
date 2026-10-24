package session

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"meris-backend/internal/apperrors"
	"meris-backend/internal/platform/ai"
)

func configureAIProvider(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	ai.SetConfig(ai.Config{Endpoint: server.URL, Model: "test/fast", EscalationModel: "test/fast"})
	t.Cleanup(func() { ai.SetConfig(ai.Config{}) })
}

func TestExtractReceiptTurnsUnreadableIntoLocalizedError(t *testing.T) {
	configureAIProvider(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"merchant_name\":\"\",\"items\":[],\"charges\":[],\"printed_subtotal\":0,\"grand_total\":0}"}}]}`))
	})

	_, err := extractReceipt(context.Background(), []byte("fake-image"))

	appErr, ok := errors.AsType[*apperrors.AppError](err)
	if !ok {
		t.Fatalf("expected an AppError, got %v", err)
	}
	if appErr.Code != "errors.receipt_unreadable" || appErr.HTTPStatus != http.StatusUnprocessableEntity {
		t.Errorf("expected a 422 receipt_unreadable error, got %s %d", appErr.Code, appErr.HTTPStatus)
	}
}

func TestExtractReceiptTurnsProviderFailureIntoBadGateway(t *testing.T) {
	configureAIProvider(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":{"message":"model overloaded, key sk-secret"}}`))
	})

	_, err := extractReceipt(context.Background(), []byte("fake-image"))

	appErr, ok := errors.AsType[*apperrors.AppError](err)
	if !ok {
		t.Fatalf("expected an AppError, got %v", err)
	}
	if appErr.Code != "errors.receipt_service_unavailable" || appErr.HTTPStatus != http.StatusBadGateway {
		t.Errorf("expected a 502 receipt_service_unavailable error, got %s %d", appErr.Code, appErr.HTTPStatus)
	}
	if !errors.Is(err, NewReceiptServiceError(nil)) {
		t.Errorf("the error should match the receipt service sentinel by code")
	}
}
