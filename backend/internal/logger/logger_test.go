package logger_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"meris-backend/internal/logger"
	"strings"
	"testing"
)

func TestInitProduction(t *testing.T) {
	var buf bytes.Buffer
	oldWriter := logger.OutputWriter
	logger.OutputWriter = &buf
	defer func() {
		logger.OutputWriter = oldWriter
	}()

	logger.Init("production", "info")

	slog.Info("test prod message")

	output := buf.String()
	if !strings.Contains(output, `"level":"INFO"`) {
		t.Errorf("expected level INFO in output, got: %s", output)
	}
	if !strings.Contains(output, `"msg":"test prod message"`) {
		t.Errorf("expected message in output, got: %s", output)
	}

	var data map[string]any
	if err := json.Unmarshal(buf.Bytes(), &data); err != nil {
		t.Errorf("expected output to be valid JSON, got error: %v", err)
	}
}

func TestInitDevelopment(t *testing.T) {
	var buf bytes.Buffer
	oldWriter := logger.OutputWriter
	logger.OutputWriter = &buf
	defer func() {
		logger.OutputWriter = oldWriter
	}()

	logger.Init("development", "debug")

	slog.Debug("test dev message")

	output := buf.String()
	if !strings.Contains(output, "level=DEBUG") {
		t.Errorf("expected level DEBUG in output, got: %s", output)
	}
	if !strings.Contains(output, "msg=\"test dev message\"") {
		t.Errorf("expected message in output, got: %s", output)
	}

	var data map[string]any
	if err := json.Unmarshal(buf.Bytes(), &data); err == nil {
		t.Errorf("expected output NOT to be valid JSON, but was successfully parsed")
	}
}

func TestRequestContextLogging(t *testing.T) {
	var buf bytes.Buffer
	oldWriter := logger.OutputWriter
	logger.OutputWriter = &buf
	defer func() {
		logger.OutputWriter = oldWriter
	}()

	logger.Init("production", "info")

	ctx := context.WithValue(context.Background(), logger.RequestIDKey, "test-req-12345")
	slog.InfoContext(ctx, "test request message")

	output := buf.String()
	if !strings.Contains(output, `"request_id":"test-req-12345"`) {
		t.Errorf("expected request_id in output, got: %s", output)
	}

	var data map[string]any
	if err := json.Unmarshal(buf.Bytes(), &data); err != nil {
		t.Fatalf("failed to parse JSON output: %v", err)
	}

	if data["request_id"] != "test-req-12345" {
		t.Errorf("expected request_id 'test-req-12345', got: %v", data["request_id"])
	}
}
