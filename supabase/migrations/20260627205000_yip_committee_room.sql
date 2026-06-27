-- YIP Committee Room — bill clauses get stable IDs, amendment proposals + votes,
-- and per-clause discussion threads.
--
-- Three additive concerns, all idempotent (safe to re-run):
--   1. yip.bills.provisions normalised to a stable {id,text}[] shape so a clause
--      can be discussed / amended without an array index that breaks on reorder.
--   2. yip.bill_amendments + yip.bill_amendment_votes — committee members propose
--      changes to a clause and vote them up/down; the chair / lead drafter folds
--      an accepted amendment into the bill.
--   3. yip.chat_messages.thread_key — anchors a message to a clause / amendment
--      sub-thread (NULL = the general committee feed). No new table needed.
--
-- Like every other yip.* community-chat table, the new tables are service-role
-- only: anon + authenticated get NO grants, RLS is enabled with NO policies, and
-- the service-role key (used only by gated server actions) is the sole reach.
-- These tables carry MINORS' content, so the lockdown is deliberate.
--
-- Additive DDL. Applied to prod (bkmpbcoxbjyafieabxao) via Management API; this
-- file is the record. DDL shown to the owner before apply (project rule).

-- ─── 1. Provisions → stable clause IDs ──────────────────────────────────
-- Live shapes seen in prod: `[]`, `{"note":"[MOCK]","clauses":["…","…"]}`, and
-- (from saveBillDraft / adminCreateBill) a flat `["…","…"]`. Normalise ALL of
-- them to `[{"id": <uuid>, "text": <string>}, …]`.
--
-- Idempotent: a row already in target shape — `[]` (empty clause list) or an
-- array whose first element carries an `id` key — is SKIPPED, so re-running the
-- migration never regenerates ids or doubles up.
UPDATE yip.bills b
SET provisions = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'text', txt)
                     ORDER BY ord)
    FROM (
      SELECT
        ord,
        CASE
          WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
          WHEN jsonb_typeof(elem) = 'object' THEN elem ->> 'text'
          ELSE NULL
        END AS txt
      FROM jsonb_array_elements(
             CASE
               -- a flat array of strings (or already-object) → use as the clause list
               WHEN jsonb_typeof(b.provisions) = 'array' THEN b.provisions
               -- the {note, clauses:[…]} wrapper → unwrap to its clauses array
               WHEN jsonb_typeof(b.provisions) = 'object'
                    AND b.provisions ? 'clauses'
                    AND jsonb_typeof(b.provisions -> 'clauses') = 'array'
                 THEN b.provisions -> 'clauses'
               ELSE '[]'::jsonb
             END
           ) WITH ORDINALITY AS t(elem, ord)
    ) s
    WHERE txt IS NOT NULL AND length(btrim(txt)) > 0
  ),
  '[]'::jsonb
)
WHERE
  -- Skip rows already in the target shape (idempotency):
  --   * NOT an array (object / scalar / null)  → needs conversion
  --   * an array that is non-empty AND whose first element has no `id` key
  jsonb_typeof(provisions) IS DISTINCT FROM 'array'
  OR (
    jsonb_array_length(provisions) > 0
    AND NOT (provisions -> 0 ? 'id')
  );

-- ─── 2. Amendments ──────────────────────────────────────────────────────
-- One proposed change to a clause (or the whole bill / a brand-new clause when
-- clause_id IS NULL). The chair or lead drafter resolves it; accepting folds
-- proposed_text into yip.bills.provisions (done in the server action, logged).
CREATE TABLE IF NOT EXISTS yip.bill_amendments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id        uuid NOT NULL REFERENCES yip.bills(id) ON DELETE CASCADE,
  event_id       uuid NOT NULL REFERENCES yip.events(id) ON DELETE CASCADE,
  committee_name text NOT NULL,
  -- The clause this targets (a yip.bills.provisions[].id). NULL = whole-bill or
  -- a proposed NEW clause (kind='add'). Not an FK — clauses live inside jsonb.
  clause_id      text,
  kind           text NOT NULL CHECK (kind IN ('edit', 'add', 'remove')),
  -- The replacement / new text. NULL is allowed only for a 'remove'.
  proposed_text  text,
  proposed_by    uuid REFERENCES yip.participants(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'accepted', 'rejected', 'withdrawn')),
  resolved_by    uuid REFERENCES yip.participants(id) ON DELETE SET NULL,
  resolution_note text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz,

  -- A removal needs no text; every other kind must carry the proposed text.
  CONSTRAINT bill_amendments_text_chk CHECK (
    kind = 'remove' OR (proposed_text IS NOT NULL AND length(btrim(proposed_text)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS bill_amendments_bill_idx
  ON yip.bill_amendments (bill_id, status, created_at);
CREATE INDEX IF NOT EXISTS bill_amendments_event_committee_idx
  ON yip.bill_amendments (event_id, committee_name);

-- ─── 3. Amendment votes ─────────────────────────────────────────────────
-- One vote per committee member per amendment (advisory — the chair/lead has
-- the final call; the tally is shown as guidance only).
CREATE TABLE IF NOT EXISTS yip.bill_amendment_votes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id  uuid NOT NULL REFERENCES yip.bill_amendments(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES yip.participants(id) ON DELETE CASCADE,
  vote          text NOT NULL CHECK (vote IN ('for', 'against')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bill_amendment_votes_uniq UNIQUE (amendment_id, participant_id)
);

CREATE INDEX IF NOT EXISTS bill_amendment_votes_amendment_idx
  ON yip.bill_amendment_votes (amendment_id);

-- ─── 4. Per-clause discussion threads ───────────────────────────────────
-- A nullable anchor on the existing committee chat. NULL = general committee
-- feed (unchanged behaviour for /yip/me/chat). 'clause:<id>' / 'amendment:<id>'
-- scopes a message to that sub-thread. No new table; reuses chat moderation.
ALTER TABLE yip.chat_messages
  ADD COLUMN IF NOT EXISTS thread_key text;

CREATE INDEX IF NOT EXISTS chat_messages_thread_idx
  ON yip.chat_messages (channel_id, thread_key, created_at);

-- ─── 5. Lockdown: service-role only (same as every yip community table) ──
ALTER TABLE yip.bill_amendments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE yip.bill_amendment_votes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON yip.bill_amendments      FROM anon, authenticated;
REVOKE ALL ON yip.bill_amendment_votes FROM anon, authenticated;

-- No RLS policies → with RLS on and no policy, anon + authenticated can do
-- nothing even if a stray grant ever appears. The service-role key (gated
-- server actions only) bypasses RLS — exactly and only how these rows are read.
