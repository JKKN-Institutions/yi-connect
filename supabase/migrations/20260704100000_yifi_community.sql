-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: YiFi Community ("YIBE Corner") — peer challenge board
--
-- A member-to-member board where YiFi registrants post business challenges,
-- best practices, and industry notes; reply, upvote helpful answers, mark a
-- "best answer", and flag content. Census-collected challenges are pre-seeded
-- as *drafts* the member can approve or discard before they go public.
--
-- Anonymity is a first-class feature: a post/reply may be anonymous, and the
-- author's identity is masked INSIDE the read RPCs — never returned unless the
-- viewer is the author, or the call is an admin (unmasked) call.
--
-- Design notes
-- ────────────
--  • Tables live in schema `yifi` (RLS on, permissive SELECT policy) matching
--    the existing yifi.* tables; ALL access in app code is via the SECURITY
--    DEFINER RPCs below, called with the service client.
--  • RPCs live in `public` (PostgREST visibility) and are hardened at the end:
--    EXECUTE is revoked from PUBLIC/anon/authenticated and granted ONLY to
--    service_role (every yifi RPC is invoked via the service client). This
--    closes the Postgres PUBLIC-default-grant leak this codebase has hit.
--  • reply_count / upvote_count / best_reply_id are kept consistent by the
--    mutating RPCs. seed + suggest are idempotent.
--
-- Strictly additive. Rollback:
--   DROP TABLE yifi.community_notifications, yifi.community_flags,
--     yifi.community_reply_votes, yifi.community_replies, yifi.community_posts;
--   (plus DROP FUNCTION for each public.yifi_community_* function)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────────────────

-- Posts (challenge / best_practice / industry). 'draft' = census-seeded and
-- pending the member's approval; only 'published' shows on the board.
CREATE TABLE IF NOT EXISTS yifi.community_posts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id            uuid NOT NULL,
  author_registrant_id  uuid NOT NULL REFERENCES yifi.registrants(id),
  post_type             text NOT NULL CHECK (post_type IN ('challenge','best_practice','industry')),
  title                 text NOT NULL,
  body                  text NOT NULL,
  sector                text,
  is_anonymous          boolean NOT NULL DEFAULT false,
  status                text NOT NULL DEFAULT 'published'
                        CHECK (status IN ('draft','published','hidden','removed')),
  is_seeded             boolean NOT NULL DEFAULT false,
  source_challenge      text,
  best_reply_id         uuid,        -- FK omitted (circular with replies); kept in sync by RPCs
  reply_count           int NOT NULL DEFAULT 0,
  upvote_count          int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE yifi.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_posts_read" ON yifi.community_posts FOR SELECT USING (true);

-- Replies to a post.
CREATE TABLE IF NOT EXISTS yifi.community_replies (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id               uuid NOT NULL REFERENCES yifi.community_posts(id),
  author_registrant_id  uuid NOT NULL,
  body                  text NOT NULL,
  is_anonymous          boolean NOT NULL DEFAULT false,
  upvote_count          int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE yifi.community_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_replies_read" ON yifi.community_replies FOR SELECT USING (true);

-- Per-registrant upvotes on replies (one per registrant per reply).
CREATE TABLE IF NOT EXISTS yifi.community_reply_votes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id       uuid NOT NULL REFERENCES yifi.community_replies(id),
  registrant_id  uuid NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reply_id, registrant_id)
);

ALTER TABLE yifi.community_reply_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_reply_votes_read" ON yifi.community_reply_votes FOR SELECT USING (true);

-- Moderation flags raised by members.
CREATE TABLE IF NOT EXISTS yifi.community_flags (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id               uuid,
  post_id                  uuid,
  reply_id                 uuid,
  flagged_by_registrant_id uuid,
  reason                   text,
  status                   text NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','resolved','dismissed')),
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE yifi.community_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_flags_read" ON yifi.community_flags FOR SELECT USING (true);

-- Notifications to members (new reply, best-answer, helper suggestion).
CREATE TABLE IF NOT EXISTS yifi.community_notifications (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_registrant_id  uuid NOT NULL,
  edition_id               uuid,
  post_id                  uuid,
  reply_id                 uuid,
  kind                     text NOT NULL CHECK (kind IN ('new_reply','best_answer','helper_suggestion')),
  is_read                  boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE yifi.community_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_notifications_read" ON yifi.community_notifications FOR SELECT USING (true);

-- ─── Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_community_posts_edition   ON yifi.community_posts(edition_id, status);
CREATE INDEX IF NOT EXISTS idx_community_posts_author    ON yifi.community_posts(author_registrant_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_challenge ON yifi.community_posts(author_registrant_id, source_challenge);
CREATE INDEX IF NOT EXISTS idx_community_replies_post    ON yifi.community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_community_reply_votes_rep ON yifi.community_reply_votes(reply_id);
CREATE INDEX IF NOT EXISTS idx_community_flags_edition   ON yifi.community_flags(edition_id, status);
CREATE INDEX IF NOT EXISTS idx_community_notif_recipient ON yifi.community_notifications(recipient_registrant_id, is_read);

-- ─────────────────────────────────────────────────────────────────────────
-- MEMBER READ / WRITE RPCs
-- ─────────────────────────────────────────────────────────────────────────

-- List published posts for an edition. author_name is NULL for anonymous posts
-- (no viewer context here → always masked). Filters on type + sector when given.
-- Ordered most-active/newest first (updated_at is bumped when a reply lands).
CREATE OR REPLACE FUNCTION public.yifi_community_list_posts(
  p_edition_id uuid, p_type text DEFAULT NULL, p_sector text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.updated_at DESC, t.created_at DESC), '[]'::json)
    FROM (
      SELECT
        p.id,
        p.edition_id,
        CASE WHEN p.is_anonymous THEN NULL ELSE p.author_registrant_id END AS author_registrant_id,
        p.post_type,
        p.title,
        p.body,
        p.sector,
        p.is_anonymous,
        p.status,
        p.is_seeded,
        p.source_challenge,
        p.best_reply_id,
        p.reply_count,
        p.upvote_count,
        CASE WHEN p.is_anonymous THEN NULL ELSE reg.full_name END AS author_name,
        (p.best_reply_id IS NOT NULL) AS has_best,
        p.created_at,
        p.updated_at
      FROM yifi.community_posts p
      JOIN yifi.registrants reg ON reg.id = p.author_registrant_id
      WHERE p.edition_id = p_edition_id
        AND p.status = 'published'
        AND (p_type IS NULL OR p.post_type = p_type)
        AND (p_sector IS NULL OR p.sector = p_sector)
    ) t
  );
END;$function$;

-- Full post detail for a viewer. Post + reply author names are masked when
-- anonymous UNLESS the viewer is that author. viewer_upvoted reflects the
-- viewer's vote on each reply; is_best marks the accepted answer.
CREATE OR REPLACE FUNCTION public.yifi_community_get_post(
  p_post_id uuid, p_viewer_registrant_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_post        yifi.community_posts%ROWTYPE;
  v_is_author   boolean;
  v_author_name text;
  v_replies     json;
BEGIN
  SELECT * INTO v_post FROM yifi.community_posts WHERE id = p_post_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- IS NOT DISTINCT FROM → false when viewer is NULL (never leak on null viewer)
  v_is_author := (v_post.author_registrant_id IS NOT DISTINCT FROM p_viewer_registrant_id);

  IF v_post.is_anonymous AND NOT v_is_author THEN
    v_author_name := NULL;
  ELSE
    SELECT full_name INTO v_author_name FROM yifi.registrants WHERE id = v_post.author_registrant_id;
  END IF;

  SELECT coalesce(json_agg(
           json_build_object(
             'id', t.id,
             'post_id', t.post_id,
             'body', t.body,
             'author_name', t.author_name,
             'is_anonymous', t.is_anonymous,
             'upvote_count', t.upvote_count,
             'is_best', t.is_best,
             'viewer_upvoted', t.viewer_upvoted,
             'created_at', t.created_at
           ) ORDER BY t.is_best DESC, t.upvote_count DESC, t.created_at ASC
         ), '[]'::json)
  INTO v_replies
  FROM (
    SELECT
      rep.id,
      rep.post_id,
      rep.body,
      CASE WHEN rep.is_anonymous AND rep.author_registrant_id IS DISTINCT FROM p_viewer_registrant_id
           THEN NULL ELSE reg.full_name END AS author_name,
      rep.is_anonymous,
      rep.upvote_count,
      (rep.id = v_post.best_reply_id) AS is_best,
      EXISTS (
        SELECT 1 FROM yifi.community_reply_votes v
        WHERE v.reply_id = rep.id AND v.registrant_id = p_viewer_registrant_id
      ) AS viewer_upvoted,
      rep.created_at
    FROM yifi.community_replies rep
    JOIN yifi.registrants reg ON reg.id = rep.author_registrant_id
    WHERE rep.post_id = p_post_id
  ) t;

  RETURN json_build_object(
    'post', json_build_object(
      'id', v_post.id,
      'edition_id', v_post.edition_id,
      'author_registrant_id', CASE WHEN v_post.is_anonymous AND NOT v_is_author THEN NULL ELSE v_post.author_registrant_id END,
      'post_type', v_post.post_type,
      'title', v_post.title,
      'body', v_post.body,
      'sector', v_post.sector,
      'is_anonymous', v_post.is_anonymous,
      'status', v_post.status,
      'is_seeded', v_post.is_seeded,
      'source_challenge', v_post.source_challenge,
      'best_reply_id', v_post.best_reply_id,
      'reply_count', v_post.reply_count,
      'upvote_count', v_post.upvote_count,
      'author_name', v_author_name,
      'created_at', v_post.created_at
    ),
    'replies', v_replies,
    'is_viewer_author', v_is_author
  );
END;$function$;

-- Create a published post.
CREATE OR REPLACE FUNCTION public.yifi_community_create_post(
  p_edition_id uuid, p_author uuid, p_type text, p_title text, p_body text,
  p_sector text, p_is_anonymous boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO yifi.community_posts
    (edition_id, author_registrant_id, post_type, title, body, sector, is_anonymous, status)
  VALUES
    (p_edition_id, p_author, p_type, p_title, p_body, p_sector, coalesce(p_is_anonymous, false), 'published')
  RETURNING id INTO v_id;
  RETURN v_id;
END;$function$;

-- The calling member's census-seeded drafts (status 'draft') for an edition.
CREATE OR REPLACE FUNCTION public.yifi_community_list_my_drafts(
  p_registrant_id uuid, p_edition_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', p.id,
      'edition_id', p.edition_id,
      'post_type', p.post_type,
      'title', p.title,
      'body', p.body,
      'sector', p.sector,
      'is_anonymous', p.is_anonymous,
      'source_challenge', p.source_challenge,
      'created_at', p.created_at
    ) ORDER BY p.created_at), '[]'::json)
    FROM yifi.community_posts p
    WHERE p.author_registrant_id = p_registrant_id
      AND p.edition_id = p_edition_id
      AND p.status = 'draft'
  );
END;$function$;

-- Approve (publish) a seeded draft, applying the member's edits. Guards
-- ownership + draft status; a no-op if the caller does not own the draft.
CREATE OR REPLACE FUNCTION public.yifi_community_approve_draft(
  p_post_id uuid, p_author uuid, p_title text, p_body text,
  p_sector text, p_is_anonymous boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE yifi.community_posts
  SET title = p_title,
      body = p_body,
      sector = p_sector,
      is_anonymous = coalesce(p_is_anonymous, false),
      status = 'published',
      updated_at = now()
  WHERE id = p_post_id
    AND author_registrant_id = p_author
    AND status = 'draft';
END;$function$;

-- Discard a seeded draft (guards ownership + draft status).
CREATE OR REPLACE FUNCTION public.yifi_community_discard_draft(
  p_post_id uuid, p_author uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE yifi.community_posts
  SET status = 'removed',
      updated_at = now()
  WHERE id = p_post_id
    AND author_registrant_id = p_author
    AND status = 'draft';
END;$function$;

-- Add a reply. Bumps reply_count + post updated_at (for board ordering) and
-- notifies the post author unless they are replying to themselves.
CREATE OR REPLACE FUNCTION public.yifi_community_add_reply(
  p_post_id uuid, p_author uuid, p_body text, p_is_anonymous boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_reply_id  uuid;
  v_post_author uuid;
  v_edition   uuid;
BEGIN
  SELECT author_registrant_id, edition_id INTO v_post_author, v_edition
  FROM yifi.community_posts WHERE id = p_post_id;
  IF v_post_author IS NULL THEN RETURN NULL; END IF;

  INSERT INTO yifi.community_replies (post_id, author_registrant_id, body, is_anonymous)
  VALUES (p_post_id, p_author, p_body, coalesce(p_is_anonymous, false))
  RETURNING id INTO v_reply_id;

  UPDATE yifi.community_posts
  SET reply_count = reply_count + 1,
      updated_at = now()
  WHERE id = p_post_id;

  IF v_post_author IS DISTINCT FROM p_author THEN
    INSERT INTO yifi.community_notifications
      (recipient_registrant_id, edition_id, post_id, reply_id, kind)
    VALUES (v_post_author, v_edition, p_post_id, v_reply_id, 'new_reply');
  END IF;

  RETURN v_reply_id;
END;$function$;

-- Toggle a member's upvote on a reply. Keeps replies.upvote_count in sync.
-- Returns TRUE when the vote is now present, FALSE when removed.
CREATE OR REPLACE FUNCTION public.yifi_community_toggle_upvote(
  p_reply_id uuid, p_registrant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_existing uuid;
BEGIN
  SELECT id INTO v_existing
  FROM yifi.community_reply_votes
  WHERE reply_id = p_reply_id AND registrant_id = p_registrant_id;

  IF v_existing IS NOT NULL THEN
    DELETE FROM yifi.community_reply_votes WHERE id = v_existing;
    UPDATE yifi.community_replies
      SET upvote_count = GREATEST(upvote_count - 1, 0)
      WHERE id = p_reply_id;
    RETURN false;
  ELSE
    INSERT INTO yifi.community_reply_votes (reply_id, registrant_id)
    VALUES (p_reply_id, p_registrant_id)
    ON CONFLICT (reply_id, registrant_id) DO NOTHING;
    UPDATE yifi.community_replies
      SET upvote_count = upvote_count + 1
      WHERE id = p_reply_id;
    RETURN true;
  END IF;
END;$function$;

-- Mark a reply as the accepted "best answer". Guards that the caller is the
-- post's author; notifies the reply's author.
CREATE OR REPLACE FUNCTION public.yifi_community_mark_best(
  p_post_id uuid, p_reply_id uuid, p_asker uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_post_author uuid;
  v_edition     uuid;
  v_reply_author uuid;
  v_valid_reply boolean;
BEGIN
  SELECT author_registrant_id, edition_id INTO v_post_author, v_edition
  FROM yifi.community_posts WHERE id = p_post_id;
  IF v_post_author IS NULL OR v_post_author IS DISTINCT FROM p_asker THEN
    RETURN;  -- only the asker may accept a best answer
  END IF;

  SELECT (author_registrant_id IS NOT NULL) , author_registrant_id
    INTO v_valid_reply, v_reply_author
  FROM yifi.community_replies WHERE id = p_reply_id AND post_id = p_post_id;
  IF NOT coalesce(v_valid_reply, false) THEN RETURN; END IF;

  UPDATE yifi.community_posts
  SET best_reply_id = p_reply_id,
      updated_at = now()
  WHERE id = p_post_id;

  INSERT INTO yifi.community_notifications
    (recipient_registrant_id, edition_id, post_id, reply_id, kind)
  VALUES (v_reply_author, v_edition, p_post_id, p_reply_id, 'best_answer');
END;$function$;

-- Raise a moderation flag on a post or reply.
CREATE OR REPLACE FUNCTION public.yifi_community_flag(
  p_edition_id uuid, p_post_id uuid, p_reply_id uuid,
  p_flagged_by uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO yifi.community_flags
    (edition_id, post_id, reply_id, flagged_by_registrant_id, reason, status)
  VALUES (p_edition_id, p_post_id, p_reply_id, p_flagged_by, p_reason, 'open')
  RETURNING id INTO v_id;
  RETURN v_id;
END;$function$;

-- A member's notifications (newest first), with the related post title.
CREATE OR REPLACE FUNCTION public.yifi_community_my_notifications(
  p_registrant_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', n.id,
      'kind', n.kind,
      'post_id', n.post_id,
      'is_read', n.is_read,
      'created_at', n.created_at,
      'post_title', p.title
    ) ORDER BY n.created_at DESC), '[]'::json)
    FROM yifi.community_notifications n
    LEFT JOIN yifi.community_posts p ON p.id = n.post_id
    WHERE n.recipient_registrant_id = p_registrant_id
  );
END;$function$;

-- Mark a single notification read.
CREATE OR REPLACE FUNCTION public.yifi_community_mark_notification_read(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE yifi.community_notifications SET is_read = true WHERE id = p_id;
END;$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- ADMIN RPCs (caller already gated by getAdminContext + hasPermission)
-- These UNMASK anonymous authors — only ever reached from admin server code.
-- ─────────────────────────────────────────────────────────────────────────

-- Every post for an edition (incl hidden/removed), with REAL author name.
CREATE OR REPLACE FUNCTION public.yifi_community_admin_list_posts(
  p_edition_id uuid, p_status text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', p.id,
      'edition_id', p.edition_id,
      'author_registrant_id', p.author_registrant_id,
      'author_name', reg.full_name,
      'post_type', p.post_type,
      'title', p.title,
      'body', p.body,
      'sector', p.sector,
      'is_anonymous', p.is_anonymous,
      'status', p.status,
      'is_seeded', p.is_seeded,
      'source_challenge', p.source_challenge,
      'best_reply_id', p.best_reply_id,
      'reply_count', p.reply_count,
      'upvote_count', p.upvote_count,
      'created_at', p.created_at
    ) ORDER BY p.created_at DESC), '[]'::json)
    FROM yifi.community_posts p
    JOIN yifi.registrants reg ON reg.id = p.author_registrant_id
    WHERE p.edition_id = p_edition_id
      AND (p_status IS NULL OR p.status = p_status)
  );
END;$function$;

-- Set a post's moderation status.
CREATE OR REPLACE FUNCTION public.yifi_community_admin_set_status(
  p_post_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF p_status NOT IN ('published','hidden','removed') THEN
    RAISE EXCEPTION 'invalid status %', p_status;
  END IF;
  UPDATE yifi.community_posts
  SET status = p_status, updated_at = now()
  WHERE id = p_post_id;
END;$function$;

-- Remove a reply (hard delete). Cleans up its votes, decrements the post's
-- reply_count, and clears best_reply_id if it pointed at this reply.
CREATE OR REPLACE FUNCTION public.yifi_community_admin_remove_reply(p_reply_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_post uuid;
BEGIN
  SELECT post_id INTO v_post FROM yifi.community_replies WHERE id = p_reply_id;
  IF v_post IS NULL THEN RETURN; END IF;

  DELETE FROM yifi.community_reply_votes WHERE reply_id = p_reply_id;
  UPDATE yifi.community_posts
    SET best_reply_id = NULL
    WHERE id = v_post AND best_reply_id = p_reply_id;
  DELETE FROM yifi.community_replies WHERE id = p_reply_id;
  UPDATE yifi.community_posts
    SET reply_count = GREATEST(reply_count - 1, 0), updated_at = now()
    WHERE id = v_post;
END;$function$;

-- Flags for an edition, with the flagged content + REAL flagger + author names.
CREATE OR REPLACE FUNCTION public.yifi_community_admin_list_flags(
  p_edition_id uuid, p_status text DEFAULT 'open')
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT coalesce(json_agg(json_build_object(
      'id', f.id,
      'reason', f.reason,
      'status', f.status,
      'created_at', f.created_at,
      'post_id', f.post_id,
      'reply_id', f.reply_id,
      'flagger_name', fr.full_name,
      'content_type', CASE WHEN f.reply_id IS NOT NULL THEN 'reply' ELSE 'post' END,
      'content_title', p.title,
      'content_text', CASE WHEN f.reply_id IS NOT NULL THEN rep.body ELSE p.body END,
      'author_name', CASE WHEN f.reply_id IS NOT NULL THEN rauth.full_name ELSE pauth.full_name END,
      'author_is_anonymous', CASE WHEN f.reply_id IS NOT NULL THEN rep.is_anonymous ELSE p.is_anonymous END
    ) ORDER BY f.created_at DESC), '[]'::json)
    FROM yifi.community_flags f
    LEFT JOIN yifi.registrants fr ON fr.id = f.flagged_by_registrant_id
    LEFT JOIN yifi.community_posts p ON p.id = f.post_id
    LEFT JOIN yifi.community_replies rep ON rep.id = f.reply_id
    LEFT JOIN yifi.registrants pauth ON pauth.id = p.author_registrant_id
    LEFT JOIN yifi.registrants rauth ON rauth.id = rep.author_registrant_id
    WHERE f.edition_id = p_edition_id
      AND (p_status IS NULL OR f.status = p_status)
  );
END;$function$;

-- Resolve / dismiss a flag.
CREATE OR REPLACE FUNCTION public.yifi_community_admin_resolve_flag(
  p_flag_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF p_status NOT IN ('resolved','dismissed') THEN
    RAISE EXCEPTION 'invalid flag status %', p_status;
  END IF;
  UPDATE yifi.community_flags SET status = p_status WHERE id = p_flag_id;
END;$function$;

-- Unmask the real author of an anonymous post OR reply (exactly one id set).
CREATE OR REPLACE FUNCTION public.yifi_community_admin_real_author(
  p_post_id uuid, p_reply_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE v_author uuid;
BEGIN
  IF p_reply_id IS NOT NULL THEN
    SELECT author_registrant_id INTO v_author FROM yifi.community_replies WHERE id = p_reply_id;
  ELSIF p_post_id IS NOT NULL THEN
    SELECT author_registrant_id INTO v_author FROM yifi.community_posts WHERE id = p_post_id;
  ELSE
    RETURN NULL;
  END IF;

  IF v_author IS NULL THEN RETURN NULL; END IF;

  RETURN (
    SELECT json_build_object(
      'registrant_id', r.id,
      'full_name', r.full_name,
      'email', r.email
    )
    FROM yifi.registrants r WHERE r.id = v_author
  );
END;$function$;

-- Seed one 'challenge' draft per registrant challenge (idempotent). Returns the
-- number of new drafts inserted. Skips (registrant, source_challenge) pairs that
-- already exist and de-dupes repeated challenge strings within a registrant.
CREATE OR REPLACE FUNCTION public.yifi_community_seed_drafts(p_edition_id uuid)
 RETURNS int
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_count int;
BEGIN
  WITH exploded AS (
    SELECT DISTINCT
      r.id                       AS author,
      r.edition_id               AS edition_id,
      r.sector                   AS sector,
      trim(c.challenge)          AS challenge_text
    FROM yifi.registrants r
    CROSS JOIN LATERAL unnest(r.challenges) AS c(challenge)
    WHERE r.edition_id = p_edition_id
      AND coalesce(r.census_complete, false) = true
      AND r.challenges IS NOT NULL
      AND trim(coalesce(c.challenge, '')) <> ''
  )
  INSERT INTO yifi.community_posts
    (edition_id, author_registrant_id, post_type, title, body, sector,
     is_anonymous, status, is_seeded, source_challenge)
  SELECT
    e.edition_id, e.author, 'challenge',
    left(e.challenge_text, 60),
    e.challenge_text,
    e.sector, false, 'draft', true, e.challenge_text
  FROM exploded e
  WHERE NOT EXISTS (
    SELECT 1 FROM yifi.community_posts p
    WHERE p.author_registrant_id = e.author
      AND p.source_challenge = e.challenge_text
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;$function$;

-- Suggest up to 5 potential helpers for a post (same sector OR overlapping
-- challenges with the post author), and notify each (idempotent per recipient+post).
CREATE OR REPLACE FUNCTION public.yifi_community_suggest_helpers(p_post_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_edition   uuid;
  v_author    uuid;
  v_sector    text;
  v_author_challenges text[];
  v_result    json;
BEGIN
  SELECT p.edition_id, p.author_registrant_id, p.sector
    INTO v_edition, v_author, v_sector
  FROM yifi.community_posts p WHERE p.id = p_post_id;
  IF v_author IS NULL THEN RETURN '[]'::json; END IF;

  SELECT challenges INTO v_author_challenges FROM yifi.registrants WHERE id = v_author;

  WITH cand AS (
    SELECT r.id, r.full_name, r.sector, r.organisation
    FROM yifi.registrants r
    WHERE r.edition_id = v_edition
      AND r.id <> v_author
      AND (
        (v_sector IS NOT NULL AND r.sector = v_sector)
        OR (v_author_challenges IS NOT NULL AND r.challenges && v_author_challenges)
      )
    ORDER BY (v_sector IS NOT NULL AND r.sector = v_sector) DESC, r.full_name
    LIMIT 5
  ), ins AS (
    INSERT INTO yifi.community_notifications
      (recipient_registrant_id, edition_id, post_id, kind)
    SELECT c.id, v_edition, p_post_id, 'helper_suggestion'
    FROM cand c
    WHERE NOT EXISTS (
      SELECT 1 FROM yifi.community_notifications n
      WHERE n.recipient_registrant_id = c.id
        AND n.post_id = p_post_id
        AND n.kind = 'helper_suggestion'
    )
    RETURNING 1
  )
  SELECT coalesce(json_agg(json_build_object(
    'id', c.id,
    'full_name', c.full_name,
    'sector', c.sector,
    'organisation', c.organisation
  )), '[]'::json)
  INTO v_result
  FROM cand c;

  RETURN v_result;
END;$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- SECURITY HARDENING
-- Every yifi_community_* RPC is invoked ONLY via the service client. Revoke the
-- default PUBLIC/anon/authenticated EXECUTE grant (Supabase auto-grants EXECUTE
-- on new public functions to anon+authenticated) and grant it only to
-- service_role. Iterating pg_proc covers every signature and skips absent fns.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'yifi_community_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
