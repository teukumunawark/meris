package httpresponse

import (
	"encoding/json"
	"errors"
	"net/http"

	"meris-backend/internal/apperrors"
	"meris-backend/internal/platform/i18n"

	i18nPkg "github.com/nicksnyder/go-i18n/v2/i18n"
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
		return errors.New("request body must be valid JSON")
	}

	return nil
}

func WriteLocalizedError(w http.ResponseWriter, r *http.Request, err error) {
	localizer := i18n.GetLocalizer(r.Context())

	var appErr *apperrors.AppError
	if errors.As(err, &appErr) {
		message := ""
		if localizer != nil {
			msg, locErr := localizer.Localize(&i18nPkg.LocalizeConfig{
				MessageID:    appErr.Code,
				TemplateData: appErr.Params,
			})
			if locErr == nil {
				message = msg
			}
		}
		if message == "" {
			message = appErr.Error()
		}

		WriteError(w, appErr.HTTPStatus, appErr.Code, message)
		return
	}

	// Fallback for generic unexpected errors
	genericMsg := "An unexpected error occurred."
	if localizer != nil {
		msg, locErr := localizer.Localize(&i18nPkg.LocalizeConfig{
			MessageID: "errors.internal_error",
		})
		if locErr == nil {
			genericMsg = msg
		}
	}
	WriteError(w, http.StatusInternalServerError, "errors.internal_error", genericMsg)
}

