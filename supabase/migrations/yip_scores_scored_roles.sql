-- Record WHICH ROLE a mark was taken under, so a recompute can reproduce the
-- denominator a human actually marked against.
--
-- THE PROBLEM
-- A session's published criteria list may span BOTH sides of the House, while
-- any one student is marked only on the subset that matches their role
-- (Director, 2026-08: "Presenter gets 6/8, Opp gets 6/8 and common for both
-- 2/4"). Government Bills publishes 16 points; the presenter is marked out of
-- 10 and the opposition member out of 10. Nobody is marked out of 16.
--
-- The results engine divides a session mark by that student's maximum. That
-- maximum is a function of (the sheet, the student's role). The sheet is read
-- live at recompute time — but the ROLE is not stored anywhere, and
-- yip.participants.party_side is editable after the event. Correcting a
-- student's bench next week would silently move their historical denominator
-- and change a published result. Storing the role on the score row makes the
-- computation reproducible from the row itself.
--
-- WHICH CRITERIA a criterion applies to lives in the existing jsonb —
-- yip.session_parameters.parameters[].roles — and needs NO migration. This file
-- covers only the other half: the role each individual mark was taken under.
--
-- THE SHAPE
--   scored_roles        text[]  -- the role slugs in force for this mark
--   scored_role_source  text    -- 'auto' (worked out) | 'override' (judge chose)
--
-- Both nullable. NULL means "no role restriction was in force", which is true of
-- every score written before this feature and of every mark on an unsplit sheet.
-- The engine reads NULL as "every criterion applied", i.e. the sheet's published
-- total_max — the denominator it already uses today.
--
-- text[] rather than a single value because a delegate holds several role slugs
-- at once: their parliament role AND the bench they sit on. "The presenter" and
-- "the opposition" in a Government Bill are benches, not parliament roles — a
-- ruling MP and an opposition MP both have parliament_role = 'mp'.
--
-- text rather than an enum because the slug space is the UNION of two existing
-- vocabularies (public.parliament_role values and the 'side:*' bench pseudo-
-- slugs) plus whatever a super-admin tags a criterion with. An enum would have
-- to be ALTERed every time the role catalogue moved, and an unrecognised slug
-- here is harmless: it simply matches no criterion.
--
-- ZERO BEHAVIOUR CHANGE
-- Both columns are added with no default and stay NULL on all 5,557 submitted
-- scores in production. No sheet in production splits by role today (zero of the
-- 13 rows in yip.session_parameters carries a criterion with a `roles` tag), so
-- nothing writes a non-NULL value until a super-admin splits a sheet. Every
-- existing result recomputes to the identical number.
--
-- NO BACKFILL. Deliberately: inventing a role for a historical mark would be
-- asserting a denominator no judge ever used.
--
-- APPLY THIS BEFORE MERGING the code that reads it — app/yip/actions/results.ts
-- selects scored_roles and app/yip/actions/scoring.ts writes both columns, and
-- PostgREST fails the whole query on an unknown column.

begin;

alter table yip.scores
  add column if not exists scored_roles text[],
  add column if not exists scored_role_source text;

comment on column yip.scores.scored_roles is
  'Role slugs this mark was taken under (parliament_role values and/or side:ruling / side:opposition). NULL = no role restriction was in force, so every criterion on the sheet applied and the denominator is the sheet total_max. See lib/yip/scoring-roles.ts.';

comment on column yip.scores.scored_role_source is
  '''auto'' when the role was worked out from the participant record, ''override'' when the judge chose it on the scoring screen. NULL alongside a NULL scored_roles.';

-- Only the two documented values, and only alongside a role. NOT VALID so the
-- constraint applies to new/updated rows without rewriting 5,557 existing ones
-- (all of which satisfy it anyway, both columns being NULL). Validate later if
-- desired: alter table yip.scores validate constraint scores_scored_role_source_ck;
alter table yip.scores
  add constraint scores_scored_role_source_ck
  check (
    (scored_role_source is null and scored_roles is null)
    or (scored_role_source in ('auto', 'override') and scored_roles is not null)
  ) not valid;

-- The audit trail must be able to say what the SUPERSEDED mark was scored
-- against, or a replaced score's total could not be re-derived from its own
-- denominator either.
alter table yip.score_revisions
  add column if not exists scored_roles text[],
  add column if not exists scored_role_source text;

comment on column yip.score_revisions.scored_roles is
  'Role slugs the REPLACED mark was taken under. Snapshot of yip.scores.scored_roles at the moment it was overwritten.';

commit;
