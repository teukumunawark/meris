package httpserver

import (
	"strings"
	"testing"
)

func TestLimiterKeyMatchesRedisACLPrefix(t *testing.T) {
	key := limiterKey("session", "203.0.113.7")

	if want := "meris-api:limiter:session:203.0.113.7"; key != want {
		t.Errorf("limiterKey = %q, want %q", key, want)
	}
	// The homelab ACL user only allows keys that start with the service name.
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
