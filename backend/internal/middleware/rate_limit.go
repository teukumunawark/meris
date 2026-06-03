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

// Lua script to atomically implement Sliding Window Log (ZSET)
const rateLimitLua = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local clear_before = now - window

-- Remove elements older than sliding window
redis.call('zremrangebyscore', key, '-inf', clear_before)

-- Count remaining requests in this window
local count = redis.call('zcard', key)
local allowed = 1

if count < limit then
    redis.call('zadd', key, now, member)
    count = count + 1
else
    allowed = 0
end

redis.call('expire', key, window)

-- Get the oldest element score to calculate time remaining until a slot resets
local oldest = redis.call('zrange', key, 0, 0, 'withscores')
local oldest_score = 0
if #oldest > 0 then
    oldest_score = tonumber(oldest[2])
end

return {allowed, count, oldest_score}
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

			now := time.Now().Unix()
			// Create a unique member for this request to avoid overwrites in ZSET
			member := fmt.Sprintf("%d:%d", now, time.Now().UnixNano())

			res, err := redis.Client.Eval(ctx, rateLimitLua, []string{key}, now, int64(window.Seconds()), limit, member).Result()
			if err != nil {
				slog.ErrorContext(ctx, "Failed to execute rate limit Lua script", "error", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			slice, ok := res.([]interface{})
			if !ok || len(slice) < 3 {
				slog.ErrorContext(ctx, "Invalid response from rate limit Lua script")
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			allowed, ok1 := slice[0].(int64)
			count, ok2 := slice[1].(int64)
			oldestScore, ok3 := slice[2].(int64)
			if !ok1 || !ok2 || !ok3 {
				slog.ErrorContext(ctx, "Invalid type in rate limit Lua response")
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			remaining := int64(limit) - count
			if remaining < 0 {
				remaining = 0
			}

			// Expose limit and remaining headers
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
			w.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))

			var ttlSec int64
			if oldestScore > 0 {
				ttlSec = (oldestScore + int64(window.Seconds())) - now
				if ttlSec < 0 {
					ttlSec = 0
				}
			} else {
				ttlSec = int64(window.Seconds())
			}

			resetTime := now + ttlSec
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(resetTime, 10))

			if allowed == 0 {
				w.Header().Set("Retry-After", strconv.FormatInt(ttlSec, 10))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)

				hours := ttlSec / 3600
				minutes := (ttlSec % 3600) / 60
				seconds := ttlSec % 60

				var msg string
				if keyPrefix == "session" {
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
