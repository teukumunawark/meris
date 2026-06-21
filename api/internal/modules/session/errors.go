package session

import (
	"errors"
	"meris-backend/internal/apperrors"
	"net/http"
)

var (
	ErrUnauthorized = apperrors.NewAppError("errors.unauthorized", nil, http.StatusUnauthorized, errors.New("unauthorized"))
)

func NewNameConflictError(name string) *apperrors.AppError {
	return apperrors.NewAppError(
		"errors.name_conflict",
		map[string]any{"name": name},
		http.StatusConflict,
		errors.New("name conflict"),
	)
}

func NewQuantityExceededError() *apperrors.AppError {
	return apperrors.NewAppError(
		"errors.quantity_exceeded",
		nil,
		http.StatusBadRequest,
		errors.New("claimed shares exceed available quantity"),
	)
}

func NewItemNotFoundError(itemId string) *apperrors.AppError {
	return apperrors.NewAppError(
		"errors.item_not_found",
		map[string]any{"itemId": itemId},
		http.StatusNotFound,
		errors.New("item not found"),
	)
}

func NewSessionNotFoundError(sessionId string) *apperrors.AppError {
	return apperrors.NewAppError(
		"errors.session_not_found",
		map[string]any{"sessionId": sessionId},
		http.StatusNotFound,
		errors.New("session not found"),
	)
}
