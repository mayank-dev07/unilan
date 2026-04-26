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
// (OpenRouter, Groq, etc.). Exposes Translate (legacy: → English),
// TranslateTo (any-to-any), and Romanize (Latin transliteration).
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

const translateSysPrompt = `You are a translation engine. Translate the user's message into clear, natural English.
Output ONLY the English translation. No quotes, no explanations, no preamble.
If the input is already English, return it unchanged. Preserve names, numbers, URLs, emoji.`

const romanizeSysPrompt = `You are a romanization (transliteration) engine.
Convert the user's text into the Latin (English) alphabet by phonetic transliteration ONLY.
DO NOT translate the meaning. Preserve the original word identity, just spelled with Latin letters.

Rules:
- Output ONLY the romanized text. No quotes, no explanations, no preamble.
- For Chinese: use Hanyu Pinyin WITHOUT tone marks (你好 → "ni hao", 嗨宝贝 → "hai bao bei").
- For Japanese: use Hepburn romaji (こんにちは → "konnichiwa").
- For Korean: use Revised Romanization (안녕하세요 → "annyeonghaseyo").
- For Cyrillic (Russian, Ukrainian): standard transliteration (Привет → "Privet").
- For Arabic / Hebrew / Persian: ALA-LC or common transliteration.
- For Devanagari (Hindi, Marathi) / Bengali / Tamil / Telugu: IAST-style without diacritics (नमस्ते → "namaste").
- For Greek: standard transliteration (Ευχαριστώ → "Efcharisto").
- For text already in Latin script (English, Spanish, French, etc.): return UNCHANGED.
- Preserve numbers, punctuation, emoji, URLs, and Latin-script words mixed in.
- Use lowercase except for the start of sentences and proper nouns.`

func (p *LLMProvider) Translate(ctx context.Context, text, srcLang string) (string, error) {
	user := text
	if srcLang != "" && srcLang != "en" {
		user = "Source language: " + srcLang + "\nText: " + text
	}
	return p.complete(ctx, translateSysPrompt, user)
}

// TranslateTo performs any-to-any translation. If src == dst, returns input
// unchanged without an LLM call.
func (p *LLMProvider) TranslateTo(ctx context.Context, text, srcLang, dstLang string) (string, error) {
	if srcLang == dstLang || dstLang == "" {
		return text, nil
	}
	srcName := LanguageName(srcLang)
	dstName := LanguageName(dstLang)
	sys := fmt.Sprintf(`You are a translation engine. Translate the user's message from %s into natural, idiomatic %s.
Output ONLY the translation in %s. No quotes, no explanations, no preamble, no notes, no transliteration.
Use the native script of %s. Preserve names, numbers, URLs, and emoji.`, srcName, dstName, dstName, dstName)
	return p.complete(ctx, sys, text)
}

// Romanize transliterates non-Latin text to Latin script phonetically.
func (p *LLMProvider) Romanize(ctx context.Context, text, srcLang string) (string, error) {
	user := text
	if srcLang != "" {
		user = "Source language: " + srcLang + "\nText: " + text
	}
	return p.complete(ctx, romanizeSysPrompt, user)
}

func (p *LLMProvider) complete(ctx context.Context, systemPrompt, userText string) (string, error) {
	body, err := json.Marshal(chatReq{
		Model:       p.model,
		Temperature: 0.1,
		Messages: []chatMsg{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userText},
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
