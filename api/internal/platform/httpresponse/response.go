package httpresponse

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"meris-backend/internal/apperrors"
	"meris-backend/internal/platform/i18n"

	i18nPkg "github.com/nicksnyder/go-i18n/v2/i18n"
)

const (
	statusClientClosedRequest = 499
	internalErrorCode         = "errors.internal_error"
	internalErrorFallback     = "An unexpected error occurred."
)

type ErrorBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(body); err != nil {
		http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
	}
}

func WriteError(w http.ResponseWriter, status int, code, message string) {
	WriteJSON(w, status, ErrorBody{
		Error:   code,
		Message: message,
	})
}

func DecodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(target); err != nil {
		return apperrors.NewInvalidRequestError(err)
	}

	return nil
}

func RespondError(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, context.Canceled) {
		slog.InfoContext(r.Context(), "request canceled by client", "method", r.Method, "path", r.URL.Path)
		w.WriteHeader(statusClientClosedRequest)
		return
	}

	appErr, ok := errors.AsType[*apperrors.AppError](err)
	if !ok {
		appErr = apperrors.NewAppError(internalErrorCode, nil, http.StatusInternalServerError, err)
	}

	if appErr.HTTPStatus >= http.StatusInternalServerError {
		slog.ErrorContext(r.Context(), "request failed",
			"method", r.Method,
			"path", r.URL.Path,
			"code", appErr.Code,
			"error", err,
		)
	}

	WriteError(w, appErr.HTTPStatus, appErr.Code, localizedMessage(r, appErr))
}

func localizedMessage(r *http.Request, appErr *apperrors.AppError) string {
	if localizer := i18n.GetLocalizer(r.Context()); localizer != nil {
		message, err := localizer.Localize(&i18nPkg.LocalizeConfig{
			MessageID:    appErr.Code,
			TemplateData: appErr.Params,
		})
		if err == nil {
			return message
		}
	}

	if appErr.HTTPStatus >= http.StatusInternalServerError {
		return internalErrorFallback
	}
	return http.StatusText(appErr.HTTPStatus)
}
