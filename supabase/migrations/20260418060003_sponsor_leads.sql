-- ============================================================================
-- Migration: Sponsor Lead Capture (Stutzee Feature 3D)
-- ============================================================================
--
-- Stores leads collected on behalf of sponsors at events. EC Member+ operate
-- the sponsor portal on behalf of sponsors (no sponsor-rep login), capturing
-- attendees' contact info + interest level + follow-up instructions.
--
-- Tables: sponsor_leads
-- RLS:    EC+ can insert; own-row + Chair+ can read.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sponsor_leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_id            UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  captured_by_user_id   UUID NOT NULL REFERENCES auth.users(id),
  rsvp_id               UUID REFERENCES public.event_rsvps(id) ON DELETE SET NULL,
  guest_rsvp_id         UUID REFERENCES public.guest_rsvps(id) ON DELETE SET NULL,
  full_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  company               TEXT,
  designation           TEXT,
  interest_level        TEXT NOT NULL DEFAULT 'medium'
    CHECK (interest_level IN ('hot', 'warm', 'medium', 'cold')),
  interest_areas        TEXT[],
  notes                 TEXT,
  follow_up_requested   BOOLEAN NOT NULL DEFAULT false,
  follow_up_by          DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_leads_event
  ON public.sponsor_leads(event_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_leads_sponsor
  ON public.sponsor_leads(sponsor_id);

CREATE INDEX IF NOT EXISTS idx_sponsor_leads_rsvp
  ON public.sponsor_leads(rsvp_id)
  WHERE rsvp_id IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_sponsor_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sponsor_leads_updated_at ON public.sponsor_leads;
CREATE TRIGGER trg_sponsor_leads_updated_at
  BEFORE UPDATE ON public.sponsor_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sponsor_leads_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.sponsor_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EC+ manages sponsor leads" ON public.sponsor_leads;
CREATE POLICY "EC+ manages sponsor leads" ON public.sponsor_leads FOR ALL
  USING (
    captured_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Chair', 'Co-Chair', 'Executive Member', 'Super Admin', 'National Admin')
    )
  );

DROP POLICY IF EXISTS "EC+ inserts sponsor leads" ON public.sponsor_leads;
CREATE POLICY "EC+ inserts sponsor leads" ON public.sponsor_leads FOR INSERT
  TO authenticated
  WITH CHECK (
    captured_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Chair', 'Co-Chair', 'Executive Member', 'EC Member', 'Super Admin', 'National Admin')
    )
  );

COMMENT ON TABLE public.sponsor_leads IS
  'Leads captured at events on behalf of sponsors (Stutzee 3D). EC+ operate portal; no sponsor-rep login.';
