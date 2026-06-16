-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: YiFi paid, member-gated registration
--
-- Two facts drive this (2026-06-18): (1) every YiFi participant is an existing
-- Yi member — registration must RESOLVE to yi_directory.people (resolve-or-
-- REJECT, not create), and (2) members PAY to register. Payment is collected
-- MANUALLY/offline (UPI / bank transfer) — there is NO gateway. The member
-- submits a payment reference; an organiser verifies it.
--
-- Strictly additive. Fee amounts/dates/UPI details are admin-editable DATA
-- entered via the Fees panel — not hardcoded here.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Edition-level fee config (two-tier early-bird) ──────────────────────
ALTER TABLE yifi.editions
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS early_bird_amount   numeric(10,2),
  ADD COLUMN IF NOT EXISTS early_bird_until     date,
  ADD COLUMN IF NOT EXISTS regular_amount       numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_instructions text;

-- ─── Per-registrant manual payment tracking ──────────────────────────────
ALTER TABLE yifi.registrants
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','submitted','verified','waived')),
  ADD COLUMN IF NOT EXISTS amount_due           numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_reference     text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_at   timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_by   text;

-- ─── Fee resolver: current amount for an edition given a date ─────────────
-- Early-bird amount when (early_bird_until IS NULL OR p_on <= early_bird_until)
-- and an early-bird amount is set; otherwise regular_amount.
CREATE OR REPLACE FUNCTION public.yifi_current_fee(p_edition_id uuid, p_on date DEFAULT current_date)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
DECLARE e yifi.editions%ROWTYPE; v_amount numeric(10,2); v_tier text;
BEGIN
  SELECT * INTO e FROM yifi.editions WHERE id = p_edition_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF e.early_bird_amount IS NOT NULL
     AND (e.early_bird_until IS NULL OR p_on <= e.early_bird_until) THEN
    v_amount := e.early_bird_amount; v_tier := 'early_bird';
  ELSE
    v_amount := e.regular_amount; v_tier := 'regular';
  END IF;
  RETURN json_build_object(
    'amount', v_amount, 'tier', v_tier, 'currency', coalesce(e.currency,'INR'),
    'early_bird_until', e.early_bird_until, 'payment_instructions', e.payment_instructions);
END;$function$;

GRANT EXECUTE ON FUNCTION public.yifi_current_fee(uuid, date) TO authenticated, anon, service_role;
