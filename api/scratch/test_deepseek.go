package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type ChatMessage struct {
	Role    string        `json:"role"`
	Content []ChatContent `json:"content"`
}

type ChatContent struct {
	Type     string        `json:"type"`
	Text     string        `json:"text,omitempty"`
	ImageURL *ImageURLInfo `json:"image_url,omitempty"`
}

type ImageURLInfo struct {
	URL string `json:"url"`
}

type ChatRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
}

func main() {
	// Retrieve API key from environment variable
	apiKey := os.Getenv("DEEPSEEK_API_KEY")
	if apiKey == "" {
		fmt.Println("Error: DEEPSEEK_API_KEY environment variable is not set.")
		return
	}

	model := os.Getenv("DEEPSEEK_MODEL")
	if model == "" {
		model = "deepseek-v4-pro" // or deepseek-v4-flash if mapped
	}

	fmt.Printf("Testing model: %s\n", model)

	// Send a dummy 1x1 pixel base64 image as input
	dummyImageBase64 := "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

	payload := ChatRequest{
		Model: model,
		Messages: []ChatMessage{
			{
				Role: "user",
				Content: []ChatContent{
					{Type: "text", Text: "What is in this image?"},
					{Type: "image_url", ImageURL: &ImageURLInfo{URL: dummyImageBase64}},
				},
			},
		},
	}

	jsonData, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling JSON: %v\n", err)
		return
	}

	req, err := http.NewRequest("POST", "https://api.deepseek.com/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	fmt.Println("Sending request to https://api.deepseek.com/chat/completions...")
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error making HTTP request: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response body: %v\n", err)
		return
	}

	fmt.Printf("HTTP Status Code: %d\n", resp.StatusCode)
	fmt.Printf("Response Body:\n%s\n", string(body))
}
