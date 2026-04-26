package handlers

import (
	"context"

	"github.com/unilan/unilanbackend/internal/crypto"
	"github.com/unilan/unilanbackend/internal/orchestrator"
)

// Pipeline encrypts a sender's outgoing message. With per-viewer rendering
// it only stores the ORIGINAL ciphertext (plus legacy display + UNI LAN
// fields snapshotted as the sender's own view, kept for back-compat with
// already-stored rows). Per-viewer renders are computed at read time.
type Pipeline struct {
	Orch   *orchestrator.Orchestrator
	Cipher *crypto.Cipher
}

type PipelineResult struct {
	Original   string
	OriginalCT string
	// Sender's-own-view snapshot. Useful for legacy reads / debugging; per-viewer
	// rendering recomputes from `Original` so we don't depend on these later.
	DisplayCT string
	UniLanCT  string
	SenderLang string
}

// Process renders the sender's own view and encrypts each form. `senderLang`
// must be the user's regional language at send time.
func (p *Pipeline) Process(ctx context.Context, original, senderLang string) (*PipelineResult, error) {
	out, err := p.Orch.ProcessForViewer(ctx, original, senderLang, senderLang)
	if err != nil {
		return nil, err
	}
	originalCT, err := p.Cipher.Encrypt([]byte(out.Original))
	if err != nil {
		return nil, err
	}
	displayCT, err := p.Cipher.Encrypt([]byte(out.Display))
	if err != nil {
		return nil, err
	}
	unilanCT, err := p.Cipher.Encrypt([]byte(out.UniLan))
	if err != nil {
		return nil, err
	}
	return &PipelineResult{
		Original:   out.Original,
		OriginalCT: originalCT,
		DisplayCT:  displayCT,
		UniLanCT:   unilanCT,
		SenderLang: senderLang,
	}, nil
}
