package ai

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
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
	if strings.HasPrefix(str, "```") {
		str = strings.TrimPrefix(str, "```")
		if strings.HasPrefix(strings.ToLower(str), "json") {
			str = str[4:]
		}
		if strings.HasSuffix(str, "```") {
			str = strings.TrimSuffix(str, "```")
		}
		str = strings.TrimSpace(str)
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
	Model    string        `json:"model"`
	Messages []MiMoMessage `json:"messages"`
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
	apiKey := os.Getenv("MIMO_API_KEY")
	endpoint := os.Getenv("MIMO_ENDPOINT")
	model := os.Getenv("MIMO_MODEL")
	if model == "" {
		model = "mimo-v2.5"
	}

	base64Image := base64.StdEncoding.EncodeToString(imageBytes)
	dataURL := fmt.Sprintf("data:image/jpeg;base64,%s", base64Image)

	prompt := `Extract receipt items, prices, quantities, subtotal, tax, and service_charge. 
	Return valid JSON following this schema: 
	{"items": [{"name": string, "price": number, "quantity": number}], "subtotal": number, "tax": number, "service_charge": number, "grand_total": number}`

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
	
	// Parse OpenAI-style response
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
