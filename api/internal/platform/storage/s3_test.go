package storage

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestNewClient_OptionalWhenEndpointEmpty(t *testing.T) {
	c, err := NewClient(Config{})
	if err != nil {
		t.Fatalf("expected no error when endpoint is empty, got %v", err)
	}
	if c != nil {
		t.Fatalf("expected nil client when endpoint is empty")
	}
}

func TestUploadGetAndPresignReceipt(t *testing.T) {
	var bucketCreated bool
	objects := make(map[string][]byte)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.Header.Get("Authorization"), "AWS4-HMAC-SHA256 Credential=rustfsadmin/") {
			w.WriteHeader(http.StatusForbidden)
			return
		}

		switch {
		case r.Method == http.MethodHead && r.URL.Path == "/meris-receipts":
			if !bucketCreated {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.WriteHeader(http.StatusOK)
		case r.Method == http.MethodPut && r.URL.Path == "/meris-receipts":
			bucketCreated = true
			w.WriteHeader(http.StatusOK)
		case r.Method == http.MethodPut && strings.HasPrefix(r.URL.Path, "/meris-receipts/receipts/"):
			data, _ := io.ReadAll(r.Body)
			objects[r.URL.Path] = data
			w.WriteHeader(http.StatusOK)
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/meris-receipts/receipts/"):
			data, ok := objects[r.URL.Path]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(data)
		default:
			w.WriteHeader(http.StatusBadRequest)
		}
	}))
	defer srv.Close()

	client, err := NewClient(Config{
		Endpoint:       srv.URL,
		PublicEndpoint: "https://s3.munawar.my.id",
		AccessKey:      "rustfsadmin",
		SecretKey:      "rustfssecret",
		Bucket:         "meris-receipts",
		Region:         "us-east-1",
		PresignExpiry:  1 * time.Hour,
	})
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.nowFn = func() time.Time {
		return time.Date(2026, 10, 31, 8, 0, 0, 0, time.UTC)
	}

	ctx := context.Background()
	if err := client.EnsureBucket(ctx); err != nil {
		t.Fatalf("EnsureBucket failed: %v", err)
	}
	if !bucketCreated {
		t.Fatalf("expected EnsureBucket to create bucket")
	}

	pngBytes := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x00, 0x00, 0x00, 0x0d, 'I', 'H', 'D', 'R'}
	key, shaHex, err := client.UploadReceipt(ctx, pngBytes)
	if err != nil {
		t.Fatalf("UploadReceipt failed: %v", err)
	}
	if !strings.HasPrefix(key, "receipts/") || !strings.HasSuffix(key, ".png") {
		t.Fatalf("unexpected image key %q", key)
	}
	if len(shaHex) != 64 {
		t.Fatalf("expected 64-char sha256 hex, got %q", shaHex)
	}

	downloaded, err := client.GetReceipt(ctx, key)
	if err != nil {
		t.Fatalf("GetReceipt failed: %v", err)
	}
	if !bytes.Equal(downloaded, pngBytes) {
		t.Fatalf("downloaded bytes do not match uploaded bytes")
	}

	presigned := client.PresignReceiptURL(key)
	parsedURL, err := url.Parse(presigned)
	if err != nil {
		t.Fatalf("PresignReceiptURL produced invalid URL: %v", err)
	}
	if parsedURL.Host != "s3.munawar.my.id" {
		t.Errorf("expected public host s3.munawar.my.id, got %s", parsedURL.Host)
	}
	if parsedURL.Path != "/meris-receipts/"+key {
		t.Errorf("unexpected presigned path %s", parsedURL.Path)
	}
	if parsedURL.Query().Get("X-Amz-Algorithm") != "AWS4-HMAC-SHA256" {
		t.Errorf("missing X-Amz-Algorithm in presigned URL")
	}
	if parsedURL.Query().Get("X-Amz-Signature") == "" {
		t.Errorf("missing X-Amz-Signature in presigned URL")
	}
}
