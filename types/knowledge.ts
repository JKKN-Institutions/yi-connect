// Module 8: Knowledge Management - TypeScript Types

// =============================================
// ENUMS & CONSTANTS
// =============================================

export const DOCUMENT_VISIBILITY = ['public', 'chapter', 'ec_only', 'chair_only'] as const;
export type DocumentVisibility = typeof DOCUMENT_VISIBILITY[number];

export const WIKI_CATEGORY = ['sop', 'best_practice', 'process_note', 'general'] as const;
export type WikiCategory = typeof WIKI_CATEGORY[number];

export const BEST_PRACTICE_STATUS = ['draft', 'submitted', 'under_review', 'published', 'rejected'] as const;
export type BestPracticeStatus = typeof BEST_PRACTICE_STATUS[number];

export const ACCESS_LOG_ACTION = ['view', 'download', 'edit', 'share'] as const;
export type AccessLogAction = typeof ACCESS_LOG_ACTION[number];

export const NATIONAL_SYNC_STATUS = ['pending', 'approved', 'rejected', 'synced'] as const;
export type NationalSyncStatus = typeof NATIONAL_SYNC_STATUS[number];

// =============================================
// DATABASE TYPES
// =============================================

export interface KnowledgeCategory {
  id: string;
  chapter_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null; // lucide icon name
  color: string | null; // hex color
  parent_category_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeTag {
  id: string;
  chapter_id: string;
  name: string;
  slug: string;
  usage_count: number;
  created_at: string;
}

export interface KnowledgeDocument {
  id: string;
  chapter_id: string;
  category_id: string | null;

  // Document Metadata
  title: string;
  description: string | null;
  file_name: string;
  file_path: string; // Supabase Storage path
  file_type: string; // MIME type
  file_size_kb: number;

  // Version Control
  version: number;
  is_latest_version: boolean;
  parent_document_id: string | null;

  // Access Control
  visibility: DocumentVisibility;

  // Auto-extracted Metadata
  tags: string[];
  vertical_tags: string[] | null;
  event_id: string | null;
  year_tag: number | null;

  // Search Optimization
  ocr_text: string | null;

  // Tracking
  download_count: number;
  view_count: number;
  last_accessed_at: string | null;

  // Metadata
  uploaded_by: string;
  created_at: string;
  updated_at: string;

  // National Sync
  shared_with_national: boolean;
  national_sync_status: NationalSyncStatus | null;
  national_sync_at: string | null;
}

export interface KnowledgeDocumentTag {
  id: string;
  document_id: string;
  tag_id: string;
  created_at: string;
}

export interface KnowledgeDocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_path: string;
  file_size_kb: number;
  change_summary: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface WikiPage {
  id: string;
  chapter_id: string;

  // Page Identity
  title: string;
  slug: string;
  category: WikiCategory;

  // Content
  content: string;
  summary: string | null;

  // Version Control
  version: number;

  // Access Control
  visibility: DocumentVisibility;
  is_locked: boolean;
  locked_by: string | null;
  locked_at: string | null;

  // Metadata
  created_by: string;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WikiPageVersion {
  id: string;
  wiki_page_id: string;
  version_number: number;
  content: string;
  change_summary: string | null;
  edited_by: string | null;
  created_at: string;
}

export interface WikiContributor {
  id: string;
  wiki_page_id: string;
  member_id: string;
  contribution_count: number;
  first_contributed_at: string;
  last_contributed_at: string;
}

export interface BestPractice {
  id: string;
  chapter_id: string;

  // Content
  title: string;
  description: string;
  full_content: string | null;

  // Impact Metrics
  impact_metrics: {
    beneficiaries?: number;
    cost_saved?: number;
    time_saved_hours?: number;
    [key: string]: number | undefined;
  };

  // Attachments
  document_ids: string[];

  // Status
  status: BestPracticeStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;

  // Engagement
  upvote_count: number;
  view_count: number;

  // Metadata
  submitted_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface BestPracticeUpvote {
  id: string;
  best_practice_id: string;
  member_id: string;
  created_at: string;
}

export interface KnowledgeAccessLog {
  id: string;
  document_id: string | null;
  wiki_page_id: string | null;
  member_id: string;
  action: AccessLogAction;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// =============================================
// EXTENDED TYPES (with relations)
// =============================================

export interface KnowledgeDocumentWithDetails extends KnowledgeDocument {
  category_name: string | null;
  uploaded_by_name: string;
  uploaded_by_avatar: string | null;
}

export interface WikiPageWithDetails extends WikiPage {
  created_by_name: string;
  created_by_avatar: string | null;
  last_edited_by_name: string | null;
  contributors_count: number;
}

export interface BestPracticeWithDetails extends BestPractice {
  submitted_by_name: string;
  submitted_by_avatar: string | null;
  reviewed_by_name: string | null;
  has_upvoted: boolean; // Whether current user has upvoted
}

// =============================================
// LIST ITEM TYPES (for tables)
// =============================================

export interface DocumentListItem {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size_kb: number;
  category_name: string | null;
  tags: string[];
  download_count: number;
  view_count: number;
  uploaded_by_name: string;
  created_at: string;
  visibility: DocumentVisibility;
}

export interface WikiPageListItem {
  id: string;
  title: string;
  slug: string;
  category: WikiCategory;
  summary: string | null;
  version: number;
  visibility: DocumentVisibility;
  is_locked: boolean;
  created_by_name: string;
  last_edited_by_name: string | null;
  updated_at: string;
}

export interface BestPracticeListItem {
  id: string;
  title: string;
  description: string;
  status: BestPracticeStatus;
  upvote_count: number;
  view_count: number;
  submitted_by_name: string;
  created_at: string;
  published_at: string | null;
}

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  document_count: number;
  sort_order: number;
}

// =============================================
// FILTER TYPES
// =============================================

export interface DocumentFilters {
  search?: string;
  category_id?: string;
  tags?: string[];
  year?: number;
  visibility?: DocumentVisibility;
  uploaded_by?: string;
  date_from?: string;
  date_to?: string;
  event_id?: string;
  page?: number;
  pageSize?: number;
}

export interface WikiPageFilters {
  search?: string;
  category?: WikiCategory;
  visibility?: DocumentVisibility;
  is_locked?: boolean;
  page?: number;
  pageSize?: number;
}

export interface BestPracticeFilters {
  search?: string;
  status?: BestPracticeStatus;
  submitted_by?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  pageSize?: number;
}

// =============================================
// PAGINATED RESPONSE TYPES
// =============================================

export interface PaginatedDocuments {
  data: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedWikiPages {
  data: WikiPageListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedBestPractices {
  data: BestPracticeListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =============================================
// ANALYTICS TYPES
// =============================================

export interface KnowledgeAnalytics {
  total_documents: number;
  total_wiki_pages: number;
  total_best_practices: number;
  total_views: number;
  total_size_mb: number;
  documents_this_month: number;
  top_categories: Array<{
    category: string;
    count: number;
  }>;
  top_contributors: Array<{
    name: string;
    uploads: number;
  }>;
  top_downloads: Array<{
    title: string;
    downloads: number;
  }>;
}

export interface KnowledgeStats {
  total_documents: number;
  total_wiki_pages: number;
  total_best_practices: number;
  total_categories: number;
  total_size_mb: number;
  documents_this_week: number;
  wiki_edits_this_week: number;
  active_contributors: number;
}

export interface ContributorStats {
  member_id: string;
  member_name: string;
  avatar_url: string | null;
  documents_uploaded: number;
  wiki_pages_created: number;
  wiki_edits: number;
  best_practices_submitted: number;
  total_contributions: number;
}

// =============================================
// UPLOAD & FORM TYPES
// =============================================

export interface DocumentUploadMetadata {
  title: string;
  description?: string;
  category_id?: string;
  tags?: string[];
  visibility: DocumentVisibility;
  event_id?: string;
}

export interface WikiPageCreateData {
  title: string;
  slug: string;
  category: WikiCategory;
  content: string;
  summary?: string;
  visibility: DocumentVisibility;
}

export interface WikiPageUpdateData {
  title?: string;
  content?: string;
  summary?: string;
  change_summary?: string;
}

export interface BestPracticeCreateData {
  title: string;
  description: string;
  full_content?: string;
  impact_metrics?: {
    beneficiaries?: number;
    cost_saved?: number;
    time_saved_hours?: number;
  };
  document_ids?: string[];
}

export interface BestPracticeReviewData {
  action: 'approve' | 'reject';
  review_notes: string;
}

// =============================================
// SEARCH TYPES
// =============================================

export interface SearchDocumentsParams {
  query?: string;
  category_id?: string;
  tags?: string[];
  year?: number;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  category_name: string | null;
  tags: string[];
  download_count: number;
  uploaded_by_name: string;
  created_at: string;
  rank: number; // Search relevance score
}

// =============================================
// FORM STATE TYPE (for Server Actions)
// =============================================

export interface FormState {
  success?: boolean;
  message?: string;
  errors?: {
    [key: string]: string[] | undefined;
  };
  redirectTo?: string;
}

// =============================================
// VERSION COMPARISON TYPES
// =============================================

export interface VersionComparison {
  current_version: number;
  previous_version: number;
  changes: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  change_summary: string | null;
  edited_by_name: string | null;
  edited_at: string;
}

// =============================================
// NOTIFICATION TYPES
// =============================================

export interface KnowledgeNotification {
  type: 'new_document' | 'new_wiki_page' | 'wiki_edited' | 'best_practice_published' | 'document_shared';
  title: string;
  message: string;
  action_url?: string;
  metadata?: {
    document_id?: string;
    wiki_page_id?: string;
    best_practice_id?: string;
    [key: string]: any;
  };
}

// =============================================
// EXPORT TYPES
// =============================================

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  include_fields?: string[];
  filters?: DocumentFilters | WikiPageFilters | BestPracticeFilters;
}

// =============================================
// HEATMAP TYPES (for knowledge gaps)
// =============================================

export interface KnowledgeGapData {
  category: string;
  vertical: string;
  document_count: number;
  expected_count: number;
  gap_percentage: number;
  priority: 'low' | 'medium' | 'high';
}

// =============================================
// UTILITY TYPES
// =============================================

export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  field: string;
  order: SortOrder;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
}
