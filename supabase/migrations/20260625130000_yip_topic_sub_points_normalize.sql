-- ============================================================================
-- Normalise YIP topic sub-points into their own rows (for future analysis)
-- ============================================================================
-- Applied to production (project ref bkmpbcoxbjyafieabxao) via the Supabase
-- Management API on 2026-06-25. Documented here for reproducibility.
--
-- Until now each topic's sub-points lived only as a jsonb array in
-- yip.topics.sub_points. They were query-able via jsonb_array_elements but had
-- no stable per-sub-point identity. This promotes each sub-point to its own row
-- in yip.topic_sub_points (id + topic_id FK + ord + text), backfills the 346
-- existing central/regional sub-points, and keeps the mirror in sync via a
-- trigger on yip.topics. The jsonb array remains the edit surface (admin form
-- textarea); the normalised table is the analytical mirror.
-- ============================================================================

CREATE TABLE IF NOT EXISTS yip.topic_sub_points (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   uuid NOT NULL REFERENCES yip.topics(id) ON DELETE CASCADE,
  ord        int  NOT NULL,                       -- 1-based position within the topic
  text       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (topic_id, ord)
);

CREATE INDEX IF NOT EXISTS idx_topic_sub_points_topic
  ON yip.topic_sub_points(topic_id);

-- No client-facing policy yet (analysis is service-role / Management API only).
ALTER TABLE yip.topic_sub_points ENABLE ROW LEVEL SECURITY;

-- Backfill from the existing jsonb arrays.
INSERT INTO yip.topic_sub_points (topic_id, ord, text)
SELECT t.id, sp.ord, sp.value
FROM yip.topics t,
     LATERAL jsonb_array_elements_text(t.sub_points) WITH ORDINALITY sp(value, ord)
WHERE t.sub_points IS NOT NULL
  AND jsonb_array_length(t.sub_points) > 0
ON CONFLICT (topic_id, ord) DO NOTHING;

-- Keep the mirror in sync whenever a topic's sub_points jsonb changes.
CREATE OR REPLACE FUNCTION yip.tg_sync_topic_sub_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = yip, public
AS $fn$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.sub_points IS NOT DISTINCT FROM OLD.sub_points) THEN
    RETURN NEW;
  END IF;
  INSERT INTO yip.topic_sub_points (topic_id, ord, text)
  SELECT NEW.id, sp.ord, sp.value
  FROM jsonb_array_elements_text(COALESCE(NEW.sub_points, '[]'::jsonb))
       WITH ORDINALITY sp(value, ord)
  ON CONFLICT (topic_id, ord) DO UPDATE
    SET text = EXCLUDED.text, updated_at = now();
  DELETE FROM yip.topic_sub_points s
  WHERE s.topic_id = NEW.id
    AND s.ord > jsonb_array_length(COALESCE(NEW.sub_points, '[]'::jsonb));
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION yip.tg_sync_topic_sub_points() FROM PUBLIC;

DROP TRIGGER IF EXISTS tg_sync_topic_sub_points ON yip.topics;
CREATE TRIGGER tg_sync_topic_sub_points
  AFTER INSERT OR UPDATE OF sub_points ON yip.topics
  FOR EACH ROW EXECUTE FUNCTION yip.tg_sync_topic_sub_points();
