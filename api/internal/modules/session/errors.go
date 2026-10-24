package session

import (
	"errors"
	"meris-backend/internal/apperrors"
	"net/http"
)

var (
	ErrUnauthorized      = apperrors.NewAppError("errors.unauthorized", nil, http.StatusUnauthorized, errors.New("unauthorized"))
	ErrBillNotFound      = apperrors.NewAppError("errors.bill_not_found", nil, http.StatusNotFound, errors.New("bill not found"))
	ErrCannotRemoveOwner = apperrors.NewAppError("errors.cannot_remove_owner", nil, http.StatusConflict, errors.New("cannot remove the session payer"))
	ErrFileTooLarge      = apperrors.NewAppError("errors.file_too_large", nil, http.StatusRequestEntityTooLarge, errors.New("receipt upload exceeds the size limit"))
	ErrInvalidFile       = apperrors.NewAppError("errors.invalid_file", nil, http.StatusBadRequest, errors.New("receipt file missing from the request"))
	ErrNotAnImage        = apperrors.NewAppError("errors.invalid_content_type", nil, http.StatusBadRequest, errors.New("receipt file is not an image"))
)

func NewReceiptServiceError(cause error) *apperrors.AppError {
	return apperrors.NewAppError("errors.receipt_service_unavailable", nil, http.StatusBadGateway, cause)
}

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

func NewUnreadableReceiptError() *apperrors.AppError {
	return apperrors.NewAppError(
		"errors.receipt_unreadable",
		nil,
		http.StatusUnprocessableEntity,
		errors.New("no readable items on the receipt"),
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
