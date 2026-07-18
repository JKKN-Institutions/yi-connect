-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: YiFi admin payment + fees RPC functions
--
-- YiFi registration fees are collected MANUALLY/OFFLINE (UPI / bank transfer —
-- no payment gateway). A member registers and submits a payment reference
-- (payment_status='submitted'); an organiser must then VERIFY it ('verified')
-- or WAIVE it ('waived'). Organisers also configure the fee tiers + payment
-- instructions shown to members, and can manually add a real Yi member who is
-- missing from the directory (the members-only gate would otherwise exclude them).
--
-- All functions live in the public schema (PostgREST visibility), SECURITY
-- DEFINER to reach yifi.* tables. Authorisation is enforced at the page/action
-- layer (getAdminContext + hasPermission("registrants")) — these functions
-- assume the caller is already a verified organiser.
--
-- Additive only: every column referenced (editions.currency/early_bird_amount/
-- early_bird_until/regular_amount/payment_instructions and registrants.
-- payment_status/amount_due/payment_reference/payment_submitted_at/
-- payment_verified_at/payment_verified_by) is already applied to prod.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Fees configuration ──────────────────────────────────────────────────
-- Set the edition's fee tiers + the payment instructions shown to members.
CREATE OR REPLACE FUNCTION public.yifi_admin_set_fees(
  p_edition_id uuid,
  p_currency text,
  p_early_bird_amount numeric,
  p_early_bird_until date,
  p_regular_amount numeric,
  p_payment_instructions text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE yifi.editions
  SET currency = p_currency,
      early_bird_amount = p_early_bird_amount,
      early_bird_until = p_early_bird_until,
      regular_amount = p_regular_amount,
      payment_instructions = p_payment_instructions,
      updated_at = now()
  WHERE id = p_edition_id;
END;$function$;

-- ─── Payment verification list ───────────────────────────────────────────
-- All registrants for an edition with their payment state. in_directory flags
-- whether the registrant is linked to a yi_directory person (person_id set);
-- a false value warns the organiser this was a manual-add / unmatched member.
CREATE OR REPLACE FUNCTION public.yifi_admin_list_payments(p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', r.id,
      'full_name', r.full_name,
      'email', r.email,
      'phone', r.phone,
      'member_category', r.member_category,
      'person_id', r.person_id,
      'in_directory', r.person_id IS NOT NULL,
      'payment_status', r.payment_status,
      'amount_due', r.amount_due,
      'payment_reference', r.payment_reference,
      'payment_submitted_at', r.payment_submitted_at,
      'payment_verified_at', r.payment_verified_at,
      'payment_verified_by', r.payment_verified_by
    ) ORDER BY r.payment_submitted_at DESC NULLS LAST), '[]'::json)
    FROM yifi.registrants r
    WHERE r.edition_id = p_edition_id
  );
END;$function$;

-- ─── Verify a submitted payment ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.yifi_admin_verify_payment(
  p_registrant_id uuid,
  p_verified_by text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE yifi.registrants
  SET payment_status = 'verified',
      payment_verified_at = now(),
      payment_verified_by = p_verified_by,
      updated_at = now()
  WHERE id = p_registrant_id;
END;$function$;

-- ─── Waive a payment ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.yifi_admin_waive_payment(
  p_registrant_id uuid,
  p_verified_by text
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE yifi.registrants
  SET payment_status = 'waived',
      payment_verified_at = now(),
      payment_verified_by = p_verified_by,
      updated_at = now()
  WHERE id = p_registrant_id;
END;$function$;

-- ─── Manual-add escape hatch ─────────────────────────────────────────────
-- Add a real Yi member who is missing from the directory (person_id left null).
-- Generates a unique access_code via the existing helper and returns it so the
-- organiser can hand it to the member. payment_status starts 'unpaid'.
CREATE OR REPLACE FUNCTION public.yifi_admin_manual_add_registrant(
  p_edition_id uuid,
  p_full_name text,
  p_email text,
  p_phone text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_code text;
  v_id uuid;
BEGIN
  v_code := public.yifi_gen_access_code();

  INSERT INTO yifi.registrants (edition_id, full_name, email, phone, person_id, access_code, payment_status)
  VALUES (p_edition_id, p_full_name, p_email, p_phone, NULL, v_code, 'unpaid')
  RETURNING id INTO v_id;

  RETURN json_build_object('registrant_id', v_id, 'access_code', v_code);
END;$function$;

-- ─── Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.yifi_admin_set_fees(uuid, text, numeric, date, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_list_payments(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_verify_payment(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_waive_payment(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.yifi_admin_manual_add_registrant(uuid, text, text, text) TO authenticated, service_role;
