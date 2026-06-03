package ai

import (
	"bytes"
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
	ErrInvalidJSON         = errors.New("invalid JSON format")
	ErrCalculationMismatch = errors.New("subtotal mismatch with sum of items")
)

func (r *ExtractedReceipt) Validate() error {
	var sum float64
	for _, item := range r.Items {
		sum += item.Price * float64(item.Quantity)
	}

	if math.Abs(r.Subtotal-sum) > 0.01 {
		return fmt.Errorf("%w: subtotal is %.2f, sum of items is %.2f", ErrCalculationMismatch, r.Subtotal, sum)
	}

	return nil
}

func cleanJSON(content []byte) []byte {
	str := string(content)
	str = strings.TrimSpace(str)

	if idx := strings.Index(str, "```json"); idx != -1 {
		sub := str[idx+7:]
		if endIdx := strings.Index(sub, "```"); endIdx != -1 {
			str = sub[:endIdx]
		}
	} else if idx := strings.Index(str, "```"); idx != -1 {
		sub := str[idx+3:]
		if endIdx := strings.Index(sub, "```"); endIdx != -1 {
			str = sub[:endIdx]
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

type MiMoRequest struct {
	Model          string              `json:"model"`
	Messages       []MiMoMessage       `json:"messages"`
	ResponseFormat *MiMoResponseFormat  `json:"response_format,omitempty"`
	Temperature    float64             `json:"temperature"`
}

type MiMoResponseFormat struct {
	Type       string              `json:"type"`
	JSONSchema *MiMoJSONSchemaConfig `json:"json_schema,omitempty"`
}

type MiMoJSONSchemaConfig struct {
	Name   string      `json:"name"`
	Strict bool        `json:"strict"`
	Schema interface{} `json:"schema"`
}

type MiMoMessage struct {
	Role    string        `json:"role"`
	Content []MiMoContent `json:"content"`
}

type MiMoContent struct {
	Type     string         `json:"type"`
	Text     string         `json:"text,omitempty"`
	ImageURL *MiMoImageURL `json:"image_url,omitempty"`
}

type MiMoImageURL struct {
	URL string `json:"url"`
}

func ExtractReceiptData(imageBytes []byte) (*ExtractedReceipt, error) {
	var lastErr error
	for attempt := 1; attempt <= 2; attempt++ {
		receipt, err := executeExtractionAttempt(imageBytes)
		if err == nil {
			return receipt, nil
		}
		lastErr = err
		slog.Warn("AI extraction attempt failed, retrying...", "attempt", attempt, "error", err)
		time.Sleep(1 * time.Second)
	}
	return nil, fmt.Errorf("AI extraction failed after 2 attempts: %w", lastErr)
}

func executeExtractionAttempt(imageBytes []byte) (*ExtractedReceipt, error) {
	apiKey := os.Getenv("MIMO_API_KEY")
	endpoint := os.Getenv("MIMO_ENDPOINT")
	model := os.Getenv("MIMO_MODEL")
	if model == "" {
		model = "mimo-v2.5"
	}

	base64Image := base64.StdEncoding.EncodeToString(imageBytes)
	dataURL := fmt.Sprintf("data:image/jpeg;base64,%s", base64Image)

	prompt := "Extract receipt items, prices, quantities, subtotal, tax, and service_charge."

	schema := map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"items": map[string]interface{}{
				"type": "array",
				"items": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"name":     map[string]interface{}{"type": "string"},
						"price":    map[string]interface{}{"type": "number"},
						"quantity": map[string]interface{}{"type": "integer"},
					},
					"required":             []string{"name", "price", "quantity"},
					"additionalProperties": false,
				},
			},
			"subtotal":       map[string]interface{}{"type": "number"},
			"tax":            map[string]interface{}{"type": "number"},
			"service_charge": map[string]interface{}{"type": "number"},
			"grand_total":    map[string]interface{}{"type": "number"},
		},
		"required":             []string{"items", "subtotal", "tax", "service_charge", "grand_total"},
		"additionalProperties": false,
	}

	payload := MiMoRequest{
		Model: model,
		Messages: []MiMoMessage{
			{
				Role: "user",
				Content: []MiMoContent{
					{Type: "text", Text: prompt},
					{Type: "image_url", ImageURL: &MiMoImageURL{URL: dataURL}},
				},
			},
		},
		ResponseFormat: &MiMoResponseFormat{
			Type: "json_schema",
			JSONSchema: &MiMoJSONSchemaConfig{
				Name:   "receipt",
				Strict: true,
				Schema: schema,
			},
		},
		Temperature: 0.0,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

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
