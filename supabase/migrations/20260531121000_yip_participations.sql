-- FOUNDATION — fields are a starting point; domain review needed before production use.
--
-- Layer 2b — relationships (yi-directory consolidation plan, 2026-05-31, §2/§4/§6 Ph6).
--
-- yip.participations is YIP's OWN relationship table over the shared identity
-- spine (yi_directory.people). One row = "this human took part in this YIP event
-- (this team, this score)". Identity is shared and deduped at the source via
-- resolvePerson() (lib/yi/directory/resolve-person.ts); the relationship row is
-- owned and edited entirely within YIP.
--
-- yuva.enrollments / thalir.enrollments will follow the same shape when built.
--
-- Additive + idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS yip.participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES yi_directory.people(id),
  edition_id uuid,
  event_id uuid,
  team text,
  status text,
  score int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS yip_participations_person_idx
  ON yip.participations(person_id);

ALTER TABLE yip.participations ENABLE ROW LEVEL SECURITY;

-- ── RLS ───────────────────────────────────────────────────────────────
-- Permissive service-role-only policy for now. All reads/writes go through
-- the YIP service client (app/yip/actions/participations.ts), which bypasses
-- RLS via the service role; this single permissive policy keeps the table
-- locked to everyone else until the scoped gate lands.
--
-- TODO: scoped RLS via the can() gate (Phase 7) — a YIP chapter admin should
-- only read/write participations for their own chapter's editions/events.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'yip'
      AND tablename = 'participations'
      AND policyname = 'service_role full access on yip participations'
  ) THEN
    CREATE POLICY "service_role full access on yip participations"
      ON yip.participations
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;
