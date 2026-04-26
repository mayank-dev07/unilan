# UniLan Backend

A chat backend where messages are translated to **UNI LAN** — a custom alphabet that lets people from different language backgrounds communicate through a shared visual representation.

## How it works

1. User types a message in any language (English, Russian, Hindi, etc.)
2. If the input is non-Latin, an LLM (via OpenRouter, Groq fallback) translates it to English
3. A pure-Go mapper converts each English letter to its UNI LAN symbol (e.g. `A` → `/-`, `B` → `|:`)
4. The message is encrypted (AES-256-GCM) at rest and broadcast over WebSocket to recipients

## UNI LAN alphabet

| EN | UNI LAN | EN | UNI LAN |
|----|---------|----|---------|
| A  | /-      | N  | ה       |
| B  | \|:     | O  | []      |
| C  | (       | P  | \|⸣     |
| D  | \|]     | Q  | Ω       |
| E  | \|~     | R  | マ      |
| F  | Г       | S  | _\|‾‾   |
| G  | ᮌ       | T  | ‾‾      |
| H  | ˦       | U  | \|_     |
| I  | !       | V  | v       |
| J  | _/      | W  | \\\\\\  |
| K  | \|<     | X  | ⅄       |
| L  | \\_     | Y  | >       |
| M  | 𐍜       | Z  | ‾‾\|_   |

## Setup

```bash
cp .env.example .env
# Fill in JWT_SECRET, MESSAGE_ENC_KEY, OPENROUTER_API_KEY (or GROQ_API_KEY)
go mod tidy
go run ./cmd/server
```

## API surface

| Method | Path                              | Auth | Purpose                          |
|--------|-----------------------------------|------|----------------------------------|
| POST   | /auth/signup                      | no   | Create account                   |
| POST   | /auth/login                       | no   | Get JWT                          |
| GET    | /me                               | yes  | Current user                     |
| POST   | /translate                        | yes  | Preview UNI LAN translation      |
| POST   | /conversations                    | yes  | Create conversation              |
| GET    | /conversations                    | yes  | List my conversations            |
| GET    | /conversations/:id/messages       | yes  | Message history (decrypted)      |
| POST   | /conversations/:id/messages       | yes  | Send message (translated + enc)  |
| GET    | /ws?token=...&conversation_id=... | yes  | Real-time WebSocket              |
