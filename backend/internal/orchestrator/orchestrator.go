package orchestrator

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/unilan/unilanbackend/internal/translator"
)

// Orchestrator runs: detect → cache lookup → translate (multi-provider with
// breakers + retry) → cache write → UNI LAN map. It is the single entry point
// for "user typed something, give me UNI LAN".
type Orchestrator struct {
	Detector  *Detector
	Providers []*ManagedProvider
	Cache     *Cache
	Logger    *slog.Logger
}

// ManagedProvider pairs a Translator with its breaker.
type ManagedProvider struct {
	T       Translator
	Breaker *Breaker
}

// Outcome is the full result returned from Process.
type Outcome struct {
	Original         string  `json:"original"`
	English          string  `json:"english"`
	UniLan           string  `json:"unilan"`
	DetectedLang     string  `json:"detected_lang"`
	Confidence       float64 `json:"confidence"`
	ProviderUsed     string  `json:"provider_used"`     // "" if no translation needed, "cache" if served from cache
	NeededTranslate  bool    `json:"needed_translate"`
	LatencyMS        int64   `json:"latency_ms"`
}

func New(det *Detector, providers []*ManagedProvider, cache *Cache, log *slog.Logger) *Orchestrator {
	if log == nil {
		log = slog.Default()
	}
	return &Orchestrator{
		Detector:  det,
		Providers: providers,
		Cache:     cache,
		Logger:    log,
	}
}

func (o *Orchestrator) Process(ctx context.Context, text string) (*Outcome, error) {
	start := time.Now()
	det := o.Detector.Detect(text)

	out := &Outcome{
		Original:        text,
		DetectedLang:    det.Language,
		Confidence:      det.Confidence,
		NeededTranslate: det.NeedsTranslation,
	}

	english := text
	if det.NeedsTranslation {
		if cached, ok := o.Cache.Get(det.Language, text); ok {
			english = cached
			out.ProviderUsed = "cache"
		} else {
			translated, provider, err := o.translateWithFallback(ctx, text, det.Language)
			if err != nil {
				// Last-resort degradation: map verbatim. Recipient sees garbled
				// glyphs but the chat keeps working.
				o.Logger.Warn("translation failed, mapping verbatim",
					"err", err,
					"lang", det.Language,
				)
				english = text
				out.ProviderUsed = "verbatim-fallback"
			} else {
				english = translated
				out.ProviderUsed = provider
				o.Cache.Put(det.Language, text, english)
			}
		}
	}

	out.English = english
	out.UniLan = translator.ToUniLan(english)
	out.LatencyMS = time.Since(start).Milliseconds()

	o.Logger.Info("orchestrator processed",
		"detected", det.Language,
		"confidence", fmt.Sprintf("%.2f", det.Confidence),
		"provider", out.ProviderUsed,
		"latency_ms", out.LatencyMS,
		"needed_translate", out.NeededTranslate,
	)
	return out, nil
}

// translateWithFallback walks providers in order. For each provider it does up
// to 2 attempts with a short backoff before moving on.
func (o *Orchestrator) translateWithFallback(ctx context.Context, text, srcLang string) (string, string, error) {
	if len(o.Providers) == 0 {
		return "", "", ErrNoProvidersAvailable
	}
	var lastErr error
	for _, p := range o.Providers {
		if !p.Breaker.Allow() {
			o.Logger.Debug("breaker open, skipping", "provider", p.T.Name())
			continue
		}
		for attempt := 1; attempt <= 2; attempt++ {
			cctx, cancel := context.WithTimeout(ctx, 15*time.Second)
			out, err := p.T.Translate(cctx, text, srcLang)
			cancel()
			if err == nil && out != "" {
				p.Breaker.RecordSuccess()
				return out, p.T.Name(), nil
			}
			lastErr = err
			o.Logger.Warn("translate attempt failed",
				"provider", p.T.Name(),
				"attempt", attempt,
				"err", err,
			)
			if attempt < 2 {
				select {
				case <-time.After(200 * time.Millisecond):
				case <-ctx.Done():
					return "", "", ctx.Err()
				}
			}
		}
		p.Breaker.RecordFailure()
	}
	if lastErr == nil {
		lastErr = ErrNoProvidersAvailable
	}
	return "", "", lastErr
}
