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
