/**
 * Extend Availability Table with Structured Profile Fields
 *
 * Adds comprehensive availability profile fields:
 * - Time Commitment (hours per week)
 * - Preferred Days (Weekdays/Weekends/Flexible)
 * - Notice Period (2 hours to 1 month)
 * - Geographic Flexibility (Erode to Pan-India)
 * - Preferred Contact Method
 */

-- Add structured availability profile fields
ALTER TABLE public.availability
ADD COLUMN IF NOT EXISTS time_commitment_hours INTEGER CHECK (time_commitment_hours IN (2, 5, 10, 15, 20)),
ADD COLUMN IF NOT EXISTS preferred_days TEXT CHECK (preferred_days IN ('weekdays', 'weekends', 'flexible')),
ADD COLUMN IF NOT EXISTS notice_period TEXT CHECK (notice_period IN ('2_hours', '1_day', '3_days', '1_week', '2_weeks', '1_month')),
ADD COLUMN IF NOT EXISTS geographic_flexibility TEXT CHECK (geographic_flexibility IN ('erode_only', 'district', 'state', 'zone', 'pan_india')),
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT CHECK (preferred_contact_method IN ('whatsapp', 'email', 'phone', 'notification'));

-- Add comments for documentation
COMMENT ON COLUMN public.availability.time_commitment_hours IS 'Weekly time commitment in hours: 2, 5, 10, 15, or 20+';
COMMENT ON COLUMN public.availability.preferred_days IS 'Preferred availability days: weekdays, weekends, or flexible';
COMMENT ON COLUMN public.availability.notice_period IS 'Required notice period: from 2_hours to 1_month';
COMMENT ON COLUMN public.availability.geographic_flexibility IS 'Geographic scope: erode_only to pan_india';
COMMENT ON COLUMN public.availability.preferred_contact_method IS 'How member prefers to be contacted: whatsapp, email, phone, or notification';

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_availability_time_commitment ON public.availability(time_commitment_hours);
CREATE INDEX IF NOT EXISTS idx_availability_preferred_days ON public.availability(preferred_days);
CREATE INDEX IF NOT EXISTS idx_availability_geographic_flexibility ON public.availability(geographic_flexibility);
