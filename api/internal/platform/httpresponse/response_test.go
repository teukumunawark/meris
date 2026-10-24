package httpresponse

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"meris-backend/internal/apperrors"
	"meris-backend/internal/platform/i18n"
)

func captureLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	return &buf
}

func respond(t *testing.T, acceptLanguage string, err error) (*httptest.ResponseRecorder, ErrorBody) {
	t.Helper()
	handler := i18n.NewTranslator().Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		RespondError(w, r, err)
	}))

	req := httptest.NewRequest(http.MethodPost, "/session/s1/claim", nil)
	if acceptLanguage != "" {
		req.Header.Set("Accept-Language", acceptLanguage)
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	var body ErrorBody
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return w, body
}

func TestRespondErrorUsesTheAppErrorStatusCodeAndLanguage(t *testing.T) {
	logs := captureLogs(t)
	err := apperrors.NewAppError("errors.name_conflict", map[string]any{"name": "Budi"}, http.StatusConflict, nil)

	w, body := respond(t, "id-ID,id;q=0.9", err)
	if w.Code != http.StatusConflict || body.Error != "errors.name_conflict" {
		t.Fatalf("unexpected response %d %+v", w.Code, body)
	}
	if !strings.Contains(body.Message, "Budi") || !strings.Contains(body.Message, "sudah dipakai") {
		t.Errorf("expected the Indonesian message with the name, got %q", body.Message)
	}

	_, body = respond(t, "en-US", err)
	if !strings.Contains(body.Message, "already taken") {
		t.Errorf("expected the English message, got %q", body.Message)
	}
	if logs.Len() != 0 {
		t.Errorf("client errors belong to the request log, not the error log: %s", logs.String())
	}
}

func TestRespondErrorHidesUnexpectedErrorsButLogsThem(t *testing.T) {
	logs := captureLogs(t)
	cause := errors.New(`ERROR: relation "bills" does not exist (SQLSTATE 42P01) host=db.internal`)

	w, body := respond(t, "id", fmt.Errorf("create bill: %w", cause))

	if w.Code != http.StatusInternalServerError || body.Error != "errors.internal_error" {
		t.Fatalf("unexpected response %d %+v", w.Code, body)
	}
	if strings.Contains(w.Body.String(), "bills") || strings.Contains(w.Body.String(), "db.internal") {
		t.Errorf("internal details leaked to the client: %s", w.Body.String())
	}
	if !strings.Contains(body.Message, "Ada yang gagal") {
		t.Errorf("expected the localized generic message, got %q", body.Message)
	}

	var entry map[string]any
	if err := json.Unmarshal(logs.Bytes(), &entry); err != nil {
		t.Fatalf("expected one JSON log entry, got %q", logs.String())
	}
	if entry["level"] != "ERROR" || entry["path"] != "/session/s1/claim" || entry["code"] != "errors.internal_error" {
		t.Errorf("unexpected log entry %v", entry)
	}
	if !strings.Contains(fmt.Sprint(entry["error"]), "SQLSTATE 42P01") {
		t.Errorf("the full cause should be in the log, got %v", entry["error"])
	}
}

func TestRespondErrorLogsServerSideAppErrors(t *testing.T) {
	logs := captureLogs(t)
	err := apperrors.NewAppError("errors.receipt_service_unavailable", nil, http.StatusBadGateway, errors.New("upstream said key sk-123 is invalid"))

	w, body := respond(t, "en", err)

	if w.Code != http.StatusBadGateway || body.Error != "errors.receipt_service_unavailable" {
		t.Fatalf("unexpected response %d %+v", w.Code, body)
	}
	if strings.Contains(w.Body.String(), "sk-123") {
		t.Errorf("upstream detail leaked to the client: %s", w.Body.String())
	}
	if !strings.Contains(logs.String(), "sk-123") {
		t.Errorf("the upstream detail should be logged server-side: %s", logs.String())
	}
}

func TestRespondErrorTreatsCanceledRequestsAsClientClosed(t *testing.T) {
	logs := captureLogs(t)
	err := apperrors.NewAppError("errors.receipt_service_unavailable", nil, http.StatusBadGateway,
		fmt.Errorf("extract receipt: %w", context.Canceled))

	w, _ := respond(t, "id", err)

	if w.Code != statusClientClosedRequest {
		t.Errorf("expected %d, got %d", statusClientClosedRequest, w.Code)
	}
	if strings.Contains(logs.String(), `"level":"ERROR"`) {
		t.Errorf("a user leaving must not raise an error alert: %s", logs.String())
	}
}

func TestRespondErrorWithoutLocalizerFallsBackToStatusText(t *testing.T) {
	captureLogs(t)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	RespondError(w, req, apperrors.ErrMissingToken)

	var body ErrorBody
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if w.Code != http.StatusBadRequest || body.Message != "Bad Request" {
		t.Errorf("unexpected response %d %+v", w.Code, body)
	}
}

func TestDecodeJSONReturnsAClientError(t *testing.T) {
	var target struct {
		Name string `json:"name"`
	}
	for _, body := range []string{`{"name":`, `{"name":"a","extra":1}`, ``} {
		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		err := DecodeJSON(req, &target)

		appErr, ok := errors.AsType[*apperrors.AppError](err)
		if !ok || appErr.HTTPStatus != http.StatusBadRequest || appErr.Code != "errors.invalid_request" {
			t.Errorf("body %q: expected a 400 invalid_request, got %v", body, err)
		}
	}
}
