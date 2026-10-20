package session

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func createMultipartRequest(t *testing.T, fieldName, fileName string, fileContent []byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	if fieldName != "" {
		part, err := writer.CreateFormFile(fieldName, fileName)
		if err != nil {
			t.Fatalf("failed to create form file: %v", err)
		}
		if _, err := io.Copy(part, bytes.NewReader(fileContent)); err != nil {
			t.Fatalf("failed to write content: %v", err)
		}
	}

	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/session", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func TestReadReceiptImage_ValidImage(t *testing.T) {
	h := &Handler{}
	pngHeader := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x00, 0x00, 0x00, 0x0d, 'I', 'H', 'D', 'R'}

	req := createMultipartRequest(t, "receipt", "receipt.png", pngHeader)
	w := httptest.NewRecorder()

	imageBytes, ok := h.readReceiptImage(w, req)
	if !ok {
		t.Fatalf("expected readReceiptImage to succeed, but it failed: %s", w.Body.String())
	}

	if !bytes.Equal(imageBytes, pngHeader) {
		t.Errorf("expected imageBytes to match input")
	}
}

func TestReadReceiptImage_MissingFile(t *testing.T) {
	h := &Handler{}
	req := createMultipartRequest(t, "wrong_field", "receipt.png", []byte("data"))
	w := httptest.NewRecorder()

	_, ok := h.readReceiptImage(w, req)
	if ok {
		t.Fatalf("expected readReceiptImage to fail for missing file")
	}

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
	if !strings.Contains(w.Body.String(), "invalid_file") {
		t.Errorf("expected invalid_file in response, got %s", w.Body.String())
	}
}

func TestReadReceiptImage_InvalidContentType(t *testing.T) {
	h := &Handler{}
	textContent := []byte("plain text content which is not an image")

	req := createMultipartRequest(t, "receipt", "note.txt", textContent)
	w := httptest.NewRecorder()

	_, ok := h.readReceiptImage(w, req)
	if ok {
		t.Fatalf("expected readReceiptImage to fail for non-image")
	}

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
	if !strings.Contains(w.Body.String(), "invalid_content_type") {
		t.Errorf("expected invalid_content_type in response, got %s", w.Body.String())
	}
}

func TestReadReceiptImage_TooLarge(t *testing.T) {
	h := &Handler{}
	largeContent := make([]byte, 5*1024*1024+1024)

	req := createMultipartRequest(t, "receipt", "large.png", largeContent)
	w := httptest.NewRecorder()

	_, ok := h.readReceiptImage(w, req)
	if ok {
		t.Fatalf("expected readReceiptImage to fail for oversized file")
	}

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("expected status %d, got %d", http.StatusRequestEntityTooLarge, w.Code)
	}
	if !strings.Contains(w.Body.String(), "file_too_large") {
		t.Errorf("expected file_too_large in response, got %s", w.Body.String())
	}
}
