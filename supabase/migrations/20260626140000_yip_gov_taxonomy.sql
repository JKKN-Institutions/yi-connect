-- ════════════════════════════════════════════════════════════════════════
-- YIP NATIONAL INTELLIGENCE — Government-of-India taxonomy table.
--
-- The canonical GoI ministry/scheme tagging vocabulary for the national
-- intelligence layer. One row per (ministry, scheme); a scheme-less row is the
-- ministry "parent". Seeded from the existing committee topic catalogue
-- (yip.topics WHERE category='committee'), which already carries title =
-- ministry and linked_scheme = comma-separated schemes.
--
-- Additive + idempotent: safe to run repeatedly. No data is dropped.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS yip.gov_taxonomy (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry      text NOT NULL,
  scheme        text,
  official_name text,
  aliases       text[] NOT NULL DEFAULT '{}',
  category      text,
  notes         text,
  needs_review  boolean NOT NULL DEFAULT false,
  sort_order    int,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness on (ministry, scheme) treating NULL scheme safely. A plain UNIQUE
-- (ministry, scheme) would allow many ministry-parent rows (NULLs compare
-- distinct), so we key on a COALESCE expression: '' stands in for "no scheme".
-- This guarantees exactly one parent row per ministry plus one row per
-- (ministry, scheme) pair. Case-insensitive so "Ministry of X" can't double up.
CREATE UNIQUE INDEX IF NOT EXISTS gov_taxonomy_ministry_scheme_uniq
  ON yip.gov_taxonomy (lower(ministry), lower(COALESCE(scheme, '')));

CREATE INDEX IF NOT EXISTS gov_taxonomy_active_sort_idx
  ON yip.gov_taxonomy (is_active, sort_order, ministry);

-- keep updated_at fresh on UPDATE (idempotent trigger install)
CREATE OR REPLACE FUNCTION yip.gov_taxonomy_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gov_taxonomy_touch_updated_at ON yip.gov_taxonomy;
CREATE TRIGGER gov_taxonomy_touch_updated_at
  BEFORE UPDATE ON yip.gov_taxonomy
  FOR EACH ROW
  EXECUTE FUNCTION yip.gov_taxonomy_touch_updated_at();

-- ── Lock down: this is national master data. RLS on, no anon/authenticated
--    policies — reads/writes go through the service-role client behind the
--    requireSuperAdmin() gate (same posture as other yip master tables). The
--    service role bypasses RLS, so enabling it here just denies the public
--    PostgREST roles by default (fail-closed).
ALTER TABLE yip.gov_taxonomy ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON yip.gov_taxonomy FROM anon, authenticated;

-- ── Seed from the committee topic catalogue (deterministic, idempotent).
--    Each committee topic: title = ministry, linked_scheme = its schemes.
--    We insert ONE ministry-parent row per distinct committee title. Schemes
--    are kept in `aliases` as a convenience snapshot; per-scheme child rows can
--    be expanded by the taxonomy agent's seed without conflicting with these.
--    ON CONFLICT DO NOTHING keeps re-runs safe and never clobbers admin edits.
--    Verified live 2026-06: 15 distinct committee ministries, schemes split
--    correctly (e.g. "NEP 2020, PM eVidya" -> {NEP 2020, PM eVidya}).
INSERT INTO yip.gov_taxonomy (ministry, scheme, official_name, aliases, category, sort_order, needs_review)
SELECT
  t.title                                   AS ministry,
  NULL                                      AS scheme,
  t.title                                   AS official_name,
  COALESCE(
    (
      SELECT array_agg(btrim(s))
      FROM regexp_split_to_table(t.linked_scheme, '[,;]') AS s
      WHERE btrim(s) <> ''
    ),
    '{}'::text[]
  )                                         AS aliases,
  'committee'                               AS category,
  row_number() OVER (ORDER BY t.title)      AS sort_order,
  false                                     AS needs_review
FROM yip.topics t
WHERE t.category = 'committee'
  AND t.is_active IS TRUE
  AND btrim(COALESCE(t.title, '')) <> ''
ON CONFLICT (lower(ministry), lower(COALESCE(scheme, ''))) DO NOTHING;
