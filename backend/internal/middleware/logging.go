package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"meris-backend/internal/logger"
)

type responseWriter struct {
	http.ResponseWriter
	status       int
	bytesWritten int64
	wroteHeader  bool
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{
		ResponseWriter: w,
		status:         http.StatusOK,
	}
}

func (rw *responseWriter) WriteHeader(code int) {
	if rw.wroteHeader {
		return
	}
	rw.status = code
	rw.wroteHeader = true
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.wroteHeader {
		rw.WriteHeader(http.StatusOK)
	}
	n, err := rw.ResponseWriter.Write(b)
	rw.bytesWritten += int64(n)
	return n, err
}

func (rw *responseWriter) Status() int {
	return rw.status
}

func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := r.Header.Get("X-Request-ID")
		if reqID == "" {
			reqID = uuid.NewString()
		}

		ctx := context.WithValue(r.Context(), logger.RequestIDKey, reqID)
		wrappedWriter := newResponseWriter(w)

		slog.InfoContext(ctx, "HTTP request started", slog.String("method", r.Method), slog.String("path", r.URL.Path))

		start := time.Now()
		next.ServeHTTP(wrappedWriter, r.WithContext(ctx))
		latency := time.Since(start)

		slog.InfoContext(ctx, "HTTP request completed", slog.String("method", r.Method), slog.String("path", r.URL.Path), slog.Int("status", wrappedWriter.Status()), slog.Duration("latency", latency))
	})
}
