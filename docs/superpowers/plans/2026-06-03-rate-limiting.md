# Redis-Based Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Redis-backed rate limiter on the Go backend (5 sessions/8 hours for session creation, and 100 requests/minute for other API endpoints) and update the React/Next.js frontend to gracefully handle and display rate-limiting error messages and countdown timers.

**Architecture:** Use Redis to store rate-limit counters with a Fixed Window Counter algorithm executed atomically via Lua scripts. Identify users by IP address (parsing standard proxy/CDN headers like X-Forwarded-For). Expose standard headers (X-RateLimit-*) and throw a startup error if the Redis connection fails.

**Tech Stack:** Go 1.26.3, Redis, `github.com/redis/go-redis/v9`, Next.js 16, React 19.

---

### Task 1: Infrastructure and Dependencies Setup

**Files:**
- Modify: `docker-compose.yml`
- Create/Modify: `backend/.env.example`
- Create/Modify: `backend/.env`
- Modify: `backend/go.mod`

- [ ] **Step 1: Add Redis service to Docker Compose**
  Add the Redis container configuration to the root `docker-compose.yml` file.

  Modify `docker-compose.yml`:
  ```yaml
  services:
    postgres:
      container_name: meris-database
      image: postgres:18-alpine
      environment:
        POSTGRES_USER: meris
        POSTGRES_PASSWORD: password
        POSTGRES_DB: merisdb
      ports:
        - "5432:5432"
      volumes:
        - postgres_data:/var/lib/postgresql/data

    redis:
      container_name: meris-redis
      image: redis:7-alpine
      ports:
        - "6379:6379"
      volumes:
        - redis_data:/data

  volumes:
    postgres_data:
    redis_data:
  ```

- [ ] **Step 2: Add Redis configuration to .env files**
  Append `REDIS_URL` to `backend/.env.example` and `backend/.env`.

  In `backend/.env.example` and `backend/.env`:
  ```env
  REDIS_URL=redis://localhost:6379/0
  ```

- [ ] **Step 3: Install go-redis dependency**
  Run `go get github.com/redis/go-redis/v9` inside the `backend` directory to add the library to `go.mod` and `go.sum`.

  Run: `cd backend; go get github.com/redis/go-redis/v9`
  Expected: Success, `go.mod` is updated with `github.com/redis/go-redis/v9`.

- [ ] **Step 4: Commit**
  Stage the config changes and commit them.
  ```bash
  git add docker-compose.yml backend/.env.example backend/go.mod backend/go.sum
  git commit -m "chore: setup redis infrastructure and install go-redis package"
  ```

---

### Task 2: Redis Client Initialization

**Files:**
- Create: `backend/internal/redis/redis.go`
- Modify: `backend/cmd/meris/main.go`

- [ ] **Step 1: Create Redis client initialization code**
  Write the connection and health check code in `backend/internal/redis/redis.go`.

  Code for `backend/internal/redis/redis.go`:
  ```go
  package redis

  import (
  	"context"
  	"fmt"
  	"os"
  	"time"

  	"github.com/redis/go-redis/v9"
  )

  var Client *redis.Client

  func InitRedis() error {
  	redisURL := os.Getenv("REDIS_URL")
  	if redisURL == "" {
  		redisURL = "redis://localhost:6379/0"
  	}

  	opt, err := redis.ParseURL(redisURL)
  	if err != nil {
  		return fmt.Errorf("failed to parse Redis URL: %w", err)
  	}

  	Client = redis.NewClient(opt)

  	// Ping Redis on startup to ensure availability (strict dependency)
  	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
  	defer cancel()

  	if err := Client.Ping(ctx).Err(); err != nil {
  		return fmt.Errorf("failed to ping Redis: %w", err)
  	}

  	return nil
  }
  ```

- [ ] **Step 2: Initialize Redis on application start**
  Modify `backend/cmd/meris/main.go` to call `redis.InitRedis()` during startup and exit if connection fails.

  In `backend/cmd/meris/main.go`:
  ```go
  // In imports:
  import (
      ...
      "meris-backend/internal/redis"
      ...
  )

  // In main() after godotenv.Load():
  if err := redis.InitRedis(); err != nil {
      slog.Error("Critical error during Redis initialization", "error", err)
      os.Exit(1)
  }
  ```

- [ ] **Step 3: Verify build**
  Run `go build` to verify the module imports and types compile cleanly.
  Run: `cd backend; go build ./cmd/meris`
  Expected: Code builds successfully without errors.

- [ ] **Step 4: Commit**
  Stage the Redis setup and commit.
  ```bash
  git add backend/internal/redis/redis.go backend/cmd/meris/main.go
  git commit -m "feat: initialize redis client and fail server startup if ping fails"
  ```

---

### Task 3: Rate Limiting Middleware

**Files:**
- Create: `backend/internal/middleware/rate_limit.go`

- [ ] **Step 1: Create rate-limiting middleware**
  Implement the IP retrieval, Lua-based Fixed Window Counter, Sliding Window Log (ZSET), HTTP headers, and 429 error formatting in `backend/internal/middleware/rate_limit.go`.

  Code for `backend/internal/middleware/rate_limit.go`:
  ```go
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

  // Lua script to atomically implement Sliding Window Log
  const slidingWindowLua = `
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

  func SlidingRateLimiter(keyPrefix string, limit int, window time.Duration) func(http.Handler) http.Handler {
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

  			res, err := redis.Client.Eval(ctx, slidingWindowLua, []string{key}, now, int64(window.Seconds()), limit, member).Result()
  			if err != nil {
  				slog.ErrorContext(ctx, "Failed to execute sliding rate limit Lua script", "error", err)
  				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
  				return
  			}

  			slice, ok := res.([]interface{})
  			if !ok || len(slice) < 3 {
  				slog.ErrorContext(ctx, "Invalid response from sliding rate limit Lua script")
  				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
  				return
  			}

  			allowed, ok1 := slice[0].(int64)
  			count, ok2 := slice[1].(int64)
  			oldestScore, ok3 := slice[2].(int64)
  			if !ok1 || !ok2 || !ok3 {
  				slog.ErrorContext(ctx, "Invalid type in sliding rate limit Lua response")
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
  				if hours > 0 {
  					msg = fmt.Sprintf("You have exceeded the session creation limit (5 sessions per 8 hours). Please try again in %d hours, %d minutes.", hours, minutes)
  				} else if minutes > 0 {
  					msg = fmt.Sprintf("You have exceeded the session creation limit (5 sessions per 8 hours). Please try again in %d minutes.", minutes)
  				} else {
  					msg = fmt.Sprintf("You have exceeded the session creation limit (5 sessions per 8 hours). Please try again in %d seconds.", seconds)
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
  ```

- [ ] **Step 2: Commit**
  Stage the middleware file and commit.
  ```bash
  git add backend/internal/middleware/rate_limit.go
  git commit -m "feat: implement rate limiter middleware using Go standard HTTP handlers and Redis Lua script"
  ```

---

### Task 4: Apply Middleware to Routes

**Files:**
- Modify: `backend/cmd/meris/main.go`

- [ ] **Step 1: Set up middleware application**
  Register both the strict session rate-limiter and the general API rate-limiter on the ServeMux in `backend/cmd/meris/main.go`.

  Modify `backend/cmd/meris/main.go`:
  ```go
  // In main() before setting up ServeMux:
  sessionRateLimiter := middleware.SlidingRateLimiter("session", 5, 8*time.Hour)
  generalRateLimiter := middleware.RateLimiter("general", 100, 1*time.Minute)

  mux := http.NewServeMux()
  mux.HandleFunc("GET /health", healthCheckHandler)
  
  // Wrap CreateSession with strict sessionRateLimiter
  mux.Handle("POST /session", sessionRateLimiter(http.HandlerFunc(sessionHandler.CreateSession)))
  
  mux.HandleFunc("GET /session/{id}", sessionHandler.GetSession)
  mux.HandleFunc("POST /session/{id}/join", sessionHandler.JoinSession)
  mux.HandleFunc("POST /session/{id}/claim", sessionHandler.ClaimItem)
  mux.HandleFunc("PUT /session/{id}/item/{itemId}/rename", sessionHandler.RenameItem)
  mux.HandleFunc("DELETE /session/{id}/participant/{participantId}", sessionHandler.DeleteParticipant)
  mux.HandleFunc("GET /stream", hub.StreamHandler)

  // Apply general rate limiter (100 req/min) to all other paths
  handlerWithLogging := middleware.RequestLogger(handlers.CORS(generalRateLimiter(mux)))
  ```

- [ ] **Step 2: Commit**
  Stage and commit main.go modifications.
  ```bash
  git add backend/cmd/meris/main.go
  git commit -m "feat: apply rate limit middlewares to server router endpoints"
  ```

---

### Task 5: Frontend UI Error Handlers

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Update API Response Handler**
  Parse JSON error details when receiving a `429 Too Many Requests` response during session creation in `frontend/src/app/page.tsx`.

  Replace in `frontend/src/app/page.tsx` (lines 104-121):
  ```tsx
        } else {
          const text = await response.text();
          console.error("Upload failed:", text);
          
          let friendlyMsg = "An unexpected error occurred while processing the receipt. Please try again.";
          if (response.status === 429) {
            try {
              const data = JSON.parse(text);
              friendlyMsg = data.message || "Too many requests. Please try again later.";
            } catch {
              friendlyMsg = "You have exceeded the session creation limit (5 sessions per 8 hours). Please try again later.";
            }
          } else if (text.includes("401") || text.includes("Invalid API Key") || text.includes("invalid_key")) {
            friendlyMsg = "The receipt scanning service is temporarily unavailable. Please try again later.";
          } else if (text.includes("AI extraction failed")) {
            friendlyMsg = "We couldn't parse the receipt details. Please make sure the photo is clear and contains readable items.";
          } else if (text.includes("Failed to save session")) {
            friendlyMsg = "We couldn't create the split bill session. Please try again later.";
          } else if (text.includes("Invalid receipt image") || text.includes("Failed to read image")) {
            friendlyMsg = "The uploaded file is not a valid image. Please choose another photo.";
          }
          
          setErrorMsg(friendlyMsg);
          setIsUploading(false);
        }
  ```

- [ ] **Step 2: Commit**
  Stage `page.tsx` modifications and commit.
  ```bash
  git add frontend/src/app/page.tsx
  git commit -m "feat: handle and display detailed rate limit error messages on frontend"
  ```
