-- YIP demo-readiness DDL (applied 2026-05-27 via Management API; this file
-- captured for posterity / disaster recovery).
--
-- Closes gaps surfaced in the 2026-05-26 YIP National team meeting:
--   F3: position bonus on scores
--   F4: special-remark flags on scores
--   F5: live banner on events (projector breaking news)
--   F8: chapter admin login slug on organizers
-- Plus two JSONB config tables for tunable bonus / flag values so the
-- National Co-Chair can adjust without a code deploy.

-- F3: position bonus column
ALTER TABLE yip.scores ADD COLUMN IF NOT EXISTS position_bonus integer NOT NULL DEFAULT 0;

-- F4: special-remark flags
ALTER TABLE yip.scores ADD COLUMN IF NOT EXISTS flag_no_confidence_brought boolean NOT NULL DEFAULT false;
ALTER TABLE yip.scores ADD COLUMN IF NOT EXISTS flag_walkout boolean NOT NULL DEFAULT false;
ALTER TABLE yip.scores ADD COLUMN IF NOT EXISTS flag_ruckus boolean NOT NULL DEFAULT false;
ALTER TABLE yip.scores ADD COLUMN IF NOT EXISTS flag_suspension boolean NOT NULL DEFAULT false;

-- F5: live projector banner
ALTER TABLE yip.events ADD COLUMN IF NOT EXISTS live_banner_text text;
ALTER TABLE yip.events ADD COLUMN IF NOT EXISTS live_banner_active boolean NOT NULL DEFAULT false;

-- F8: organizer chapter-slug login (e.g. "mizoram-1")
ALTER TABLE yip.organizers ADD COLUMN IF NOT EXISTS login_slug text;
CREATE UNIQUE INDEX IF NOT EXISTS yip_organizers_login_slug_key
  ON yip.organizers(login_slug)
  WHERE login_slug IS NOT NULL;

-- Tunable bonus config (single-row JSONB)
CREATE TABLE IF NOT EXISTS yip.position_bonus_config (
  id boolean PRIMARY KEY DEFAULT true,
  bonuses jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT yip_position_bonus_singleton CHECK (id = true)
);
INSERT INTO yip.position_bonus_config (bonuses) VALUES (
  '{"prime_minister": 5, "speaker": 3, "deputy_speaker": 2, "leader_of_opposition": 3, "cabinet_minister": 2, "mp": 0}'::jsonb
) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS yip.scoring_flags_config (
  id boolean PRIMARY KEY DEFAULT true,
  deltas jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT yip_scoring_flags_singleton CHECK (id = true)
);
INSERT INTO yip.scoring_flags_config (deltas) VALUES (
  '{"no_confidence_brought": 3, "walkout": -5, "ruckus": -3, "suspension": -10}'::jsonb
) ON CONFLICT (id) DO NOTHING;
