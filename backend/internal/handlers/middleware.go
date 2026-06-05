package handlers

import (
	"net/http"
	"os"
	"strings"
)

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		allowedOriginsStr := os.Getenv("ALLOWED_ORIGINS")
		if allowedOriginsStr == "" {
			allowedOriginsStr = "http://localhost:3000"
		}

		allowedOrigins := strings.Split(allowedOriginsStr, ",")
		isAllowed := false

		for _, allowed := range allowedOrigins {
			trimmedAllowed := strings.TrimSpace(allowed)
			if trimmedAllowed == "*" || trimmedAllowed == origin {
				isAllowed = true
				break
			}
		}

		if isAllowed && origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else if allowedOriginsStr == "*" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
