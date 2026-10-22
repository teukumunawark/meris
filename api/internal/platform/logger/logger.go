package logger

import (
	"context"
	"log/slog"
	"os"

	"go.opentelemetry.io/otel/trace"
)

// New returns the application logger. Logs go to stdout only (Alloy collects them), and every record
// logged with a context that carries a span also carries trace_id and span_id.
func New(env string) *slog.Logger {
	var handler slog.Handler
	if env == "local" || env == "" {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
	} else {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	}

	return slog.New(&traceHandler{Handler: handler})
}

// traceHandler copies the active span's IDs into the log record so logs can be joined with traces
// (Loki to Tempo in Grafana). Calls without a context, such as slog.Info, carry no span and get no IDs.
type traceHandler struct {
	slog.Handler
}

func (h *traceHandler) Handle(ctx context.Context, record slog.Record) error {
	if sc := trace.SpanContextFromContext(ctx); sc.IsValid() {
		record.AddAttrs(
			slog.String("trace_id", sc.TraceID().String()),
			slog.String("span_id", sc.SpanID().String()),
		)
	}
	return h.Handler.Handle(ctx, record)
}

func (h *traceHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &traceHandler{Handler: h.Handler.WithAttrs(attrs)}
}

func (h *traceHandler) WithGroup(name string) slog.Handler {
	return &traceHandler{Handler: h.Handler.WithGroup(name)}
}
