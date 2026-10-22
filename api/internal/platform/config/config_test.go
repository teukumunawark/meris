package config

import (
	"strings"
	"testing"
	"time"
)

func TestLoadRateLimit(t *testing.T) {
	tests := []struct {
		name       string
		max        string
		window     string
		wantMax    int
		wantWindow time.Duration
	}{
		{"defaults when unset", "", "", 5, 8 * time.Hour},
		{"values from env", "20", "90m", 20, 90 * time.Minute},
		{"zero turns the limiter off", "0", "", 0, 8 * time.Hour},
		{"zero max ignores a zero window", "0", "0s", 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("RATE_LIMIT_SESSION_MAX", tt.max)
			t.Setenv("RATE_LIMIT_SESSION_WINDOW", tt.window)

			cfg, err := Load()
			if err != nil {
				t.Fatalf("Load: %v", err)
			}
			if cfg.RateLimit.SessionMax != tt.wantMax {
				t.Errorf("SessionMax = %d, want %d", cfg.RateLimit.SessionMax, tt.wantMax)
			}
			if cfg.RateLimit.SessionWindow != tt.wantWindow {
				t.Errorf("SessionWindow = %s, want %s", cfg.RateLimit.SessionWindow, tt.wantWindow)
			}
		})
	}
}

func TestLoadRateLimitRejectsBadValues(t *testing.T) {
	tests := []struct {
		name    string
		max     string
		window  string
		wantErr string
	}{
		{"max is not a number", "many", "", "RATE_LIMIT_SESSION_MAX"},
		{"max is negative", "-1", "", "RATE_LIMIT_SESSION_MAX"},
		{"window is not a duration", "5", "eight hours", "RATE_LIMIT_SESSION_WINDOW"},
		{"window is zero while limiter is on", "5", "0s", "RATE_LIMIT_SESSION_WINDOW"},
		{"window is negative while limiter is on", "5", "-1h", "RATE_LIMIT_SESSION_WINDOW"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("RATE_LIMIT_SESSION_MAX", tt.max)
			t.Setenv("RATE_LIMIT_SESSION_WINDOW", tt.window)

			_, err := Load()
			if err == nil {
				t.Fatal("Load succeeded, want an error")
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("error %q does not mention %s", err, tt.wantErr)
			}
		})
	}
}
