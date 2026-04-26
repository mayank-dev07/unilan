#!/usr/bin/env bash
# One-shot Hasura metadata setup. Idempotent — safe to re-run.
#
# What it does:
#   1. Tracks the 4 tables (users, conversations, conversation_members, messages)
#   2. Wires up relationships (so GraphQL can traverse: conversation.members,
#      message.sender, etc.)
#   3. Sets per-table permissions for the "user" role so a logged-in user can
#      only see their own data.
#
# Prerequisites (you do these in the Hasura Cloud UI, NOT here):
#   - Create a Hasura Cloud project (free tier).
#   - In the project's Data tab, "Connect Existing Database" with your
#     CockroachDB / Neon DATABASE_URL. Name the source "default".
#   - In project Settings -> Env Vars, set:
#       HASURA_GRAPHQL_JWT_SECRET = {"type":"HS256","key":"<your JWT_SECRET from backend/.env>"}
#     (this lets Hasura validate the JWTs your Go backend issues)
#   - In Settings -> Env Vars, also set:
#       HASURA_GRAPHQL_UNAUTHORIZED_ROLE = anonymous   (optional)
#
# Then run this script with:
#   HASURA_ENDPOINT=https://your-project.hasura.app \
#   HASURA_ADMIN_SECRET=...your admin secret... \
#   ./hasura/setup.sh

set -euo pipefail

: "${HASURA_ENDPOINT:?HASURA_ENDPOINT not set, e.g. https://your-project.hasura.app}"
: "${HASURA_ADMIN_SECRET:?HASURA_ADMIN_SECRET not set}"

ENDPOINT="${HASURA_ENDPOINT%/}/v1/metadata"
SOURCE="${HASURA_SOURCE:-default}"

GREEN=$'\e[32m'; RED=$'\e[31m'; DIM=$'\e[2m'; N=$'\e[0m'

call() {
  local body="$1"
  local desc="$2"
  local resp
  resp="$(curl -sS -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "X-Hasura-Admin-Secret: $HASURA_ADMIN_SECRET" \
    -d "$body")"
  # Hasura returns {"message":"success"} OR {"code":"already-exists",...}
  if echo "$resp" | grep -q '"message":"success"'; then
    echo "  ${GREEN}ok${N}    $desc"
  elif echo "$resp" | grep -qE '"already-(exists|tracked|defined)"|"already exists"'; then
    echo "  ${DIM}skip${N}  $desc (already in place)"
  else
    echo "  ${RED}FAIL${N}  $desc"
    echo "  ${DIM}response: $resp${N}"
    return 1
  fi
}

# ---------- 1. Track tables ----------
echo "1) tracking tables..."
for tbl in users conversations conversation_members messages; do
  call "{\"type\":\"pg_track_table\",\"args\":{\"source\":\"$SOURCE\",\"table\":\"$tbl\"}}" \
       "track table $tbl"
done

# ---------- 2. Relationships ----------
echo
echo "2) creating relationships..."

# conversations.created_by -> users (object: created_by_user)
call "$(cat <<JSON
{"type":"pg_create_object_relationship","args":{
  "source":"$SOURCE","table":"conversations","name":"created_by_user",
  "using":{"foreign_key_constraint_on":"created_by"}}}
JSON
)" "conversations.created_by_user"

# conversations -> conversation_members (array: members)
call "$(cat <<JSON
{"type":"pg_create_array_relationship","args":{
  "source":"$SOURCE","table":"conversations","name":"members",
  "using":{"foreign_key_constraint_on":{"table":"conversation_members","column":"conversation_id"}}}}
JSON
)" "conversations.members"

# conversations -> messages (array)
call "$(cat <<JSON
{"type":"pg_create_array_relationship","args":{
  "source":"$SOURCE","table":"conversations","name":"messages",
  "using":{"foreign_key_constraint_on":{"table":"messages","column":"conversation_id"}}}}
JSON
)" "conversations.messages"

# conversation_members -> conversations (object)
call "$(cat <<JSON
{"type":"pg_create_object_relationship","args":{
  "source":"$SOURCE","table":"conversation_members","name":"conversation",
  "using":{"foreign_key_constraint_on":"conversation_id"}}}
JSON
)" "conversation_members.conversation"

# conversation_members -> users (object)
call "$(cat <<JSON
{"type":"pg_create_object_relationship","args":{
  "source":"$SOURCE","table":"conversation_members","name":"user",
  "using":{"foreign_key_constraint_on":"user_id"}}}
JSON
)" "conversation_members.user"

# messages -> conversations (object)
call "$(cat <<JSON
{"type":"pg_create_object_relationship","args":{
  "source":"$SOURCE","table":"messages","name":"conversation",
  "using":{"foreign_key_constraint_on":"conversation_id"}}}
JSON
)" "messages.conversation"

# messages -> users (object: sender)
call "$(cat <<JSON
{"type":"pg_create_object_relationship","args":{
  "source":"$SOURCE","table":"messages","name":"sender",
  "using":{"foreign_key_constraint_on":"sender_id"}}}
JSON
)" "messages.sender"

# users -> conversation_members (array)
call "$(cat <<JSON
{"type":"pg_create_array_relationship","args":{
  "source":"$SOURCE","table":"users","name":"conversation_memberships",
  "using":{"foreign_key_constraint_on":{"table":"conversation_members","column":"user_id"}}}}
JSON
)" "users.conversation_memberships"

# ---------- 3. Permissions for role 'user' ----------
echo
echo "3) setting permissions for role 'user'..."

# users: any authenticated user can browse the user directory (id+username only).
# Password hashes are excluded from the column list so they're never exposed.
call "$(cat <<JSON
{"type":"pg_create_select_permission","args":{
  "source":"$SOURCE","table":"users","role":"user",
  "permission":{
    "columns":["id","username","picture","name","created_at"],
    "filter":{},
    "allow_aggregations":true
  }}}
JSON
)" "users select (browse directory)"

# conversations: see only conversations the user is a member of.
call "$(cat <<JSON
{"type":"pg_create_select_permission","args":{
  "source":"$SOURCE","table":"conversations","role":"user",
  "permission":{
    "columns":["id","title","created_by","created_at"],
    "filter":{"members":{"user_id":{"_eq":"X-Hasura-User-Id"}}}
  }}}
JSON
)" "conversations select (member of)"

# conversation_members: see members of conversations the user is in.
call "$(cat <<JSON
{"type":"pg_create_select_permission","args":{
  "source":"$SOURCE","table":"conversation_members","role":"user",
  "permission":{
    "columns":["conversation_id","user_id","joined_at"],
    "filter":{"conversation":{"members":{"user_id":{"_eq":"X-Hasura-User-Id"}}}}
  }}}
JSON
)" "conversation_members select (own conversations)"

# messages: see messages in conversations the user is in.
call "$(cat <<JSON
{"type":"pg_create_select_permission","args":{
  "source":"$SOURCE","table":"messages","role":"user",
  "permission":{
    "columns":["id","conversation_id","sender_id","original_ct","english_ct","unilan_ct","media_url","media_type","created_at"],
    "filter":{"conversation":{"members":{"user_id":{"_eq":"X-Hasura-User-Id"}}}}
  }}}
JSON
)" "messages select (own conversations)"

echo
echo "${GREEN}done.${N} hasura console: ${HASURA_ENDPOINT%/}/console"
echo "${DIM}note: writes (signup, send-message, create-conversation) still go through the Go backend so the translation+encryption pipeline runs.${N}"
