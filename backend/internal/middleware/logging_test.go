package middleware_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"meris-backend/internal/logger"
	"meris-backend/internal/middleware"
)

type logRecord struct {
	Level     string  `json:"level"`
	Msg       string  `json:"msg"`
	RequestID string  `json:"request_id"`
	Method    string  `json:"method"`
	Path      string  `json:"path"`
	Status    int     `json:"status"`
	Latency   float64 `json:"latency"`
}

func TestRequestLogger_WithRequestIDHeader(t *testing.T) {
	var buf bytes.Buffer
	oldWriter := logger.OutputWriter
	logger.OutputWriter = &buf
	defer func() {
		logger.OutputWriter = oldWriter
	}()

	logger.Init("production", "info")

	var capturedCtx context.Context
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedCtx = r.Context()
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte("ok"))
	})

	mw := middleware.RequestLogger(nextHandler)
	req := httptest.NewRequest(http.MethodPost, "/test-path", nil)
	req.Header.Set("X-Request-ID", "custom-req-id")
	rec := httptest.NewRecorder()

	mw.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Errorf("expected status %d, got %d", http.StatusAccepted, rec.Code)
	}

	if capturedCtx == nil {
		t.Fatal("expected non-nil captured context")
	}

	reqID, ok := capturedCtx.Value(logger.RequestIDKey).(string)
	if !ok || reqID != "custom-req-id" {
		t.Errorf("expected request ID 'custom-req-id' in context, got %v", reqID)
	}

	decoder := json.NewDecoder(&buf)
	var records []logRecord
	for {
		var rec logRecord
		if err := decoder.Decode(&rec); err == io.EOF {
			break
		} else if err != nil {
			t.Fatalf("failed to decode log line: %v", err)
		}
		records = append(records, rec)
	}

	if len(records) != 2 {
		t.Fatalf("expected 2 log records, got %d", len(records))
	}

	if records[0].Msg != "HTTP request started" {
		t.Errorf("expected first log message 'HTTP request started', got '%s'", records[0].Msg)
	}
	if records[0].RequestID != "custom-req-id" {
		t.Errorf("expected first log request_id 'custom-req-id', got '%s'", records[0].RequestID)
	}
	if records[0].Method != "POST" {
		t.Errorf("expected first log method 'POST', got '%s'", records[0].Method)
	}
	if records[0].Path != "/test-path" {
		t.Errorf("expected first log path '/test-path', got '%s'", records[0].Path)
	}

	if records[1].Msg != "HTTP request completed" {
		t.Errorf("expected second log message 'HTTP request completed', got '%s'", records[1].Msg)
	}
	if records[1].RequestID != "custom-req-id" {
		t.Errorf("expected second log request_id 'custom-req-id', got '%s'", records[1].RequestID)
	}
	if records[1].Method != "POST" {
		t.Errorf("expected second log method 'POST', got '%s'", records[1].Method)
	}
	if records[1].Path != "/test-path" {
		t.Errorf("expected second log path '/test-path', got '%s'", records[1].Path)
	}
	if records[1].Status != http.StatusAccepted {
		t.Errorf("expected second log status %d, got %d", http.StatusAccepted, records[1].Status)
	}
}

func TestRequestLogger_GeneratedRequestID(t *testing.T) {
	var buf bytes.Buffer
	oldWriter := logger.OutputWriter
	logger.OutputWriter = &buf
	defer func() {
		logger.OutputWriter = oldWriter
	}()

	logger.Init("production", "info")

	var capturedCtx context.Context
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedCtx = r.Context()
	})

	mw := middleware.RequestLogger(nextHandler)
	req := httptest.NewRequest(http.MethodGet, "/another-path", nil)
	rec := httptest.NewRecorder()

	mw.ServeHTTP(rec, req)

	if capturedCtx == nil {
		t.Fatal("expected non-nil captured context")
	}

	reqID, ok := capturedCtx.Value(logger.RequestIDKey).(string)
	if !ok || reqID == "" {
		t.Errorf("expected non-empty request ID generated in context, got %v", reqID)
	}

	decoder := json.NewDecoder(&buf)
	var records []logRecord
	for {
		var rec logRecord
		if err := decoder.Decode(&rec); err == io.EOF {
			break
		} else if err != nil {
			t.Fatalf("failed to decode log line: %v", err)
		}
		records = append(records, rec)
	}

	if len(records) != 2 {
		t.Fatalf("expected 2 log records, got %d", len(records))
	}

	if records[0].RequestID != reqID {
		t.Errorf("expected first log request_id '%s', got '%s'", reqID, records[0].RequestID)
	}
	if records[1].RequestID != reqID {
		t.Errorf("expected second log request_id '%s', got '%s'", reqID, records[1].RequestID)
	}
}

func TestRequestLogger_DefaultStatusCode(t *testing.T) {
	var buf bytes.Buffer
	oldWriter := logger.OutputWriter
	logger.OutputWriter = &buf
	defer func() {
		logger.OutputWriter = oldWriter
	}()

	logger.Init("production", "info")

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("default 200 ok"))
	})

	mw := middleware.RequestLogger(nextHandler)
	req := httptest.NewRequest(http.MethodGet, "/default-status", nil)
	rec := httptest.NewRecorder()

	mw.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	decoder := json.NewDecoder(&buf)
	var records []logRecord
	for {
		var rec logRecord
		if err := decoder.Decode(&rec); err == io.EOF {
			break
		} else if err != nil {
			t.Fatalf("failed to decode log line: %v", err)
		}
		records = append(records, rec)
	}

	if len(records) != 2 {
		t.Fatalf("expected 2 log records, got %d", len(records))
	}

	if records[1].Status != http.StatusOK {
		t.Errorf("expected second log status %d, got %d", http.StatusOK, records[1].Status)
	}
}

type mockFlusherResponseWriter struct {
	http.ResponseWriter
	flushed bool
}

func (m *mockFlusherResponseWriter) Flush() {
	m.flushed = true
}

func TestRequestLogger_FlusherAndHeader(t *testing.T) {
	var buf bytes.Buffer
	oldWriter := logger.OutputWriter
	logger.OutputWriter = &buf
	defer func() {
		logger.OutputWriter = oldWriter
	}()

	logger.Init("production", "info")

	mockRec := httptest.NewRecorder()
	mockWriter := &mockFlusherResponseWriter{
		ResponseWriter: mockRec,
	}

	var assertFlushed bool
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Error("expected wrapped writer to implement http.Flusher")
			return
		}
		flusher.Flush()
		assertFlushed = true
	})

	mw := middleware.RequestLogger(nextHandler)
	req := httptest.NewRequest(http.MethodGet, "/sse", nil)
	req.Header.Set("X-Request-ID", "sse-req-id")

	mw.ServeHTTP(mockWriter, req)

	if !assertFlushed {
		t.Error("expected handler to run and detect http.Flusher")
	}

	if !mockWriter.flushed {
		t.Error("expected underlying Flush to have been called")
	}

	if gotHeader := mockRec.Header().Get("X-Request-ID"); gotHeader != "sse-req-id" {
		t.Errorf("expected X-Request-ID header to be 'sse-req-id', got '%s'", gotHeader)
	}
}

