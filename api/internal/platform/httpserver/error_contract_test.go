package httpserver

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"meris-backend/internal/apperrors"
	"meris-backend/internal/modules/session"
	"meris-backend/internal/platform/httpresponse"
	"meris-backend/internal/platform/i18n"
)

func allAppErrors() []*apperrors.AppError {
	return []*apperrors.AppError{
		session.ErrUnauthorized,
		session.ErrBillNotFound,
		session.ErrCannotRemoveOwner,
		session.ErrFileTooLarge,
		session.ErrInvalidFile,
		session.ErrNotAnImage,
		session.NewReceiptServiceError(errors.New("upstream")),
		session.NewUnreadableReceiptError(),
		session.NewNameConflictError("Budi"),
		session.NewQuantityExceededError(),
		session.NewItemNotFoundError("i1"),
		session.NewSessionNotFoundError("s1"),
		apperrors.ErrMissingToken,
		apperrors.ErrInvalidID,
		apperrors.ErrInvalidName,
		apperrors.NewInvalidRequestError(errors.New("bad json")),
		ErrTooManyRequests,
	}
}

func TestEveryAppErrorIsTranslatedInBothLanguages(t *testing.T) {
	translator := i18n.NewTranslator()

	for _, appErr := range allAppErrors() {
		for _, lang := range []string{"id", "en"} {
			t.Run(appErr.Code+"/"+lang, func(t *testing.T) {
				handler := translator.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					httpresponse.RespondError(w, r, appErr)
				}))
				req := httptest.NewRequest(http.MethodGet, "/", nil)
				req.Header.Set("Accept-Language", lang)
				w := httptest.NewRecorder()
				handler.ServeHTTP(w, req)

				var body httpresponse.ErrorBody
				if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
					t.Fatalf("response is not the JSON error contract: %q", w.Body.String())
				}
				if w.Code != appErr.HTTPStatus || body.Error != appErr.Code {
					t.Errorf("expected %d %s, got %d %s", appErr.HTTPStatus, appErr.Code, w.Code, body.Error)
				}
				if body.Message == "" || body.Message == http.StatusText(appErr.HTTPStatus) || body.Message == "An unexpected error occurred." {
					t.Errorf("%s has no %s translation, got %q", appErr.Code, lang, body.Message)
				}
			})
		}
	}
}

func TestRateLimitedResponseUsesTheJSONErrorContract(t *testing.T) {
	handler := i18n.NewTranslator().Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		httpresponse.RespondError(w, r, ErrTooManyRequests)
	}))
	req := httptest.NewRequest(http.MethodPost, "/session", nil)
	req.Header.Set("Accept-Language", "id")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests || w.Header().Get("Content-Type") != "application/json" {
		t.Errorf("expected a JSON 429, got %d %q", w.Code, w.Header().Get("Content-Type"))
	}
}
