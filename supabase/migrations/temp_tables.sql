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
