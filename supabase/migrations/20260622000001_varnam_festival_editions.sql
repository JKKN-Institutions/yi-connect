-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Varnam Vizha — festival_editions (evergreen edition grouping)
--
-- The ONE new table the Varnam Vizha festival vertical needs. Events in
-- yi_connect are flat (no series/edition linkage); this table groups an
-- edition's sub-events so any year plugs in (2021 … 2026 …) and rolls up.
--
-- Everything else the festival needs is REUSED, not created: events, sessions,
-- speakers, custom-form RSVP, sponsor CRM, finance.
-- See docs/SPEC-VARNAM-VIZHA-FESTIVAL-PLATFORM.md.
--
-- Identity/roles: NO new auth table. Roles live in yi_directory.role_assignments
-- with app='varnam' (free-text column, no CHECK — no migration needed for the
-- app value).
--
-- ⚠ VERIFY BEFORE APPLY: events.festival_edition_id targets yi_connect.events
-- (the canonical events module). The 2025 Yi-Erode import seeded public.events —
-- reconcile historical rows in a later seed migration (P4). This migration is
-- schema-only; it inserts no data.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS yi_connect.festival_editions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_key     text NOT NULL DEFAULT 'varnam-vizha',  -- keeps it future-generic
  chapter_id       uuid REFERENCES yi.chapters(id),
  year             integer NOT NULL,
  name             text NOT NULL,                          -- "Varnam Vizha 2026"
  slug             text NOT NULL UNIQUE,                   -- "varnam-vizha-2026"
  theme            text,                                   -- optional annual theme
  start_date       date,
  end_date         date,
  status           text NOT NULL DEFAULT 'planning'
                     CHECK (status IN ('planning','live','completed','archived')),
  chair_person_ids uuid[] NOT NULL DEFAULT '{}',           -- → yi_directory.people.id
  budget_id        uuid REFERENCES yi_connect.budgets(id), -- ties P&L to the edition
  hero_image_url   text,
  summary          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_festival_edition_key_year UNIQUE (festival_key, year)
);

COMMENT ON TABLE yi_connect.festival_editions IS
  'One row per festival edition/year (e.g. Varnam Vizha 2026). Sub-events are yi_connect.events rows linked via events.festival_edition_id. Erode-only for now; festival_key + chapter_id keep it future-generic.';

CREATE INDEX IF NOT EXISTS idx_festival_editions_key_year
  ON yi_connect.festival_editions (festival_key, year DESC);
CREATE INDEX IF NOT EXISTS idx_festival_editions_status
  ON yi_connect.festival_editions (status);
CREATE INDEX IF NOT EXISTS idx_festival_editions_chapter
  ON yi_connect.festival_editions (chapter_id);

-- Link sub-events to an edition (nullable: a plain event need not belong to one).
ALTER TABLE yi_connect.events
  ADD COLUMN IF NOT EXISTS festival_edition_id uuid
    REFERENCES yi_connect.festival_editions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_festival_edition
  ON yi_connect.events (festival_edition_id);

-- ── RLS ────────────────────────────────────────────────────────────────
-- Public site reads live/completed editions anonymously. Writes go through the
-- service client in server actions (RLS-bypassing), gated in app-layer auth by
-- yi_directory role (app='varnam'). No anon/authenticated write policy here.
ALTER TABLE yi_connect.festival_editions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS festival_editions_public_read ON yi_connect.festival_editions;
CREATE POLICY festival_editions_public_read
  ON yi_connect.festival_editions
  FOR SELECT
  USING (status IN ('live','completed'));

-- updated_at is maintained by the application layer (server actions set it on write).
