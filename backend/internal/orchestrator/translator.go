package orchestrator

import (
	"context"
	"errors"
)

// Translator is the upstream LLM-style provider interface.
type Translator interface {
	Name() string
	// Translate converts text into clear, natural English.
	Translate(ctx context.Context, text, srcLang string) (string, error)
	// TranslateTo performs any-to-any translation; returns the input
	// unchanged when src == dst.
	TranslateTo(ctx context.Context, text, srcLang, dstLang string) (string, error)
	// Romanize transliterates non-Latin text to Latin script phonetically.
	Romanize(ctx context.Context, text, srcLang string) (string, error)
}

var ErrNoProvidersAvailable = errors.New("no translation providers available")
