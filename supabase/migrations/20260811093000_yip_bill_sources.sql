-- ═══════════════════════════════════════════════════════════════════
-- YIP Bill Sources — Government Bills & Private Members' Bills (Regional Round)
-- ───────────────────────────────────────────────────────────────────
-- Chapter rounds: committees draft bills AT the event (source 'committee',
-- identified by committee_name). The 2026 Regional Round adds two new bill
-- origins that reuse the SAME presentation / amendment / voting machinery:
--   • 'government'     — 3–5 bills prepared by the Cabinet BEFORE the event,
--                        each moved (presented) by its concerned Minister.
--   • 'private_member' — Day-2 bills moved by individual Members who are NOT
--                        ministers.
-- Both carry committee_name NULL (no drafting committee) and record WHO moves
-- the bill in mover_participant_id. The creating action also mirrors the mover
-- into the existing presenter_1 column so every downstream presenter consumer
-- (projector display, jury scoring flow) resolves the mover with no changes.
--
-- Deliberately NO foreign key on mover_participant_id — matches the house
-- style for trail/annotation columns (see yip.score_revisions): the bill row
-- must survive participant resets, and integrity is enforced in the creating
-- server action (mover must belong to the event + hold an eligible role).
--
-- ⚠️ NOT YET APPLIED — the USER applies migrations manually. The deployed code
-- degrades gracefully (bills behave as committee-unlinked bills, mover still
-- shown via presenter_1) until this lands.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE yip.bills
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'committee';
ALTER TABLE yip.bills
  ADD COLUMN IF NOT EXISTS mover_participant_id uuid;

-- Allowed origins only. Named constraint so re-runs are idempotent.
ALTER TABLE yip.bills DROP CONSTRAINT IF EXISTS bills_source_check;
ALTER TABLE yip.bills ADD CONSTRAINT bills_source_check
  CHECK (source IN ('committee', 'government', 'private_member'));

COMMENT ON COLUMN yip.bills.source IS
  'Bill origin: ''committee'' (drafted at the event by a committee — the default and the only pre-Regional-Round value), ''government'' (Cabinet-prepared, moved by its concerned Minister), ''private_member'' (moved by an individual non-minister Member, Regional Round Day 2). Government/private_member bills carry committee_name NULL.';
COMMENT ON COLUMN yip.bills.mover_participant_id IS
  'yip.participants.id of the Member who MOVES this bill (the concerned Minister for a government bill; the private Member for a private_member bill). NULL for committee bills (presenters live in presenter_1/presenter_2). No FK by design — validated in app/yip/actions/bills.ts adminCreateBill; the creating action also mirrors this id into presenter_1 so existing presenter consumers need no change.';
