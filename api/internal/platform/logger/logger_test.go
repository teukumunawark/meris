package logger

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	"go.opentelemetry.io/otel/trace"
)

func newTestLogger(buf *bytes.Buffer) *slog.Logger {
	return slog.New(&traceHandler{Handler: slog.NewJSONHandler(buf, nil)})
}

func TestTraceHandlerAddsSpanIDs(t *testing.T) {
	traceID, _ := trace.TraceIDFromHex("0102030405060708090a0b0c0d0e0f10")
	spanID, _ := trace.SpanIDFromHex("0102030405060708")
	ctx := trace.ContextWithSpanContext(context.Background(), trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    traceID,
		SpanID:     spanID,
		TraceFlags: trace.FlagsSampled,
	}))

	var buf bytes.Buffer
	newTestLogger(&buf).InfoContext(ctx, "hello", "key", "value")

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("log line is not JSON: %v", err)
	}
	if got["trace_id"] != traceID.String() {
		t.Errorf("trace_id = %v, want %s", got["trace_id"], traceID)
	}
	if got["span_id"] != spanID.String() {
		t.Errorf("span_id = %v, want %s", got["span_id"], spanID)
	}
	if got["key"] != "value" {
		t.Errorf("original attribute lost: %v", got)
	}
}

func TestTraceHandlerWithoutSpanAddsNothing(t *testing.T) {
	var buf bytes.Buffer
	newTestLogger(&buf).Info("no span")

	var got map[string]any
	if err := json.Unmarshal(buf.Bytes(), &got); err != nil {
		t.Fatalf("log line is not JSON: %v", err)
	}
	if _, ok := got["trace_id"]; ok {
		t.Errorf("trace_id present without a span: %v", got)
	}
}

func TestTraceHandlerKeepsIDsThroughWithAttrs(t *testing.T) {
	traceID, _ := trace.TraceIDFromHex("0102030405060708090a0b0c0d0e0f10")
	spanID, _ := trace.SpanIDFromHex("0102030405060708")
	ctx := trace.ContextWithSpanContext(context.Background(), trace.NewSpanContext(trace.SpanContextConfig{
		TraceID: traceID,
		SpanID:  spanID,
	}))

	var buf bytes.Buffer
	newTestLogger(&buf).With("component", "test").WithGroup("g").InfoContext(ctx, "grouped")

	if !bytes.Contains(buf.Bytes(), []byte(traceID.String())) {
		t.Errorf("trace id missing after With/WithGroup: %s", buf.String())
	}
}
