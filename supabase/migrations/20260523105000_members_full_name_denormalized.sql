-- Denormalize profiles.full_name onto yi_connect.members so PostgREST
-- embeds like `nominee:members(id, full_name, avatar_url, ...)` work
-- without forcing every consumer to traverse a nested profiles embed.
--
-- Context: yi_connect.members.id IS a 1:1 FK to yi_connect.profiles.id.
-- full_name lives ONLY on profiles. App code historically selected it as
-- if it lived on members, which 42703'd at runtime. Two fix options:
--   (a) Rewrite every embed + every consumer to use
--       nominee.profile.full_name — touches 5+ component files
--   (b) Add full_name as a denormalized column on members with a sync
--       trigger from profiles — zero consumer code change, single
--       point of truth still profiles
-- This migration takes (b). The trigger keeps members.full_name in sync
-- whenever profiles.full_name is INSERTed or UPDATEd.

ALTER TABLE yi_connect.members ADD COLUMN IF NOT EXISTS full_name TEXT;

UPDATE yi_connect.members m
   SET full_name = p.full_name
  FROM yi_connect.profiles p
 WHERE m.id = p.id
   AND m.full_name IS DISTINCT FROM p.full_name;

CREATE OR REPLACE FUNCTION yi_connect.sync_member_full_name()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE yi_connect.members
     SET full_name = NEW.full_name
   WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_member_full_name_trg ON yi_connect.profiles;

CREATE TRIGGER sync_member_full_name_trg
  AFTER INSERT OR UPDATE OF full_name ON yi_connect.profiles
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.sync_member_full_name();

NOTIFY pgrst, 'reload schema';
