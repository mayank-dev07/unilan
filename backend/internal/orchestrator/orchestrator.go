package orchestrator

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/unilan/unilanbackend/internal/translator"
)

// Orchestrator turns a sender's text into the per-viewer rendering. The
// pipeline is:
//
//  1. If sender_lang == viewer_lang  → keep the original text as the display.
//  2. Otherwise, translate sender → viewer with the LLM.
//  3. If viewer's language uses non-Latin script, romanize the display.
//  4. Map the (now-Latin) text to UNI LAN.
//
// Cache key includes both languages so the same text rendered for two
// different viewers doesn't collide.
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

// Outcome is the per-viewer rendering returned by ProcessForViewer.
type Outcome struct {
	Original     string  `json:"original"`     // sender's raw text
	Display      string  `json:"display"`      // text in viewer's language (their script)
	UniLan       string  `json:"unilan"`       // UNI LAN of romanized Display
	SenderLang   string  `json:"sender_lang"`
	ViewerLang   string  `json:"viewer_lang"`
	ProviderUsed string  `json:"provider_used"` // "" / "cache" / "openrouter" / "groq" / "verbatim-fallback"
	LatencyMS    int64   `json:"latency_ms"`
	Confidence   float64 `json:"confidence"`
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

// Process is a back-compat shim that renders for the sender themself
// (sender_lang == viewer_lang). New code should call ProcessForViewer.
func (o *Orchestrator) Process(ctx context.Context, text string) (*Outcome, error) {
	det := o.Detector.Detect(text)
	src := det.Language
	if src == "" {
		src = "en"
	}
	return o.ProcessForViewer(ctx, text, src, src)
}

// ProcessForViewer renders the given text as it should appear to a viewer
// whose preferred language is `viewerLang`. `senderLang` is the sender's
// language at send time (snapshot, not their current preference).
func (o *Orchestrator) ProcessForViewer(ctx context.Context, text, senderLang, viewerLang string) (*Outcome, error) {
	start := time.Now()
	if senderLang == "" {
		senderLang = "en"
	}
	if viewerLang == "" {
		viewerLang = "en"
	}

	out := &Outcome{
		Original:   text,
		SenderLang: senderLang,
		ViewerLang: viewerLang,
	}

	// ----- 1. Translate to viewer's language (or skip if same) -----
	display := text
	if senderLang != viewerLang {
		key := "tr:" + senderLang + "→" + viewerLang + "|" + text
		if cached, ok := o.Cache.Get(key, ""); ok {
			display = cached
			out.ProviderUsed = "cache"
		} else {
			tr, prov, err := o.translateWithFallback(ctx, text, senderLang, viewerLang)
			if err != nil {
				o.Logger.Warn("translateTo failed, using original",
					"err", err, "src", senderLang, "dst", viewerLang)
				display = text
				out.ProviderUsed = "verbatim-fallback"
			} else {
				display = tr
				out.ProviderUsed = prov
				o.Cache.Put(key, "", display)
			}
		}
	}
	out.Display = display

	// ----- 2. Romanize if the viewer's language uses non-Latin script -----
	latin := display
	if !IsLatinLang(viewerLang) {
		if !translator.IsLatin(display) {
			rkey := "rom:" + viewerLang + "|" + display
			if cached, ok := o.Cache.Get(rkey, ""); ok {
				latin = cached
				if out.ProviderUsed == "" {
					out.ProviderUsed = "cache"
				}
			} else {
				rom, prov, err := o.romanizeWithFallback(ctx, display, viewerLang)
				if err != nil {
					o.Logger.Warn("romanize failed, mapping verbatim",
						"err", err, "lang", viewerLang)
					// Leave latin = display; non-Latin chars pass through to UNI LAN.
				} else {
					latin = rom
					o.Cache.Put(rkey, "", latin)
					if out.ProviderUsed == "" {
						out.ProviderUsed = prov
					}
				}
			}
		}
	}

	// ----- 3. Map to UNI LAN -----
	out.UniLan = translator.ToUniLan(latin)
	out.LatencyMS = time.Since(start).Milliseconds()

	o.Logger.Info("orchestrator processed",
		"src", senderLang, "dst", viewerLang,
		"provider", out.ProviderUsed,
		"latency_ms", out.LatencyMS,
		"len", fmt.Sprintf("%d→%d", len(text), len(out.UniLan)),
	)
	return out, nil
}

func (o *Orchestrator) translateWithFallback(ctx context.Context, text, srcLang, dstLang string) (string, string, error) {
	if len(o.Providers) == 0 {
		return "", "", ErrNoProvidersAvailable
	}
	var lastErr error
	for _, p := range o.Providers {
		if !p.Breaker.Allow() {
			continue
		}
		for attempt := 1; attempt <= 2; attempt++ {
			cctx, cancel := context.WithTimeout(ctx, 15*time.Second)
			out, err := p.T.TranslateTo(cctx, text, srcLang, dstLang)
			cancel()
			if err == nil && out != "" {
				p.Breaker.RecordSuccess()
				return out, p.T.Name(), nil
			}
			lastErr = err
			o.Logger.Warn("translateTo attempt failed",
				"provider", p.T.Name(), "attempt", attempt, "err", err)
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

func (o *Orchestrator) romanizeWithFallback(ctx context.Context, text, srcLang string) (string, string, error) {
	if len(o.Providers) == 0 {
		return "", "", ErrNoProvidersAvailable
	}
	var lastErr error
	for _, p := range o.Providers {
		if !p.Breaker.Allow() {
			continue
		}
		for attempt := 1; attempt <= 2; attempt++ {
			cctx, cancel := context.WithTimeout(ctx, 15*time.Second)
			out, err := p.T.Romanize(cctx, text, srcLang)
			cancel()
			if err == nil && out != "" {
				p.Breaker.RecordSuccess()
				return out, p.T.Name(), nil
			}
			lastErr = err
			o.Logger.Warn("romanize attempt failed",
				"provider", p.T.Name(), "attempt", attempt, "err", err)
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
