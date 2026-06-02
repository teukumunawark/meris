package sse

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestHub_RegisterAndBroadcast(t *testing.T) {
	hub := NewHub()

	// Create local test server
	server := httptest.NewServer(http.HandlerFunc(hub.StreamHandler))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", server.URL, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	client := server.Client()
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Failed to connect to SSE stream: %v", err)
	}
	defer resp.Body.Close()

	// Verify headers
	if contentType := resp.Header.Get("Content-Type"); contentType != "text/event-stream" {
		t.Errorf("Expected Content-Type text/event-stream, got %s", contentType)
	}
	if cacheControl := resp.Header.Get("Cache-Control"); cacheControl != "no-cache" {
		t.Errorf("Expected Cache-Control no-cache, got %s", cacheControl)
	}

	testMsg := "hello world"
	go func() {
		// Wait slightly to ensure registering completes
		time.Sleep(50 * time.Millisecond)
		hub.Broadcast(testMsg)
	}()

	// Read response body continuously until we find the broadcast message
	ctxRead, cancelRead := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelRead()

	resultChan := make(chan string, 1)
	errChan := make(chan error, 1)
	go func() {
		buf := make([]byte, 1024)
		var builder strings.Builder
		for {
			n, err := resp.Body.Read(buf)
			if n > 0 {
				builder.Write(buf[:n])
				current := builder.String()
				if strings.Contains(current, testMsg) {
					resultChan <- current
					return
				}
			}
			if err != nil {
				errChan <- err
				return
			}
		}
	}()

	select {
	case <-ctxRead.Done():
		t.Fatalf("Timeout waiting for broadcast message %q", testMsg)
	case err := <-errChan:
		if !strings.Contains(err.Error(), "EOF") {
			t.Fatalf("Failed to read from stream: %v", err)
		}
	case received := <-resultChan:
		if !strings.Contains(received, testMsg) {
			t.Errorf("Expected stream to contain %q, got: %q", testMsg, received)
		}
	}
}

func TestHub_CleanupOnDisconnect(t *testing.T) {
	hub := NewHub()

	server := httptest.NewServer(http.HandlerFunc(hub.StreamHandler))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())

	req, err := http.NewRequestWithContext(ctx, "GET", server.URL, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	client := server.Client()
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Failed to connect to SSE stream: %v", err)
	}
	defer resp.Body.Close()

	// Wait a moment for connection registration
	time.Sleep(50 * time.Millisecond)

	hub.mu.Lock()
	clientsCountBefore := len(hub.clients)
	hub.mu.Unlock()

	if clientsCountBefore != 1 {
		t.Errorf("Expected 1 client registered, got %d", clientsCountBefore)
	}

	// Cancel context to simulate client disconnect
	cancel()

	// Wait a moment for cleanup goroutine/defer block to run
	time.Sleep(100 * time.Millisecond)

	hub.mu.Lock()
	clientsCountAfter := len(hub.clients)
	hub.mu.Unlock()

	if clientsCountAfter != 0 {
		t.Errorf("Expected 0 clients registered after disconnect, got %d", clientsCountAfter)
	}
}
