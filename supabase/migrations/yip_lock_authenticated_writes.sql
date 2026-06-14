-- yip: lock down anon/authenticated writes across the schema
-- ============================================================
-- WHY
-- The `authenticated` role (any logged-in Supabase user — e.g. any organiser or
-- chapter chair, regardless of which chapter/event they belong to) held
-- INSERT/UPDATE/DELETE/TRUNCATE grants on ~23 yip tables. On 11 of them a
-- permissive write policy (`USING/ WITH CHECK (auth.uid() IS NOT NULL)` for
-- PUBLIC) ALSO existed, making it a LIVE horizontal-privilege IDOR: a logged-in
-- user could tamper with ANY event's rows. The standouts:
--   organizers  -> privilege escalation (insert yourself as organiser anywhere)
--   contestants -> person-model PII tamper / fabricate participants
--   promotions  -> rig who advances chapter -> regional -> national
--   media/event_topics/topics/invitations/fees/feedback/brand_checks/registrations
-- A second set of tables (votes/scores/results/vote_sessions/bills/motions/
-- questions/score_audit) was already closed by prior grant-revokes, but still
-- carried vestigial PUBLIC write policies (`WITH CHECK (true)`) — a loaded gun:
-- one stray future GRANT silently re-opens vote/score rigging.
--
-- SAFETY
-- Every app write goes through service-role server actions (createServiceClient).
-- service_role has rolbypassrls=true, so it bypasses RLS entirely and does NOT
-- depend on any of these policies or on anon/authenticated grants. Therefore both
-- the REVOKEs and the policy DROPs below change ZERO application behaviour.
-- Reads are fully preserved: every affected table keeps its separate permissive
-- SELECT policy (feedback/fees, which had only the ALL policy, get an identical-
-- predicate SELECT replacement). The votes "readable only when revealed"
-- ballot-secrecy SELECT policy (#358) is left untouched.
--
-- Verified against the live DB before/after via information_schema grants,
-- pg_policy, and a real anon-key PostgREST probe.

begin;

-- 1) Remove all write privileges from anon + authenticated. This is the
--    definitive lock: no grant => no write, independent of any policy.
--    (Idempotent: revoking a privilege the role lacks is a no-op.)
revoke insert, update, delete, truncate on
  yip.admin_audit_log,
  yip.agenda_speakers,
  yip.bills,
  yip.brand_checks,
  yip.checklist,
  yip.checklist_template,
  yip.committee_scores,
  yip.constituencies,
  yip.contestants,
  yip.event_topics,
  yip.events,
  yip.feedback,
  yip.fees,
  yip.invitations,
  yip.media,
  yip.motions,
  yip.organizers,
  yip.participations,
  yip.position_bonus_config,
  yip.promotions,
  yip.questions,
  yip.registrations,
  yip.results,
  yip.rubrics,
  yip.score_audit,
  yip.scores,
  yip.scoring_flags_config,
  yip.topics,
  yip.volunteers,
  yip.vote_sessions,
  yip.votes
from anon, authenticated;

-- 2) Drop the vestigial PUBLIC write policies. These granted writes to
--    anon/authenticated only (service_role bypasses RLS). Each table below keeps
--    its own permissive SELECT policy, so reads are unchanged.
drop policy if exists "Branding checks manageable by organizer" on yip.brand_checks;
drop policy if exists "People manageable by authenticated"      on yip.contestants;
drop policy if exists "Event topics manageable"                 on yip.event_topics;
drop policy if exists "Invitations manageable by organizer"     on yip.invitations;
drop policy if exists "Event media manageable by authenticated" on yip.media;
drop policy if exists "Organizer profiles manageable by authenticated" on yip.organizers;
drop policy if exists "Promotions manageable by authenticated"  on yip.promotions;
drop policy if exists "Topics manageable by authenticated"      on yip.topics;
drop policy if exists "Registrations insertable by authenticated" on yip.registrations;
drop policy if exists "Registrations updatable by authenticated"  on yip.registrations;
drop policy if exists "Bills can be inserted"  on yip.bills;
drop policy if exists "Bills can be updated"   on yip.bills;
drop policy if exists "Motions insertable"     on yip.motions;
drop policy if exists "Motions updatable"      on yip.motions;
drop policy if exists "Questions can be inserted" on yip.questions;
drop policy if exists "Questions can be updated"  on yip.questions;
drop policy if exists "Results can be managed" on yip.results;
drop policy if exists "Results can be updated" on yip.results;
drop policy if exists "Scores can be inserted" on yip.scores;
drop policy if exists "Scores can be updated"  on yip.scores;
drop policy if exists "Audit log can be inserted" on yip.score_audit;
drop policy if exists "Vote sessions can be managed" on yip.vote_sessions;
drop policy if exists "Vote sessions can be updated" on yip.vote_sessions;
drop policy if exists "Votes can be cast"      on yip.votes;

-- 3) feedback + fees had ONLY the ALL policy (no separate SELECT policy). Replace
--    it with an identical-predicate SELECT policy so authenticated read posture is
--    byte-for-byte preserved, while the write capability is removed.
drop policy if exists "Feedback manageable by organizer" on yip.feedback;
create policy "Feedback readable by authenticated" on yip.feedback
  for select using (auth.uid() is not null);

drop policy if exists "Fees manageable by organizer" on yip.fees;
create policy "Fees readable by authenticated" on yip.fees
  for select using (auth.uid() is not null);

commit;
