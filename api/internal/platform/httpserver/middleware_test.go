package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestLimiterKeyMatchesRedisACLPrefix(t *testing.T) {
	key := limiterKey("session", "203.0.113.7")

	if want := "meris-api:limiter:session:203.0.113.7"; key != want {
		t.Errorf("limiterKey = %q, want %q", key, want)
	}

	if !strings.HasPrefix(key, "meris-api:") {
		t.Errorf("key %q does not start with the service name, Redis would answer NOPERM", key)
	}
}

func TestLimiterKeySeparatesTypesAndClients(t *testing.T) {
	if limiterKey("session", "1.1.1.1") == limiterKey("session", "2.2.2.2") {
		t.Error("different clients share a limiter key")
	}
	if limiterKey("session", "1.1.1.1") == limiterKey("other", "1.1.1.1") {
		t.Error("different limiter types share a key")
	}
}

func TestRetryAfterSeconds(t *testing.T) {
	tests := []struct {
		name string
		ttl  time.Duration
		want int
	}{
		{"whole seconds", 30 * time.Second, 30},
		{"rounds a fraction up", 1500 * time.Millisecond, 2},
		{"sub-second still waits one second", 200 * time.Millisecond, 1},
		{"no expiry reported", -1, 1},
		{"zero", 0, 1},
		{"hours", 8 * time.Hour, 28800},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := retryAfterSeconds(tt.ttl); got != tt.want {
				t.Errorf("retryAfterSeconds(%s) = %d, want %d", tt.ttl, got, tt.want)
			}
		})
	}
}

func serve(t *testing.T, limiter func(http.Handler) http.Handler) int {
	t.Helper()

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/session", nil)
	req.RemoteAddr = "203.0.113.7:4242"
	limiter(next).ServeHTTP(rec, req)

	return rec.Code
}

func TestRateLimiterOffWhenLimitIsZero(t *testing.T) {
	limiter := RateLimiter("session", 0, time.Hour)

	for i := range 50 {
		if code := serve(t, limiter); code != http.StatusNoContent {
			t.Fatalf("request %d got %d, want %d with the limiter off", i+1, code, http.StatusNoContent)
		}
	}
}

func TestRateLimiterFailsOpenWithoutRedis(t *testing.T) {
	limiter := RateLimiter("session", 1, time.Hour)

	for i := range 3 {
		if code := serve(t, limiter); code != http.StatusNoContent {
			t.Fatalf("request %d got %d, want %d when Redis is unavailable", i+1, code, http.StatusNoContent)
		}
	}
}
