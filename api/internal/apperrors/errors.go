package apperrors

import (
	"fmt"
)

type AppError struct {
	Code       string         // Translation Key, e.g. "errors.unauthorized"
	Params     map[string]any // Interpolation parameters, e.g. {"name": "John"}
	HTTPStatus int            // Status code mapping, e.g. 404
	Err        error          // Internal original error for server logs
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

func NewAppError(code string, params map[string]any, httpStatus int, err error) *AppError {
	return &AppError{
		Code:       code,
		Params:     params,
		HTTPStatus: httpStatus,
		Err:        err,
	}
}
