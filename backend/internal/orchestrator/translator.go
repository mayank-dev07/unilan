package orchestrator

import (
	"context"
	"errors"
)

// Translator converts text in any language to English.
type Translator interface {
	Name() string
	Translate(ctx context.Context, text, srcLang string) (string, error)
}

// ErrNoProvidersAvailable is returned when every provider is open-circuited
// or unconfigured.
var ErrNoProvidersAvailable = errors.New("no translation providers available")
