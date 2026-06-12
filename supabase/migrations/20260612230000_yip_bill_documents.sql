-- YIP Committee Bill Repository (national-call ask, 2026-06-12).
--
-- Committee members upload supporting documents / drawings (+ a short
-- description) for their committee's bill; organisers see everything across
-- committees. Participants are MINORS, so the posture is fail-closed:
--   * PRIVATE storage bucket (signed URLs only, 4 MB cap, allow-listed mimes)
--   * RLS enabled with NO policies + zero anon/authenticated grants
--   * the gated server actions in app/yip/actions/bill-documents.ts
--     (service role bypasses RLS) are the ONLY access path — same posture
--     as 20260612080147_yip_chat_moderation.sql.
--
-- APPLIED to live 2026-06-12 via the Management API; committed for the record.

-- ─── 1. Private storage bucket ──────────────────────────────────
-- 4 MB per file (must stay under Vercel's ~4.5 MB serverless request-body
-- limit — the upload travels base64-encoded through a server action).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'yip-bill-documents',
  'yip-bill-documents',
  false,
  4194304,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Document rows ───────────────────────────────────────────
-- committee_name is copied from the uploader's participants row at insert
-- time (never trusted from the client); uploaded_by anchors self-delete.
CREATE TABLE IF NOT EXISTS yip.bill_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  committee_name  text NOT NULL,
  uploaded_by     uuid NOT NULL REFERENCES yip.participants(id) ON DELETE CASCADE,
  description     text NOT NULL DEFAULT '',
  file_path       text NOT NULL,
  file_name       text NOT NULL,
  content_type    text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  is_mock         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Student list + organiser grouping both read per (event, committee).
CREATE INDEX IF NOT EXISTS idx_bill_documents_event_committee
  ON yip.bill_documents (event_id, committee_name);

-- ─── 3. Lockdown: service-role only ─────────────────────────────
ALTER TABLE yip.bill_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON yip.bill_documents FROM anon, authenticated;

-- No RLS policies are created → with RLS enabled and no policy, anon and
-- authenticated can do nothing even if a stray table grant ever appears.
