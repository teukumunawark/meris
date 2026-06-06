package httpserver

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"meris-backend/internal/platform/sse"
)

func RegisterSystemRoutes(r chi.Router, hub *sse.Hub) {
	r.Get("/healthz", healthz)
	r.Handle("/metrics", promhttp.Handler())
	if hub != nil {
		r.HandleFunc("/stream", hub.StreamHandler)
	}
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}
