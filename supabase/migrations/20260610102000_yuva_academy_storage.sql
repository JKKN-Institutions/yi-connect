-- Yi Youth Academy — storage buckets.
-- 3 PRIVATE: yuva-materials (mentor session materials AND national per-session template
--   documents under a program/ prefix), yuva-submissions, yuva-certificates.
-- 1 PUBLIC: yuva-public (mentor photos + academy logos — rendered on public pages without
--   signed-URL minting). Every other download is a short-lived signed URL minted inside a
--   gated action (donor: app/yi-future/actions/resources.ts → getResourceSignedUrl).

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('yuva-materials',    'yuva-materials',    false),
  ('yuva-submissions',  'yuva-submissions',  false),
  ('yuva-certificates', 'yuva-certificates', false),
  ('yuva-public',       'yuva-public',       true)
ON CONFLICT (id) DO NOTHING;
