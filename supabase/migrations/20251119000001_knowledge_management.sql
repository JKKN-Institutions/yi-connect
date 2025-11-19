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
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
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
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
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
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
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
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,

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
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,

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
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wiki_pages_updated_at
  BEFORE UPDATE ON wiki_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_best_practices_updated_at
  BEFORE UPDATE ON best_practices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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
FROM chapters c
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
