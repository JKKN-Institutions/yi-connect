-- Add per-region finale date columns to yi.chapters (canonical table; future.chapters is a view)
ALTER TABLE yi.chapters ADD COLUMN IF NOT EXISTS finale_start_date DATE;
ALTER TABLE yi.chapters ADD COLUMN IF NOT EXISTS finale_end_date DATE;

-- Set dates for the 5 host chapters (Jaipur is TBA, left null)
UPDATE yi.chapters SET finale_start_date = '2026-09-11', finale_end_date = '2026-09-12' WHERE name = 'Hosur' AND is_finale_host = true;
UPDATE yi.chapters SET finale_start_date = '2026-09-17', finale_end_date = '2026-09-18' WHERE name = 'Raipur' AND is_finale_host = true;
UPDATE yi.chapters SET finale_start_date = '2026-09-20', finale_end_date = '2026-09-21' WHERE name = 'Kochi' AND is_finale_host = true;
UPDATE yi.chapters SET finale_start_date = '2026-09-11', finale_end_date = '2026-09-12' WHERE name = 'Bhavnagar' AND is_finale_host = true;

-- Recreate future.chapters view to expose the new columns
CREATE OR REPLACE VIEW future.chapters AS
SELECT id, yi_chapter_id, name, city, state, region, logo_url, is_active, created_at,
       programme_duration_days, finale_region, is_finale_host,
       chair_name, chair_email, chair_mobile,
       finale_start_date, finale_end_date
FROM yi.chapters;
