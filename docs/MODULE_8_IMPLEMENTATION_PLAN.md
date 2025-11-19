# Module 8: Knowledge Management System - Implementation Plan

**Status:** Ready for Implementation
**Priority:** MEDIUM (Phase 2 - Q2)
**Estimated Complexity:** HIGH
**Dependencies:** Module 3 (Events) for archive integration

---

## Executive Summary

Module 8 transforms scattered documents, event reports, and best practices into a structured, searchable digital library. This module will leverage Supabase Storage for file management, PostgreSQL full-text search for document discovery, and collaborative wiki features for knowledge sharing.

**Core Value Proposition:**
- Prevent institutional knowledge loss during leadership transitions
- Enable faster onboarding of new members
- Improve knowledge reuse across events and initiatives
- Create searchable archive of all chapter activities

---

## Architecture Overview

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| File Storage | Supabase Storage | Document uploads (PDFs, DOCX, images) |
| Full-Text Search | PostgreSQL tsvector + pg_trgm | Fast document search with OCR support |
| Version Control | Documents versions table | Track document changes over time |
| Access Control | Supabase RLS | Chapter-level and role-based permissions |
| Real-time Collaboration | Supabase Realtime | Live wiki editing notifications |
| File Processing | Edge Functions (future) | OCR, thumbnail generation, metadata extraction |

### Data Flow

```
Document Upload Flow:
User → Upload Form → Server Action → Supabase Storage → Database Record → Auto-tagging → Search Indexing

Document Search Flow:
User → Search Query → Cached Search Function → PostgreSQL Full-Text Search → Results

Wiki Editing Flow:
User → Wiki Editor → Server Action → Version Save → Realtime Broadcast → Other Users
```

---

## Database Schema Design

### Core Tables

#### 1. knowledge_categories
```sql
CREATE TABLE knowledge_categories (
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

-- Categories: Events, Projects, Templates, MoUs, Photos, Reports, SOPs, Best Practices
```

#### 2. knowledge_tags
```sql
CREATE TABLE knowledge_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_tag_slug_per_chapter UNIQUE(chapter_id, slug)
);

CREATE INDEX idx_knowledge_tags_usage ON knowledge_tags(usage_count DESC);
```

#### 3. knowledge_documents
```sql
CREATE TABLE knowledge_documents (
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
CREATE INDEX idx_knowledge_docs_latest ON knowledge_documents(is_latest_version) WHERE is_latest_version = true;
CREATE INDEX idx_knowledge_docs_search ON knowledge_documents USING GIN(search_vector);
CREATE INDEX idx_knowledge_docs_tags ON knowledge_documents USING GIN(tags);
CREATE INDEX idx_knowledge_docs_created ON knowledge_documents(created_at DESC);

-- Full-text search trigger
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

CREATE TRIGGER knowledge_documents_search_update
  BEFORE INSERT OR UPDATE OF title, description, ocr_text, tags
  ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_document_search_vector();
```

#### 4. knowledge_document_tags
```sql
CREATE TABLE knowledge_document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES knowledge_tags(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_document_tag UNIQUE(document_id, tag_id)
);

CREATE INDEX idx_document_tags_document ON knowledge_document_tags(document_id);
CREATE INDEX idx_document_tags_tag ON knowledge_document_tags(tag_id);
```

#### 5. knowledge_document_versions
```sql
CREATE TABLE knowledge_document_versions (
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
```

#### 6. wiki_pages
```sql
CREATE TABLE wiki_pages (
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
```

#### 7. wiki_page_versions
```sql
CREATE TABLE wiki_page_versions (
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
```

#### 8. wiki_contributors
```sql
CREATE TABLE wiki_contributors (
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
```

#### 9. best_practices
```sql
CREATE TABLE best_practices (
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
CREATE INDEX idx_best_practices_upvotes ON best_practices(upvote_count DESC);
```

#### 10. best_practice_upvotes
```sql
CREATE TABLE best_practice_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  best_practice_id UUID REFERENCES best_practices(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_upvote UNIQUE(best_practice_id, member_id)
);

CREATE INDEX idx_upvotes_practice ON best_practice_upvotes(best_practice_id);
CREATE INDEX idx_upvotes_member ON best_practice_upvotes(member_id);
```

#### 11. knowledge_access_log
```sql
CREATE TABLE knowledge_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  wiki_page_id UUID REFERENCES wiki_pages(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('view', 'download', 'edit', 'share')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_access_log_document ON knowledge_access_log(document_id);
CREATE INDEX idx_access_log_wiki ON knowledge_access_log(wiki_page_id);
CREATE INDEX idx_access_log_member ON knowledge_access_log(member_id);
CREATE INDEX idx_access_log_created ON knowledge_access_log(created_at DESC);
```

---

## Row Level Security (RLS) Policies

### knowledge_documents

```sql
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- View: Users can see documents based on visibility and their role
CREATE POLICY "Users can view documents in their chapter"
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
        AND r.role_name IN ('ec_member', 'chair', 'admin')
      ))
      OR (visibility = 'chair_only' AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.role_name IN ('chair', 'admin')
      ))
    )
  );

-- Insert: Members can upload documents to their chapter
CREATE POLICY "Members can upload documents to their chapter"
  ON knowledge_documents FOR INSERT
  WITH CHECK (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND uploaded_by = auth.uid()
  );

-- Update: Users can update documents they uploaded or EC can edit
CREATE POLICY "Users can update their own documents or EC can edit"
  ON knowledge_documents FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.role_name IN ('ec_member', 'chair', 'admin')
    )
  );

-- Delete: Only uploader or Chair/Admin can delete
CREATE POLICY "Only uploader or Chair can delete documents"
  ON knowledge_documents FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.role_name IN ('chair', 'admin')
    )
  );
```

### wiki_pages

```sql
ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;

-- View: Similar to documents
CREATE POLICY "Users can view wiki pages in their chapter"
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
        AND r.role_name IN ('ec_member', 'chair', 'admin')
      ))
    )
  );

-- Insert: Members can create wiki pages
CREATE POLICY "Members can create wiki pages in their chapter"
  ON wiki_pages FOR INSERT
  WITH CHECK (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND created_by = auth.uid()
    AND NOT is_locked
  );

-- Update: Members can edit unlocked pages
CREATE POLICY "Members can edit unlocked wiki pages"
  ON wiki_pages FOR UPDATE
  USING (
    chapter_id = (SELECT chapter_id FROM members WHERE id = auth.uid())
    AND NOT is_locked
  );
```

---

## Database Functions

### 1. Auto-tag Extraction Function
```sql
CREATE OR REPLACE FUNCTION extract_auto_tags(file_name TEXT)
RETURNS TEXT[] AS $$
DECLARE
  tags TEXT[] := '{}';
  verticals TEXT[] := ARRAY['Masoom', 'Yuva', 'Stree', 'COWE', 'Parivaar'];
  types TEXT[] := ARRAY['Report', 'MoU', 'Photo', 'Certificate', 'Invoice'];
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
```

### 2. Full-Text Search Function
```sql
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
```

### 3. Knowledge Analytics Function
```sql
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
        WHERE kd.chapter_id = p_chapter_id
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
        WHERE kd.chapter_id = p_chapter_id
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
        WHERE chapter_id = p_chapter_id
        ORDER BY download_count DESC
        LIMIT 5
      ) t
    )
  ) INTO result
  FROM knowledge_documents
  WHERE chapter_id = p_chapter_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## TypeScript Types

```typescript
// types/knowledge.ts

// Enums
export const DOCUMENT_VISIBILITY = ['public', 'chapter', 'ec_only', 'chair_only'] as const;
export type DocumentVisibility = typeof DOCUMENT_VISIBILITY[number];

export const WIKI_CATEGORY = ['sop', 'best_practice', 'process_note', 'general'] as const;
export type WikiCategory = typeof WIKI_CATEGORY[number];

export const BEST_PRACTICE_STATUS = ['draft', 'submitted', 'under_review', 'published', 'rejected'] as const;
export type BestPracticeStatus = typeof BEST_PRACTICE_STATUS[number];

// Database Types
export interface KnowledgeCategory {
  id: string;
  chapter_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  parent_category_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocument {
  id: string;
  chapter_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size_kb: number;
  version: number;
  is_latest_version: boolean;
  parent_document_id: string | null;
  visibility: DocumentVisibility;
  tags: string[];
  vertical_tags: string[] | null;
  event_id: string | null;
  year_tag: number | null;
  ocr_text: string | null;
  download_count: number;
  view_count: number;
  last_accessed_at: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  shared_with_national: boolean;
  national_sync_status: string | null;
  national_sync_at: string | null;
}

export interface KnowledgeDocumentWithDetails extends KnowledgeDocument {
  category_name: string | null;
  uploaded_by_name: string;
  uploaded_by_avatar: string | null;
}

export interface WikiPage {
  id: string;
  chapter_id: string;
  title: string;
  slug: string;
  category: WikiCategory;
  content: string;
  summary: string | null;
  version: number;
  visibility: DocumentVisibility;
  is_locked: boolean;
  locked_by: string | null;
  locked_at: string | null;
  created_by: string;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BestPractice {
  id: string;
  chapter_id: string;
  title: string;
  description: string;
  full_content: string | null;
  impact_metrics: {
    beneficiaries?: number;
    cost_saved?: number;
    time_saved_hours?: number;
    [key: string]: number | undefined;
  };
  document_ids: string[];
  status: BestPracticeStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  upvote_count: number;
  view_count: number;
  submitted_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

// List Item Types (for tables)
export interface DocumentListItem {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size_kb: number;
  category_name: string | null;
  tags: string[];
  download_count: number;
  uploaded_by_name: string;
  created_at: string;
}

// Filter Types
export interface DocumentFilters {
  search?: string;
  category_id?: string;
  tags?: string[];
  year?: number;
  visibility?: DocumentVisibility;
  uploaded_by?: string;
  date_from?: string;
  date_to?: string;
}

export interface WikiPageFilters {
  search?: string;
  category?: WikiCategory;
  visibility?: DocumentVisibility;
}

// Paginated Responses
export interface PaginatedDocuments {
  data: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Analytics Types
export interface KnowledgeAnalytics {
  total_documents: number;
  total_size_mb: number;
  documents_this_month: number;
  top_categories: Array<{ category: string; count: number }>;
  top_contributors: Array<{ name: string; uploads: number }>;
  top_downloads: Array<{ title: string; downloads: number }>;
}

// Upload Types
export interface DocumentUploadMetadata {
  title: string;
  description?: string;
  category_id?: string;
  tags?: string[];
  visibility: DocumentVisibility;
  event_id?: string;
}
```

---

## Zod Validation Schemas

```typescript
// lib/validations/knowledge.ts
import { z } from 'zod';

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const uploadDocumentSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must not exceed 255 characters'),
  description: z.string()
    .max(2000, 'Description must not exceed 2000 characters')
    .optional(),
  category_id: z.string().uuid('Invalid category').optional(),
  tags: z.array(z.string().max(50)).max(10, 'Maximum 10 tags allowed').optional(),
  visibility: z.enum(['public', 'chapter', 'ec_only', 'chair_only']),
  event_id: z.string().uuid('Invalid event').optional(),
  file: z.custom<File>()
    .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, `File size must be less than ${MAX_FILE_SIZE_MB}MB`)
    .refine((file) => ALLOWED_MIME_TYPES.includes(file.type), 'Invalid file type. Allowed: PDF, DOCX, XLSX, PPTX, JPG, PNG, WEBP'),
});

export const updateDocumentSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must not exceed 255 characters')
    .optional(),
  description: z.string()
    .max(2000, 'Description must not exceed 2000 characters')
    .optional(),
  category_id: z.string().uuid('Invalid category').optional(),
  tags: z.array(z.string().max(50)).max(10, 'Maximum 10 tags allowed').optional(),
  visibility: z.enum(['public', 'chapter', 'ec_only', 'chair_only']).optional(),
});

export const createWikiPageSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must not exceed 255 characters'),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(255, 'Slug must not exceed 255 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  category: z.enum(['sop', 'best_practice', 'process_note', 'general']),
  content: z.string()
    .min(10, 'Content must be at least 10 characters')
    .max(100000, 'Content must not exceed 100,000 characters'),
  summary: z.string()
    .max(500, 'Summary must not exceed 500 characters')
    .optional(),
  visibility: z.enum(['public', 'chapter', 'ec_only', 'chair_only']),
});

export const updateWikiPageSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must not exceed 255 characters')
    .optional(),
  content: z.string()
    .min(10, 'Content must be at least 10 characters')
    .max(100000, 'Content must not exceed 100,000 characters')
    .optional(),
  summary: z.string()
    .max(500, 'Summary must not exceed 500 characters')
    .optional(),
  change_summary: z.string()
    .max(200, 'Change summary must not exceed 200 characters')
    .optional(),
});

export const createBestPracticeSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(255, 'Title must not exceed 255 characters'),
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description must not exceed 5000 characters'),
  full_content: z.string()
    .max(50000, 'Content must not exceed 50,000 characters')
    .optional(),
  impact_metrics: z.object({
    beneficiaries: z.number().int().min(0).optional(),
    cost_saved: z.number().min(0).optional(),
    time_saved_hours: z.number().min(0).optional(),
  }).optional(),
  document_ids: z.array(z.string().uuid()).max(10, 'Maximum 10 documents allowed').optional(),
});

export const reviewBestPracticeSchema = z.object({
  action: z.enum(['approve', 'reject']),
  review_notes: z.string()
    .min(10, 'Review notes must be at least 10 characters')
    .max(1000, 'Review notes must not exceed 1000 characters'),
});

export const searchDocumentsSchema = z.object({
  query: z.string().min(2, 'Search query must be at least 2 characters').optional(),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
```

---

## Data Layer (Cached Functions)

**CRITICAL:** Use React `cache()` NOT Next.js `'use cache'` due to Supabase client accessing cookies.

```typescript
// lib/data/knowledge.ts
import { cache } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentChapterId } from '@/lib/auth';
import type {
  KnowledgeDocument,
  DocumentListItem,
  PaginatedDocuments,
  DocumentFilters,
  KnowledgeAnalytics
} from '@/types/knowledge';

/**
 * Get paginated documents with filters
 */
export const getDocuments = cache(
  async (params: {
    page?: number;
    pageSize?: number;
    filters?: DocumentFilters;
  } = {}): Promise<PaginatedDocuments> => {
    const { page = 1, pageSize = 20, filters = {} } = params;
    const chapterId = await getCurrentChapterId();

    if (!chapterId) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const supabase = await createServerSupabaseClient();

    // Use search function if search query provided
    if (filters.search) {
      const { data, error } = await supabase.rpc('search_knowledge_documents', {
        p_chapter_id: chapterId,
        p_search_query: filters.search,
        p_category_id: filters.category_id || null,
        p_tags: filters.tags || null,
        p_year: filters.year || null,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      });

      if (error) {
        console.error('Search error:', error);
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
      }

      // Get total count separately for search
      const { count } = await supabase.rpc('search_knowledge_documents', {
        p_chapter_id: chapterId,
        p_search_query: filters.search,
        p_category_id: filters.category_id || null,
        p_tags: filters.tags || null,
        p_year: filters.year || null,
        p_limit: 999999,
        p_offset: 0,
      }).select('*', { count: 'exact', head: true });

      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    }

    // Regular query without search
    let query = supabase
      .from('knowledge_documents')
      .select(`
        id,
        title,
        file_name,
        file_type,
        file_size_kb,
        tags,
        download_count,
        created_at,
        category:knowledge_categories(name),
        uploader:members!uploaded_by(
          profile:profiles(full_name)
        )
      `, { count: 'exact' })
      .eq('chapter_id', chapterId)
      .eq('is_latest_version', true);

    // Apply filters
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }
    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }
    if (filters.year) {
      query = query.eq('year_tag', filters.year);
    }
    if (filters.visibility) {
      query = query.eq('visibility', filters.visibility);
    }
    if (filters.uploaded_by) {
      query = query.eq('uploaded_by', filters.uploaded_by);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);
    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Get documents error:', error);
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    // Transform data
    const documents: DocumentListItem[] = (data || []).map(doc => ({
      id: doc.id,
      title: doc.title,
      file_name: doc.file_name,
      file_type: doc.file_type,
      file_size_kb: doc.file_size_kb,
      category_name: doc.category?.name || null,
      tags: doc.tags || [],
      download_count: doc.download_count,
      uploaded_by_name: doc.uploader?.profile?.full_name || 'Unknown',
      created_at: doc.created_at,
    }));

    return {
      data: documents,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }
);

/**
 * Get single document by ID
 */
export const getDocumentById = cache(
  async (documentId: string): Promise<KnowledgeDocument | null> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('knowledge_documents')
      .select(`
        *,
        category:knowledge_categories(name),
        uploader:members!uploaded_by(
          profile:profiles(full_name, avatar_url)
        )
      `)
      .eq('id', documentId)
      .single();

    if (error || !data) {
      console.error('Get document error:', error);
      return null;
    }

    return data;
  }
);

/**
 * Get knowledge analytics for dashboard
 */
export const getKnowledgeAnalytics = cache(
  async (): Promise<KnowledgeAnalytics | null> => {
    const chapterId = await getCurrentChapterId();
    if (!chapterId) return null;

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('get_knowledge_analytics', {
      p_chapter_id: chapterId,
    });

    if (error) {
      console.error('Analytics error:', error);
      return null;
    }

    return data;
  }
);

/**
 * Get all categories for chapter
 */
export const getCategories = cache(
  async (): Promise<KnowledgeCategory[]> => {
    const chapterId = await getCurrentChapterId();
    if (!chapterId) return [];

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('knowledge_categories')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Get categories error:', error);
      return [];
    }

    return data || [];
  }
);

/**
 * Get popular tags
 */
export const getPopularTags = cache(
  async (limit: number = 20): Promise<string[]> => {
    const chapterId = await getCurrentChapterId();
    if (!chapterId) return [];

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('knowledge_tags')
      .select('name')
      .eq('chapter_id', chapterId)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Get tags error:', error);
      return [];
    }

    return (data || []).map(tag => tag.name);
  }
);

// Add similar functions for:
// - getWikiPages()
// - getWikiPageById()
// - getBestPractices()
// - getBestPracticeById()
// - getDocumentVersions()
// - getWikiContributors()
```

---

## Server Actions

```typescript
// app/actions/knowledge.ts
'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser, getCurrentChapterId } from '@/lib/auth';
import { uploadDocumentSchema, updateDocumentSchema } from '@/lib/validations/knowledge';
import type { FormState } from '@/types';

/**
 * Upload a new document
 */
export async function uploadDocument(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser();
    const chapterId = await getCurrentChapterId();

    if (!user || !chapterId) {
      return { message: 'Unauthorized. Please login.' };
    }

    // Get file from FormData
    const file = formData.get('file') as File;

    // Parse and validate
    const validation = uploadDocumentSchema.safeParse({
      title: formData.get('title'),
      description: formData.get('description') || undefined,
      category_id: formData.get('category_id') || undefined,
      tags: formData.get('tags') ? JSON.parse(formData.get('tags') as string) : undefined,
      visibility: formData.get('visibility'),
      event_id: formData.get('event_id') || undefined,
      file,
    });

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.',
      };
    }

    const data = validation.data;
    const supabase = await createServerSupabaseClient();

    // 1. Upload file to Supabase Storage
    const fileExt = data.file.name.split('.').pop();
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${chapterId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('knowledge-documents')
      .upload(filePath, data.file, {
        contentType: data.file.type,
        upsert: false,
      });

    if (uploadError) {
      return { message: `Upload failed: ${uploadError.message}` };
    }

    // 2. Auto-extract tags from filename
    const { data: autoTags } = await supabase.rpc('extract_auto_tags', {
      file_name: data.file.name,
    });

    const allTags = [...new Set([...(data.tags || []), ...(autoTags || [])])];

    // 3. Extract year tag
    const yearMatch = data.file.name.match(/\d{4}/);
    const yearTag = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

    // 4. Insert document record
    const { data: document, error: insertError } = await supabase
      .from('knowledge_documents')
      .insert({
        chapter_id: chapterId,
        category_id: data.category_id || null,
        title: data.title,
        description: data.description || null,
        file_name: data.file.name,
        file_path: filePath,
        file_type: data.file.type,
        file_size_kb: Math.round(data.file.size / 1024),
        visibility: data.visibility,
        tags: allTags,
        year_tag: yearTag,
        event_id: data.event_id || null,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      // Cleanup: delete uploaded file
      await supabase.storage.from('knowledge-documents').remove([filePath]);
      return { message: `Database error: ${insertError.message}` };
    }

    // 5. Update tag usage counts
    if (allTags.length > 0) {
      await supabase.rpc('increment_tag_usage', {
        p_chapter_id: chapterId,
        p_tags: allTags,
      });
    }

    // 6. Invalidate caches
    revalidateTag('knowledge-documents', 'max');
    revalidateTag('knowledge-analytics', 'max');
    revalidateTag(`knowledge-document-${document.id}`, 'max');

    return {
      success: true,
      message: 'Document uploaded successfully!',
      redirectTo: `/knowledge/documents/${document.id}`,
    };
  } catch (error) {
    console.error('Upload document error:', error);
    return { message: 'An unexpected error occurred. Please try again.' };
  }
}

/**
 * Update document metadata
 */
export async function updateDocument(
  documentId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { message: 'Unauthorized. Please login.' };
    }

    // Validate
    const validation = updateDocumentSchema.safeParse({
      title: formData.get('title') || undefined,
      description: formData.get('description') || undefined,
      category_id: formData.get('category_id') || undefined,
      tags: formData.get('tags') ? JSON.parse(formData.get('tags') as string) : undefined,
      visibility: formData.get('visibility') || undefined,
    });

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.',
      };
    }

    const supabase = await createServerSupabaseClient();

    // Check permissions
    const { data: existing } = await supabase
      .from('knowledge_documents')
      .select('uploaded_by')
      .eq('id', documentId)
      .single();

    if (!existing) {
      return { message: 'Document not found.' };
    }

    // User can only edit their own documents (RLS will enforce EC/Chair permissions)
    const { error: updateError } = await supabase
      .from('knowledge_documents')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      return { message: `Update failed: ${updateError.message}` };
    }

    // Invalidate caches
    revalidateTag('knowledge-documents', 'max');
    revalidateTag(`knowledge-document-${documentId}`, 'max');

    return {
      success: true,
      message: 'Document updated successfully!',
    };
  } catch (error) {
    console.error('Update document error:', error);
    return { message: 'An unexpected error occurred. Please try again.' };
  }
}

/**
 * Delete document
 */
export async function deleteDocument(documentId: string): Promise<FormState> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { message: 'Unauthorized. Please login.' };
    }

    const supabase = await createServerSupabaseClient();

    // Get document file path
    const { data: document } = await supabase
      .from('knowledge_documents')
      .select('file_path, uploaded_by')
      .eq('id', documentId)
      .single();

    if (!document) {
      return { message: 'Document not found.' };
    }

    // Delete from database (RLS will check permissions)
    const { error: deleteError } = await supabase
      .from('knowledge_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      return { message: `Delete failed: ${deleteError.message}` };
    }

    // Delete file from storage
    await supabase.storage
      .from('knowledge-documents')
      .remove([document.file_path]);

    // Invalidate caches
    revalidateTag('knowledge-documents', 'max');
    revalidateTag('knowledge-analytics', 'max');

    return {
      success: true,
      message: 'Document deleted successfully!',
      redirectTo: '/knowledge/documents',
    };
  } catch (error) {
    console.error('Delete document error:', error);
    return { message: 'An unexpected error occurred. Please try again.' };
  }
}

/**
 * Track document view/download
 */
export async function trackDocumentAccess(
  documentId: string,
  action: 'view' | 'download'
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) return;

    const supabase = await createServerSupabaseClient();

    // Log access
    await supabase.from('knowledge_access_log').insert({
      document_id: documentId,
      member_id: user.id,
      action,
    });

    // Increment counter
    if (action === 'download') {
      await supabase.rpc('increment', {
        table_name: 'knowledge_documents',
        column_name: 'download_count',
        row_id: documentId,
      });
    } else {
      await supabase.rpc('increment', {
        table_name: 'knowledge_documents',
        column_name: 'view_count',
        row_id: documentId,
      });
    }

    // Update last_accessed_at
    await supabase
      .from('knowledge_documents')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', documentId);

    // Invalidate document cache
    revalidateTag(`knowledge-document-${documentId}`, 'max');
  } catch (error) {
    console.error('Track access error:', error);
  }
}

// Add similar Server Actions for:
// - createWikiPage()
// - updateWikiPage()
// - deleteWikiPage()
// - createBestPractice()
// - reviewBestPractice()
// - upvoteBestPractice()
// - shareWithNational()
```

---

## UI Components

### 1. Document Upload Form

```tsx
// components/knowledge/document-upload-form.tsx
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadDocument } from '@/app/actions/knowledge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { KnowledgeCategory } from '@/types/knowledge';

interface DocumentUploadFormProps {
  categories: KnowledgeCategory[];
  events?: Array<{ id: string; title: string }>;
}

export function DocumentUploadForm({ categories, events }: DocumentUploadFormProps) {
  const [state, formAction] = useActionState(uploadDocument, {});

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <Alert variant={state.success ? 'default' : 'destructive'}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="file">Document File *</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.webp"
          required
          aria-invalid={!!state.errors?.file}
        />
        <p className="text-sm text-muted-foreground mt-1">
          Max 50MB. Supported: PDF, DOCX, XLSX, PPTX, JPG, PNG, WEBP
        </p>
        {state.errors?.file && (
          <p className="text-sm text-destructive mt-1">{state.errors.file[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          name="title"
          type="text"
          placeholder="e.g., Masoom Road Safety Report 2025"
          required
          aria-invalid={!!state.errors?.title}
        />
        {state.errors?.title && (
          <p className="text-sm text-destructive mt-1">{state.errors.title[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Brief description of the document..."
          rows={3}
          aria-invalid={!!state.errors?.description}
        />
        {state.errors?.description && (
          <p className="text-sm text-destructive mt-1">{state.errors.description[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="category_id">Category</Label>
        <Select name="category_id" aria-invalid={!!state.errors?.category_id}>
          <option value="">Select a category</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </Select>
        {state.errors?.category_id && (
          <p className="text-sm text-destructive mt-1">{state.errors.category_id[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="visibility">Visibility *</Label>
        <Select name="visibility" defaultValue="chapter" required>
          <option value="public">Public</option>
          <option value="chapter">Chapter Only</option>
          <option value="ec_only">EC Members Only</option>
          <option value="chair_only">Chair Only</option>
        </Select>
        {state.errors?.visibility && (
          <p className="text-sm text-destructive mt-1">{state.errors.visibility[0]}</p>
        )}
      </div>

      {events && events.length > 0 && (
        <div>
          <Label htmlFor="event_id">Link to Event (Optional)</Label>
          <Select name="event_id">
            <option value="">None</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </Select>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Uploading...' : 'Upload Document'}
    </Button>
  );
}
```

### 2. Documents Table

```tsx
// components/knowledge/documents-table.tsx
'use client';

import { DataTable } from '@/components/data-table/data-table';
import { documentsTableColumns } from './documents-table-columns';
import type { DocumentListItem } from '@/types/knowledge';

interface DocumentsTableProps {
  documents: DocumentListItem[];
  categories: Array<{ id: string; name: string }>;
}

export function DocumentsTable({ documents, categories }: DocumentsTableProps) {
  return (
    <DataTable
      columns={documentsTableColumns}
      data={documents}
      filterFields={[
        {
          id: 'title',
          label: 'Search',
          type: 'text',
          placeholder: 'Search documents...',
        },
        {
          id: 'category_name',
          label: 'Category',
          type: 'select',
          options: categories.map(cat => ({ label: cat.name, value: cat.name })),
        },
        {
          id: 'file_type',
          label: 'File Type',
          type: 'select',
          options: [
            { label: 'PDF', value: 'application/pdf' },
            { label: 'Word', value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
            { label: 'Excel', value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            { label: 'PowerPoint', value: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
            { label: 'Image', value: 'image/*' },
          ],
        },
      ]}
      exportConfig={{
        filename: 'knowledge-documents',
        columns: ['title', 'category_name', 'file_name', 'download_count', 'created_at'],
      }}
    />
  );
}
```

### 3. Document Card

```tsx
// components/knowledge/document-card.tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Eye, FileText } from 'lucide-react';
import { formatDate, formatFileSize } from '@/lib/utils';
import type { DocumentListItem } from '@/types/knowledge';

interface DocumentCardProps {
  document: DocumentListItem;
}

export function DocumentCard({ document }: DocumentCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <Badge variant="outline">{document.category_name || 'Uncategorized'}</Badge>
        </div>
        <CardTitle className="line-clamp-2">{document.title}</CardTitle>
        <CardDescription>
          {document.file_name} • {formatFileSize(document.file_size_kb)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {document.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{document.uploaded_by_name}</span>
          <span>{formatDate(document.created_at)}</span>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" className="flex-1">
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button variant="default" size="sm" className="flex-1">
            <Download className="h-4 w-4 mr-1" />
            Download ({document.download_count})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Pages Structure

### Main Knowledge Hub Page

```tsx
// app/(dashboard)/knowledge/page.tsx
import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { getKnowledgeAnalytics } from '@/lib/data/knowledge';
import { KnowledgeStats } from '@/components/knowledge/knowledge-stats';
import { RecentDocuments } from '@/components/knowledge/recent-documents';
import { PopularCategories } from '@/components/knowledge/popular-categories';
import { Skeleton } from '@/components/ui/skeleton';

export default async function KnowledgePage() {
  await requireAuth();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Management</h1>
          <p className="text-muted-foreground">
            Your chapter's digital library and knowledge base
          </p>
        </div>
      </div>

      {/* Analytics */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <KnowledgeAnalyticsSection />
      </Suspense>

      {/* Quick Actions Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <QuickActionCard
          title="Upload Document"
          href="/knowledge/documents/new"
          icon="upload"
        />
        <QuickActionCard
          title="Browse Library"
          href="/knowledge/documents"
          icon="library"
        />
        <QuickActionCard
          title="Wiki Pages"
          href="/knowledge/wiki"
          icon="book"
        />
        <QuickActionCard
          title="Best Practices"
          href="/knowledge/best-practices"
          icon="star"
        />
      </div>

      {/* Recent Documents */}
      <Suspense fallback={<DocumentsSkeleton />}>
        <RecentDocuments />
      </Suspense>
    </div>
  );
}

async function KnowledgeAnalyticsSection() {
  const analytics = await getKnowledgeAnalytics();
  if (!analytics) return null;

  return <KnowledgeStats analytics={analytics} />;
}
```

### Documents List Page

```tsx
// app/(dashboard)/knowledge/documents/page.tsx
import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { getDocuments, getCategories } from '@/lib/data/knowledge';
import { DocumentsTable } from '@/components/knowledge/documents-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    page?: string;
  }>;
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  await requireAuth();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Library</h1>
          <p className="text-muted-foreground">
            Browse and search all chapter documents
          </p>
        </div>
        <Button asChild>
          <Link href="/knowledge/documents/new">
            <Plus className="h-4 w-4 mr-2" />
            Upload Document
          </Link>
        </Button>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <DocumentsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function DocumentsContent({
  searchParams
}: {
  searchParams: Promise<{ search?: string; category?: string; page?: string }>
}) {
  const params = await searchParams;

  const [documents, categories] = await Promise.all([
    getDocuments({
      page: parseInt(params.page || '1'),
      filters: {
        search: params.search,
        category_id: params.category,
      },
    }),
    getCategories(),
  ]);

  return (
    <DocumentsTable
      documents={documents.data}
      categories={categories}
    />
  );
}
```

---

## File Structure Summary

```
supabase/
└── migrations/
    └── 20251119000001_knowledge_management.sql

types/
└── knowledge.ts

lib/
├── data/
│   └── knowledge.ts
└── validations/
    └── knowledge.ts

app/
├── actions/
│   └── knowledge.ts
└── (dashboard)/
    └── knowledge/
        ├── page.tsx
        ├── documents/
        │   ├── page.tsx
        │   ├── new/
        │   │   └── page.tsx
        │   └── [id]/
        │       ├── page.tsx
        │       └── edit/
        │           └── page.tsx
        ├── wiki/
        │   ├── page.tsx
        │   ├── new/
        │   │   └── page.tsx
        │   └── [slug]/
        │       ├── page.tsx
        │       └── edit/
        │           └── page.tsx
        ├── best-practices/
        │   ├── page.tsx
        │   ├── new/
        │   │   └── page.tsx
        │   └── [id]/
        │       └── page.tsx
        ├── templates/
        │   └── page.tsx
        ├── search/
        │   └── page.tsx
        └── analytics/
            └── page.tsx

components/
└── knowledge/
    ├── document-upload-form.tsx
    ├── document-card.tsx
    ├── documents-table.tsx
    ├── documents-table-columns.tsx
    ├── document-viewer.tsx
    ├── version-history.tsx
    ├── wiki-editor.tsx
    ├── wiki-page-card.tsx
    ├── wiki-table.tsx
    ├── best-practice-form.tsx
    ├── best-practice-card.tsx
    ├── best-practices-table.tsx
    ├── knowledge-stats.tsx
    ├── knowledge-heatmap.tsx
    ├── search-bar.tsx
    ├── filter-sidebar.tsx
    ├── category-selector.tsx
    └── auto-tagger.tsx
```

---

## Implementation Phases

### Phase 1: Core Document Management (Week 1)
- [ ] Database schema and migration
- [ ] Types and validation schemas
- [ ] File upload to Supabase Storage
- [ ] Basic CRUD operations (create, read, update, delete)
- [ ] Document list page with basic filtering
- [ ] Upload form with auto-tagging

### Phase 2: Search & Discovery (Week 2)
- [ ] Full-text search implementation
- [ ] Advanced filters (category, tags, year, type)
- [ ] Search results page
- [ ] Category browser
- [ ] Tag cloud
- [ ] Popular documents widget

### Phase 3: Wiki & Collaboration (Week 3)
- [ ] Wiki page creation and editing
- [ ] Version control for wiki pages
- [ ] Contributor tracking
- [ ] Wiki templates (SOP, Best Practice, Process Note)
- [ ] Collaborative editing notifications (Realtime)

### Phase 4: Best Practices & Analytics (Week 4)
- [ ] Best practices submission form
- [ ] EC review workflow
- [ ] Upvote system
- [ ] Impact metrics tracking
- [ ] Knowledge analytics dashboard
- [ ] Contribution leaderboard
- [ ] Knowledge gaps heatmap

### Phase 5: Integration & Polish (Week 5)
- [ ] Event archives auto-save integration
- [ ] National repository sync
- [ ] OCR text extraction (Edge Function)
- [ ] Thumbnail generation for PDFs
- [ ] Export functionality
- [ ] Bulk operations
- [ ] Advanced table with all features

---

## Supabase Storage Setup

### Create Storage Bucket

```sql
-- Create bucket for knowledge documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-documents', 'knowledge-documents', false);

-- RLS policies for storage
CREATE POLICY "Chapter members can view documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'knowledge-documents'
    AND EXISTS (
      SELECT 1 FROM knowledge_documents kd
      JOIN members m ON kd.chapter_id = m.chapter_id
      WHERE kd.file_path = storage.objects.name
      AND m.id = auth.uid()
    )
  );

CREATE POLICY "Chapter members can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'knowledge-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT chapter_id::TEXT FROM members WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their uploaded documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'knowledge-documents'
    AND EXISTS (
      SELECT 1 FROM knowledge_documents kd
      WHERE kd.file_path = storage.objects.name
      AND kd.uploaded_by = auth.uid()
    )
  );
```

---

## Integration Points

### Event Archives Integration

When an event is marked complete, automatically save event report to knowledge library:

```typescript
// app/actions/events.ts (add to existing)
export async function completeEvent(eventId: string): Promise<FormState> {
  // ... existing code ...

  // Auto-archive event report
  if (eventReport) {
    await archiveEventReport(eventId, eventReport);
  }

  // ... rest of code ...
}

async function archiveEventReport(eventId: string, report: EventReport) {
  const supabase = await createServerSupabaseClient();

  // Create document entry for event report
  await supabase.from('knowledge_documents').insert({
    chapter_id: report.chapter_id,
    category_id: await getCategoryIdBySlug('event-reports'),
    title: `${report.event_title} - Event Report`,
    description: report.summary,
    file_name: `${report.event_title}_Report.pdf`,
    file_path: report.file_path,
    file_type: 'application/pdf',
    file_size_kb: report.file_size_kb,
    visibility: 'chapter',
    tags: ['Event Report', report.vertical, report.year.toString()],
    event_id: eventId,
    year_tag: report.year,
    uploaded_by: report.created_by,
  });

  revalidateTag('knowledge-documents', 'max');
}
```

---

## Common Errors to Avoid

### ❌ DON'T:

```typescript
// ❌ Using 'use cache' with cookies
'use cache'
export async function getDocuments() {
  const supabase = await createServerSupabaseClient(); // Uses cookies!
}

// ❌ Awaiting searchParams at page level
export default async function Page({ searchParams }) {
  const params = await searchParams; // ❌ ERROR
}

// ❌ Forgetting file cleanup on error
const { error } = await supabase.from('documents').insert(data);
if (error) return { message: error.message };
// File remains in storage!

// ❌ Not validating file size/type on server
const file = formData.get('file') as File;
await uploadToStorage(file); // No validation!
```

### ✅ DO:

```typescript
// ✅ Use React cache() with Supabase
import { cache } from 'react';
export const getDocuments = cache(async () => {
  const supabase = await createServerSupabaseClient(); // OK!
});

// ✅ Await searchParams inside Suspense boundary
async function Content({ searchParams }: { searchParams: Promise<...> }) {
  const params = await searchParams; // ✅ Correct
}

// ✅ Cleanup on error
const { error: uploadError } = await supabase.storage.from('bucket').upload(path, file);
if (uploadError) {
  // Cleanup
  return { message: uploadError.message };
}

const { error: dbError } = await supabase.from('documents').insert(data);
if (dbError) {
  // Cleanup storage
  await supabase.storage.from('bucket').remove([path]);
  return { message: dbError.message };
}

// ✅ Validate on server
const validation = uploadDocumentSchema.safeParse({ file, ... });
if (!validation.success) {
  return { errors: validation.error.flatten().fieldErrors };
}
```

---

## Testing Checklist

### Functionality
- [ ] Document upload (all file types)
- [ ] Auto-tag extraction from filename
- [ ] Full-text search
- [ ] Filter by category, tags, year
- [ ] Download tracking
- [ ] View tracking
- [ ] Version history
- [ ] Wiki page creation
- [ ] Wiki editing with version save
- [ ] Best practice submission
- [ ] EC review workflow
- [ ] Upvote system
- [ ] National sync

### Performance
- [ ] Large file uploads (up to 50MB)
- [ ] Search with 1000+ documents
- [ ] Pagination works correctly
- [ ] Cached data returns instantly
- [ ] Cache invalidation works

### Security
- [ ] RLS policies enforce visibility
- [ ] Users can't access other chapters' documents
- [ ] EC-only documents hidden from members
- [ ] File uploads size/type validated
- [ ] XSS protection on user input
- [ ] SQL injection prevention

### Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader compatible
- [ ] ARIA labels on forms
- [ ] Error messages announced
- [ ] Focus management

---

## Next Steps After Module 8

Once Module 8 is complete:

1. **Update IMPLEMENTATION_PLAN.md**
   - Mark Module 8 as 100% complete
   - Update Phase 2 progress percentage
   - Document any deferred features
   - Add completion date and statistics

2. **Integration Testing**
   - Test Event → Knowledge auto-archive
   - Verify navigation flow across modules
   - Check cross-module data consistency

3. **Proceed to Module 9: Vertical Performance Tracker**
   - Leverage knowledge analytics data
   - Build KPI dashboards per vertical
   - Integrate with Events, Finance, Knowledge modules

---

## Appendix: Database Helper Functions

```sql
-- Increment counter helper
CREATE OR REPLACE FUNCTION increment(
  table_name TEXT,
  column_name TEXT,
  row_id UUID,
  amount INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET %I = %I + $1 WHERE id = $2',
    table_name, column_name, column_name)
  USING amount, row_id;
END;
$$ LANGUAGE plpgsql;

-- Increment tag usage
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

-- Get category ID by slug
CREATE OR REPLACE FUNCTION get_category_id_by_slug(
  p_chapter_id UUID,
  p_slug TEXT
)
RETURNS UUID AS $$
  SELECT id FROM knowledge_categories
  WHERE chapter_id = p_chapter_id AND slug = p_slug
  LIMIT 1;
$$ LANGUAGE sql STABLE;
```

---

**END OF MODULE 8 IMPLEMENTATION PLAN**

This plan provides a complete roadmap for implementing the Knowledge Management System. Follow the patterns from existing modules (especially Module 7 - Communications) and adhere to Next.js 16 best practices throughout development.
