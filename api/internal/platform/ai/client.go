package ai

import (
	"bytes"
	"cmp"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

var (
	ErrInvalidJSON = errors.New("invalid JSON format")
)

const (
	defaultModel           = "ag/gemini-3.8-flash-low"
	defaultEscalationModel = "ag/gemini-3.8-flash-high"
)

type Config struct {
	APIKey          string
	Endpoint        string
	Model           string
	EscalationModel string
}

var currentConfig Config

func SetConfig(cfg Config) {
	currentConfig = cfg
}

var delayBeforeRetry = 1 * time.Second

func resolveConfig() (Config, error) {
	cfg := currentConfig
	if cfg.APIKey == "" {
		cfg.APIKey = os.Getenv("AI_API_KEY")
	}
	if cfg.Endpoint == "" {
		cfg.Endpoint = os.Getenv("AI_ENDPOINT")
	}
	if cfg.Endpoint == "" {
		return Config{}, errors.New("AI_ENDPOINT environment variable is not set")
	}
	if cfg.Model == "" {
		cfg.Model = cmp.Or(os.Getenv("AI_MODEL"), defaultModel)
	}
	if cfg.EscalationModel == "" {
		cfg.EscalationModel = cmp.Or(os.Getenv("AI_ESCALATION_MODEL"), defaultEscalationModel)
	}
	return cfg, nil
}

func ParseReceipt(rawJSON []byte) (*ExtractedReceipt, error) {
	var transcribed transcribedReceipt
	if err := json.Unmarshal(cleanJSON(rawJSON), &transcribed); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidJSON, err)
	}
	if err := transcribed.normalize(); err != nil {
		return nil, err
	}
	return transcribed.reconcile(), nil
}

func cleanJSON(content []byte) []byte {
	str := string(content)
	str = strings.TrimSpace(str)

	if _, sub, found := strings.Cut(str, "```json"); found {
		if content, _, endFound := strings.Cut(sub, "```"); endFound {
			str = content
		}
	} else if _, sub, found := strings.Cut(str, "```"); found {
		if content, _, endFound := strings.Cut(sub, "```"); endFound {
			str = content
		}
	}

	str = strings.TrimSpace(str)

	start := strings.Index(str, "{")
	end := strings.LastIndex(str, "}")
	if start != -1 && end != -1 && start < end {
		str = str[start : end+1]
	}

	return []byte(str)
}

type ChatCompletionRequest struct {
	Model          string              `json:"model"`
	Messages       []ChatMessage       `json:"messages"`
	ResponseFormat *ChatResponseFormat `json:"response_format,omitempty"`
	Temperature    float64             `json:"temperature"`
	Stream         bool                `json:"stream"`
}

type ChatResponseFormat struct {
	Type       string                `json:"type"`
	JSONSchema *ChatJSONSchemaConfig `json:"json_schema,omitempty"`
}

type ChatJSONSchemaConfig struct {
	Name   string `json:"name"`
	Strict bool   `json:"strict"`
	Schema any    `json:"schema"`
}

type ChatMessage struct {
	Role    string        `json:"role"`
	Content []ChatContent `json:"content"`
}

type ChatContent struct {
	Type     string        `json:"type"`
	Text     string        `json:"text,omitempty"`
	ImageURL *ChatImageURL `json:"image_url,omitempty"`
}

type ChatImageURL struct {
	URL string `json:"url"`
}

func ExtractReceiptData(ctx context.Context, imageBytes []byte) (*ExtractedReceipt, error) {
	cfg, err := resolveConfig()
	if err != nil {
		return nil, err
	}

	primary, primaryErr := extractWithRetry(ctx, cfg, cfg.Model, imageBytes)
	if primaryErr == nil && primary.MatchesPrintedTotal {
		return primary, nil
	}
	if cfg.EscalationModel == cfg.Model {
		if primaryErr != nil {
			return nil, primaryErr
		}
		slog.WarnContext(ctx, "AI receipt amounts do not add up to the printed total", "model", primary.ExtractedByModel)
		return primary, nil
	}

	reason := "amounts do not add up"
	if primaryErr != nil {
		reason = primaryErr.Error()
	}
	slog.InfoContext(ctx, "Escalating AI receipt extraction", "from", cfg.Model, "to", cfg.EscalationModel, "reason", reason)

	escalated, escalatedErr := extractWithRetry(ctx, cfg, cfg.EscalationModel, imageBytes)
	switch {
	case escalatedErr == nil:
		if !escalated.MatchesPrintedTotal {
			slog.WarnContext(ctx, "AI receipt amounts do not add up to the printed total", "model", escalated.ExtractedByModel)
		}
		return escalated, nil
	case primaryErr == nil:
		slog.WarnContext(ctx, "AI escalation failed, keeping the unreconciled reading", "model", primary.ExtractedByModel, "error", escalatedErr)
		return primary, nil
	default:
		return nil, fmt.Errorf("AI extraction failed: %w; escalation: %w", primaryErr, escalatedErr)
	}
}

func ExtractReceiptDataWithEscalation(ctx context.Context, imageBytes []byte) (*ExtractedReceipt, error) {
	cfg, err := resolveConfig()
	if err != nil {
		return nil, err
	}

	model := cmp.Or(cfg.EscalationModel, cfg.Model)
	slog.InfoContext(ctx, "Running AI receipt rescan with escalation model", "model", model)
	extracted, err := extractWithRetry(ctx, cfg, model, imageBytes)
	if err != nil {
		return nil, err
	}
	if !extracted.MatchesPrintedTotal {
		slog.WarnContext(ctx, "AI receipt amounts do not add up to the printed total on rescan", "model", extracted.ExtractedByModel)
	}
	return extracted, nil
}

func extractWithRetry(ctx context.Context, cfg Config, model string, imageBytes []byte) (*ExtractedReceipt, error) {
	var lastErr error
	for attempt := 1; attempt <= 2; attempt++ {
		receipt, err := executeExtractionAttempt(ctx, cfg, model, imageBytes)
		if err == nil {
			receipt.ExtractedByModel = model
			return receipt, nil
		}
		lastErr = err
		if !isRetryable(err) {
			return nil, err
		}
		slog.WarnContext(ctx, "AI extraction attempt failed", "model", model, "attempt", attempt, "error", err)

		if attempt == 2 {
			break
		}
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("AI extraction context cancelled: %w", ctx.Err())
		case <-time.After(delayBeforeRetry):
		}
	}
	return nil, fmt.Errorf("AI extraction with %s failed after 2 attempts: %w", model, lastErr)
}

type statusError struct {
	code int
	body string
}

func (e *statusError) Error() string {
	return fmt.Sprintf("AI API returned status %d: %s", e.code, e.body)
}

func isRetryable(err error) bool {
	if errors.Is(err, ErrUnreadableReceipt) || errors.Is(err, context.Canceled) {
		return false
	}
	if se, ok := errors.AsType[*statusError](err); ok {
		return se.code == http.StatusTooManyRequests || se.code >= 500
	}
	return true
}

func imageDataURL(imageBytes []byte) string {
	mimeType := http.DetectContentType(imageBytes)
	if !strings.HasPrefix(mimeType, "image/") {
		mimeType = "image/jpeg"
	}
	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(imageBytes))
}

func executeExtractionAttempt(ctx context.Context, cfg Config, model string, imageBytes []byte) (*ExtractedReceipt, error) {
	payload := ChatCompletionRequest{
		Model: model,
		Messages: []ChatMessage{
			{
				Role: "user",
				Content: []ChatContent{
					{Type: "text", Text: transcriptionPrompt},
					{Type: "image_url", ImageURL: &ChatImageURL{URL: imageDataURL(imageBytes)}},
				},
			},
		},
		ResponseFormat: &ChatResponseFormat{
			Type: "json_schema",
			JSONSchema: &ChatJSONSchemaConfig{
				Name:   "receipt",
				Strict: true,
				Schema: transcribedReceiptSchema,
			},
		},
		Temperature: 0.0,
		Stream:      false,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", cfg.Endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.APIKey))

	client := &http.Client{
		Timeout: 45 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, &statusError{code: resp.StatusCode, body: string(body)}
	}

	var completion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &completion); err != nil {
		return nil, fmt.Errorf("failed to parse AI response: %v | body: %s", err, string(body))
	}

	if completion.Error != nil {
		return nil, fmt.Errorf("AI Error: %s", completion.Error.Message)
	}

	if len(completion.Choices) == 0 {
		return nil, fmt.Errorf("no choices returned from AI. Full body: %s", string(body))
	}

	return ParseReceipt([]byte(completion.Choices[0].Message.Content))
}
