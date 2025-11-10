/**
 * Allow Public Read Access to Chapters
 *
 * The /apply page is public (no authentication required), but users need to
 * see the list of chapters to select their preferred chapter during application.
 *
 * This migration adds a policy to allow anonymous users to read the chapters table.
 */

-- Add policy for anonymous/public users to view chapters
CREATE POLICY "Chapters are viewable by everyone (including anonymous)"
  ON public.chapters FOR SELECT
  TO anon
  USING (true);

-- Note: The existing policy "Chapters are viewable by authenticated users" remains
-- So both authenticated and anonymous users can now read chapters
