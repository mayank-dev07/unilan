package orchestrator

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// LLMProvider wraps an OpenAI-compatible chat-completions endpoint
// (OpenRouter, Groq, etc.) as a Translator.
type LLMProvider struct {
	name    string
	baseURL string
	apiKey  string
	model   string
	http    *http.Client
}

func NewLLMProvider(name, baseURL, apiKey, model string) *LLMProvider {
	return &LLMProvider{
		name:    name,
		baseURL: baseURL,
		apiKey:  apiKey,
		model:   model,
		http:    &http.Client{Timeout: 20 * time.Second},
	}
}

func (p *LLMProvider) Name() string { return p.name }

type chatMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type chatReq struct {
	Model       string    `json:"model"`
	Messages    []chatMsg `json:"messages"`
	Temperature float64   `json:"temperature"`
}
type chatResp struct {
	Choices []struct {
		Message chatMsg `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

const sysPrompt = `You are a translation engine. Translate the user's message into clear, natural English.
Rules:
- Output ONLY the English translation. No quotes, no explanations, no preamble, no notes.
- If the input is already English, return it unchanged.
- If the input is a romanized non-English language (e.g. Hinglish, romanized Arabic), translate the meaning into English.
- Preserve names, numbers, URLs, emoji, and proper nouns.
- Keep punctuation and capitalization natural for English.`

func (p *LLMProvider) Translate(ctx context.Context, text, srcLang string) (string, error) {
	user := text
	if srcLang != "" && srcLang != "en" {
		user = "Source language: " + srcLang + "\nText: " + text
	}
	body, err := json.Marshal(chatReq{
		Model:       p.model,
		Temperature: 0.1,
		Messages: []chatMsg{
			{Role: "system", Content: sysPrompt},
			{Role: "user", Content: user},
		},
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	if p.name == "openrouter" {
		req.Header.Set("HTTP-Referer", "https://unilan.local")
		req.Header.Set("X-Title", "UniLan Backend")
	}
	resp, err := p.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("status %d: %s", resp.StatusCode, truncate(string(raw), 300))
	}
	var cr chatResp
	if err := json.Unmarshal(raw, &cr); err != nil {
		return "", err
	}
	if cr.Error != nil {
		return "", errors.New(cr.Error.Message)
	}
	if len(cr.Choices) == 0 {
		return "", errors.New("no choices")
	}
	return strings.TrimSpace(cr.Choices[0].Message.Content), nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
