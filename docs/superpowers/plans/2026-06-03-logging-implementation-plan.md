# Plan Implementasi Production-Grade Logging (Go `slog`)

## 1. Analisis & Research Kebutuhan
Aplikasi **Meris Backend** menggunakan standar library `net/http` di Go 1.26.3, tanpa framework eksternal yang berat. Ini sangat ideal karena kita bisa langsung memanfaatkan middleware `net/http` standar untuk menyisipkan *Request ID*.
Kebutuhan *production-grade* mencakup:
- **Traceability**: Tiap HTTP request (baik dari API REST biasa maupun koneksi SSE) wajib memiliki *Request ID* yang disebar (propagate) ke setiap fungsi dan query database yang dilakukan di dalam request tersebut.
- **Dynamic Formatting**: Mode *development* akan menampilkan teks yang mudah dibaca. Mode *production* akan meng-output JSON untuk memudahkan agregasi log (*Datadog, Loki, dll*).
- **Zero-Dependency Core**: Menggunakan standar library `log/slog` bawaan Go. Satu-satunya dependensi tambahan mungkin hanya `github.com/google/uuid` (yang sudah ada di `go.mod`) untuk *generate* Request ID.
- **Latency & Status Logging**: Middleware HTTP harus mencatat kapan sebuah request masuk, kapan selesai, durasi (latency), dan status kode HTTP (200, 400, 500, dll).

## 2. Struktur Direktori Baru
Kita akan membuat/memodifikasi beberapa file berikut:
- `internal/logger/logger.go`: Berisi inisialisasi `slog`, custom context handler.
- `internal/middleware/logging.go`: Middleware HTTP untuk injeksi Request ID dan mencatat Request/Response metrics (Method, Path, Latency, Status Code).
- `cmd/meris/main.go`: Modifikasi untuk meng-init logger, dan membungkus `mux` dengan `LoggingMiddleware`.

## 3. Detail Implementasi Step-by-Step

### Step 1: Membuat Package Logger (`internal/logger/logger.go`)
- Definisikan tipe konstanta `contextKey` untuk `RequestIDKey`.
- Buat struct `ContextHandler` yang mengimplementasikan `slog.Handler`. Di dalam metode `Handle`, handler akan mengekstrak nilai Request ID dari context, dan menyisipkannya menggunakan `r.AddAttrs(slog.String("request_id", reqID))`.
- Buat fungsi `Init(env, level)` yang memilih `slog.NewJSONHandler` atau `slog.NewTextHandler` berdasarkan parameter *env*.
- Atur `slog.SetDefault(logger)` agar kita bisa menggunakan pemanggilan statis seperti `slog.InfoContext(ctx, ...)`.

### Step 2: Membuat HTTP Middleware (`internal/middleware/logging.go`)
- Buat fungsi `RequestLogger(next http.Handler) http.Handler`.
- Fungsi ini akan:
  1. *Generate* UUID `google/uuid` sebagai *Request ID* (atau menggunakan *header* `X-Request-ID` jika request dikirim melalui API Gateway/Nginx).
  2. Menyimpan *Request ID* tersebut ke dalam `r.Context()`.
  3. Membungkus `http.ResponseWriter` menggunakan custom *response writer* agar bisa merekam (capture) Status Code HTTP yang dikembalikan ke *client*.
  4. Mencatat `slog.InfoContext` saat request dimulai.
  5. Menjalankan *handler* berikutnya (`next.ServeHTTP`).
  6. Setelah *handler* selesai, hitung *latency* (menggunakan `time.Since`) dan catat ke `slog.InfoContext` bersama status kode respons.

### Step 3: Modifikasi Entrypoint (`cmd/meris/main.go`)
- Panggil `logger.Init(os.Getenv("APP_ENV"), os.Getenv("LOG_LEVEL"))` pada baris-baris awal di fungsi `main()`.
- Ganti panggilan `log.Printf` dan `log.Fatalf` bawaan standar ke `slog.Info` dan `slog.Error`.
- Ubah baris `handlerWithCORS := handlers.CORS(mux)` menjadi `finalHandler := middleware.RequestLogger(handlers.CORS(mux))`.

### Step 4: Adopsi Contextual Logging di Handlers & DB
- Setiap parameter fungsi di *handler* dan fungsi-fungsi bisnis logik harus menerima tipe `context.Context`.
- Ganti pemanggilan `log.Println` atau `log.Printf` di *handlers* dengan `slog.InfoContext(r.Context(), "pesan")`.
- Khusus untuk fungsi *Error*, gunakan atribut `slog.Any("error", err)`. (Misal: `slog.ErrorContext(ctx, "failed to decode json", slog.Any("error", err))`).
- (Opsional tetapi sangat dianjurkan) Untuk fungsi GORM di `internal/db`, gunakan `db.WithContext(ctx)` agar GORM meneruskan context (berisi request ID) sampai tingkat query SQL.

## 4. Evaluasi & Testing
- Jalankan service tanpa *environment variable* `APP_ENV`. Log harus muncul dengan format Teks di Terminal/Konsol.
- Atur `APP_ENV=production` dan `LOG_LEVEL=debug`, periksa output terminal yang harus berupa JSON string lengkap dengan *Request ID* di setiap baris (termasuk *logger middleware*).
- Kirim request yang menghasilkan HTTP 500 (misalnya simulasi *panic* atau *database error*) untuk memverifikasi apakah jejak pemanggilan fungsi (Caller/Source Code Location) terekam pada log level Error.
