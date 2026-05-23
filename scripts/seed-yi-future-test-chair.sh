#!/usr/bin/env bash
#
# Idempotent: seed a dedicated Sandbox chapter and a test Chapter Chair
# for the Yi Future product, so the team can log into /yi-future/chapter
# from a clean chair perspective (no super-admin overlays).
#
# CREATES (idempotently):
#   1. yi.chapters row:                       Sandbox (region SRTN), is_active=false
#   2. auth.users:                            test-chair@yi-future-demo.com / TestChair2026!
#   3. future.chapter_core_team row:          role=chapter_chair, active edition
#
# RE-RUN ANYTIME to reset the test-chair password back to TestChair2026!
#
# REQUIRED env in .env.local:
#   NEXT_PUBLIC_SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY
#
# DO NOT GRANT THIS ACCOUNT ANY REAL PRIVILEGES.
# The password lives in this script and is therefore in git.
# Useful for sandbox testing only.
#
# Run:  bash scripts/seed-yi-future-test-chair.sh

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
SANDBOX_CHAPTER_NAME="Sandbox — Test Chapter (do not use for real Yi work)"
SANDBOX_CITY="Sandbox"
SANDBOX_STATE="South India"
SANDBOX_REGION="SRTN"
TEST_CHAIR_EMAIL="test-chair@yi-future-demo.com"
TEST_CHAIR_PASSWORD="TestChair2026!"
TEST_CHAIR_NAME="Sandbox Test Chair"
EDITION_SLUG="2026"

# ── Load env (handle quoted values, blank lines, comments) ──────────────────
if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found. Run from project root."
  exit 1
fi

URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | cut -d'=' -f2- | tr -d '"')
KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local | cut -d'=' -f2- | tr -d '"')

if [ -z "${URL:-}" ] || [ -z "${KEY:-}" ]; then
  echo "ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local"
  exit 1
fi

api() {
  # api METHOD PATH SCHEMA [BODY] [EXTRA_HEADERS...]
  local method="$1" path="$2" schema="$3"
  shift 3
  local body=""
  if [ $# -gt 0 ] && [ -n "${1:-}" ]; then
    body="$1"
    shift
  fi
  local headers=(
    -H "apikey: $KEY"
    -H "Authorization: Bearer $KEY"
    -H "Accept-Profile: $schema"
    -H "Content-Profile: $schema"
    -H "Content-Type: application/json"
    -H "Prefer: return=representation"
  )
  if [ -n "$body" ]; then
    curl -sf -X "$method" "$URL$path" "${headers[@]}" "$@" -d "$body"
  else
    curl -sf -X "$method" "$URL$path" "${headers[@]}" "$@"
  fi
}

# ── 1. Resolve active edition ───────────────────────────────────────────────
echo "── Looking up active edition ($EDITION_SLUG)..."
EDITION_ID=$(api GET "/rest/v1/editions?select=id&slug=eq.$EDITION_SLUG" future \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

if [ -z "$EDITION_ID" ]; then
  echo "ERROR: no edition with slug=$EDITION_SLUG"
  exit 1
fi
echo "   edition_id = $EDITION_ID"

# ── 2. Upsert Sandbox chapter ───────────────────────────────────────────────
echo "── Looking up Sandbox chapter..."
SANDBOX_NAME_ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$SANDBOX_CHAPTER_NAME")
CHAPTER_ID=$(api GET "/rest/v1/chapters?select=id&name=eq.$SANDBOX_NAME_ENC" yi \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

if [ -z "$CHAPTER_ID" ]; then
  echo "   creating Sandbox chapter..."
  CHAPTER_ID=$(api POST "/rest/v1/chapters" yi \
    "{\"name\":\"$SANDBOX_CHAPTER_NAME\",\"city\":\"$SANDBOX_CITY\",\"state\":\"$SANDBOX_STATE\",\"region\":\"$SANDBOX_REGION\",\"is_active\":false,\"finale_region\":\"$SANDBOX_REGION\",\"is_finale_host\":false}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'])")
  echo "   created chapter_id = $CHAPTER_ID"
else
  echo "   found existing chapter_id = $CHAPTER_ID"
fi

# ── 3. Upsert auth user ─────────────────────────────────────────────────────
# IMPORTANT: /auth/v1/admin/users?email=X does NOT filter by query string —
# it returns the first user in the system regardless of the email param.
# Confirmed 2026-05-23 after this bug rotated the wrong user's password.
# Use the Supabase Management API to SQL the auth.users table directly.
echo "── Looking up auth user $TEST_CHAIR_EMAIL..."
if [ ! -f ~/.supabase/access-token ]; then
  echo "ERROR: ~/.supabase/access-token not found — needed for auth.users lookup."
  echo "  Get a personal access token from https://supabase.com/dashboard/account/tokens"
  echo "  and save it (no newline) to ~/.supabase/access-token"
  exit 1
fi
MGMT_TOKEN=$(cat ~/.supabase/access-token | tr -d '\n')
PROJECT_REF=$(echo "$URL" | sed -E 's|https://||; s|\.supabase\.co.*||')

EXISTING_USER=$(curl -sf -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $MGMT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"SELECT id FROM auth.users WHERE email = '$TEST_CHAIR_EMAIL' LIMIT 1;\"}" 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

if [ -z "$EXISTING_USER" ]; then
  echo "   creating auth user..."
  USER_ID=$(curl -sf -X POST "$URL/auth/v1/admin/users" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_CHAIR_EMAIL\",\"password\":\"$TEST_CHAIR_PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$TEST_CHAIR_NAME\"}}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
  echo "   created user_id = $USER_ID"
else
  USER_ID="$EXISTING_USER"
  echo "   resetting password for user_id = $USER_ID..."
  curl -sf -X PUT "$URL/auth/v1/admin/users/$USER_ID" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "{\"password\":\"$TEST_CHAIR_PASSWORD\",\"email_confirm\":true}" > /dev/null
  echo "   password reset OK"
fi

# ── 4. Upsert chapter_core_team row (chair role) ────────────────────────────
echo "── Linking user as chapter_chair on Sandbox chapter for active edition..."
EXISTING_CCT=$(api GET "/rest/v1/chapter_core_team?select=id&chapter_id=eq.$CHAPTER_ID&edition_id=eq.$EDITION_ID&role=eq.chapter_chair" future \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

if [ -z "$EXISTING_CCT" ]; then
  api POST "/rest/v1/chapter_core_team" future \
    "{\"chapter_id\":\"$CHAPTER_ID\",\"edition_id\":\"$EDITION_ID\",\"role\":\"chapter_chair\",\"user_id\":\"$USER_ID\",\"email\":\"$TEST_CHAIR_EMAIL\",\"full_name\":\"$TEST_CHAIR_NAME\",\"is_active\":true}" \
    > /dev/null
  echo "   created chapter_core_team row"
else
  api PATCH "/rest/v1/chapter_core_team?id=eq.$EXISTING_CCT" future \
    "{\"user_id\":\"$USER_ID\",\"email\":\"$TEST_CHAIR_EMAIL\",\"full_name\":\"$TEST_CHAIR_NAME\",\"is_active\":true}" \
    > /dev/null
  echo "   refreshed existing chapter_core_team row"
fi

# ── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  Seed complete."
echo ""
echo "  Login URL : ${URL%/}/yi-future/login   (or your dev URL + /yi-future/login)"
echo "  Email     : $TEST_CHAIR_EMAIL"
echo "  Password  : $TEST_CHAIR_PASSWORD"
echo "  Chapter   : $SANDBOX_CHAPTER_NAME"
echo "  Edition   : $EDITION_SLUG"
echo ""
echo "  Re-run this script anytime to reset the password."
echo "════════════════════════════════════════════════════════════════════"
