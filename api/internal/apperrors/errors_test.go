package apperrors

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
)

func TestIsMatchesByCode(t *testing.T) {
	sentinel := NewAppError("errors.quantity_exceeded", nil, http.StatusBadRequest, errors.New("exceeded"))
	rebuilt := NewAppError("errors.quantity_exceeded", map[string]any{"itemId": "i1"}, http.StatusBadRequest, nil)
	other := NewAppError("errors.unauthorized", nil, http.StatusUnauthorized, nil)

	if !errors.Is(rebuilt, sentinel) {
		t.Error("errors built later with the same code should match the sentinel")
	}
	if !errors.Is(fmt.Errorf("claim item: %w", rebuilt), sentinel) {
		t.Error("wrapping must not hide the code")
	}
	if errors.Is(other, sentinel) {
		t.Error("different codes must not match")
	}
	if errors.Is(errors.New("quantity_exceeded"), sentinel) {
		t.Error("a plain error must not match an AppError")
	}
}

func TestUnwrapExposesTheCause(t *testing.T) {
	cause := errors.New("connection reset")
	err := NewAppError("errors.receipt_service_unavailable", nil, http.StatusBadGateway, cause)

	if !errors.Is(err, cause) {
		t.Error("the underlying cause should stay reachable")
	}
}

func TestInvalidRequestKeepsDecodeError(t *testing.T) {
	cause := errors.New(`json: unknown field "foo"`)
	err := NewInvalidRequestError(cause)

	if err.HTTPStatus != http.StatusBadRequest || err.Code != "errors.invalid_request" {
		t.Errorf("unexpected error %+v", err)
	}
	if !errors.Is(err, cause) {
		t.Error("the decode error should be kept for debugging")
	}
}
