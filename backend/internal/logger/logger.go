package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
)

type contextKey string

const RequestIDKey contextKey = "request_id"

var OutputWriter io.Writer = os.Stdout

type ContextHandler struct {
	Handler slog.Handler
}

func (h ContextHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.Handler.Enabled(ctx, level)
}

func (h ContextHandler) Handle(ctx context.Context, r slog.Record) error {
	if reqID, ok := ctx.Value(RequestIDKey).(string); ok && reqID != "" {
		r.AddAttrs(slog.String("request_id", reqID))
	}
	return h.Handler.Handle(ctx, r)
}

func (h ContextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return ContextHandler{Handler: h.Handler.WithAttrs(attrs)}
}

func (h ContextHandler) WithGroup(name string) slog.Handler {
	return ContextHandler{Handler: h.Handler.WithGroup(name)}
}

func Init(env string, level string) {
	var slogLevel slog.Level
	switch strings.ToLower(level) {
	case "debug":
		slogLevel = slog.LevelDebug
	case "info":
		slogLevel = slog.LevelInfo
	case "warn":
		slogLevel = slog.LevelWarn
	case "error":
		slogLevel = slog.LevelError
	default:
		slogLevel = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level: slogLevel,
	}

	var handler slog.Handler
	if env == "production" || env == "prod" {
		handler = slog.NewJSONHandler(OutputWriter, opts)
	} else {
		handler = slog.NewTextHandler(OutputWriter, opts)
	}

	logger := slog.New(ContextHandler{Handler: handler})
	slog.SetDefault(logger)
}
