#!/usr/bin/env bash
# YIP Concurrency Load Test — Phase 19/C
#
# Read-only load test against the deployed YIP routes on yi-connect-app.
# Validates the platform can survive 5–10 chapter rounds running in
# parallel with ~150 jury+student logins each on June 4–5.
#
# Usage:
#   ./scripts/load-test/run-yip-load-test.sh                 # full sweep, writes ./reports/<ts>/
#   ./scripts/load-test/run-yip-load-test.sh --quick         # 1 short scenario, smoke test
#   BASE_URL=https://yi-connect-app.vercel.app ./run-yip-load-test.sh
#
# Requires: npx (autocannon will be fetched on demand)

set -euo pipefail

BASE_URL="${BASE_URL:-https://yi-connect-app.vercel.app}"
EVENT_ID="${EVENT_ID:-27219472-5d6d-4b77-b6e0-22b77a6eb38b}"   # Mizoram chapter (draft)
MODE="${1:-full}"

TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_DIR="$(cd "$(dirname "$0")" && pwd)/reports/$TS"
mkdir -p "$OUT_DIR"

echo "==============================================================="
echo "YIP Concurrency Load Test"
echo "Base URL : $BASE_URL"
echo "Event ID : $EVENT_ID"
echo "Mode     : $MODE"
echo "Out dir  : $OUT_DIR"
echo "==============================================================="

run_scenario () {
  local name="$1" url="$2" conns="$3" dur="$4"
  echo
  echo "--- Scenario: $name ($conns conns / ${dur}s) -> $url"
  npx --yes autocannon@latest \
    -c "$conns" -d "$dur" \
    -H "user-agent: yip-load-test/1.0" \
    --renderStatusCodes \
    "$url" 2>&1 | tee "$OUT_DIR/$name.txt"
}

# Pre-flight: confirm the live URL responds
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/yip")
if [ "$code" != "200" ]; then
  echo "FATAL: $BASE_URL/yip returned $code (expected 200). Aborting."
  exit 1
fi
echo "Pre-flight OK: $BASE_URL/yip -> 200"

if [ "$MODE" = "--quick" ]; then
  run_scenario "smoke-landing" "$BASE_URL/yip" 20 10
  echo "Quick mode done. Output: $OUT_DIR"
  exit 0
fi

# --- Scenario 1: Landing page burst -----------------------------------------
# 100 concurrent connections / 30s. Verifies edge + ISR caching survives.
run_scenario "01-landing-burst"   "$BASE_URL/yip"             100 30

# --- Scenario 2: Jury login (redirect to /yip/join) -------------------------
# 50 concurrent / 30s. Hits the public redirect.
run_scenario "02-jury-login"      "$BASE_URL/yip/jury/login"   50 30

# --- Scenario 3: Join page (access-code entry, public) ----------------------
# 100 concurrent / 30s. The first thing 150 students hit per chapter.
run_scenario "03-join-page"       "$BASE_URL/yip/join"        100 30

# --- Scenario 4: Organiser login (public form) ------------------------------
# 50 concurrent / 30s. Lighter — only organisers hit this.
run_scenario "04-organiser-login" "$BASE_URL/yip/login"        50 30

echo
echo "==============================================================="
echo "All scenarios done. Per-scenario logs: $OUT_DIR"
echo "==============================================================="
