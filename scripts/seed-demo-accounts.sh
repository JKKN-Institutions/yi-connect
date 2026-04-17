#!/usr/bin/env bash
# Seed missing demo accounts needed for 20-workflow sequential testing.
# Uses Supabase admin API via service role key.
#
# Creates 5 new demo accounts on the Yi Erode demo chapter:
# - demo-super@yi-demo.com    → Super Admin (level 7)
# - demo-national@yi-demo.com → National Admin (level 6)
# - demo-exec@yi-demo.com     → Executive Member (level 5)
# - demo-member@yi-demo.com   → Member (level 1)
# - demo-industry@yi-demo.com → Industry Coordinator (level 1, special)
#
# Existing demo accounts:
# - demo-chair@yi-demo.com    → Chair (level 4)
# - demo-cochair@yi-demo.com  → Co-Chair (level 3)
# - demo-ec@yi-demo.com       → EC Member (level 2)
#
# Password for all demo accounts: Demo123!
#
# Run:  bash scripts/seed-demo-accounts.sh

set -euo pipefail

# Load env
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${NEXT_PUBLIC_SUPABASE_URL:?missing in .env.local}"
: "${SUPABASE_SERVICE_ROLE_KEY:?missing in .env.local}"

URL="${NEXT_PUBLIC_SUPABASE_URL}"
KEY="${SUPABASE_SERVICE_ROLE_KEY}"
CHAPTER_ID="1a475942-94cc-478d-ab78-89242a0c3a67" # Yi Erode
PASSWORD="Demo123!"

# Accounts to seed: email|role_name|full_name
accounts=(
  "demo-super@yi-demo.com|Super Admin|Demo Super Admin"
  "demo-national@yi-demo.com|National Admin|Demo National Admin"
  "demo-exec@yi-demo.com|Executive Member|Demo Executive Member"
  "demo-member@yi-demo.com|Member|Demo Regular Member"
  "demo-industry@yi-demo.com|Industry Coordinator|Demo Industry Coordinator"
)

# Get an existing admin id to use as approved_by
ADMIN_ID=$(curl -s "$URL/rest/v1/user_roles?select=user_id,role:roles(hierarchy_level)&role.hierarchy_level=gte.6&limit=1" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" | grep -oE '"user_id":"[^"]+"' | head -1 | cut -d'"' -f4)

if [ -z "$ADMIN_ID" ]; then
  echo "No admin user found to use as approved_by. Aborting."
  exit 1
fi
echo "Using admin as approved_by: $ADMIN_ID"

for entry in "${accounts[@]}"; do
  IFS='|' read -r email role fullname <<< "$entry"
  echo ""
  echo "=== $email → $role ==="

  # Step 1: create auth user (idempotent via email_confirm=true)
  resp=$(curl -s -X POST "$URL/auth/v1/admin/users" \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$fullname\"}}")

  # Parse user id from response or existing user lookup
  user_id=$(echo "$resp" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

  if [ -z "$user_id" ]; then
    # User likely exists — look it up
    lookup=$(curl -s "$URL/auth/v1/admin/users?email=$email" \
      -H "apikey: $KEY" \
      -H "Authorization: Bearer $KEY")
    user_id=$(echo "$lookup" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
    echo "  User already exists: $user_id"
  else
    echo "  Created auth user: $user_id"
  fi

  if [ -z "$user_id" ]; then
    echo "  FAILED to create or find user for $email — skipping"
    echo "  Response: $resp"
    continue
  fi

  # Step 2: upsert approved_emails (so trigger assigns the role next login)
  curl -s -X POST "$URL/rest/v1/approved_emails?on_conflict=email" \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates,return=minimal" \
    -d "{\"email\":\"$email\",\"approved_by\":\"$ADMIN_ID\",\"assigned_chapter_id\":\"$CHAPTER_ID\",\"assigned_role_name\":\"$role\",\"notes\":\"Demo $role account for workflow testing\",\"is_active\":true}" > /dev/null
  echo "  Upserted approved_emails"

  # Step 3: ensure user_roles is set (handle_new_user trigger may not re-fire on existing users)
  role_id=$(curl -s "$URL/rest/v1/roles?select=id&name=eq.$(echo $role | sed 's/ /%20/g')" \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

  if [ -n "$role_id" ]; then
    # Check if user_roles row already exists
    existing=$(curl -s "$URL/rest/v1/user_roles?select=id&user_id=eq.$user_id&role_id=eq.$role_id" \
      -H "apikey: $KEY" \
      -H "Authorization: Bearer $KEY")
    if [ "$existing" = "[]" ]; then
      curl -s -X POST "$URL/rest/v1/user_roles" \
        -H "apikey: $KEY" \
        -H "Authorization: Bearer $KEY" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "{\"user_id\":\"$user_id\",\"role_id\":\"$role_id\"}" > /dev/null
      echo "  Assigned role $role (id: $role_id)"
    else
      echo "  Role $role already assigned"
    fi
  else
    echo "  ⚠ role $role not found in roles table"
  fi

  # Step 4: ensure profile row exists with chapter
  curl -s -X POST "$URL/rest/v1/profiles?on_conflict=id" \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates,return=minimal" \
    -d "{\"id\":\"$user_id\",\"full_name\":\"$fullname\",\"chapter_id\":\"$CHAPTER_ID\",\"status\":\"active\"}" > /dev/null
  echo "  Upserted profile"

  # Step 5: ensure member row exists (skip for Super Admin/National Admin who aren't chapter members per se; still create for consistency so they appear in member lists)
  curl -s -X POST "$URL/rest/v1/members?on_conflict=id" \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates,return=minimal" \
    -d "{\"id\":\"$user_id\",\"chapter_id\":\"$CHAPTER_ID\",\"status\":\"active\",\"membership_type\":\"regular\"}" > /dev/null
  echo "  Upserted member"
done

echo ""
echo "✅ Seed complete. All 5 new demo accounts ready."
echo ""
echo "Login credentials (all accounts use password: $PASSWORD):"
for entry in "${accounts[@]}"; do
  IFS='|' read -r email role fullname <<< "$entry"
  echo "  $email → $role"
done
