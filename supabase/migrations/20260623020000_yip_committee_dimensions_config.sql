CREATE TABLE IF NOT EXISTS yip.committee_dimensions_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  dimensions jsonb NOT NULL,
  drafting_divisor numeric NOT NULL DEFAULT 10,
  presentation_divisor numeric NOT NULL DEFAULT 2,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE yip.committee_dimensions_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON yip.committee_dimensions_config FROM anon, authenticated;
GRANT ALL ON yip.committee_dimensions_config TO service_role;
INSERT INTO yip.committee_dimensions_config (id, dimensions, drafting_divisor, presentation_divisor)
VALUES (true,
  '[{"key":"bill_draft_quality","label":"Bill Draft Quality"},{"key":"policy_relevance","label":"Policy Relevance"},{"key":"innovation","label":"Innovation"},{"key":"feasibility","label":"Feasibility"},{"key":"team_collaboration","label":"Team Collaboration"},{"key":"presentation_defence","label":"Presentation & Defence"}]'::jsonb,
  10, 2)
ON CONFLICT (id) DO NOTHING;
NOTIFY pgrst, 'reload schema';
