package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

const (
	fastModel   = "test/fast"
	strongModel = "test/strong"
)

const (
	matchingTranscription    = `{"merchant_name":"Kedai Kopi","items":[{"name":"Kopi","quantity":2,"unit_price":0,"line_total":40000,"discount":0,"sub_items":[]}],"charges":[],"printed_subtotal":40000,"grand_total":40000}`
	mismatchingTranscription = `{"merchant_name":"Kedai Kopi","items":[{"name":"Kopi","quantity":2,"unit_price":0,"line_total":46000,"discount":0,"sub_items":[]}],"charges":[],"printed_subtotal":40000,"grand_total":40000}`
	emptyTranscription       = `{"merchant_name":"","items":[],"charges":[],"printed_subtotal":0,"grand_total":0}`
)

type modelReply struct {
	status  int
	content string
}

type fakeProvider struct {
	mu       sync.Mutex
	replies  map[string][]modelReply
	calls    map[string]int
	requests []ChatCompletionRequest
	rawBody  [][]byte
}

func (f *fakeProvider) callsTo(model string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls[model]
}

func (f *fakeProvider) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var body bytes.Buffer
	_, _ = body.ReadFrom(r.Body)
	var req ChatCompletionRequest
	_ = json.Unmarshal(body.Bytes(), &req)

	f.mu.Lock()
	f.requests = append(f.requests, req)
	f.rawBody = append(f.rawBody, body.Bytes())
	attempt := f.calls[req.Model]
	f.calls[req.Model]++
	replies := f.replies[req.Model]
	f.mu.Unlock()

	if len(replies) == 0 {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	reply := replies[min(attempt, len(replies)-1)]
	if reply.status != http.StatusOK {
		w.WriteHeader(reply.status)
		_, _ = w.Write([]byte(`{"error":{"message":"provider error"}}`))
		return
	}
	completion := map[string]any{"choices": []any{map[string]any{"message": map[string]any{"content": reply.content}}}}
	_ = json.NewEncoder(w).Encode(completion)
}

func withProvider(t *testing.T, escalationModel string, replies map[string][]modelReply) *fakeProvider {
	t.Helper()
	provider := &fakeProvider{replies: replies, calls: map[string]int{}}
	server := httptest.NewServer(provider)

	previousConfig, previousDelay := currentConfig, delayBeforeRetry
	SetConfig(Config{APIKey: "test-key", Endpoint: server.URL, Model: fastModel, EscalationModel: escalationModel})
	delayBeforeRetry = 0
	t.Cleanup(func() {
		server.Close()
		SetConfig(previousConfig)
		delayBeforeRetry = previousDelay
	})
	return provider
}

func ok(content string) modelReply {
	return modelReply{status: http.StatusOK, content: content}
}

var fakeJPEG = []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F'}

func TestMatchingFastReadingIsNotEscalated(t *testing.T) {
	provider := withProvider(t, strongModel, map[string][]modelReply{
		fastModel:   {ok(matchingTranscription)},
		strongModel: {ok(matchingTranscription)},
	})

	receipt, err := ExtractReceiptData(context.Background(), fakeJPEG)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if receipt.ExtractedByModel != fastModel || !receipt.MatchesPrintedTotal {
		t.Errorf("expected a matching reading from the fast model, got %+v", receipt)
	}
	if provider.callsTo(strongModel) != 0 {
		t.Errorf("the strong model should not be called")
	}
}

func TestMismatchEscalatesToTheStrongModel(t *testing.T) {
	provider := withProvider(t, strongModel, map[string][]modelReply{
		fastModel:   {ok(mismatchingTranscription)},
		strongModel: {ok(matchingTranscription)},
	})

	receipt, err := ExtractReceiptData(context.Background(), fakeJPEG)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if receipt.ExtractedByModel != strongModel || receipt.Items[0].Price != 20000 {
		t.Errorf("expected the strong model's reading, got %+v", receipt)
	}
	if provider.callsTo(fastModel) != 1 {
		t.Errorf("a mismatch must not be retried on the fast model, got %d calls", provider.callsTo(fastModel))
	}
}

func TestUnreadableOnBothModels(t *testing.T) {
	withProvider(t, strongModel, map[string][]modelReply{
		fastModel:   {ok(emptyTranscription)},
		strongModel: {ok(emptyTranscription)},
	})

	if _, err := ExtractReceiptData(context.Background(), fakeJPEG); !errors.Is(err, ErrUnreadableReceipt) {
		t.Errorf("expected ErrUnreadableReceipt, got %v", err)
	}
}

func TestUnreadableOnFastModelReadByStrongModel(t *testing.T) {
	withProvider(t, strongModel, map[string][]modelReply{
		fastModel:   {ok(emptyTranscription)},
		strongModel: {ok(matchingTranscription)},
	})

	receipt, err := ExtractReceiptData(context.Background(), fakeJPEG)
	if err != nil || receipt.ExtractedByModel != strongModel {
		t.Errorf("expected the strong model to read the receipt, got %+v, %v", receipt, err)
	}
}

func TestServerErrorIsRetriedThenEscalated(t *testing.T) {
	provider := withProvider(t, strongModel, map[string][]modelReply{
		fastModel:   {{status: http.StatusBadGateway}},
		strongModel: {ok(matchingTranscription)},
	})

	receipt, err := ExtractReceiptData(context.Background(), fakeJPEG)
	if err != nil || receipt.ExtractedByModel != strongModel {
		t.Fatalf("expected the strong model to take over, got %+v, %v", receipt, err)
	}
	if provider.callsTo(fastModel) != 2 {
		t.Errorf("expected one retry on a 502, got %d calls", provider.callsTo(fastModel))
	}
}

func TestClientErrorIsNotRetried(t *testing.T) {
	provider := withProvider(t, strongModel, map[string][]modelReply{
		fastModel:   {{status: http.StatusBadRequest}},
		strongModel: {ok(matchingTranscription)},
	})

	if _, err := ExtractReceiptData(context.Background(), fakeJPEG); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if provider.callsTo(fastModel) != 1 {
		t.Errorf("a 400 must not be retried, got %d calls", provider.callsTo(fastModel))
	}
}

func TestFailedEscalationKeepsTheMismatchingReading(t *testing.T) {
	withProvider(t, strongModel, map[string][]modelReply{
		fastModel:   {ok(mismatchingTranscription)},
		strongModel: {{status: http.StatusInternalServerError}},
	})

	receipt, err := ExtractReceiptData(context.Background(), fakeJPEG)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if receipt.ExtractedByModel != fastModel || receipt.MatchesPrintedTotal {
		t.Errorf("expected the unmatched fast reading, got %+v", receipt)
	}
}

func TestEscalationTurnedOffBySameModel(t *testing.T) {
	provider := withProvider(t, fastModel, map[string][]modelReply{
		fastModel: {ok(mismatchingTranscription)},
	})

	receipt, err := ExtractReceiptData(context.Background(), fakeJPEG)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if receipt.MatchesPrintedTotal || provider.callsTo(fastModel) != 1 {
		t.Errorf("expected a single unmatched call, got %d calls", provider.callsTo(fastModel))
	}
}

func TestBothModelsFailing(t *testing.T) {
	withProvider(t, strongModel, map[string][]modelReply{
		fastModel:   {{status: http.StatusServiceUnavailable}},
		strongModel: {{status: http.StatusServiceUnavailable}},
	})

	if _, err := ExtractReceiptData(context.Background(), fakeJPEG); err == nil {
		t.Fatal("expected an error when both models fail")
	}
}

func TestRequestCarriesImageTypeAndOrderedStrictSchema(t *testing.T) {
	provider := withProvider(t, strongModel, map[string][]modelReply{
		fastModel: {ok(matchingTranscription)},
	})
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0x0d, 'I', 'H', 'D', 'R'}

	if _, err := ExtractReceiptData(context.Background(), png); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	req := provider.requests[0]
	if req.Temperature != 0 || req.ResponseFormat == nil || !req.ResponseFormat.JSONSchema.Strict {
		t.Errorf("expected a deterministic strict JSON schema request")
	}
	if url := req.Messages[0].Content[1].ImageURL.URL; !strings.HasPrefix(url, "data:image/png;base64,") {
		t.Errorf("expected a PNG data URL, got %q", url[:min(len(url), 40)])
	}

	body := string(provider.rawBody[0])
	order := []string{`"merchant_name"`, `"items"`, `"charges"`, `"printed_subtotal"`, `"grand_total"`}
	last := -1
	for _, key := range order {
		at := strings.Index(body, key)
		if at <= last {
			t.Fatalf("schema properties out of order at %s", key)
		}
		last = at
	}
}

func TestEmptyEndpoint(t *testing.T) {
	previous := currentConfig
	t.Cleanup(func() { SetConfig(previous) })
	SetConfig(Config{})
	t.Setenv("AI_ENDPOINT", "")

	_, err := ExtractReceiptData(context.Background(), fakeJPEG)
	if err == nil || !strings.Contains(err.Error(), "AI_ENDPOINT environment variable is not set") {
		t.Errorf("expected a missing endpoint error, got %v", err)
	}
}
