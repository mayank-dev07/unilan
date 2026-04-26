package handlers

import (
	"context"

	"github.com/unilan/unilanbackend/internal/crypto"
	"github.com/unilan/unilanbackend/internal/orchestrator"
)

// Pipeline runs the orchestrator (detect → translate → map) then encrypts the
// three text forms for storage.
type Pipeline struct {
	Orch   *orchestrator.Orchestrator
	Cipher *crypto.Cipher
}

type PipelineResult struct {
	*orchestrator.Outcome
	OriginalCT string
	EnglishCT  string
	UniLanCT   string
}

func (p *Pipeline) Process(ctx context.Context, original string) (*PipelineResult, error) {
	out, err := p.Orch.Process(ctx, original)
	if err != nil {
		return nil, err
	}
	originalCT, err := p.Cipher.Encrypt([]byte(out.Original))
	if err != nil {
		return nil, err
	}
	englishCT, err := p.Cipher.Encrypt([]byte(out.English))
	if err != nil {
		return nil, err
	}
	unilanCT, err := p.Cipher.Encrypt([]byte(out.UniLan))
	if err != nil {
		return nil, err
	}
	return &PipelineResult{
		Outcome:    out,
		OriginalCT: originalCT,
		EnglishCT:  englishCT,
		UniLanCT:   unilanCT,
	}, nil
}
