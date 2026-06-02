# Split Bill Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun MVP dari aplikasi Split Bill (Frontend Next.js dan Backend Golang) yang mengekstrak struk via AI (Xiaomi MiMo), melakukan sinkronisasi klaim via SSE, dan membagi pajak secara proporsional.

**Architecture:** Frontend mengirim HTTP POST ke Golang untuk upload struk. Backend Golang mengontak Xiaomi MiMo API dan menyimpan hasil struk ke memori sementara (atau PostgreSQL). Frontend melakukan koneksi *Server-Sent Events (SSE)* ke Golang untuk menerima sinkronisasi *real-time* atas aksi klaim dari seluruh partisipan.

**Tech Stack:** Next.js, TypeScript, Tailwind, shadcn/ui, Golang, SSE, PostgreSQL, Docker.

**Code Quality Note:** 
- **Backend:** Implementasi WAJIB mengikuti kaidah *Go idiomatic* (misal: penanganan *error* yang eksplisit, *early returns*, penggunaan `context.Context` yang benar, dan menghindari abstraksi berlebihan).
- **Frontend:** Implementasi WAJIB mengikuti standar *Next.js Way* (pemanfaatan App Router secara maksimal, pembagian Server dan Client Components yang proporsional, serta penulisan React/TypeScript yang bersih).

---

### Task 1: Scaffold Project & Folder Structure

**Files:**
- Create: `backend/go.mod`
- Create: `backend/main.go`
- Create: `frontend/package.json` (via Next.js CLI)
- Create: `docker-compose.yml`

- [ ] **Step 1: Inisialisasi Backend Golang**
```bash
mkdir backend
cd backend
go mod init split-bill-backend
```

- [ ] **Step 2: Buat entry point backend dasar (`backend/main.go`)**
```go
package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})
	fmt.Println("Server running on port 8080")
	http.ListenAndServe(":8080", nil)
}
```

- [ ] **Step 3: Scaffold Frontend Next.js**
```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 4: Buat `docker-compose.yml` di root proyek**
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: splitbill
      POSTGRES_PASSWORD: password
      POSTGRES_DB: splitbilldb
    ports:
      - "5432:5432"
```

- [ ] **Step 5: Commit**
```bash
git init
git add .
git commit -m "chore: scaffold Next.js frontend, Go backend, and docker-compose"
```

---

### Task 2: Core Logic - Proportional Tax Calculation (TDD)

**Files:**
- Create: `backend/calculator/calculator.go`
- Create: `backend/calculator/calculator_test.go`

- [ ] **Step 1: Write the failing test**
Create `backend/calculator/calculator_test.go`:
```go
package calculator

import (
	"testing"
)

func TestCalculateProportional(t *testing.T) {
	subtotal := 100000.0
	tax := 11000.0 // 11% tax
	service := 5000.0 // 5% service charge

	// Person A claims 60k, Person B claims 40k
	personASubtotal := 60000.0
	personBSubtotal := 40000.0

	calcA := CalculateShare(personASubtotal, subtotal, tax, service)
	calcB := CalculateShare(personBSubtotal, subtotal, tax, service)

	expectedA := 60000.0 + (60000.0/100000.0)*(11000.0+5000.0) // 60k + 9.6k = 69600
	expectedB := 40000.0 + (40000.0/100000.0)*(11000.0+5000.0) // 40k + 6.4k = 46400

	if calcA != expectedA {
		t.Errorf("Expected A to be %f, got %f", expectedA, calcA)
	}
	if calcB != expectedB {
		t.Errorf("Expected B to be %f, got %f", expectedB, calcB)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd backend && go test ./calculator -v
```
Expected: FAIL (Package calculator not found / undefined CalculateShare)

- [ ] **Step 3: Write minimal implementation**
Create `backend/calculator/calculator.go`:
```go
package calculator

func CalculateShare(personSubtotal, totalSubtotal, tax, service float64) float64 {
	if totalSubtotal == 0 {
		return 0
	}
	proportion := personSubtotal / totalSubtotal
	shareOfTaxAndService := proportion * (tax + service)
	return personSubtotal + shareOfTaxAndService
}
```

- [ ] **Step 4: Run test to verify it passes**
```bash
cd backend && go test ./calculator -v
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/calculator
git commit -m "feat: implement proportional tax calculation logic with tests"
```

---

### Task 3: AI Service Standardized Schema Defintions

**Files:**
- Create: `backend/ai/schema.go`
- Create: `backend/ai/client.go`

- [ ] **Step 1: Definisikan Struct untuk output AI yang konsisten**
Create `backend/ai/schema.go`:
```go
package ai

type ExtractedItem struct {
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Quantity int     `json:"quantity"`
}

type ExtractedReceipt struct {
	Items         []ExtractedItem `json:"items"`
	Subtotal      float64         `json:"subtotal"`
	Tax           float64         `json:"tax"`
	ServiceCharge float64         `json:"service_charge"`
	GrandTotal    float64         `json:"grand_total"`
}
```

- [ ] **Step 2: Buat HTTP Client Mock/Interface dengan Retry Logic (Konseptual untuk MiMo API)**
Create `backend/ai/client.go`:
```go
package ai

import (
	"encoding/json"
	"fmt"
)

// ParseJSONWithRetry simulates checking JSON against our strict struct.
func ParseJSONWithRetry(rawJSON []byte) (*ExtractedReceipt, error) {
	var receipt ExtractedReceipt
	err := json.Unmarshal(rawJSON, &receipt)
	if err != nil {
		// Di implementasi asli, trigger re-prompting ke AI di sini
		return nil, fmt.Errorf("failed to parse AI JSON strictly: %v", err)
	}
	return &receipt, nil
}
```

- [ ] **Step 3: Commit**
```bash
git add backend/ai
git commit -m "feat: define strict structs for AI output standardization"
```

---

### Task 4: Setup Server-Sent Events (SSE) Endpoint

**Files:**
- Create: `backend/sse/hub.go`

- [ ] **Step 1: Implementasi SSE Hub Sederhana**
Create `backend/sse/hub.go`:
```go
package sse

import (
	"fmt"
	"net/http"
)

func StreamHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Flush immediately to keep connection open
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	fmt.Fprintf(w, "data: {\"message\": \"connected\"}\n\n")
	flusher.Flush()

	// Blocks until connection is closed by client
	<-r.Context().Done()
}
```

- [ ] **Step 2: Daftarkan endpoint SSE di main.go**
Modify `backend/main.go:8-13`:
```go
import (
	"fmt"
	"net/http"
	"split-bill-backend/sse"
)

func main() {
	http.HandleFunc("/stream", sse.StreamHandler)
	fmt.Println("Server running on port 8080")
	http.ListenAndServe(":8080", nil)
}
```

- [ ] **Step 3: Commit**
```bash
git add backend
git commit -m "feat: add Server-Sent Events base endpoint"
```

---

### Task 5: Frontend - Halaman Sesi Klaim (Next.js)

**Files:**
- Create: `frontend/src/app/session/[id]/page.tsx`

- [ ] **Step 1: Buat UI Klaim Dasar dan SSE Client Listener**
Create `frontend/src/app/session/[id]/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';

export default function SessionPage({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:8080/stream');
    eventSource.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };
    return () => eventSource.close();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Sesi Split Bill: {params.id}</h1>
      <div className="border p-4 rounded bg-gray-50">
        <h2 className="font-semibold mb-2">Live Updates:</h2>
        {messages.map((msg, i) => (
          <div key={i} className="text-sm text-gray-700">{msg}</div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Jalankan Next.js dan pastikan halamannya merender**
```bash
cd frontend && npm run build
```
*(Asumsi berhasil dicompile. Tidak bisa test dev server di background tanpa intervensi, build akan memvalidasi syntax).*

- [ ] **Step 3: Commit**
```bash
git add frontend/src/app
git commit -m "feat: setup basic frontend session page with SSE listening"
```
