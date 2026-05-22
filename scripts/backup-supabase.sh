#!/usr/bin/env bash
#
# Daily Supabase backup script — yi-connect + cross-app schemas.
#
# Dumps the shared Supabase project (bkmpbcoxbjyafieabxao) covering all
# Yi platform schemas to a local file, gzips it, optionally uploads to
# S3, and prunes local backups older than 30 days.
#
# Environment variables required:
#   SUPABASE_DB_URL       — full Postgres connection string with password.
#                            Format: postgresql://postgres.<ref>:<password>@<host>:6543/postgres
#                            Get from Supabase dashboard → Project Settings → Database.
#
# Optional (for S3 upload):
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   AWS_DEFAULT_REGION    — e.g., ap-south-1
#   S3_BUCKET_NAME        — e.g., yi-supabase-backups
#
# Exit codes:
#   0 — success (local dump + optional S3 upload OK)
#   1 — pg_dump failed
#   2 — S3 upload failed (local dump still present)
#
# Usage:
#   ./scripts/backup-supabase.sh
#
# Schedule via cron (daily at 02:00 IST = 20:30 UTC):
#   30 20 * * * /full/path/to/scripts/backup-supabase.sh >> /var/log/yi-backup.log 2>&1
# Or via GitHub Actions — see .github/workflows/daily-backup.yml

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
DUMP_FILE="${BACKUP_DIR}/yi-supabase-backup-${TIMESTAMP}.sql"
DUMP_FILE_GZ="${DUMP_FILE}.gz"

# Schemas to back up (yi-connect's own + cross-app shared).
# We include public and future so the backup is a single restore-point for the
# whole Yi platform, not just yi_connect.
SCHEMAS=(public future yi yi_directory yi_connect auth storage)

mkdir -p "$BACKUP_DIR"

# ── Validate ────────────────────────────────────────────────────────────
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL not set." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install postgresql-client." >&2
  exit 1
fi

# ── Dump ────────────────────────────────────────────────────────────────
echo "[$(date -u)] Starting Supabase backup → $DUMP_FILE_GZ"

SCHEMA_ARGS=()
for s in "${SCHEMAS[@]}"; do
  SCHEMA_ARGS+=(--schema="$s")
done

if pg_dump "$SUPABASE_DB_URL" \
  --no-owner \
  --no-privileges \
  "${SCHEMA_ARGS[@]}" \
  | gzip -9 > "$DUMP_FILE_GZ"; then
  SIZE=$(du -h "$DUMP_FILE_GZ" | cut -f1)
  echo "[$(date -u)] Dump complete: $DUMP_FILE_GZ ($SIZE)"
else
  echo "[$(date -u)] ERROR: pg_dump failed." >&2
  rm -f "$DUMP_FILE_GZ"
  exit 1
fi

# ── Optional S3 upload ──────────────────────────────────────────────────
if [[ -n "${S3_BUCKET_NAME:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "[$(date -u)] WARN: S3_BUCKET_NAME set but aws CLI not installed. Skipping upload." >&2
  else
    S3_KEY="yi-supabase-backups/$(date -u +%Y/%m)/yi-supabase-backup-${TIMESTAMP}.sql.gz"
    echo "[$(date -u)] Uploading to s3://${S3_BUCKET_NAME}/${S3_KEY}"
    if aws s3 cp "$DUMP_FILE_GZ" "s3://${S3_BUCKET_NAME}/${S3_KEY}"; then
      echo "[$(date -u)] S3 upload complete."
    else
      echo "[$(date -u)] ERROR: S3 upload failed. Local backup retained." >&2
      exit 2
    fi
  fi
else
  echo "[$(date -u)] S3_BUCKET_NAME not set. Skipping upload — local-only backup."
fi

# ── Prune old local backups ─────────────────────────────────────────────
echo "[$(date -u)] Pruning local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "yi-supabase-backup-*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -print -delete

echo "[$(date -u)] Backup complete."
exit 0
