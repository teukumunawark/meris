package apperrors

import (
	"errors"
	"fmt"
	"net/http"
)

type AppError struct {
	Code       string
	Params     map[string]any
	HTTPStatus int
	Err        error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %v", e.Code, e.Err)
	}
	return fmt.Sprintf("[%s]", e.Code)
}

func (e *AppError) Unwrap() error {
	return e.Err
}

func (e *AppError) Is(target error) bool {
	other, ok := target.(*AppError)
	return ok && other.Code == e.Code
}

func NewAppError(code string, params map[string]any, httpStatus int, err error) *AppError {
	return &AppError{
		Code:       code,
		Params:     params,
		HTTPStatus: httpStatus,
		Err:        err,
	}
}

func NewInvalidRequestError(cause error) *AppError {
	return NewAppError("errors.invalid_request", nil, http.StatusBadRequest, cause)
}

var (
	ErrMissingToken = NewAppError("errors.missing_token", nil, http.StatusBadRequest, errors.New("missing token"))
	ErrInvalidID    = NewAppError("errors.invalid_id", nil, http.StatusBadRequest, errors.New("invalid id"))
	ErrInvalidName  = NewAppError("errors.invalid_name", nil, http.StatusBadRequest, errors.New("name cannot be empty"))
)
