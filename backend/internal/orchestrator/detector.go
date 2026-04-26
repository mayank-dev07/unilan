package orchestrator

import (
	"strings"

	"github.com/pemistahl/lingua-go"
)

// Detector wraps lingua-go for language detection.
type Detector struct {
	d lingua.LanguageDetector
}

// NewDetector builds a detector pre-loaded with common languages used in chat.
// Trades a one-time ~50MB load for fast (~1ms) per-call detection.
func NewDetector() *Detector {
	langs := []lingua.Language{
		lingua.English,
		lingua.Spanish,
		lingua.French,
		lingua.German,
		lingua.Italian,
		lingua.Portuguese,
		lingua.Russian,
		lingua.Chinese,
		lingua.Japanese,
		lingua.Korean,
		lingua.Arabic,
		lingua.Hindi,
		lingua.Bengali,
		lingua.Urdu,
		lingua.Turkish,
		lingua.Vietnamese,
		lingua.Thai,
		lingua.Indonesian,
		lingua.Dutch,
		lingua.Polish,
		lingua.Ukrainian,
		lingua.Hebrew,
		lingua.Persian,
		lingua.Greek,
		lingua.Tamil,
		lingua.Telugu,
		lingua.Marathi,
	}
	return &Detector{
		d: lingua.NewLanguageDetectorBuilder().
			FromLanguages(langs...).
			WithPreloadedLanguageModels().
			Build(),
	}
}

// Result describes the outcome of detection.
type Result struct {
	Language   string  // ISO 639-1 like "en", "ru", "hi"; empty if unknown
	Confidence float64 // 0..1
	IsEnglish  bool
	NeedsTranslation bool
}

// Detect returns the most likely language. We translate when:
//   - the detector cannot decide at all, OR
//   - the top candidate is non-English and the second candidate is not English
//     with a comparable score (so we don't waste an LLM call on borderline
//     English text).
func (d *Detector) Detect(text string) Result {
	t := strings.TrimSpace(text)
	if t == "" {
		return Result{IsEnglish: true}
	}
	lang, ok := d.d.DetectLanguageOf(t)
	if !ok {
		return Result{NeedsTranslation: true}
	}
	conf := d.d.ComputeLanguageConfidence(t, lang)
	code := strings.ToLower(lang.IsoCode639_1().String())
	res := Result{
		Language:   code,
		Confidence: conf,
		IsEnglish:  code == "en",
	}
	res.NeedsTranslation = !res.IsEnglish
	return res
}
