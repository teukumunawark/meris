package httpserver

import (
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"meris-backend/internal/platform/redis"
)

type responseWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func wrapResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{ResponseWriter: w, status: http.StatusOK}
}

func (rw *responseWriter) Status() int {
	return rw.status
}

func (rw *responseWriter) WriteHeader(code int) {
	if rw.wroteHeader {
		return
	}
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
	rw.wroteHeader = true
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.wroteHeader {
		rw.WriteHeader(http.StatusOK)
	}
	return rw.ResponseWriter.Write(b)
}

func (rw *responseWriter) Flush() {
	if flusher, ok := rw.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}


func RequestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/healthz" || r.URL.Path == "/health" || r.URL.Path == "/metrics" {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			wrapped := wrapResponseWriter(w)

			next.ServeHTTP(wrapped, r)

			duration := time.Since(start)
			status := wrapped.status

			level := slog.LevelInfo
			if status >= 500 {
				level = slog.LevelError
			} else if status >= 400 {
				level = slog.LevelWarn
			}

			attrs := []slog.Attr{
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", status),
				slog.String("duration", duration.String()),
				slog.String("ip", r.RemoteAddr),
			}

			if q := r.URL.RawQuery; q != "" {
				attrs = append(attrs, slog.String("query", q))
			}

			if ua := r.Header.Get("User-Agent"); ua != "" {
				attrs = append(attrs, slog.String("user_agent", ua))
			}

			logger.LogAttrs(r.Context(), level, "http request", attrs...)
		})
	}
}

func CORS(allowedOrigins string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			allowed := false

			if allowedOrigins == "*" || allowedOrigins == "" {
				allowed = true
			} else {
				for o := range strings.SplitSeq(allowedOrigins, ",") {
					if strings.TrimSpace(o) == origin {
						allowed = true
						break
					}
				}
			}

			if allowed && origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE, PATCH")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, x-api-key")
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// limiterKeyPrefix must start with the service name: on the homelab the Redis ACL user `meris-api`
// can only touch keys matching `meris-api:*`, and any other prefix fails with NOPERM.
const limiterKeyPrefix = "meris-api:limiter"

func limiterKey(limitType, ip string) string {
	return fmt.Sprintf("%s:%s:%s", limiterKeyPrefix, limitType, ip)
}

func RateLimiter(limitType string, limit int, duration time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				ip = r.RemoteAddr
			}

			key := limiterKey(limitType, ip)
			ctx := r.Context()

			if redis.RDB == nil {
				next.ServeHTTP(w, r)
				return
			}

			count, err := redis.RDB.Incr(ctx, key).Result()
			if err != nil {
				slog.ErrorContext(ctx, "Redis rate limiting error", "error", err)
				next.ServeHTTP(w, r)
				return
			}

			if count == 1 {
				redis.RDB.Expire(ctx, key, duration)
			}

			if count > int64(limit) {
				http.Error(w, "Too many requests", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
