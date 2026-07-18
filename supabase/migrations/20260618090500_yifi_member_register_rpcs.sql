-- YiFi member-gated, paid registration RPCs.
--
-- Two NEW rules this migration enforces at the database layer:
--   1. RESOLVE-OR-REJECT: every YiFi participant must already exist in
--      yi_directory.people. yifi_resolve_member() finds the person or returns
--      NULL — it NEVER creates a directory identity (the opposite of
--      lib/yi/directory/resolve-person.ts, which is find-or-CREATE). The /yifi/join
--      register door renders an explicit rejection screen on NULL; it must never
--      silently redirect.
--   2. MANUAL/OFFLINE PAYMENT: there is no payment gateway. The member sees the fee
--      (public.yifi_current_fee) + payment_instructions, pays via UPI/transfer
--      outside the app, then submits a payment_reference. yifi_register_member()
--      records the reference and sets payment_status='submitted' (pending organiser
--      verification). Access is granted on submit — the member can register + do
--      census while payment is unverified.
--
-- Normalization MUST match lib/yi/directory/resolve-person.ts exactly so the same
-- human matches whether they were entered there or here:
--   * email  = lower(trim(email))
--   * phone  = right(regexp_replace(phone, '\D', '', 'g'), 10)   (last 10 digits;
--              drops +91 / leading 0 / spaces / dashes)
--
-- Chapter resolution is BEST-EFFORT: the person's active role_assignments.yi_chapter
-- (a text chapter NAME) is matched to yi.chapters.name -> id. A null match does NOT
-- fail registration (registrants.chapter_id is nullable) — chapter is metadata, not
-- a gate.
--
-- Schema note: the payment columns (payment_status / amount_due / payment_reference /
-- payment_submitted_at / payment_verified_at / payment_verified_by) and the edition
-- fee columns + public.yifi_current_fee RPC were ALREADY APPLIED TO PROD before this
-- migration. This file is additive: it only creates the two new RPCs. It reuses the
-- existing public.yifi_gen_access_code() collision-free YIFI-XXXX generator.
--
-- Security posture: matches the established yifi RPC discipline — the server actions
-- call these with the SERVICE client, so EXECUTE is granted to service_role. Per this
-- task's brief the join page is pre-login, so anon + authenticated are granted too.

-- ---------------------------------------------------------------------------
-- 1. yifi_resolve_member — RESOLVE-OR-REJECT against yi_directory.people.
--    Returns the person (with best-effort chapter_id) or NULL. Never creates.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.yifi_resolve_member(
  p_email text,
  p_phone text
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_email   text := lower(nullif(trim(coalesce(p_email, '')), ''));
  -- last 10 digits only, mirroring resolve-person.ts normPhone(); null if < 10.
  v_phone   text;
  v_person  yi_directory.people%ROWTYPE;
  v_chapter_id uuid;
BEGIN
  v_phone := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  IF length(v_phone) < 10 THEN
    v_phone := NULL;
  END IF;

  -- Need at least one identifier to resolve.
  IF v_email IS NULL AND v_phone IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Match by email (strongest key), among active people.
  IF v_email IS NOT NULL THEN
    SELECT * INTO v_person
    FROM yi_directory.people
    WHERE lower(trim(email)) = v_email
      AND coalesce(is_active, true) = true
    LIMIT 1;
  END IF;

  -- 2. Fall back to phone (last-10-digit match) when email did not resolve.
  IF v_person.id IS NULL AND v_phone IS NOT NULL THEN
    SELECT * INTO v_person
    FROM yi_directory.people
    WHERE right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_phone
      AND coalesce(is_active, true) = true
    LIMIT 1;
  END IF;

  -- 3. Not found -> REJECT (NULL). The caller renders the explicit rejection screen.
  IF v_person.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 4. Best-effort chapter: the person's active role chapter NAME -> yi.chapters.id.
  --    Null when there is no name match — never fails resolution.
  SELECT c.id INTO v_chapter_id
  FROM yi_directory.role_assignments ra
  JOIN yi.chapters c ON lower(trim(c.name)) = lower(trim(ra.yi_chapter))
  WHERE ra.person_id = v_person.id
    AND ra.is_active = true
    AND ra.yi_chapter IS NOT NULL
  ORDER BY ra.yi_year DESC NULLS LAST
  LIMIT 1;

  RETURN json_build_object(
    'person_id',  v_person.id,
    'full_name',  v_person.full_name,
    'email',      v_person.email,
    'phone',      v_person.phone,
    'photo_url',  v_person.photo_url,
    'chapter_id', v_chapter_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. yifi_register_member — UPSERT a registrant for a resolved member with a
--    submitted (pending) payment. Mints an access code if the row has none.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.yifi_register_member(
  p_edition_id        uuid,
  p_person_id         uuid,
  p_full_name         text,
  p_email             text,
  p_phone             text,
  p_payment_reference text,
  p_amount_due        numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email      text := nullif(trim(coalesce(p_email, '')), '');
  v_name       text := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone      text := nullif(trim(coalesce(p_phone, '')), '');
  v_ref        text := nullif(trim(coalesce(p_payment_reference, '')), '');
  v_chapter_id uuid;
  v_id         uuid;
  v_code       text;
BEGIN
  IF p_edition_id IS NULL THEN
    RETURN json_build_object('error', 'Registration is not open yet');
  END IF;
  IF p_person_id IS NULL THEN
    -- Should never happen: resolve-or-reject runs before this. Fail closed.
    RETURN json_build_object('error', 'Member could not be resolved');
  END IF;
  IF v_name IS NULL THEN
    RETURN json_build_object('error', 'Name is required');
  END IF;
  IF v_ref IS NULL THEN
    RETURN json_build_object('error', 'Payment reference is required');
  END IF;

  -- Best-effort chapter from the directory role (same rule as yifi_resolve_member).
  SELECT c.id INTO v_chapter_id
  FROM yi_directory.role_assignments ra
  JOIN yi.chapters c ON lower(trim(c.name)) = lower(trim(ra.yi_chapter))
  WHERE ra.person_id = p_person_id
    AND ra.is_active = true
    AND ra.yi_chapter IS NOT NULL
  ORDER BY ra.yi_year DESC NULLS LAST
  LIMIT 1;

  -- Find an existing row to UPSERT: prefer (edition_id, person_id), else
  -- (edition_id, email) which is the table's UNIQUE key.
  SELECT id, access_code INTO v_id, v_code
  FROM yifi.registrants
  WHERE edition_id = p_edition_id AND person_id = p_person_id
  LIMIT 1;

  IF v_id IS NULL AND v_email IS NOT NULL THEN
    SELECT id, access_code INTO v_id, v_code
    FROM yifi.registrants
    WHERE edition_id = p_edition_id AND lower(email) = lower(v_email)
    LIMIT 1;
  END IF;

  IF v_id IS NOT NULL THEN
    -- UPDATE existing row. Keep its access_code if it already has one; mint one if not.
    IF v_code IS NULL OR length(trim(v_code)) = 0 THEN
      v_code := public.yifi_gen_access_code();
    END IF;

    UPDATE yifi.registrants SET
      person_id           = p_person_id,
      chapter_id          = coalesce(v_chapter_id, chapter_id),
      full_name           = v_name,
      email               = coalesce(v_email, email),
      phone               = coalesce(v_phone, phone),
      access_code         = v_code,
      amount_due          = p_amount_due,
      payment_reference   = v_ref,
      payment_status      = 'submitted',
      payment_submitted_at = now()
    WHERE id = v_id;
  ELSE
    -- INSERT a new registrant, guarded against the concurrent (edition_id, email) race.
    v_code := public.yifi_gen_access_code();
    BEGIN
      INSERT INTO yifi.registrants (
        edition_id, person_id, chapter_id, access_code,
        full_name, email, phone,
        amount_due, payment_reference, payment_status, payment_submitted_at,
        census_complete
      ) VALUES (
        p_edition_id, p_person_id, v_chapter_id, v_code,
        v_name, v_email, v_phone,
        p_amount_due, v_ref, 'submitted', now(),
        false
      )
      RETURNING id, access_code INTO v_id, v_code;
    EXCEPTION WHEN unique_violation THEN
      -- A concurrent submit for the same (edition_id, email) won the race. Re-fetch
      -- that row and apply the payment to it (idempotent), keeping its existing code.
      SELECT id, access_code INTO v_id, v_code
      FROM yifi.registrants
      WHERE edition_id = p_edition_id AND lower(email) = lower(v_email)
      LIMIT 1;

      IF v_id IS NULL THEN
        RETURN json_build_object('error', 'Could not save your registration. Please try again.');
      END IF;
      IF v_code IS NULL OR length(trim(v_code)) = 0 THEN
        v_code := public.yifi_gen_access_code();
      END IF;

      UPDATE yifi.registrants SET
        person_id            = p_person_id,
        chapter_id           = coalesce(v_chapter_id, chapter_id),
        full_name            = v_name,
        phone                = coalesce(v_phone, phone),
        access_code          = v_code,
        amount_due           = p_amount_due,
        payment_reference    = v_ref,
        payment_status       = 'submitted',
        payment_submitted_at = now()
      WHERE id = v_id;
    END;
  END IF;

  RETURN json_build_object(
    'registrant_id', v_id,
    'access_code',   v_code
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Grants. The server actions use the service client; the join page is
--    pre-login, so anon + authenticated may invoke too (per this task's brief).
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.yifi_resolve_member(text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.yifi_register_member(
  uuid, uuid, text, text, text, text, numeric)
  TO service_role;
