-- YiFi self-serve registration: the form IS the census IS the routing input.
--
-- Adds three nullable columns (expectations/intent, team size, free-text chapter
-- for a national registrant base) and public SECURITY DEFINER RPCs that match the
-- existing unexposed-yifi-schema pattern (yifi_lookup_registrant / yifi_update_census).
--
-- Security posture (the registration page /yifi/join is PUBLIC + unauthenticated):
--   * yifi_register_self NEVER returns an existing registrant's access_code. On a
--     duplicate (edition_id, email) it returns only { already_registered: true } so
--     possession of an email can NOT mint a session or reveal a credential. A fresh
--     code is returned only for a row created in this same call.
--   * yifi_prefill_by_email returns name only (no phone/photo) to avoid turning the
--     member directory into a public phone book.
--   * All three functions are locked to service_role (the server actions use the
--     service client); EXECUTE is revoked from PUBLIC.
--
-- Behaviour:
--   * resolves the current edition (status != 'archived'),
--   * idempotent on (edition_id, email) — sequential AND concurrent (the INSERT is
--     guarded against the UNIQUE(edition_id, email) race),
--   * generates a collision-free YIFI-XXXX access code,
--   * handles couples: the partner becomes their own registrant (census_complete
--     FALSE so they complete their own census at /yifi/me — spec: each spouse is
--     filtered to their own problems), cross-linked; if the partner's email is
--     already registered we link to that row instead of dropping it,
--   * flips census_complete with the SAME rule as yifi_update_census
--     (>= 1 challenge AND a non-empty sector) so the Census Monitor counts it.

-- 1. Additive schema (nullable, no backfill)
ALTER TABLE yifi.registrants ADD COLUMN IF NOT EXISTS seeking text[];
ALTER TABLE yifi.registrants ADD COLUMN IF NOT EXISTS total_team_size text;
ALTER TABLE yifi.registrants ADD COLUMN IF NOT EXISTS chapter_name text;

-- 2. Collision-free access-code generator (unambiguous alphabet: no I, L, O, 0, 1)
CREATE OR REPLACE FUNCTION public.yifi_gen_access_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := 'YIFI-';
    FOR i IN 1..4 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM yifi.registrants WHERE access_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- 3. Self-serve registration RPC
CREATE OR REPLACE FUNCTION public.yifi_register_self(
  p_full_name       text,
  p_phone           text,
  p_email           text,
  p_member_category text,
  p_chapter_name    text,
  p_sector          text,
  p_organisation    text,
  p_designation     text,
  p_city            text,
  p_challenges      text[],
  p_can_offer       jsonb,
  p_seeking         text[],
  p_total_team_size text,
  p_is_couple       boolean,
  p_partner_name    text,
  p_partner_phone   text,
  p_partner_email   text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_edition_id    uuid;
  v_dup_id        uuid;
  v_code          text;
  v_partner_code  text;
  v_id            uuid;
  v_partner_id    uuid;
  v_census        boolean;
  v_email         text := nullif(trim(coalesce(p_email, '')), '');
  v_name          text := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone         text := nullif(trim(coalesce(p_phone, '')), '');
  v_chapter       text := nullif(trim(coalesce(p_chapter_name, '')), '');
  v_sector        text := nullif(trim(coalesce(p_sector, '')), '');
  v_org           text := nullif(trim(coalesce(p_organisation, '')), '');
  v_desig         text := nullif(trim(coalesce(p_designation, '')), '');
  v_city          text := nullif(trim(coalesce(p_city, '')), '');
  v_mc            text := lower(nullif(trim(coalesce(p_member_category, '')), ''));
  v_team          text := nullif(trim(coalesce(p_total_team_size, '')), '');
  v_partner_name  text := nullif(trim(coalesce(p_partner_name, '')), '');
  v_partner_phone text := nullif(trim(coalesce(p_partner_phone, '')), '');
  v_partner_email text := nullif(trim(coalesce(p_partner_email, '')), '');
BEGIN
  IF v_name IS NULL THEN
    RETURN json_build_object('error', 'Name is required');
  END IF;
  IF v_phone IS NULL THEN
    RETURN json_build_object('error', 'Phone is required');
  END IF;

  -- keep member_category within the CHECK constraint
  IF v_mc IS NOT NULL AND v_mc NOT IN ('ec', 'gc', 'nmt', 'general', 'couple') THEN
    v_mc := 'general';
  END IF;

  SELECT id INTO v_edition_id
  FROM yifi.editions
  WHERE status != 'archived'
  ORDER BY event_date ASC
  LIMIT 1;

  IF v_edition_id IS NULL THEN
    RETURN json_build_object('error', 'Registration is not open yet');
  END IF;

  v_census := (coalesce(array_length(p_challenges, 1), 0) >= 1
               AND v_sector IS NOT NULL);

  -- idempotency: same edition + email -> say so, but NEVER leak the existing code
  -- or mint a session for an identity the caller has not proven they own.
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_dup_id
    FROM yifi.registrants
    WHERE edition_id = v_edition_id AND lower(email) = lower(v_email)
    LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RETURN json_build_object('already_registered', true);
    END IF;
  END IF;

  v_code := public.yifi_gen_access_code();

  -- primary insert, guarded against the concurrent (edition_id, email) race
  BEGIN
    INSERT INTO yifi.registrants (
      edition_id, access_code, full_name, email, phone, member_category,
      chapter_name, sector, organisation, designation, city, challenges,
      can_offer, seeking, total_team_size, is_couple, census_complete
    ) VALUES (
      v_edition_id, v_code, v_name, v_email, v_phone, v_mc,
      v_chapter, v_sector, v_org, v_desig, v_city,
      p_challenges, coalesce(p_can_offer, '{}'::jsonb), p_seeking, v_team,
      coalesce(p_is_couple, false), v_census
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    -- a concurrent submit for the same email won the race; treat as duplicate
    -- (still never returning the existing code)
    RETURN json_build_object('already_registered', true);
  END;

  -- couple: partner becomes their own registrant. They complete THEIR OWN census
  -- at /yifi/me, so census_complete starts FALSE (do not overcount completion).
  IF coalesce(p_is_couple, false) AND v_partner_name IS NOT NULL THEN
    -- if the partner is already registered (by email) link to that row, don't dup
    IF v_partner_email IS NOT NULL THEN
      SELECT id INTO v_partner_id
      FROM yifi.registrants
      WHERE edition_id = v_edition_id AND lower(email) = lower(v_partner_email)
      LIMIT 1;
    END IF;

    IF v_partner_id IS NULL THEN
      v_partner_code := public.yifi_gen_access_code();
      BEGIN
        INSERT INTO yifi.registrants (
          edition_id, access_code, full_name, email, phone, member_category,
          chapter_name, sector, organisation, designation, city, challenges,
          can_offer, seeking, total_team_size, is_couple, partner_registrant_id,
          census_complete
        ) VALUES (
          v_edition_id, v_partner_code, v_partner_name, v_partner_email,
          v_partner_phone, v_mc, v_chapter, v_sector, v_org, null, v_city,
          p_challenges, coalesce(p_can_offer, '{}'::jsonb), p_seeking, v_team,
          true, v_id, false
        )
        RETURNING id INTO v_partner_id;
      EXCEPTION WHEN unique_violation THEN
        -- raced to register the partner email; fall back to linking the existing row
        SELECT id INTO v_partner_id
        FROM yifi.registrants
        WHERE edition_id = v_edition_id AND lower(email) = lower(v_partner_email)
        LIMIT 1;
      END;
    END IF;

    IF v_partner_id IS NOT NULL THEN
      UPDATE yifi.registrants SET partner_registrant_id = v_partner_id, is_couple = true WHERE id = v_id;
      UPDATE yifi.registrants SET partner_registrant_id = v_id, is_couple = true
        WHERE id = v_partner_id AND partner_registrant_id IS NULL;
    END IF;
  END IF;

  RETURN json_build_object(
    'id', v_id,
    'access_code', v_code,
    'full_name', v_name,
    'edition_id', v_edition_id,
    'census_complete', v_census,
    'partner_linked', v_partner_id IS NOT NULL,
    'already_registered', false
  );
END;
$$;

-- 4. Prefill helper for known Yi members. Returns NAME ONLY (no phone/photo) so a
--    guessed email cannot harvest contact details from the directory.
CREATE OR REPLACE FUNCTION public.yifi_prefill_by_email(p_email text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_name  text;
BEGIN
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT full_name INTO v_name
  FROM yi_directory.people
  WHERE lower(email) = v_email AND coalesce(is_active, true) = true
  LIMIT 1;
  IF v_name IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN json_build_object('full_name', v_name);
END;
$$;

-- 5. Lock the new functions to the service role (the server actions use the service
--    client). Matches the explicit-grant discipline of the prior yifi migrations and
--    removes the default PUBLIC execute grant.
-- Revoke from PUBLIC *and* from anon/authenticated. Supabase auto-grants EXECUTE
-- on new public functions to anon+authenticated via ALTER DEFAULT PRIVILEGES, which
-- would otherwise let the public anon key invoke these directly through PostgREST
-- (/rest/v1/rpc/...), bypassing the server actions. These must be service_role-only.
REVOKE ALL ON FUNCTION public.yifi_gen_access_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yifi_register_self(
  text, text, text, text, text, text, text, text, text, text[], jsonb, text[],
  text, boolean, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yifi_prefill_by_email(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.yifi_gen_access_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.yifi_register_self(
  text, text, text, text, text, text, text, text, text, text[], jsonb, text[],
  text, boolean, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.yifi_prefill_by_email(text) TO service_role;
