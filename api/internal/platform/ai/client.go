package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"os"
	"strings"
	"time"
)

var (
	ErrInvalidJSON = errors.New("invalid JSON format")
)

type Config struct {
	APIKey   string
	Endpoint string
	Model    string
}

var currentConfig Config

func SetConfig(cfg Config) {
	currentConfig = cfg
}

func (r *ExtractedReceipt) Validate() error {
	var sum float64
	for _, item := range r.Items {
		sum += item.Price * float64(item.Quantity)
	}

	if math.Abs(r.Subtotal-sum) > 0.01 {
		slog.Warn("AI receipt subtotal mismatch, adjusting to sum of items", "original_subtotal", r.Subtotal, "sum_of_items", sum)
		r.Subtotal = sum
		r.GrandTotal = sum + r.Tax + r.ServiceCharge
	}

	return nil
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

func ParseReceipt(rawJSON []byte) (*ExtractedReceipt, error) {
	cleaned := cleanJSON(rawJSON)
	var receipt ExtractedReceipt
	if err := json.Unmarshal(cleaned, &receipt); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidJSON, err)
	}

	if err := receipt.Validate(); err != nil {
		return nil, err
	}

	return &receipt, nil
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
	var lastErr error
	for attempt := 1; attempt <= 2; attempt++ {
		receipt, err := executeExtractionAttempt(ctx, imageBytes)
		if err == nil {
			return receipt, nil
		}
		lastErr = err
		slog.WarnContext(ctx, "AI extraction attempt failed, retrying...", "attempt", attempt, "error", err)

		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("AI extraction context cancelled: %w", ctx.Err())
		case <-time.After(1 * time.Second):
		}
	}
	return nil, fmt.Errorf("AI extraction failed after 2 attempts: %w", lastErr)
}

func executeExtractionAttempt(ctx context.Context, imageBytes []byte) (*ExtractedReceipt, error) {
	apiKey := currentConfig.APIKey
	if apiKey == "" {
		apiKey = os.Getenv("AI_API_KEY")
	}

	endpoint := currentConfig.Endpoint
	if endpoint == "" {
		endpoint = os.Getenv("AI_ENDPOINT")
	}
	if endpoint == "" {
		return nil, errors.New("AI_ENDPOINT environment variable is not set")
	}

	model := currentConfig.Model
	if model == "" {
		model = os.Getenv("AI_MODEL")
	}
	if model == "" {
		model = "gemini-3.8-flash-high"
	}

	base64Image := base64.StdEncoding.EncodeToString(imageBytes)
	dataURL := fmt.Sprintf("data:image/jpeg;base64,%s", base64Image)

	prompt := "Extract receipt data into the requested JSON schema.\nStrict rules:\n1. All price, quantity, subtotal, tax, service_charge, and grand_total values must be raw numbers, do not wrap them in quotes.\n2. Do NOT use decimal points for thousands separators (e.g., 14.000 on an Indonesian receipt must be output as 14000).\n3. Ensure mathematical consistency: subtotal must exactly equal the sum of (price * quantity) of all items, and grand_total must exactly equal subtotal + tax + service_charge.\n4. If there are discounts, represent them as a line item with a negative price so the math remains perfectly consistent.\n5. Detect packages and their sub-items. If an item has sub-items listed below it (often indented or with '-' prefix), nest them under 'sub_items'. Sub-items should have a price of 0 if their cost is included in the parent package.\n6. Extract the merchant or store name from the receipt header if visible (e.g. restaurant name, cafe name, shop name). Output it as merchant_name. If not detectable, omit the field."

	itemSchema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"name":     map[string]any{"type": "string"},
			"price":    map[string]any{"type": "number"},
			"quantity": map[string]any{"type": "integer"},
			"sub_items": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"name":     map[string]any{"type": "string"},
						"price":    map[string]any{"type": "number"},
						"quantity": map[string]any{"type": "integer"},
					},
					"required":             []string{"name", "price", "quantity"},
					"additionalProperties": false,
				},
			},
		},
		"required":             []string{"name", "price", "quantity"},
		"additionalProperties": false,
	}

	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"merchant_name": map[string]any{"type": "string"},
			"items": map[string]any{
				"type":  "array",
				"items": itemSchema,
			},
			"subtotal":       map[string]any{"type": "number"},
			"tax":            map[string]any{"type": "number"},
			"service_charge": map[string]any{"type": "number"},
			"grand_total":    map[string]any{"type": "number"},
		},
		"required":             []string{"items", "subtotal", "tax", "service_charge", "grand_total"},
		"additionalProperties": false,
	}

	payload := ChatCompletionRequest{
		Model: model,
		Messages: []ChatMessage{
			{
				Role: "user",
				Content: []ChatContent{
					{Type: "text", Text: prompt},
					{Type: "image_url", ImageURL: &ChatImageURL{URL: dataURL}},
				},
			},
		},
		ResponseFormat: &ChatResponseFormat{
			Type: "json_schema",
			JSONSchema: &ChatJSONSchemaConfig{
				Name:   "receipt",
				Strict: true,
				Schema: schema,
			},
		},
		Temperature: 0.0,
		Stream:      false,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

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
		return nil, fmt.Errorf("AI API returned status %d: %s", resp.StatusCode, string(body))
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
