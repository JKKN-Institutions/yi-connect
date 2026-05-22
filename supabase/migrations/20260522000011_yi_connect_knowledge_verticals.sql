-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Knowledge Management + Vertical Performance (Batch 8)
-- Combines 2 of 3 migrations:
--   - knowledge_management (11 tables)
--   - vertical_performance_tracker (9 tables)
--
-- SKIPPED: knowledge_storage — sets policies on storage.objects which
-- the Management API cannot ALTER (requires supabase_admin role). Will
-- run via Supabase dashboard or storage CLI separately.
-- ═══════════════════════════════════════════════════════════════════════

SET search_path TO yi_connect, public, extensions;

-- Helper function needed by RLS policies in this batch.
-- Lifted from 20251128000001_security_functions (which is in Batch 9).
CREATE OR REPLACE FUNCTION yi_connect.get_user_hierarchy_level(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $func$
DECLARE
  v_user_id UUID;
  v_level INTEGER;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN RETURN 0; END IF;
  SELECT COALESCE(MAX(r.hierarchy_level), 0)
  INTO v_level
  FROM yi_connect.user_roles ur
  JOIN yi_connect.roles r ON ur.role_id = r.id
  WHERE ur.user_id = v_user_id;
  RETURN v_level;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Set search_path AGAIN inside the function body context if needed
SET search_path TO yi_connect, public, extensions;



-- ── 20251119000001_knowledge_management.sql ─────────────────────────────────
-- =============================================
-- Module 8: Knowledge Management System
-- Migration: 20251119000001
-- Description: Complete knowledge management infrastructure
-- =============================================

-- =============================================
-- 1. CATEGORIES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS knowledge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50), -- lucide icon name
  color VARCHAR(20), -- hex color
  parent_category_id UUID REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_category_slug_per_chapter UNIQUE(chapter_id, slug)
);

CREATE INDEX idx_knowledge_categories_chapter ON knowledge_categories(chapter_id);
CREATE INDEX idx_knowledge_categories_slug ON knowledge_categories(slug);
CREATE INDEX idx_knowledge_categories_active ON knowledge_categories(is_active) WHERE is_active = true;

COMMENT ON TABLE knowledge_categories IS 'Hierarchical categories for organizing knowledge documents';

-- =============================================
-- 2. TAGS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS knowledge_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_tag_slug_per_chapter UNIQUE(chapter_id, slug)
);

CREATE INDEX idx_knowledge_tags_chapter ON knowledge_tags(chapter_id);
CREATE INDEX idx_knowledge_tags_usage ON knowledge_tags(usage_count DESC);
CREATE INDEX idx_knowledge_tags_slug ON knowledge_tags(slug);

COMMENT ON TABLE knowledge_tags IS 'Tags for categorizing and searching documents';

-- =============================================
-- 3. DOCUMENTS TABLE (Core)
-- =============================================

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES knowledge_categories(id) ON DELETE SET NULL,

  -- Document Metadata
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL, -- Supabase Storage path
  file_type VARCHAR(50) NOT NULL, -- MIME type
  file_size_kb INTEGER NOT NULL,

  -- Version Control
  version INTEGER DEFAULT 1,
  is_latest_version BOOLEAN DEFAULT true,
  parent_document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL,

  -- Access Control
  visibility VARCHAR(20) DEFAULT 'chapter' CHECK (visibility IN ('public', 'chapter', 'ec_only', 'chair_only')),

  -- Auto-extracted Metadata
  tags TEXT[] DEFAULT '{}',
  vertical_tags TEXT[], -- Masoom, Yuva, etc.
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  year_tag INTEGER,

  -- Search Optimization
  search_vector TSVECTOR,
  ocr_text TEXT, -- Extracted text from PDFs/images

  -- Tracking
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  -- Metadata
  uploaded_by UUID REFERENCES members(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- National Sync
  shared_with_national BOOLEAN DEFAULT false,
  national_sync_status VARCHAR(20) CHECK (national_sync_status IN ('pending', 'approved', 'rejected', 'synced')),
  national_sync_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_knowledge_docs_chapter ON knowledge_documents(chapter_id);
CREATE INDEX idx_knowledge_docs_category ON knowledge_documents(category_id);
CREATE INDEX idx_knowledge_docs_event ON knowledge_documents(event_id);
CREATE INDEX idx_knowledge_docs_uploaded_by ON knowledge_documents(uploaded_by);
CREATE INDEX idx_knowledge_docs_latest ON knowledge_documents(is_latest_version) WHERE is_latest_version = true;
CREATE INDEX idx_knowledge_docs_search ON knowledge_documents USING GIN(search_vector);
CREATE INDEX idx_knowledge_docs_tags ON knowledge_documents USING GIN(tags);
CREATE INDEX idx_knowledge_docs_created ON knowledge_documents(created_at DESC);
CREATE INDEX idx_knowledge_docs_visibility ON knowledge_documents(visibility);
CREATE INDEX idx_knowledge_docs_year ON knowledge_documents(year_tag);

COMMENT ON TABLE knowledge_documents IS 'Core document storage with metadata and search optimization';

-- =============================================
-- 4. DOCUMENT-TAG JUNCTION TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS knowledge_document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES knowledge_tags(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_document_tag UNIQUE(document_id, tag_id)
);

CREATE INDEX idx_document_tags_document ON knowledge_document_tags(document_id);
CREATE INDEX idx_document_tags_tag ON knowledge_document_tags(tag_id);

COMMENT ON TABLE knowledge_document_tags IS 'Many-to-many relationship between documents and tags';

-- =============================================
-- 5. DOCUMENT VERSIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS knowledge_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size_kb INTEGER NOT NULL,
  change_summary TEXT,
  uploaded_by UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_document_version UNIQUE(document_id, version_number)
);

CREATE INDEX idx_document_versions_document ON knowledge_document_versions(document_id);
CREATE INDEX idx_document_versions_created ON knowledge_document_versions(created_at DESC);

COMMENT ON TABLE knowledge_document_versions IS 'Version history for documents';

-- =============================================
-- 6. WIKI PAGES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS wiki_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE NOT NULL,

  -- Page Identity
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('sop', 'best_practice', 'process_note', 'general')),

  -- Content
  content TEXT NOT NULL, -- Markdown or rich text
  summary TEXT,

  -- Version Control
  version INTEGER DEFAULT 1,

  -- Access Control
  visibility VARCHAR(20) DEFAULT 'chapter' CHECK (visibility IN ('public', 'chapter', 'ec_only', 'chair_only')),
  is_locked BOOLEAN DEFAULT false,
  locked_by UUID REFERENCES members(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID REFERENCES members(id) ON DELETE SET NULL NOT NULL,
  last_edited_by UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_wiki_slug_per_chapter UNIQUE(chapter_id, slug)
);

CREATE INDEX idx_wiki_pages_chapter ON wiki_pages(chapter_id);
CREATE INDEX idx_wiki_pages_category ON wiki_pages(category);
CREATE INDEX idx_wiki_pages_slug ON wiki_pages(slug);
CREATE INDEX idx_wiki_pages_created_by ON wiki_pages(created_by);
CREATE INDEX idx_wiki_pages_visibility ON wiki_pages(visibility);

COMMENT ON TABLE wiki_pages IS 'Collaborative wiki pages for knowledge sharing';

-- =============================================
-- 7. WIKI PAGE VERSIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS wiki_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_page_id UUID REFERENCES wiki_pages(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  change_summary TEXT,
  edited_by UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_wiki_version UNIQUE(wiki_page_id, version_number)
);

CREATE INDEX idx_wiki_versions_page ON wiki_page_versions(wiki_page_id);
CREATE INDEX idx_wiki_versions_created ON wiki_page_versions(created_at DESC);

COMMENT ON TABLE wiki_page_versions IS 'Version history for wiki pages';

-- =============================================
-- 8. WIKI CONTRIBUTORS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS wiki_contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_page_id UUID REFERENCES wiki_pages(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  contribution_count INTEGER DEFAULT 1,
  first_contributed_at TIMESTAMPTZ DEFAULT NOW(),
  last_contributed_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_wiki_contributor UNIQUE(wiki_page_id, member_id)
);

CREATE INDEX idx_wiki_contributors_page ON wiki_contributors(wiki_page_id);
CREATE INDEX idx_wiki_contributors_member ON wiki_contributors(member_id);

COMMENT ON TABLE wiki_contributors IS 'Track contributors to wiki pages';

-- =============================================
-- 9. BEST PRACTICES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS best_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES yi.chapters(id) ON DELETE CASCADE NOT NULL,

  -- Content
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  full_content TEXT,

  -- Impact Metrics
  impact_metrics JSONB DEFAULT '{}', -- { beneficiaries: 100, cost_saved: 5000, time_saved_hours: 20 }

  -- Attachments
  document_ids UUID[] DEFAULT '{}',

  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'published', 'rejected')),
  reviewed_by UUID REFERENCES members(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Engagement
  upvote_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,

  -- Metadata
  submitted_by UUID REFERENCES members(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_best_practices_chapter ON best_practices(chapter_id);
CREATE INDEX idx_best_practices_status ON best_practices(status);
CREATE INDEX idx_best_practices_submitted_by ON best_practices(submitted_by);
CREATE INDEX idx_best_practices_upvotes ON best_practices(upvote_count DESC);
CREATE INDEX idx_best_practices_created ON best_practices(created_at DESC);

COMMENT ON TABLE best_practices IS 'Repository of best practices with review workflow';

-- =============================================
-- 10. BEST PRACTICE UPVOTES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS best_practice_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  best_practice_id UUID REFERENCES best_practices(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_upvote UNIQUE(best_practice_id, member_id)
);

CREATE INDEX idx_upvotes_practice ON best_practice_upvotes(best_practice_id);
CREATE INDEX idx_upvotes_member ON best_practice_upvotes(member_id);

COMMENT ON TABLE best_practice_upvotes IS 'Track upvotes for best practices';

-- =============================================
-- 11. ACCESS LOG TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS knowledge_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  wiki_page_id UUID REFERENCES wiki_pages(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('view', 'download', 'edit', 'share')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT check_resource CHECK (
    (document_id IS NOT NULL AND wiki_page_id IS NULL) OR
    (document_id IS NULL AND wiki_page_id IS NOT NULL)
  )
);

CREATE INDEX idx_access_log_document ON knowledge_access_log(document_id);
CREATE INDEX idx_access_log_wiki ON knowledge_access_log(wiki_page_id);
CREATE INDEX idx_access_log_member ON knowledge_access_log(member_id);
CREATE INDEX idx_access_log_created ON knowledge_access_log(created_at DESC);
CREATE INDEX idx_access_log_action ON knowledge_access_log(action);

COMMENT ON TABLE knowledge_access_log IS 'Audit log for document and wiki page access';

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function: Auto-extract tags from filename
CREATE OR REPLACE FUNCTION extract_auto_tags(file_name TEXT)
RETURNS TEXT[] AS $$
DECLARE
  tags TEXT[] := '{}';
  verticals TEXT[] := ARRAY['Masoom', 'Yuva', 'Stree', 'COWE', 'Parivaar'];
  types TEXT[] := ARRAY['Report', 'MoU', 'Photo', 'Certificate', 'Invoice', 'Template', 'SOP'];
  v TEXT;
  t TEXT;
BEGIN
  -- Extract year (e.g., 2025, 2024)
  IF file_name ~ '\d{4}' THEN
    tags := array_append(tags, (regexp_match(file_name, '(\d{4})'))[1]);
  END IF;

  -- Extract vertical names
  FOREACH v IN ARRAY verticals LOOP
    IF file_name ILIKE '%' || v || '%' THEN
      tags := array_append(tags, v);
    END IF;
  END LOOP;

  -- Extract document types
  FOREACH t IN ARRAY types LOOP
    IF file_name ILIKE '%' || t || '%' THEN
      tags := array_append(tags, t);
    END IF;
  END LOOP;

  RETURN tags;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION extract_auto_tags IS 'Extract tags from filename (year, vertical, document type)';

-- Function: Update search vector for documents
CREATE OR REPLACE FUNCTION update_knowledge_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.ocr_text, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_knowledge_document_search_vector IS 'Update full-text search vector on document changes';

-- Function: Full-text search for documents
CREATE OR REPLACE FUNCTION search_knowledge_documents(
  p_chapter_id UUID,
  p_search_query TEXT,
  p_category_id UUID DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_year INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  description TEXT,
  file_name VARCHAR,
  file_type VARCHAR,
  category_name VARCHAR,
  tags TEXT[],
  download_count INTEGER,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kd.id,
    kd.title,
    kd.description,
    kd.file_name,
    kd.file_type,
    kc.name AS category_name,
    kd.tags,
    kd.download_count,
    p.full_name AS uploaded_by_name,
    kd.created_at,
    ts_rank(kd.search_vector, plainto_tsquery('english', p_search_query)) AS rank
  FROM knowledge_documents kd
  LEFT JOIN knowledge_categories kc ON kd.category_id = kc.id
  LEFT JOIN members m ON kd.uploaded_by = m.id
  LEFT JOIN profiles p ON m.id = p.id
  WHERE
    kd.chapter_id = p_chapter_id
    AND kd.is_latest_version = true
    AND (
      p_search_query IS NULL
      OR kd.search_vector @@ plainto_tsquery('english', p_search_query)
    )
    AND (p_category_id IS NULL OR kd.category_id = p_category_id)
    AND (p_tags IS NULL OR kd.tags && p_tags)
    AND (p_year IS NULL OR kd.year_tag = p_year)
  ORDER BY
    CASE
      WHEN p_search_query IS NOT NULL THEN ts_rank(kd.search_vector, plainto_tsquery('english', p_search_query))
      ELSE 0
    END DESC,
    kd.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_knowledge_documents IS 'Full-text search with filters and ranking';

-- Function: Get knowledge analytics
CREATE OR REPLACE FUNCTION get_knowledge_analytics(p_chapter_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_documents', COUNT(*),
    'total_size_mb', ROUND((SUM(file_size_kb) / 1024.0)::NUMERIC, 2),
    'documents_this_month', COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())),
    'top_categories', (
      SELECT jsonb_agg(
        jsonb_build_object('category', category_name, 'count', doc_count)
        ORDER BY doc_count DESC
      )
      FROM (
        SELECT kc.name AS category_name, COUNT(*) AS doc_count
        FROM knowledge_documents kd
        JOIN knowledge_categories kc ON kd.category_id = kc.id
        WHERE kd.chapter_id = p_chapter_id AND kd.is_latest_version = true
        GROUP BY kc.name
        LIMIT 5
      ) t
    ),
    'top_contributors', (
      SELECT jsonb_agg(
        jsonb_build_object('name', contributor_name, 'uploads', upload_count)
        ORDER BY upload_count DESC
      )
      FROM (
        SELECT p.full_name AS contributor_name, COUNT(*) AS upload_count
        FROM knowledge_documents kd
        JOIN members m ON kd.uploaded_by = m.id
        JOIN profiles p ON m.id = p.id
        WHERE kd.chapter_id = p_chapter_id AND kd.is_latest_version = true
        GROUP BY p.full_name
        ORDER BY upload_count DESC
        LIMIT 5
      ) t
    ),
    'top_downloads', (
      SELECT jsonb_agg(
        jsonb_build_object('title', title, 'downloads', download_count)
        ORDER BY download_count DESC
      )
      FROM (
        SELECT title, download_count
        FROM knowledge_documents
        WHERE chapter_id = p_chapter_id AND is_latest_version = true
        ORDER BY download_count DESC
        LIMIT 5
      ) t
    )
  ) INTO result
  FROM knowledge_documents
  WHERE chapter_id = p_chapter_id AND is_latest_version = true;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_knowledge_analytics IS 'Get analytics summary for knowledge management dashboard';

-- Function: Increment tag usage count
CREATE OR REPLACE FUNCTION increment_tag_usage(
  p_chapter_id UUID,
  p_tags TEXT[]
)
RETURNS VOID AS $$
DECLARE
  tag_name TEXT;
BEGIN
  FOREACH tag_name IN ARRAY p_tags LOOP
    INSERT INTO knowledge_tags (chapter_id, name, slug, usage_count)
    VALUES (p_chapter_id, tag_name, LOWER(REPLACE(tag_name, ' ', '-')), 1)
    ON CONFLICT (chapter_id, slug)
    DO UPDATE SET usage_count = knowledge_tags.usage_count + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_tag_usage IS 'Increment usage count for tags (create if not exists)';

-- Function: Get category ID by slug
CREATE OR REPLACE FUNCTION get_category_id_by_slug(
  p_chapter_id UUID,
  p_slug TEXT
)
RETURNS UUID AS $$
  SELECT id FROM knowledge_categories
  WHERE chapter_id = p_chapter_id AND slug = p_slug
  LIMIT 1;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_category_id_by_slug IS 'Get category UUID by slug';

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger: Update search vector on document insert/update
CREATE TRIGGER knowledge_documents_search_update
  BEFORE INSERT OR UPDATE OF title, description, ocr_text, tags
  ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_document_search_vector();

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_knowledge_categories_updated_at
  BEFORE UPDATE ON knowledge_categories
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_wiki_pages_updated_at
  BEFORE UPDATE ON wiki_pages
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_best_practices_updated_at
  BEFORE UPDATE ON best_practices
  FOR EACH ROW
  EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_practice_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_access_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS: CATEGORIES
-- =============================================

CREATE POLICY "Users can view categories in their chapter"
  ON knowledge_categories FOR SELECT
  USING (chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid()));

CREATE POLICY "EC can manage categories"
  ON knowledge_categories FOR ALL
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin')
    )
  );

-- =============================================
-- RLS: TAGS
-- =============================================

CREATE POLICY "Users can view tags in their chapter"
  ON knowledge_tags FOR SELECT
  USING (chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid()));

CREATE POLICY "System can manage tags"
  ON knowledge_tags FOR ALL
  USING (chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid()));

-- =============================================
-- RLS: DOCUMENTS
-- =============================================

CREATE POLICY "Users can view documents based on visibility"
  ON knowledge_documents FOR SELECT
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND (
      visibility = 'public'
      OR visibility = 'chapter'
      OR (visibility = 'ec_only' AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin')
      ))
      OR (visibility = 'chair_only' AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('Chair', 'Co-Chair', 'Executive Member', 'Super Admin')
      ))
    )
  );

CREATE POLICY "Members can upload documents to their chapter"
  ON knowledge_documents FOR INSERT
  WITH CHECK (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Users can update their own documents or EC can edit"
  ON knowledge_documents FOR UPDATE
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin')
      )
    )
  );

CREATE POLICY "Only uploader or Chair can delete documents"
  ON knowledge_documents FOR DELETE
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('Chair', 'Co-Chair', 'Executive Member', 'Super Admin')
      )
    )
  );

-- =============================================
-- RLS: DOCUMENT TAGS
-- =============================================

CREATE POLICY "Users can view document tags"
  ON knowledge_document_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_documents kd
      WHERE kd.id = document_id
      AND kd.chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    )
  );

CREATE POLICY "System can manage document tags"
  ON knowledge_document_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_documents kd
      WHERE kd.id = document_id
      AND kd.chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    )
  );

-- =============================================
-- RLS: DOCUMENT VERSIONS
-- =============================================

CREATE POLICY "Users can view document versions"
  ON knowledge_document_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_documents kd
      WHERE kd.id = document_id
      AND kd.chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    )
  );

CREATE POLICY "System can manage versions"
  ON knowledge_document_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_documents kd
      WHERE kd.id = document_id
      AND kd.chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    )
  );

-- =============================================
-- RLS: WIKI PAGES
-- =============================================

CREATE POLICY "Users can view wiki pages based on visibility"
  ON wiki_pages FOR SELECT
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND (
      visibility = 'public'
      OR visibility = 'chapter'
      OR (visibility = 'ec_only' AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin')
      ))
      OR (visibility = 'chair_only' AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('Chair', 'Co-Chair', 'Executive Member', 'Super Admin')
      ))
    )
  );

CREATE POLICY "Members can create wiki pages"
  ON wiki_pages FOR INSERT
  WITH CHECK (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND created_by = auth.uid()
    AND NOT is_locked
  );

CREATE POLICY "Members can edit unlocked wiki pages"
  ON wiki_pages FOR UPDATE
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND NOT is_locked
  );

CREATE POLICY "Chair can delete wiki pages"
  ON wiki_pages FOR DELETE
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('Chair', 'Co-Chair', 'Executive Member', 'Super Admin')
    )
  );

-- =============================================
-- RLS: WIKI VERSIONS & CONTRIBUTORS
-- =============================================

CREATE POLICY "Users can view wiki versions"
  ON wiki_page_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wiki_pages wp
      WHERE wp.id = wiki_page_id
      AND wp.chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    )
  );

CREATE POLICY "System can manage wiki versions"
  ON wiki_page_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM wiki_pages wp
      WHERE wp.id = wiki_page_id
      AND wp.chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can view wiki contributors"
  ON wiki_contributors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wiki_pages wp
      WHERE wp.id = wiki_page_id
      AND wp.chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    )
  );

CREATE POLICY "System can manage contributors"
  ON wiki_contributors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM wiki_pages wp
      WHERE wp.id = wiki_page_id
      AND wp.chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    )
  );

-- =============================================
-- RLS: BEST PRACTICES
-- =============================================

CREATE POLICY "Users can view published best practices"
  ON best_practices FOR SELECT
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND (
      status = 'published'
      OR submitted_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin')
      )
    )
  );

CREATE POLICY "Members can submit best practices"
  ON best_practices FOR INSERT
  WITH CHECK (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND submitted_by = auth.uid()
  );

CREATE POLICY "Users can update their own drafts"
  ON best_practices FOR UPDATE
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND (
      (submitted_by = auth.uid() AND status = 'draft')
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('EC Member', 'Chair', 'Co-Chair', 'Executive Member', 'Super Admin')
      )
    )
  );

CREATE POLICY "Users can delete their own drafts"
  ON best_practices FOR DELETE
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND submitted_by = auth.uid()
    AND status = 'draft'
  );

-- =============================================
-- RLS: UPVOTES
-- =============================================

CREATE POLICY "Users can view upvotes"
  ON best_practice_upvotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM best_practices bp
      WHERE bp.id = best_practice_id
      AND bp.chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    )
  );

CREATE POLICY "Members can manage their own upvotes"
  ON best_practice_upvotes FOR ALL
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- =============================================
-- RLS: ACCESS LOG
-- =============================================

CREATE POLICY "Users can view their own access logs"
  ON knowledge_access_log FOR SELECT
  USING (member_id = auth.uid());

CREATE POLICY "System can insert access logs"
  ON knowledge_access_log FOR INSERT
  WITH CHECK (member_id = auth.uid());

-- =============================================
-- SEED DEFAULT CATEGORIES
-- =============================================

-- Insert default categories for each chapter
INSERT INTO knowledge_categories (chapter_id, name, slug, description, icon, color, sort_order)
SELECT
  c.id,
  category_data.name,
  category_data.slug,
  category_data.description,
  category_data.icon,
  category_data.color,
  category_data.sort_order
FROM yi.chapters c
CROSS JOIN (
  VALUES
    ('Event Reports', 'event-reports', 'Reports from chapter events and activities', 'FileText', '#3b82f6', 1),
    ('Project Documentation', 'project-documentation', 'Documentation for ongoing and completed projects', 'FolderOpen', '#8b5cf6', 2),
    ('Templates', 'templates', 'Reusable templates for events, reports, and communications', 'FileTemplate', '#06b6d4', 3),
    ('MoUs & Agreements', 'mous-agreements', 'Memorandums of Understanding and partnership agreements', 'FileSignature', '#10b981', 4),
    ('Photos & Media', 'photos-media', 'Event photos, promotional materials, and media files', 'Image', '#f59e0b', 5),
    ('Reports & Analytics', 'reports-analytics', 'Annual reports, quarterly reviews, and analytics', 'BarChart', '#ef4444', 6),
    ('SOPs & Processes', 'sops-processes', 'Standard Operating Procedures and process documentation', 'Settings', '#6366f1', 7),
    ('Best Practices', 'best-practices', 'Documented best practices and learnings', 'Star', '#ec4899', 8),
    ('Training Materials', 'training-materials', 'Training content for members and volunteers', 'GraduationCap', '#14b8a6', 9),
    ('Miscellaneous', 'miscellaneous', 'Other documents and files', 'Folder', '#64748b', 10)
) AS category_data(name, slug, description, icon, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM knowledge_categories kc
  WHERE kc.chapter_id = c.id AND kc.slug = category_data.slug
);

-- =============================================
-- END OF MIGRATION
-- =============================================

-- ── 20251119150443_vertical_performance_tracker.sql ─────────────────────────────────
-- ============================================================================
-- Module 9: Vertical Performance Tracker
-- Created: 2025-01-19
-- Description: Complete schema for vertical performance tracking system
-- ============================================================================

-- ============================================================================
-- PHASE 1: CORE TABLES
-- ============================================================================

-- Table 1: verticals (Master)
CREATE TABLE verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES yi.chapters(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color for UI: "#3B82F6"
  icon VARCHAR(50), -- Icon name: "heart", "users", "briefcase"
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chapter_id, slug)
);

CREATE INDEX idx_verticals_chapter_id ON verticals(chapter_id);
CREATE INDEX idx_verticals_slug ON verticals(slug);

COMMENT ON TABLE verticals IS 'Master table for vertical definitions (Masoom, Yuva, Health, etc.)';

-- Table 2: vertical_chairs (Leadership)
CREATE TABLE vertical_chairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('chair', 'co_chair')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  appointed_by UUID REFERENCES members(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vertical_id, member_id, start_date)
);

CREATE INDEX idx_vertical_chairs_vertical_id ON vertical_chairs(vertical_id);
CREATE INDEX idx_vertical_chairs_member_id ON vertical_chairs(member_id);

COMMENT ON TABLE vertical_chairs IS 'Chair and Co-Chair assignments for verticals';

-- Table 3: vertical_plans (Annual Planning)
CREATE TABLE vertical_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL CHECK (fiscal_year >= 2020 AND fiscal_year <= 2100),
  plan_name VARCHAR(255) NOT NULL,
  vision TEXT,
  mission TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'active', 'completed')),

  -- Quarterly budgets
  q1_budget NUMERIC(10,2) DEFAULT 0,
  q2_budget NUMERIC(10,2) DEFAULT 0,
  q3_budget NUMERIC(10,2) DEFAULT 0,
  q4_budget NUMERIC(10,2) DEFAULT 0,
  total_budget NUMERIC(10,2) GENERATED ALWAYS AS (
    COALESCE(q1_budget, 0) + COALESCE(q2_budget, 0) +
    COALESCE(q3_budget, 0) + COALESCE(q4_budget, 0)
  ) STORED,

  -- Approval workflow
  approved_by UUID REFERENCES members(id),
  approved_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,

  -- Plan continuity
  copied_from_plan_id UUID REFERENCES vertical_plans(id),

  created_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, fiscal_year)
);

CREATE INDEX idx_vertical_plans_vertical_id ON vertical_plans(vertical_id);
CREATE INDEX idx_vertical_plans_fiscal_year ON vertical_plans(fiscal_year);

COMMENT ON TABLE vertical_plans IS 'Annual plans with goals, KPIs, and quarterly budgets';

-- Table 4: vertical_kpis (KPI Definitions)
CREATE TABLE vertical_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES vertical_plans(id) ON DELETE CASCADE,
  kpi_name VARCHAR(255) NOT NULL,
  kpi_description TEXT,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('count', 'percentage', 'amount', 'hours', 'score')),
  unit VARCHAR(50),

  -- Quarterly targets
  target_q1 NUMERIC(10,2) DEFAULT 0,
  target_q2 NUMERIC(10,2) DEFAULT 0,
  target_q3 NUMERIC(10,2) DEFAULT 0,
  target_q4 NUMERIC(10,2) DEFAULT 0,
  target_annual NUMERIC(10,2) GENERATED ALWAYS AS (
    COALESCE(target_q1, 0) + COALESCE(target_q2, 0) +
    COALESCE(target_q3, 0) + COALESCE(target_q4, 0)
  ) STORED,

  weight NUMERIC(5,2) DEFAULT 10 CHECK (weight >= 0 AND weight <= 100),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vertical_kpis_plan_id ON vertical_kpis(plan_id);

COMMENT ON TABLE vertical_kpis IS 'KPI definitions with quarterly targets and weights';

-- Table 5: vertical_kpi_actuals (KPI Progress)
CREATE TABLE vertical_kpi_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES vertical_kpis(id) ON DELETE CASCADE,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  actual_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  recorded_by UUID REFERENCES members(id),
  recorded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  supporting_event_ids UUID[],

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(kpi_id, quarter)
);

CREATE INDEX idx_vertical_kpi_actuals_kpi_id ON vertical_kpi_actuals(kpi_id);

COMMENT ON TABLE vertical_kpi_actuals IS 'Actual KPI values per quarter';

-- Table 6: vertical_members (Team Assignments)
CREATE TABLE vertical_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role_in_vertical VARCHAR(100),
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  left_date DATE,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, member_id)
);

CREATE INDEX idx_vertical_members_vertical_id ON vertical_members(vertical_id);
CREATE INDEX idx_vertical_members_member_id ON vertical_members(member_id);

COMMENT ON TABLE vertical_members IS 'Team member assignments to verticals';

-- Table 7: vertical_activities (Activity Tracking)
CREATE TABLE vertical_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  activity_date DATE NOT NULL,
  activity_title VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) CHECK (activity_type IN ('event', 'meeting', 'outreach', 'campaign', 'training', 'other')),
  description TEXT,

  -- Outcome metrics
  beneficiaries_count INT DEFAULT 0,
  volunteer_count INT DEFAULT 0,
  volunteer_hours NUMERIC(8,2) DEFAULT 0,
  cost_incurred NUMERIC(10,2) DEFAULT 0,
  photos_count INT DEFAULT 0,

  report_url TEXT,
  impact_summary TEXT,

  -- Auto-calculate quarter from date
  quarter INT GENERATED ALWAYS AS (
    CASE
      WHEN EXTRACT(MONTH FROM activity_date) BETWEEN 1 AND 3 THEN 1
      WHEN EXTRACT(MONTH FROM activity_date) BETWEEN 4 AND 6 THEN 2
      WHEN EXTRACT(MONTH FROM activity_date) BETWEEN 7 AND 9 THEN 3
      ELSE 4
    END
  ) STORED,

  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vertical_activities_vertical_id ON vertical_activities(vertical_id);
CREATE INDEX idx_vertical_activities_event_id ON vertical_activities(event_id);
CREATE INDEX idx_vertical_activities_date ON vertical_activities(activity_date);

COMMENT ON TABLE vertical_activities IS 'Activity logs with outcome tracking';

-- Table 8: vertical_performance_reviews (Chair Reviews)
CREATE TABLE vertical_performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  review_type VARCHAR(20) DEFAULT 'quarterly' CHECK (review_type IN ('quarterly', 'annual', 'mid_year')),

  top_achievements TEXT[],
  pending_actions TEXT[],
  improvement_areas TEXT[],
  chair_comments TEXT,

  -- Auto-calculated scores
  kpi_completion_percentage NUMERIC(5,2),
  budget_utilization_percentage NUMERIC(5,2),
  engagement_score NUMERIC(5,2),
  innovation_score NUMERIC(5,2),
  overall_rating NUMERIC(5,2) CHECK (overall_rating >= 0 AND overall_rating <= 10),

  reviewed_by UUID REFERENCES members(id),
  reviewed_at TIMESTAMPTZ DEFAULT now(),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, fiscal_year, quarter)
);

CREATE INDEX idx_vertical_reviews_vertical_id ON vertical_performance_reviews(vertical_id);

COMMENT ON TABLE vertical_performance_reviews IS 'Quarterly performance reviews with auto-generated insights';

-- Table 9: vertical_achievements (Recognition)
CREATE TABLE vertical_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  achievement_title VARCHAR(255) NOT NULL,
  achievement_description TEXT,
  achievement_date DATE NOT NULL,
  achievement_type VARCHAR(50) CHECK (achievement_type IN ('kpi_exceeded', 'innovation', 'impact', 'partnership', 'recognition', 'other')),

  impact_metrics JSONB,
  is_highlighted BOOLEAN DEFAULT false,
  nominated_for_award BOOLEAN DEFAULT false,
  award_nomination_id UUID,

  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vertical_achievements_vertical_id ON vertical_achievements(vertical_id);

COMMENT ON TABLE vertical_achievements IS 'Notable achievements for recognition and awards';

-- ============================================================================
-- PHASE 2: INTEGRATION ALTERATIONS
-- ============================================================================

-- Alter events table to link to verticals
ALTER TABLE events
ADD COLUMN vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL;

CREATE INDEX idx_events_vertical_id ON events(vertical_id);

COMMENT ON COLUMN events.vertical_id IS 'Link event to vertical for performance tracking';

-- Alter expenses table to link to verticals
ALTER TABLE expenses
ADD COLUMN vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL;

CREATE INDEX idx_expenses_vertical_id ON expenses(vertical_id);

COMMENT ON COLUMN expenses.vertical_id IS 'Link expense to vertical for cost tracking';

-- ============================================================================
-- PHASE 3: ANALYTICS VIEWS
-- ============================================================================

-- View 1: vertical_kpi_progress
CREATE VIEW vertical_kpi_progress AS
SELECT
  vk.id AS kpi_id,
  vk.plan_id,
  vp.vertical_id,
  v.name AS vertical_name,
  vp.fiscal_year,
  vk.kpi_name,
  vk.metric_type,
  vk.unit,
  vk.target_q1,
  vk.target_q2,
  vk.target_q3,
  vk.target_q4,
  vk.target_annual,
  COALESCE(vka_q1.actual_value, 0) AS actual_q1,
  COALESCE(vka_q2.actual_value, 0) AS actual_q2,
  COALESCE(vka_q3.actual_value, 0) AS actual_q3,
  COALESCE(vka_q4.actual_value, 0) AS actual_q4,
  (COALESCE(vka_q1.actual_value, 0) + COALESCE(vka_q2.actual_value, 0) +
   COALESCE(vka_q3.actual_value, 0) + COALESCE(vka_q4.actual_value, 0)) AS actual_annual,
  CASE
    WHEN vk.target_annual > 0
    THEN ROUND(((COALESCE(vka_q1.actual_value, 0) + COALESCE(vka_q2.actual_value, 0) +
                 COALESCE(vka_q3.actual_value, 0) + COALESCE(vka_q4.actual_value, 0)) / vk.target_annual * 100), 2)
    ELSE 0
  END AS completion_percentage
FROM vertical_kpis vk
JOIN vertical_plans vp ON vk.plan_id = vp.id
JOIN verticals v ON vp.vertical_id = v.id
LEFT JOIN vertical_kpi_actuals vka_q1 ON vk.id = vka_q1.kpi_id AND vka_q1.quarter = 1
LEFT JOIN vertical_kpi_actuals vka_q2 ON vk.id = vka_q2.kpi_id AND vka_q2.quarter = 2
LEFT JOIN vertical_kpi_actuals vka_q3 ON vk.id = vka_q3.kpi_id AND vka_q3.quarter = 3
LEFT JOIN vertical_kpi_actuals vka_q4 ON vk.id = vka_q4.kpi_id AND vka_q4.quarter = 4
WHERE vk.is_active = true;

COMMENT ON VIEW vertical_kpi_progress IS 'Real-time KPI progress tracking with completion percentages';

-- View 2: vertical_impact_metrics
CREATE VIEW vertical_impact_metrics AS
SELECT
  v.id AS vertical_id,
  v.name AS vertical_name,
  v.chapter_id,
  EXTRACT(YEAR FROM va.activity_date)::INT AS year,
  COUNT(DISTINCT va.id) AS total_activities,
  COUNT(DISTINCT va.event_id) AS total_events,
  SUM(va.beneficiaries_count) AS total_beneficiaries,
  SUM(va.volunteer_hours) AS total_volunteer_hours,
  SUM(va.cost_incurred) AS total_cost,
  CASE
    WHEN SUM(va.beneficiaries_count) > 0
    THEN ROUND(SUM(va.cost_incurred) / SUM(va.beneficiaries_count), 2)
    ELSE 0
  END AS cost_per_beneficiary,
  COUNT(DISTINCT vm.member_id) AS team_size,
  CASE
    WHEN COUNT(DISTINCT vm.member_id) > 0
    THEN ROUND(SUM(va.volunteer_hours) / COUNT(DISTINCT vm.member_id), 2)
    ELSE 0
  END AS avg_hours_per_member
FROM verticals v
LEFT JOIN vertical_activities va ON v.id = va.vertical_id
LEFT JOIN vertical_members vm ON v.id = vm.vertical_id AND vm.is_active = true
WHERE v.is_active = true
GROUP BY v.id, v.name, v.chapter_id, EXTRACT(YEAR FROM va.activity_date);

COMMENT ON VIEW vertical_impact_metrics IS 'Impact analytics per vertical with cost efficiency metrics';

-- ============================================================================
-- PHASE 4: DATABASE FUNCTIONS
-- ============================================================================

-- Function 1: calculate_vertical_ranking
CREATE OR REPLACE FUNCTION calculate_vertical_ranking(
  p_chapter_id UUID,
  p_fiscal_year INT,
  p_quarter INT DEFAULT NULL
)
RETURNS TABLE (
  vertical_id UUID,
  vertical_name VARCHAR,
  kpi_score NUMERIC,
  engagement_score NUMERIC,
  innovation_score NUMERIC,
  total_score NUMERIC,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH vertical_scores AS (
    SELECT
      v.id AS vertical_id,
      v.name AS vertical_name,
      -- KPI Score: Average KPI completion percentage (weighted 50%)
      COALESCE(AVG(
        CASE
          WHEN vkp.target_annual > 0
          THEN (vkp.actual_annual / vkp.target_annual) * 100
          ELSE 0
        END
      ), 0) AS kpi_score,
      -- Engagement Score: Volunteer hours per member (weighted 30%)
      COALESCE(
        (SUM(va.volunteer_hours) / NULLIF(COUNT(DISTINCT vm.member_id), 0)) * 10, 0
      ) AS engagement_score,
      -- Innovation Score: From performance reviews (weighted 20%)
      COALESCE(AVG(vpr.innovation_score), 0) * 10 AS innovation_score
    FROM verticals v
    LEFT JOIN vertical_plans vp ON v.id = vp.vertical_id AND vp.fiscal_year = p_fiscal_year
    LEFT JOIN vertical_kpi_progress vkp ON vp.id = vkp.plan_id
    LEFT JOIN vertical_activities va ON v.id = va.vertical_id
      AND EXTRACT(YEAR FROM va.activity_date) = p_fiscal_year
      AND (p_quarter IS NULL OR va.quarter = p_quarter)
    LEFT JOIN vertical_members vm ON v.id = vm.vertical_id AND vm.is_active = true
    LEFT JOIN vertical_performance_reviews vpr ON v.id = vpr.vertical_id
      AND vpr.fiscal_year = p_fiscal_year
      AND (p_quarter IS NULL OR vpr.quarter = p_quarter)
    WHERE v.chapter_id = p_chapter_id AND v.is_active = true
    GROUP BY v.id, v.name
  )
  SELECT
    vs.vertical_id,
    vs.vertical_name,
    ROUND(vs.kpi_score, 2),
    ROUND(vs.engagement_score, 2),
    ROUND(vs.innovation_score, 2),
    ROUND((vs.kpi_score * 0.5 + vs.engagement_score * 0.3 + vs.innovation_score * 0.2), 2) AS total_score,
    RANK() OVER (ORDER BY (vs.kpi_score * 0.5 + vs.engagement_score * 0.3 + vs.innovation_score * 0.2) DESC) AS rank
  FROM vertical_scores vs
  ORDER BY total_score DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_vertical_ranking IS 'Calculate vertical rankings based on KPI completion, engagement, and innovation';

-- Function 2: check_kpi_alerts
CREATE OR REPLACE FUNCTION check_kpi_alerts(p_chapter_id UUID DEFAULT NULL)
RETURNS TABLE (
  vertical_id UUID,
  vertical_name VARCHAR,
  kpi_name VARCHAR,
  target NUMERIC,
  actual NUMERIC,
  completion_percentage NUMERIC,
  alert_type VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.name,
    vkp.kpi_name,
    vkp.target_annual,
    vkp.actual_annual,
    vkp.completion_percentage,
    CASE
      WHEN vkp.completion_percentage < 70 THEN 'target_missed'
      WHEN vkp.completion_percentage > 120 THEN 'overachievement'
      ELSE 'on_track'
    END::VARCHAR AS alert_type
  FROM vertical_kpi_progress vkp
  JOIN verticals v ON vkp.vertical_id = v.id
  WHERE v.is_active = true
    AND vkp.fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE)
    AND (p_chapter_id IS NULL OR v.chapter_id = p_chapter_id)
    AND (vkp.completion_percentage < 70 OR vkp.completion_percentage > 120);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_kpi_alerts IS 'Check for KPIs that missed targets (<70%) or exceeded targets (>120%)';

-- ============================================================================
-- PHASE 5: AUTOMATION TRIGGERS
-- ============================================================================

-- Trigger 1: Auto-create vertical_activity from completed event
CREATE OR REPLACE FUNCTION auto_create_vertical_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_volunteer_hours NUMERIC;
  v_created_by UUID;
BEGIN
  IF NEW.vertical_id IS NOT NULL AND NEW.status = 'completed' THEN
    -- Calculate total volunteer hours for this event
    SELECT COALESCE(SUM(hours_contributed), 0) INTO v_volunteer_hours
    FROM event_volunteers
    WHERE event_id = NEW.id AND status = 'completed';

    -- Get the organizer of the event
    v_created_by := NEW.organizer_id;

    -- Insert activity record (ON CONFLICT DO NOTHING prevents duplicates)
    INSERT INTO vertical_activities (
      vertical_id,
      event_id,
      activity_date,
      activity_title,
      activity_type,
      description,
      beneficiaries_count,
      volunteer_hours,
      cost_incurred,
      created_by
    )
    VALUES (
      NEW.vertical_id,
      NEW.id,
      NEW.start_date::date,
      NEW.title,
      'event',
      NEW.description,
      NEW.current_registrations,
      v_volunteer_hours,
      COALESCE(NEW.actual_expense, 0),
      v_created_by
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_completed_create_activity
AFTER UPDATE ON events
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION auto_create_vertical_activity();

COMMENT ON FUNCTION auto_create_vertical_activity IS 'Automatically create vertical_activity when event is completed';

-- Trigger 2: Update timestamp triggers
CREATE TRIGGER update_verticals_updated_at
BEFORE UPDATE ON verticals
FOR EACH ROW
EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_vertical_plans_updated_at
BEFORE UPDATE ON vertical_plans
FOR EACH ROW
EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_vertical_kpis_updated_at
BEFORE UPDATE ON vertical_kpis
FOR EACH ROW
EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_vertical_kpi_actuals_updated_at
BEFORE UPDATE ON vertical_kpi_actuals
FOR EACH ROW
EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_vertical_members_updated_at
BEFORE UPDATE ON vertical_members
FOR EACH ROW
EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_vertical_activities_updated_at
BEFORE UPDATE ON vertical_activities
FOR EACH ROW
EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_vertical_reviews_updated_at
BEFORE UPDATE ON vertical_performance_reviews
FOR EACH ROW
EXECUTE FUNCTION yi_connect.update_updated_at_column();

CREATE TRIGGER update_vertical_chairs_updated_at
BEFORE UPDATE ON vertical_chairs
FOR EACH ROW
EXECUTE FUNCTION yi_connect.update_updated_at_column();

-- ============================================================================
-- PHASE 6: RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_chairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_kpi_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_achievements ENABLE ROW LEVEL SECURITY;

-- verticals: Read by chapter members, write by EC/Chair
CREATE POLICY verticals_select_policy ON verticals
  FOR SELECT USING (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
  );

CREATE POLICY verticals_insert_policy ON verticals
  FOR INSERT WITH CHECK (
    user_belongs_to_chapter(chapter_id)
    AND get_user_hierarchy_level() >= 3
  );

CREATE POLICY verticals_update_policy ON verticals
  FOR UPDATE USING (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    AND get_user_hierarchy_level() >= 3
  );

CREATE POLICY verticals_delete_policy ON verticals
  FOR DELETE USING (
    get_user_hierarchy_level() >= 4
  );

-- vertical_plans: Read by chapter members, write by vertical chairs/EC
CREATE POLICY vertical_plans_select_policy ON vertical_plans
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_plans_insert_policy ON vertical_plans
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_chairs
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

CREATE POLICY vertical_plans_update_policy ON vertical_plans
  FOR UPDATE USING (
    (vertical_id IN (
      SELECT vertical_id FROM vertical_chairs
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    ) AND locked_at IS NULL)
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_activities: Read by all chapter members, write by vertical members/chairs
CREATE POLICY vertical_activities_select_policy ON vertical_activities
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_activities_insert_policy ON vertical_activities
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_members
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

CREATE POLICY vertical_activities_update_policy ON vertical_activities
  FOR UPDATE USING (
    vertical_id IN (
      SELECT vertical_id FROM vertical_members
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_kpis: Read by all, write by chairs/EC
CREATE POLICY vertical_kpis_select_policy ON vertical_kpis
  FOR SELECT USING (
    plan_id IN (
      SELECT id FROM vertical_plans
      WHERE vertical_id IN (
        SELECT id FROM verticals
        WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
      )
    )
  );

CREATE POLICY vertical_kpis_insert_policy ON vertical_kpis
  FOR INSERT WITH CHECK (
    plan_id IN (
      SELECT vp.id FROM vertical_plans vp
      JOIN vertical_chairs vc ON vp.vertical_id = vc.vertical_id
      WHERE vc.member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND vc.is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_kpi_actuals: Read by all, write by vertical members/chairs
CREATE POLICY vertical_kpi_actuals_select_policy ON vertical_kpi_actuals
  FOR SELECT USING (
    kpi_id IN (
      SELECT vk.id FROM vertical_kpis vk
      JOIN vertical_plans vp ON vk.plan_id = vp.id
      JOIN verticals v ON vp.vertical_id = v.id
      WHERE v.chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_kpi_actuals_insert_policy ON vertical_kpi_actuals
  FOR INSERT WITH CHECK (
    kpi_id IN (
      SELECT vk.id FROM vertical_kpis vk
      JOIN vertical_plans vp ON vk.plan_id = vp.id
      JOIN vertical_members vm ON vp.vertical_id = vm.vertical_id
      WHERE vm.member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND vm.is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_members: Read by all, write by chairs/EC
CREATE POLICY vertical_members_select_policy ON vertical_members
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_members_insert_policy ON vertical_members
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_chairs
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_chairs: Read by all, write by EC only
CREATE POLICY vertical_chairs_select_policy ON vertical_chairs
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_chairs_insert_policy ON vertical_chairs
  FOR INSERT WITH CHECK (
    get_user_hierarchy_level() >= 3
  );

-- vertical_performance_reviews: Read by all, write by chairs/EC
CREATE POLICY vertical_reviews_select_policy ON vertical_performance_reviews
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_reviews_insert_policy ON vertical_performance_reviews
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_chairs
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_achievements: Read by all, write by vertical members/chairs
CREATE POLICY vertical_achievements_select_policy ON vertical_achievements
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_achievements_insert_policy ON vertical_achievements
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_members
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
