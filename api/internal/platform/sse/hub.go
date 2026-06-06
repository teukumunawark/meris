package sse

import (
	"fmt"
	"net/http"
	"sync"
	"time"
)

type Hub struct {
	mu      sync.Mutex
	clients map[chan string]bool
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[chan string]bool),
	}
}

func (h *Hub) StreamHandler(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	messageChan := make(chan string, 10)

	h.mu.Lock()
	h.clients[messageChan] = true
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.clients, messageChan)
		h.mu.Unlock()
		close(messageChan)
	}()

	fmt.Fprintf(w, ": ok\n\n")
	flusher.Flush()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg, ok := <-messageChan:
			if !ok {
				return
			}
			fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func (h *Hub) Broadcast(message string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for clientChan := range h.clients {
		select {
		case clientChan <- message:
		default:
		}
	}
}
