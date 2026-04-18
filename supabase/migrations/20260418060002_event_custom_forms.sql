-- =============================================================================
-- Event Custom Forms: Custom form builder for event registration
-- (Stutzee Feature 1C)
-- =============================================================================
-- Adds JSONB columns to events for storing registration form field definitions,
-- and to event_rsvps / guest_rsvps for capturing dynamic custom-field responses.
--
-- Design notes:
-- - Field IDs are client-generated UUIDs (stable across saves)
-- - Field types: text, textarea, select, multiselect, checkbox, date, number, phone
-- - Validation / required-ness is enforced in the app layer (Zod) because JSONB
--   does not support per-field constraints cheaply; GIN index speeds up future
--   queries on responses.
-- =============================================================================

-- 1. Event-level custom form field definitions
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_form_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.registration_form_fields IS
  'Array of CustomFormField objects. Each field: { id, type, label, required, placeholder?, help_text?, options?, sort_order }.';

-- 2. Per-RSVP response storage
ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS custom_field_responses JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.event_rsvps.custom_field_responses IS
  'Map of custom field id -> user response value. Shape: { [field_id]: string | string[] | boolean | number | null }.';

-- 3. Guest RSVP parity
ALTER TABLE public.guest_rsvps
  ADD COLUMN IF NOT EXISTS custom_field_responses JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.guest_rsvps.custom_field_responses IS
  'Map of custom field id -> user response value. Same shape as event_rsvps.custom_field_responses.';

-- 4. GIN index on event_rsvps custom responses for future filtering / analytics
CREATE INDEX IF NOT EXISTS idx_event_rsvps_custom_responses
  ON public.event_rsvps USING gin(custom_field_responses);

CREATE INDEX IF NOT EXISTS idx_guest_rsvps_custom_responses
  ON public.guest_rsvps USING gin(custom_field_responses);
