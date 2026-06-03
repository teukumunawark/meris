package middleware

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"meris-backend/internal/redis"
)

type RateLimitResponse struct {
	Error      string `json:"error"`
	Message    string `json:"message"`
	RetryAfter int    `json:"retry_after"`
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if ip != "" {
				return ip
			}
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// Lua script to atomically increment the counter and set the expiration TTL if it's the first request
const fixedWindowLua = `
local current = redis.call('incr', KEYS[1])
local ttl = redis.call('ttl', KEYS[1])
if current == 1 then
    redis.call('expire', KEYS[1], tonumber(ARGV[1]))
    ttl = tonumber(ARGV[1])
end
return {current, ttl}
`

func RateLimiter(keyPrefix string, limit int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			ip := getClientIP(r)
			key := fmt.Sprintf("rate_limit:%s:%s", keyPrefix, ip)

			if redis.Client == nil {
				slog.ErrorContext(ctx, "Redis client not initialized")
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			// Run atomic operations in Redis via Lua
			res, err := redis.Client.Eval(ctx, fixedWindowLua, []string{key}, int(window.Seconds())).Result()
			if err != nil {
				slog.ErrorContext(ctx, "Failed to execute rate limit Lua script", "error", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			slice, ok := res.([]interface{})
			if !ok || len(slice) < 2 {
				slog.ErrorContext(ctx, "Invalid response from rate limit Lua script")
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			count, ok1 := slice[0].(int64)
			ttlSec, ok2 := slice[1].(int64)
			if !ok1 || !ok2 {
				slog.ErrorContext(ctx, "Invalid type in rate limit Lua response")
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			remaining := int64(limit) - count
			if remaining < 0 {
				remaining = 0
			}

			// Set standard rate limit headers
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
			w.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
			resetTime := time.Now().Add(time.Duration(ttlSec) * time.Second).Unix()
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(resetTime, 10))

			// Deny request if limit exceeded
			if count > int64(limit) {
				w.Header().Set("Retry-After", strconv.FormatInt(ttlSec, 10))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)

				var msg string
				if keyPrefix == "session" {
					hours := ttlSec / 3600
					minutes := (ttlSec % 3600) / 60
					seconds := ttlSec % 60
					if hours > 0 {
						msg = fmt.Sprintf("You have exceeded the session creation limit (5 sessions per 8 hours). Please try again in %d hours, %d minutes.", hours, minutes)
					} else if minutes > 0 {
						msg = fmt.Sprintf("You have exceeded the session creation limit (5 sessions per 8 hours). Please try again in %d minutes.", minutes)
					} else {
						msg = fmt.Sprintf("You have exceeded the session creation limit (5 sessions per 8 hours). Please try again in %d seconds.", seconds)
					}
				} else {
					msg = "Too many requests. Please try again later."
				}

				resp := RateLimitResponse{
					Error:      "Too Many Requests",
					Message:    msg,
					RetryAfter: int(ttlSec),
				}
				json.NewEncoder(w).Encode(resp)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
