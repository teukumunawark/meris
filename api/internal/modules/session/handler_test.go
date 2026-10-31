package session

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"meris-backend/internal/apperrors"
)

func captureLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	return &buf
}

func createMultipartRequest(t *testing.T, fieldName, fileName string, fileContent []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	if fieldName != "" {
		part, err := writer.CreateFormFile(fieldName, fileName)
		if err != nil {
			t.Fatalf("failed to create form file: %v", err)
		}
		if _, err := io.Copy(part, bytes.NewReader(fileContent)); err != nil {
			t.Fatalf("failed to write content: %v", err)
		}
	}

	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/session", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func TestReadReceiptImage_ValidImage(t *testing.T) {
	h := &Handler{}
	pngHeader := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x00, 0x00, 0x00, 0x0d, 'I', 'H', 'D', 'R'}

	req := createMultipartRequest(t, "receipt", "receipt.png", pngHeader)
	w := httptest.NewRecorder()

	imageBytes, err := h.readReceiptImage(w, req)
	if err != nil {
		t.Fatalf("expected readReceiptImage to succeed, got %v", err)
	}

	if !bytes.Equal(imageBytes, pngHeader) {
		t.Errorf("expected imageBytes to match input")
	}
}

func TestReadReceiptImage_Rejections(t *testing.T) {
	cases := []struct {
		name       string
		field      string
		content    []byte
		want       *apperrors.AppError
		wantStatus int
	}{
		{"missing file", "wrong_field", []byte("data"), ErrInvalidFile, http.StatusBadRequest},
		{"not an image", "receipt", []byte("plain text content which is not an image"), ErrNotAnImage, http.StatusBadRequest},
		{"over the size limit", "receipt", make([]byte, maxReceiptUploadSize+1024), ErrFileTooLarge, http.StatusRequestEntityTooLarge},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := &Handler{}
			req := createMultipartRequest(t, tc.field, "receipt.png", tc.content)

			_, err := h.readReceiptImage(httptest.NewRecorder(), req)

			if !errors.Is(err, tc.want) {
				t.Fatalf("expected %s, got %v", tc.want.Code, err)
			}
			appErr, _ := errors.AsType[*apperrors.AppError](err)
			if appErr.HTTPStatus != tc.wantStatus {
				t.Errorf("expected status %d, got %d", tc.wantStatus, appErr.HTTPStatus)
			}
		})
	}
}

func TestGetSession_DatabaseFailureIsNotReportedAsNotFound(t *testing.T) {
	logs := captureLogs(t)
	pool, err := pgxpool.New(context.Background(), "postgres://meris:secret@127.0.0.1:1/meris?connect_timeout=1")
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}
	t.Cleanup(pool.Close)
	h := NewHandler(NewService(NewRepository(pool), nil))

	req := httptest.NewRequest(http.MethodGet, "/session/abc", nil)
	w := httptest.NewRecorder()
	h.GetSession(w, req, "abc")

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for an unreachable database, got %d: %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "session_not_found") {
		t.Errorf("a database failure must not look like a missing session: %s", w.Body.String())
	}
	if strings.Contains(w.Body.String(), "127.0.0.1") || strings.Contains(w.Body.String(), "secret") {
		t.Errorf("connection details leaked to the client: %s", w.Body.String())
	}
	if !strings.Contains(logs.String(), "fetch session abc") {
		t.Errorf("expected the cause in the server log, got %s", logs.String())
	}
}

func TestFetchSessionError(t *testing.T) {
	notFound := fetchSessionError("abc", pgx.ErrNoRows)
	if !errors.Is(notFound, NewSessionNotFoundError("abc")) {
		t.Errorf("no rows should become session not found, got %v", notFound)
	}

	dbDown := errors.New("connection refused")
	got := fetchSessionError("abc", dbDown)
	if errors.Is(got, NewSessionNotFoundError("abc")) {
		t.Errorf("other failures must not become session not found")
	}
	if !errors.Is(got, dbDown) {
		t.Errorf("the original error should stay reachable for logging, got %v", got)
	}
}

func TestDeleteWithoutTokenIsRejectedBeforeTheService(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest(http.MethodDelete, "/session/s1/item/i1", nil)
	w := httptest.NewRecorder()

	h.executeDelete(w, req, "", func() error { t.Fatal("service must not be called"); return nil })

	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "errors.missing_token") {
		t.Errorf("expected 400 errors.missing_token, got %d %s", w.Code, w.Body.String())
	}
}

func TestJoinSession_RejectsBlankName(t *testing.T) {
	h := &Handler{}

	for _, body := range []string{`{"name":""}`, `{"name":"   "}`} {
		req := httptest.NewRequest(http.MethodPost, "/session/s1/join", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		h.JoinSession(w, req, "s1")

		if w.Code != http.StatusBadRequest {
			t.Errorf("body %s: expected status %d, got %d", body, http.StatusBadRequest, w.Code)
		}
		if !strings.Contains(w.Body.String(), "errors.invalid_name") {
			t.Errorf("body %s: expected errors.invalid_name in response, got %s", body, w.Body.String())
		}
	}
}

func TestRenameParticipant_RejectsBadInput(t *testing.T) {
	h := &Handler{}

	cases := []struct {
		name          string
		participantID string
		body          string
		wantCode      string
	}{
		{"non-numeric participant ID", "abc", `{"name":"Andika","token":"t"}`, "errors.invalid_id"},
		{"malformed JSON", "7", `{"name":`, "errors.invalid_request"},
		{"empty name", "7", `{"name":"","token":"t"}`, "errors.invalid_name"},
		{"whitespace-only name", "7", `{"name":"   ","token":"t"}`, "errors.invalid_name"},
		{"missing token", "7", `{"name":"Andika"}`, "errors.missing_token"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPut, "/session/s1/participant/"+tc.participantID+"/name", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			h.RenameParticipant(w, req, "s1", tc.participantID)

			if w.Code != http.StatusBadRequest {
				t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
			}
			if !strings.Contains(w.Body.String(), tc.wantCode) {
				t.Errorf("expected %s in response, got %s", tc.wantCode, w.Body.String())
			}
		})
	}
}

func TestHandleJSON(t *testing.T) {
	type payload struct {
		Name string `json:"name"`
	}
	post := func(body string, call func(payload) error) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		w := httptest.NewRecorder()
		handleJSON(w, req, http.StatusCreated, call)
		return w
	}

	t.Run("success uses the given status", func(t *testing.T) {
		w := post(`{"name":"Andi"}`, func(p payload) error {
			if p.Name != "Andi" {
				t.Errorf("payload not decoded, got %+v", p)
			}
			return nil
		})
		if w.Code != http.StatusCreated {
			t.Errorf("expected 201, got %d", w.Code)
		}
	})

	t.Run("malformed body never reaches the service", func(t *testing.T) {
		w := post(`{"name":`, func(payload) error { t.Fatal("service must not be called"); return nil })
		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "errors.invalid_request") {
			t.Errorf("expected 400 errors.invalid_request, got %d %s", w.Code, w.Body.String())
		}
	})

	t.Run("domain errors keep their status", func(t *testing.T) {
		w := post(`{"name":"Andi"}`, func(payload) error { return ErrUnauthorized })
		if w.Code != http.StatusUnauthorized || !strings.Contains(w.Body.String(), "errors.unauthorized") {
			t.Errorf("expected 401 errors.unauthorized, got %d %s", w.Code, w.Body.String())
		}
	})

	t.Run("unexpected errors become a generic 500", func(t *testing.T) {
		captureLogs(t)
		w := post(`{"name":"Andi"}`, func(payload) error { return errors.New("pq: deadlock detected") })
		if w.Code != http.StatusInternalServerError || strings.Contains(w.Body.String(), "deadlock") {
			t.Errorf("expected a generic 500, got %d %s", w.Code, w.Body.String())
		}
	})
}

func TestRescanBill_RejectsMissingToken(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest(http.MethodPost, "/session/s1/bill/b1/rescan", strings.NewReader(`{"token":"   "}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.RescanBill(w, req, "s1", "b1")

	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "errors.missing_token") {
		t.Errorf("expected 400 errors.missing_token, got %d %s", w.Code, w.Body.String())
	}
}
