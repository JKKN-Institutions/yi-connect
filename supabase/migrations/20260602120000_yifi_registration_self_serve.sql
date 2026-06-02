-- YiFi self-serve registration: the form IS the census IS the routing input.
--
-- Adds three nullable columns (expectations/intent, team size, free-text chapter
-- for a national registrant base) and a public SECURITY DEFINER RPC that:
--   * resolves the current edition (status != 'archived'),
--   * is idempotent on (edition_id, email) so a double-submit returns the same
--     row instead of hitting the UNIQUE(edition_id, email) constraint,
--   * generates a collision-free YIFI-XXXX access code,
--   * handles couples (creates the partner as their own registrant, cross-links),
--   * flips census_complete with the SAME rule as yifi_update_census
--     (>= 1 challenge AND a non-empty sector) so the Census Monitor counts it.
--
-- All access to the unexposed `yifi` schema stays behind public RPCs, matching
-- the existing yifi_lookup_registrant / yifi_update_census pattern.

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
  v_existing      yifi.registrants%ROWTYPE;
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
  v_mc            text := lower(nullif(trim(coalesce(p_member_category, '')), ''));
  v_team          text := nullif(trim(coalesce(p_total_team_size, '')), '');
  v_partner_name  text := nullif(trim(coalesce(p_partner_name, '')), '');
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

  -- idempotency: same edition + email -> return the existing row (no duplicate)
  IF v_email IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM yifi.registrants
    WHERE edition_id = v_edition_id AND lower(email) = lower(v_email)
    LIMIT 1;
    IF FOUND THEN
      RETURN json_build_object(
        'id', v_existing.id,
        'access_code', v_existing.access_code,
        'full_name', v_existing.full_name,
        'edition_id', v_existing.edition_id,
        'census_complete', v_existing.census_complete,
        'already_registered', true
      );
    END IF;
  END IF;

  v_code := public.yifi_gen_access_code();

  INSERT INTO yifi.registrants (
    edition_id, access_code, full_name, email, phone, member_category,
    chapter_name, sector, organisation, designation, city, challenges,
    can_offer, seeking, total_team_size, is_couple, census_complete
  ) VALUES (
    v_edition_id, v_code, v_name, v_email, v_phone, v_mc,
    v_chapter, v_sector,
    nullif(trim(coalesce(p_organisation, '')), ''),
    nullif(trim(coalesce(p_designation, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    p_challenges, coalesce(p_can_offer, '{}'::jsonb), p_seeking, v_team,
    coalesce(p_is_couple, false), v_census
  )
  RETURNING id INTO v_id;

  -- couple: partner becomes their own registrant (own access code), cross-linked
  IF coalesce(p_is_couple, false) AND v_partner_name IS NOT NULL THEN
    v_partner_code := public.yifi_gen_access_code();
    BEGIN
      INSERT INTO yifi.registrants (
        edition_id, access_code, full_name, email, phone, member_category,
        chapter_name, sector, organisation, designation, city, challenges,
        can_offer, seeking, total_team_size, is_couple, partner_registrant_id,
        census_complete
      ) VALUES (
        v_edition_id, v_partner_code, v_partner_name, v_partner_email,
        nullif(trim(coalesce(p_partner_phone, '')), ''), v_mc,
        v_chapter, v_sector,
        nullif(trim(coalesce(p_organisation, '')), ''), null,
        nullif(trim(coalesce(p_city, '')), ''),
        p_challenges, coalesce(p_can_offer, '{}'::jsonb), p_seeking, v_team,
        true, v_id, v_census
      )
      RETURNING id INTO v_partner_id;

      UPDATE yifi.registrants SET partner_registrant_id = v_partner_id WHERE id = v_id;
    EXCEPTION WHEN unique_violation THEN
      v_partner_id := NULL;  -- partner email already registered; skip silently
    END;
  END IF;

  RETURN json_build_object(
    'id', v_id,
    'access_code', v_code,
    'full_name', v_name,
    'edition_id', v_edition_id,
    'census_complete', v_census,
    'partner_id', v_partner_id,
    'already_registered', false
  );
END;
$$;

-- 4. Prefill helper for known Yi members (name/phone/photo only; directory has no
--    sector/chapter). Returns null when no active match by email.
CREATE OR REPLACE FUNCTION public.yifi_prefill_by_email(p_email text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_row   record;
BEGIN
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT full_name, email, phone, photo_url INTO v_row
  FROM yi_directory.people
  WHERE lower(email) = v_email AND coalesce(is_active, true) = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN json_build_object(
    'full_name', v_row.full_name,
    'email', v_row.email,
    'phone', v_row.phone,
    'photo_url', v_row.photo_url
  );
END;
$$;
