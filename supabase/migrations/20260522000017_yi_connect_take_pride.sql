-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Take Pride Award Automation (Module 6) — NEW build
--
-- The CLAUDE.md project plan claimed Module 6 was complete, but no
-- migration ever created the underlying tables. The vertical_performance
-- migration (lifted in batch 8) referenced `nominations(id)` and the
-- reports_system migration queried `award_nominations` — both unresolved.
--
-- This migration creates the full Take Pride schema in yi_connect.*,
-- inferred from docs/module_06_take_pride_award.md.
--
-- Source doc covers: 6 award categories, nomination form with attachments,
-- jury dashboard with weighted scoring (5 metrics: impact, innovation,
-- participation, consistency, leadership), verification stage,
-- certificate generation, leaderboard, automation triggers.
-- ═══════════════════════════════════════════════════════════════════════

SET search_path TO yi_connect, public, extensions;

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
                 WHERE t.typname = 'award_cycle_status' AND n.nspname = 'yi_connect') THEN
    CREATE TYPE yi_connect.award_cycle_status AS ENUM (
      'draft',          -- cycle created, not yet open
      'open',           -- accepting nominations
      'scoring',        -- nominations closed, jury scoring active
      'verification',   -- EM reviewing top scorers
      'announced',      -- winners declared
      'archived'        -- cycle complete
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
                 WHERE t.typname = 'nomination_status' AND n.nspname = 'yi_connect') THEN
    CREATE TYPE yi_connect.nomination_status AS ENUM (
      'draft',           -- auto-saved, not submitted
      'submitted',       -- submitted, awaiting jury
      'under_review',    -- jury actively scoring
      'shortlisted',     -- top scorer, awaiting verification
      'verified',        -- EM verified
      'flagged',         -- EM flagged for review
      'awarded',         -- declared winner
      'rejected',        -- not selected
      'withdrawn'        -- nominator withdrew
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
                 WHERE t.typname = 'jury_score_status' AND n.nspname = 'yi_connect') THEN
    CREATE TYPE yi_connect.jury_score_status AS ENUM (
      'pending',
      'in_progress',
      'submitted',
      'reopened'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
                 WHERE t.typname = 'certificate_status' AND n.nspname = 'yi_connect') THEN
    CREATE TYPE yi_connect.certificate_status AS ENUM (
      'pending',
      'generating',
      'issued',
      'failed',
      'revoked'
    );
  END IF;
END$$;

-- ============================================================================
-- TABLE: award_categories — master list of award types (per doc 6.1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.award_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE,
  -- chapter_id NULL = national-level category (visible across all chapters)

  name TEXT NOT NULL,
  -- e.g. 'Best Member of the Month', 'Best Volunteer (Quarterly)',
  -- 'Best Vertical Performance', 'Best Chapter Initiative',
  -- 'Chair''s Recognition', 'Lifetime Service Award'

  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT,                 -- lucide icon name
  color TEXT,                -- hex color for UI

  -- Eligibility criteria
  eligible_for TEXT CHECK (eligible_for IN ('member', 'vertical', 'chapter', 'initiative')),
  min_membership_months INTEGER DEFAULT 0,
  requires_active_membership BOOLEAN NOT NULL DEFAULT true,

  -- Scoring weights (per doc 6.4 — defaults match the example formula)
  weight_impact NUMERIC(5,4) NOT NULL DEFAULT 0.30,
  weight_innovation NUMERIC(5,4) NOT NULL DEFAULT 0.25,
  weight_participation NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  weight_consistency NUMERIC(5,4) NOT NULL DEFAULT 0.15,
  weight_leadership NUMERIC(5,4) NOT NULL DEFAULT 0.10,

  -- Cadence
  cadence TEXT CHECK (cadence IN ('monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time')),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  created_by UUID REFERENCES yi_connect.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_award_category_slug_per_chapter UNIQUE (chapter_id, slug),
  CONSTRAINT valid_weights CHECK (
    (weight_impact + weight_innovation + weight_participation +
     weight_consistency + weight_leadership) BETWEEN 0.99 AND 1.01
  )
);

CREATE INDEX idx_award_categories_chapter ON yi_connect.award_categories(chapter_id);
CREATE INDEX idx_award_categories_active ON yi_connect.award_categories(is_active) WHERE is_active = true;
CREATE INDEX idx_award_categories_cadence ON yi_connect.award_categories(cadence);

COMMENT ON TABLE yi_connect.award_categories IS
  'Master list of Take Pride award categories with scoring weights and cadence';

-- ============================================================================
-- TABLE: award_cycles — each cycle of an award (e.g. Q1-2026 Best Member)
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.award_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES yi_connect.award_categories(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE,

  cycle_name TEXT NOT NULL,   -- e.g. 'Q1 2026 — Best Volunteer'
  cycle_label TEXT,           -- e.g. 'Q1-2026', 'Jan-2026'

  -- Cycle window
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Nomination window
  nomination_open_at TIMESTAMPTZ,
  nomination_close_at TIMESTAMPTZ,

  -- Scoring window
  scoring_open_at TIMESTAMPTZ,
  scoring_close_at TIMESTAMPTZ,

  -- Outcome
  announced_at TIMESTAMPTZ,

  -- State
  status yi_connect.award_cycle_status NOT NULL DEFAULT 'draft',

  -- Reminder tracking (per doc 6.8 automation triggers)
  nomination_reminder_sent BOOLEAN NOT NULL DEFAULT false,
  jury_reminder_sent BOOLEAN NOT NULL DEFAULT false,

  created_by UUID REFERENCES yi_connect.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_cycle_window CHECK (period_end >= period_start)
);

CREATE INDEX idx_award_cycles_category ON yi_connect.award_cycles(category_id);
CREATE INDEX idx_award_cycles_chapter ON yi_connect.award_cycles(chapter_id);
CREATE INDEX idx_award_cycles_status ON yi_connect.award_cycles(status);
CREATE INDEX idx_award_cycles_period ON yi_connect.award_cycles(period_start, period_end);

COMMENT ON TABLE yi_connect.award_cycles IS
  'A single round of an award (e.g. Q1-2026 Best Volunteer). Drives lifecycle dates.';

-- ============================================================================
-- TABLE: nominations — a submitted nomination
-- (this is the table referenced by vertical_performance.award_nomination_id
--  and reports_system.award_nominations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES yi_connect.award_cycles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES yi_connect.award_categories(id) ON DELETE RESTRICT,
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE,

  -- Who is nominated (polymorphic — member, vertical, or chapter)
  nominee_type TEXT NOT NULL CHECK (nominee_type IN ('member', 'vertical', 'chapter', 'initiative')),
  nominee_member_id UUID REFERENCES yi_connect.members(id) ON DELETE CASCADE,
  nominee_vertical_id UUID,    -- soft ref to yi_connect.verticals
  nominee_text TEXT,           -- free-form name (initiative/chapter) when no FK applies

  -- Who nominated
  nominator_id UUID NOT NULL REFERENCES yi_connect.profiles(id) ON DELETE CASCADE,

  -- Submission content
  title TEXT,
  citation TEXT,               -- short narrative for the award
  achievements TEXT,           -- bullet list of achievements
  impact_summary TEXT,         -- quantified impact
  supporting_data JSONB,       -- structured data (numbers, dates, links)

  -- Status
  status yi_connect.nomination_status NOT NULL DEFAULT 'draft',

  -- Computed score (cached from jury_scores; recomputed by trigger or job)
  final_score NUMERIC(6,2),
  rank INTEGER,                -- final rank within the cycle

  -- Verification (per doc 6.5)
  verified_by UUID REFERENCES yi_connect.profiles(id),
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  flagged_reason TEXT,

  -- Timestamps
  submitted_at TIMESTAMPTZ,
  awarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_nominee_ref CHECK (
    (nominee_type = 'member' AND nominee_member_id IS NOT NULL) OR
    (nominee_type = 'vertical' AND nominee_vertical_id IS NOT NULL) OR
    (nominee_type IN ('chapter', 'initiative') AND nominee_text IS NOT NULL)
  )
);

-- Per doc 6.2: cannot nominate same member twice in one cycle
CREATE UNIQUE INDEX uniq_nomination_per_cycle_member
  ON yi_connect.nominations(cycle_id, nominee_member_id)
  WHERE nominee_member_id IS NOT NULL AND status != 'withdrawn';

CREATE INDEX idx_nominations_cycle ON yi_connect.nominations(cycle_id);
CREATE INDEX idx_nominations_category ON yi_connect.nominations(category_id);
CREATE INDEX idx_nominations_chapter ON yi_connect.nominations(chapter_id);
CREATE INDEX idx_nominations_nominee_member ON yi_connect.nominations(nominee_member_id)
  WHERE nominee_member_id IS NOT NULL;
CREATE INDEX idx_nominations_nominator ON yi_connect.nominations(nominator_id);
CREATE INDEX idx_nominations_status ON yi_connect.nominations(status);
CREATE INDEX idx_nominations_final_score ON yi_connect.nominations(cycle_id, final_score DESC NULLS LAST);

COMMENT ON TABLE yi_connect.nominations IS
  'Take Pride award nominations. Polymorphic nominee (member/vertical/chapter/initiative).';

-- ============================================================================
-- VIEW: award_nominations — alias for legacy queries (reports_system used this name)
-- ============================================================================
-- Reports system queries SELECT ... FROM award_nominations WHERE nominee_id = m.id
-- so the view must expose `nominee_id` and `status`.
CREATE OR REPLACE VIEW yi_connect.award_nominations AS
SELECT
  n.id,
  n.cycle_id,
  n.category_id,
  n.chapter_id,
  n.nominee_member_id AS nominee_id,   -- alias for reports_system compatibility
  n.nominee_type,
  n.nominee_member_id,
  n.nominee_vertical_id,
  n.nominee_text,
  n.nominator_id,
  n.title,
  n.citation,
  n.achievements,
  n.impact_summary,
  n.status,
  n.final_score,
  n.rank,
  n.verified_by,
  n.verified_at,
  n.submitted_at,
  n.awarded_at,
  n.created_at,
  n.updated_at
FROM yi_connect.nominations n;

COMMENT ON VIEW yi_connect.award_nominations IS
  'Legacy alias for yi_connect.nominations. Exposes nominee_id for reports_system queries.';

-- ============================================================================
-- TABLE: nomination_attachments — supporting files per doc 6.2
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.nomination_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id UUID NOT NULL REFERENCES yi_connect.nominations(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  caption TEXT,

  uploaded_by UUID REFERENCES yi_connect.profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nomination_attachments_nomination
  ON yi_connect.nomination_attachments(nomination_id);

COMMENT ON TABLE yi_connect.nomination_attachments IS
  'Supporting files (images, reports, certificates) attached to nominations';

-- ============================================================================
-- TABLE: jury_panels — jury composition for a cycle (per doc 6.3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.jury_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES yi_connect.award_cycles(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE,

  panel_name TEXT NOT NULL,
  description TEXT,

  -- Anonymization (per doc 6.3: name masked until scoring complete)
  anonymize_nominees BOOLEAN NOT NULL DEFAULT true,

  -- Operational
  scoring_deadline TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_by UUID REFERENCES yi_connect.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jury_panels_cycle ON yi_connect.jury_panels(cycle_id);
CREATE INDEX idx_jury_panels_chapter ON yi_connect.jury_panels(chapter_id);

COMMENT ON TABLE yi_connect.jury_panels IS
  'Jury panel composition for one award cycle. Multiple jurors via jury_panel_members.';

-- ============================================================================
-- TABLE: jury_panel_members — many-to-many between panels and jurors
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.jury_panel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id UUID NOT NULL REFERENCES yi_connect.jury_panels(id) ON DELETE CASCADE,
  juror_id UUID NOT NULL REFERENCES yi_connect.profiles(id) ON DELETE CASCADE,

  role TEXT CHECK (role IN ('chair', 'juror', 'observer')),
  is_active BOOLEAN NOT NULL DEFAULT true,

  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (panel_id, juror_id)
);

CREATE INDEX idx_jury_panel_members_panel ON yi_connect.jury_panel_members(panel_id);
CREATE INDEX idx_jury_panel_members_juror ON yi_connect.jury_panel_members(juror_id);

COMMENT ON TABLE yi_connect.jury_panel_members IS
  'Jurors assigned to a panel. Each juror scores independently.';

-- ============================================================================
-- TABLE: jury_scores — individual juror scores per nomination (per doc 6.3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.jury_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id UUID NOT NULL REFERENCES yi_connect.nominations(id) ON DELETE CASCADE,
  panel_id UUID NOT NULL REFERENCES yi_connect.jury_panels(id) ON DELETE CASCADE,
  juror_id UUID NOT NULL REFERENCES yi_connect.profiles(id) ON DELETE CASCADE,

  -- Per doc 6.3: 5 metrics on a 1-10 scale
  score_impact NUMERIC(3,1) CHECK (score_impact BETWEEN 1 AND 10),
  score_innovation NUMERIC(3,1) CHECK (score_innovation BETWEEN 1 AND 10),
  score_participation NUMERIC(3,1) CHECK (score_participation BETWEEN 1 AND 10),
  score_consistency NUMERIC(3,1) CHECK (score_consistency BETWEEN 1 AND 10),
  score_leadership NUMERIC(3,1) CHECK (score_leadership BETWEEN 1 AND 10),

  -- Computed weighted score (kept as plain column; weights come from category)
  -- Calculated by trigger/app, not GENERATED, to avoid IMMUTABLE issues
  weighted_score NUMERIC(6,2),

  -- Free-form feedback
  comments TEXT,
  strengths TEXT,
  concerns TEXT,

  -- Status
  status yi_connect.jury_score_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One score per juror per nomination
  UNIQUE (nomination_id, juror_id)
);

CREATE INDEX idx_jury_scores_nomination ON yi_connect.jury_scores(nomination_id);
CREATE INDEX idx_jury_scores_panel ON yi_connect.jury_scores(panel_id);
CREATE INDEX idx_jury_scores_juror ON yi_connect.jury_scores(juror_id);
CREATE INDEX idx_jury_scores_status ON yi_connect.jury_scores(status);

COMMENT ON TABLE yi_connect.jury_scores IS
  'Individual juror scores. Auto-averaged by the weighted_score column per doc 6.4 formula.';

-- ============================================================================
-- TABLE: award_certificates — issued certificates (per doc 6.6)
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.award_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id UUID NOT NULL REFERENCES yi_connect.nominations(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES yi_connect.award_cycles(id) ON DELETE CASCADE,

  certificate_number TEXT UNIQUE,
  recipient_name TEXT NOT NULL,
  award_title TEXT NOT NULL,
  citation TEXT,

  -- Output
  template_id TEXT,            -- which certificate template was used
  pdf_url TEXT,
  thumbnail_url TEXT,
  signature_urls JSONB,        -- {chair: url, em: url, ...}

  -- Status
  status yi_connect.certificate_status NOT NULL DEFAULT 'pending',
  generation_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,

  -- Issuance
  issued_at TIMESTAMPTZ,
  issued_by UUID REFERENCES yi_connect.profiles(id),

  -- Distribution
  emailed_at TIMESTAMPTZ,
  whatsapp_sent_at TIMESTAMPTZ,
  download_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_award_certificates_nomination ON yi_connect.award_certificates(nomination_id);
CREATE INDEX idx_award_certificates_cycle ON yi_connect.award_certificates(cycle_id);
CREATE INDEX idx_award_certificates_status ON yi_connect.award_certificates(status);

COMMENT ON TABLE yi_connect.award_certificates IS
  'Issued award certificates with PDF generation status and distribution tracking';

-- ============================================================================
-- TABLE: award_announcements — winner announcements (per doc 6.6)
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.award_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES yi_connect.award_cycles(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE,

  headline TEXT NOT NULL,
  body TEXT,
  hero_image_url TEXT,

  -- Channels
  posted_to_whatsapp BOOLEAN NOT NULL DEFAULT false,
  posted_to_email BOOLEAN NOT NULL DEFAULT false,
  posted_to_app BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES yi_connect.profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_award_announcements_cycle ON yi_connect.award_announcements(cycle_id);
CREATE INDEX idx_award_announcements_chapter ON yi_connect.award_announcements(chapter_id);

COMMENT ON TABLE yi_connect.award_announcements IS
  'Winner announcement posts pushed to WhatsApp/email/in-app per doc 6.6';

-- ============================================================================
-- TABLE: award_history — annual archive (per doc 6.8 — Jan 1 reset)
-- ============================================================================
CREATE TABLE IF NOT EXISTS yi_connect.award_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id UUID NOT NULL REFERENCES yi_connect.nominations(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES yi_connect.award_cycles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES yi_connect.award_categories(id) ON DELETE RESTRICT,
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE,

  year INTEGER NOT NULL,
  award_title TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_member_id UUID REFERENCES yi_connect.members(id),
  citation TEXT,
  final_score NUMERIC(6,2),

  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_award_history_year ON yi_connect.award_history(year);
CREATE INDEX idx_award_history_category ON yi_connect.award_history(category_id);
CREATE INDEX idx_award_history_chapter ON yi_connect.award_history(chapter_id);
CREATE INDEX idx_award_history_member ON yi_connect.award_history(recipient_member_id);

COMMENT ON TABLE yi_connect.award_history IS
  'Annual archive of awarded nominations for leaderboard history (doc 6.7)';

-- ============================================================================
-- TRIGGERS — updated_at
-- ============================================================================

CREATE TRIGGER trg_award_categories_updated_at
  BEFORE UPDATE ON yi_connect.award_categories
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER trg_award_cycles_updated_at
  BEFORE UPDATE ON yi_connect.award_cycles
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER trg_nominations_updated_at
  BEFORE UPDATE ON yi_connect.nominations
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER trg_jury_panels_updated_at
  BEFORE UPDATE ON yi_connect.jury_panels
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER trg_jury_scores_updated_at
  BEFORE UPDATE ON yi_connect.jury_scores
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER trg_award_certificates_updated_at
  BEFORE UPDATE ON yi_connect.award_certificates
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER trg_award_announcements_updated_at
  BEFORE UPDATE ON yi_connect.award_announcements
  FOR EACH ROW EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- ============================================================================
-- TRIGGER: auto-compute weighted_score on jury_scores insert/update
-- (per doc 6.4 formula, using category weights)
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.compute_jury_weighted_score()
RETURNS TRIGGER AS $$
DECLARE
  v_w_impact NUMERIC(5,4);
  v_w_innovation NUMERIC(5,4);
  v_w_participation NUMERIC(5,4);
  v_w_consistency NUMERIC(5,4);
  v_w_leadership NUMERIC(5,4);
BEGIN
  -- Fetch weights from category via nomination
  SELECT ac.weight_impact, ac.weight_innovation, ac.weight_participation,
         ac.weight_consistency, ac.weight_leadership
  INTO v_w_impact, v_w_innovation, v_w_participation, v_w_consistency, v_w_leadership
  FROM yi_connect.nominations n
  JOIN yi_connect.award_categories ac ON n.category_id = ac.id
  WHERE n.id = NEW.nomination_id;

  -- Compute weighted score per doc 6.4 formula (multiply by 10 to scale 0-100)
  NEW.weighted_score := (
    COALESCE(NEW.score_impact, 0) * COALESCE(v_w_impact, 0.30) +
    COALESCE(NEW.score_innovation, 0) * COALESCE(v_w_innovation, 0.25) +
    COALESCE(NEW.score_participation, 0) * COALESCE(v_w_participation, 0.20) +
    COALESCE(NEW.score_consistency, 0) * COALESCE(v_w_consistency, 0.15) +
    COALESCE(NEW.score_leadership, 0) * COALESCE(v_w_leadership, 0.10)
  ) * 10;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jury_scores_compute_weighted
  BEFORE INSERT OR UPDATE OF score_impact, score_innovation, score_participation,
                              score_consistency, score_leadership
  ON yi_connect.jury_scores
  FOR EACH ROW EXECUTE FUNCTION yi_connect.compute_jury_weighted_score();

-- ============================================================================
-- TRIGGER: refresh nominations.final_score when jury_scores change
-- ============================================================================
CREATE OR REPLACE FUNCTION yi_connect.refresh_nomination_final_score()
RETURNS TRIGGER AS $$
DECLARE
  v_nomination_id UUID;
  v_avg NUMERIC(6,2);
BEGIN
  v_nomination_id := COALESCE(NEW.nomination_id, OLD.nomination_id);

  SELECT ROUND(AVG(weighted_score)::NUMERIC, 2)
  INTO v_avg
  FROM yi_connect.jury_scores
  WHERE nomination_id = v_nomination_id
    AND status = 'submitted';

  UPDATE yi_connect.nominations
  SET final_score = v_avg,
      updated_at = now()
  WHERE id = v_nomination_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jury_scores_refresh_final
  AFTER INSERT OR UPDATE OR DELETE ON yi_connect.jury_scores
  FOR EACH ROW EXECUTE FUNCTION yi_connect.refresh_nomination_final_score();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE yi_connect.award_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.award_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.nomination_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.jury_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.jury_panel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.jury_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.award_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.award_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE yi_connect.award_history ENABLE ROW LEVEL SECURITY;

-- ── award_categories: read all authenticated; write national admins
CREATE POLICY "award_categories_read_authenticated"
  ON yi_connect.award_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "award_categories_write_national_admins"
  ON yi_connect.award_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- ── award_cycles: read all authenticated; write national admins
CREATE POLICY "award_cycles_read_authenticated"
  ON yi_connect.award_cycles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "award_cycles_write_national_admins"
  ON yi_connect.award_cycles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- ── nominations: read authenticated; write own (nominator) + national admins
CREATE POLICY "nominations_read_authenticated"
  ON yi_connect.nominations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "nominations_insert_own"
  ON yi_connect.nominations FOR INSERT
  TO authenticated
  WITH CHECK (nominator_id = auth.uid());

CREATE POLICY "nominations_update_own_or_admin"
  ON yi_connect.nominations FOR UPDATE
  TO authenticated
  USING (
    nominator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "nominations_delete_own_or_admin"
  ON yi_connect.nominations FOR DELETE
  TO authenticated
  USING (
    nominator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- ── nomination_attachments: same access as parent nomination
CREATE POLICY "nomination_attachments_read"
  ON yi_connect.nomination_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "nomination_attachments_write_uploader_or_admin"
  ON yi_connect.nomination_attachments FOR ALL
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM yi_connect.nominations n
      WHERE n.id = nomination_id
        AND n.nominator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM yi_connect.nominations n
      WHERE n.id = nomination_id
        AND n.nominator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- ── jury_panels: read authenticated; write national admins
CREATE POLICY "jury_panels_read_authenticated"
  ON yi_connect.jury_panels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "jury_panels_write_national_admins"
  ON yi_connect.jury_panels FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- ── jury_panel_members: read authenticated; write national admins
CREATE POLICY "jury_panel_members_read_authenticated"
  ON yi_connect.jury_panel_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "jury_panel_members_write_national_admins"
  ON yi_connect.jury_panel_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- ── jury_scores: read authenticated; juror writes own scores; admins manage
CREATE POLICY "jury_scores_read_authenticated"
  ON yi_connect.jury_scores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "jury_scores_insert_own"
  ON yi_connect.jury_scores FOR INSERT
  TO authenticated
  WITH CHECK (juror_id = auth.uid());

CREATE POLICY "jury_scores_update_own_or_admin"
  ON yi_connect.jury_scores FOR UPDATE
  TO authenticated
  USING (
    juror_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "jury_scores_delete_admin_only"
  ON yi_connect.jury_scores FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- ── award_certificates: read authenticated; write national admins
CREATE POLICY "award_certificates_read_authenticated"
  ON yi_connect.award_certificates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "award_certificates_write_national_admins"
  ON yi_connect.award_certificates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- ── award_announcements: read authenticated; write national admins
CREATE POLICY "award_announcements_read_authenticated"
  ON yi_connect.award_announcements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "award_announcements_write_national_admins"
  ON yi_connect.award_announcements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- ── award_history: read authenticated; write national admins
CREATE POLICY "award_history_read_authenticated"
  ON yi_connect.award_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "award_history_write_national_admins"
  ON yi_connect.award_history FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yi.national_admins na
      JOIN auth.users u ON u.email = na.email
      WHERE u.id = auth.uid()
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON yi_connect.award_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON yi_connect.award_cycles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON yi_connect.nominations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON yi_connect.nomination_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON yi_connect.jury_panels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON yi_connect.jury_panel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON yi_connect.jury_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON yi_connect.award_certificates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON yi_connect.award_announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON yi_connect.award_history TO authenticated;
GRANT SELECT ON yi_connect.award_nominations TO authenticated;

NOTIFY pgrst, 'reload schema';
