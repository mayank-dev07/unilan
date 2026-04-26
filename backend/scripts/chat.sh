#!/usr/bin/env bash
# Interactive UNI LAN translator REPL.
# Boots the server, signs up a throwaway user, then loops:
#   you type something -> shows UNI LAN translation.
#
# Usage:
#   OPENROUTER_API_KEY=sk-or-... ./scripts/chat.sh
# Optional:
#   GROQ_API_KEY=gsk_...        # fallback provider
#   PORT=8080                   # default 8123
#   KEEP_DB=1                   # keep /tmp/unilan-chat.db across runs

set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-8123}"
DB_PATH="${DB_PATH:-/tmp/unilan-chat.db}"
BASE="http://localhost:${PORT}"

# Colors
B=$'\e[1m'; DIM=$'\e[2m'; G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; R=$'\e[31m'; N=$'\e[0m'

if [[ -z "${OPENROUTER_API_KEY:-}" && -z "${GROQ_API_KEY:-}" ]]; then
  echo "${Y}warn:${N} no OPENROUTER_API_KEY or GROQ_API_KEY set."
  echo "      English will work; non-English will pass through unchanged."
  echo
fi

echo "${B}== UNI LAN chat REPL ==${N}"
echo "${DIM}building server...${N}"
go build -o ./unilanbackend ./cmd/server

if [[ "${KEEP_DB:-0}" != "1" ]]; then
  rm -f "$DB_PATH" "$DB_PATH"-wal "$DB_PATH"-shm
fi

JWT_SECRET="$(openssl rand -hex 32)"
MESSAGE_ENC_KEY="$(openssl rand -hex 32)"

export JWT_SECRET MESSAGE_ENC_KEY PORT DB_PATH
export GIN_MODE=release LOG_JSON=false

echo "${DIM}starting server on :${PORT}...${N}"
./unilanbackend > /tmp/unilan-chat.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true; rm -f ./unilanbackend' EXIT

# wait for ready
for _ in $(seq 1 50); do
  if curl -sf "$BASE/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
if ! curl -sf "$BASE/healthz" >/dev/null 2>&1; then
  echo "${R}server failed to start. log:${N}"
  cat /tmp/unilan-chat.log
  exit 1
fi
echo "${G}ready.${N}"

# signup throwaway user (ignore conflict if KEEP_DB carried it over)
USER="repl_$(date +%s)"
RESP="$(curl -s -X POST "$BASE/auth/signup" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"replreplrepl\"}")"
TOK="$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")"
if [[ -z "$TOK" ]]; then
  echo "${R}signup failed:${N} $RESP"
  exit 1
fi

cat <<EOF

${B}Type any text in any language. Press Ctrl+C or type 'quit' to exit.${N}
${DIM}server log: tail -f /tmp/unilan-chat.log${N}

EOF

while true; do
  printf "${C}you>${N} "
  if ! IFS= read -r LINE; then echo; break; fi
  [[ "$LINE" == "quit" || "$LINE" == "exit" ]] && break
  [[ -z "$LINE" ]] && continue

  # build JSON safely with python
  BODY="$(python3 -c "import json,sys; print(json.dumps({'text': sys.argv[1]}))" "$LINE")"
  RAW="$(curl -s -X POST "$BASE/translate" \
    -H "Authorization: Bearer $TOK" \
    -H 'Content-Type: application/json' \
    -d "$BODY")"

  python3 - "$RAW" <<'PY'
import json, sys
try:
    d = json.loads(sys.argv[1])
except Exception:
    print("\033[31m  parse error:\033[0m", sys.argv[1]); sys.exit()
B="\033[1m"; DIM="\033[2m"; G="\033[32m"; Y="\033[33m"; N="\033[0m"
if d.get("error"):
    print(f"\033[31m  error:\033[0m {d['error']}"); sys.exit()
print(f"  {DIM}detected:{N} {d.get('detected_lang','?')} ({d.get('confidence',0):.2f})  "
      f"{DIM}via:{N} {d.get('provider_used') or 'no-translate'}  "
      f"{DIM}{d.get('latency_ms',0)}ms{N}")
if d.get("english") and d["english"] != d.get("original"):
    print(f"  {Y}english:{N}  {d['english']}")
print(f"  {G}unilan:{N}   {B}{d['unilan']}{N}")
print()
PY
done

echo "${DIM}bye.${N}"
