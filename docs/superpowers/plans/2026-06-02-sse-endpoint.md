# Task 4: Setup Server-Sent Events (SSE) Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a thread-safe SSE Hub to manage real-time client connections and broadcast claim event notifications.

**Architecture:** Create a `Hub` type in `backend/sse/hub.go` that manages connections using Go channels and a sync mutex. Integrate this hub into `backend/main.go` and write automated tests verifying correct connection handling and cleanup on disconnect.

**Tech Stack:** Go (Standard Library `net/http`, `sync`, `testing`).

---

### Task 1: Implement SSE Hub

**Files:**
- Create: `backend/sse/hub.go`

- [ ] **Step 1: Write `backend/sse/hub.go`**
  Implement the `Hub` struct, `NewHub()`, `Register()`, `StreamHandler()`, and `Broadcast()` methods using a `sync.Mutex` to coordinate client channels.
  ```go
  package sse

  import (
  	"fmt"
  	"net/http"
  	"sync"
  )

  // Hub manages active SSE client connections and broadcasts messages.
  type Hub struct {
  	mu      sync.Mutex
  	clients map[chan string]bool
  }

  // NewHub creates and returns a new Hub instance.
  func NewHub() *Hub {
  	return &Hub{
  		clients: make(map[chan string]bool),
  	}
  }

  // Register handles the incoming HTTP request, establishes the SSE stream,
  // and listens for messages or client disconnects.
  func (h *Hub) Register(w http.ResponseWriter, r *http.Request) {
  	flusher, ok := w.(http.Flusher)
  	if !ok {
  		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
  		return
  	}

  	// Set headers for Server-Sent Events
  	w.Header().Set("Content-Type", "text/event-stream")
  	w.Header().Set("Cache-Control", "no-cache")
  	w.Header().Set("Connection", "keep-alive")
  	w.Header().Set("Access-Control-Allow-Origin", "*")

  	// Create connection channel for this client
  	messageChan := make(chan string, 10)

  	// Register client
  	h.mu.Lock()
  	h.clients[messageChan] = true
  	h.mu.Unlock()

  	// Ensure cleanup on exit
  	defer func() {
  		h.mu.Lock()
  		delete(h.clients, messageChan)
  		h.mu.Unlock()
  		close(messageChan)
  	}()

  	// Send connection confirmation comment
  	fmt.Fprintf(w, ": ok\n\n")
  	flusher.Flush()

  	// Stream loop
  	for {
  		select {
  		case msg, ok := <-messageChan:
  			if !ok {
  				return
  			}
  			fmt.Fprintf(w, "data: %s\n\n", msg)
  			flusher.Flush()
  		case <-r.Context().Done():
  			return
  		}
  	}
  }

  // StreamHandler exposes Register as a standard http.HandlerFunc.
  func (h *Hub) StreamHandler(w http.ResponseWriter, r *http.Request) {
  	h.Register(w, r)
  }

  // Broadcast sends a message string to all active client channels.
  func (h *Hub) Broadcast(message string) {
  	h.mu.Lock()
  	defer h.mu.Unlock()
  	for clientChan := range h.clients {
  		select {
  		case clientChan <- message:
  		default:
  			// Avoid blocking on slow or full client channels
  		}
  	}
  }
  ```

---

### Task 2: Register SSE Endpoint in main.go

**Files:**
- Modify: `backend/main.go`

- [ ] **Step 1: Set up Global Hub and Register `/stream` Route**
  Update `backend/main.go` to initialize a global `sse.Hub` (or a variable instantiated in main) and register the `/stream` endpoint.
  ```go
  package main

  import (
  	"encoding/json"
  	"log"
  	"net/http"

  	"split-bill-backend/sse"
  )

  type HealthResponse struct {
  	Status  string `json:"status"`
  	Message string `json:"message"`
  }

  func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
  	if r.Method != http.MethodGet {
  		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
  		return
  	}

  	w.Header().Set("Content-Type", "application/json")
  	w.WriteHeader(http.StatusOK)
  	
  	response := HealthResponse{
  		Status:  "OK",
  		Message: "Split Bill Backend is running",
  	}

  	if err := json.NewEncoder(w).Encode(response); err != nil {
  		log.Printf("Error encoding health check response: %v", err)
  	}
  }

  func main() {
  	mux := http.NewServeMux()
  	mux.HandleFunc("/health", healthCheckHandler)

  	// Initialize global SSE Hub
  	hub := sse.NewHub()
  	mux.HandleFunc("/stream", hub.StreamHandler)

  	port := ":8080"
  	log.Printf("Starting health check and SSE server on port %s...", port)
  	if err := http.ListenAndServe(port, mux); err != nil {
  		log.Fatalf("Server failed to start: %v", err)
  	}
  }
  ```

---

### Task 3: Test SSE Hub and Endpoint

**Files:**
- Create: `backend/sse/hub_test.go`

- [ ] **Step 1: Create `backend/sse/hub_test.go`**
  Implement tests to verify registration, message broadcasting, context/disconnection cleanup, and standard SSE headers.
  ```go
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

  	// Read response body buffer
  	buf := make([]byte, 512)
  	n, err := resp.Body.Read(buf)
  	if err != nil && !strings.Contains(err.Error(), "EOF") {
  		t.Fatalf("Failed to read response body: %v", err)
  	}

  	bodyStr := string(buf[:n])
  	if !strings.Contains(bodyStr, testMsg) {
  		t.Errorf("Expected body to contain broadcast message %q, got: %q", testMsg, bodyStr)
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
  ```

- [ ] **Step 2: Run Tests to Verify Correct Behavior**
  Run command: `go test -v ./sse` from `C:\Users\munawar\Development\split-bill\backend` or `go test -v ./...`.
  Expected: PASS

---

### Task 4: Commit and Update TODO

- [ ] **Step 1: Commit Changes**
  Add files and commit with exact commit message: `"feat: add Server-Sent Events base endpoint"`.

- [ ] **Step 2: Update TODO.md**
  Mark Task 4 as completed in `TODO.md` and commit the update.
