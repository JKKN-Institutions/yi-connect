// Module 8: Knowledge Management - Zod Validation Schemas

import { z } from 'zod';

// =============================================
// ENUMS
// =============================================

export const documentVisibilitySchema = z.enum(['public', 'chapter', 'ec_only', 'chair_only']);
export const wikiCategorySchema = z.enum(['sop', 'best_practice', 'process_note', 'general']);
export const bestPracticeStatusSchema = z.enum(['draft', 'submitted', 'under_review', 'published', 'rejected']);
export const accessLogActionSchema = z.enum(['view', 'download', 'edit', 'share']);
export const nationalSyncStatusSchema = z.enum(['pending', 'approved', 'rejected', 'synced']);

// =============================================
// CATEGORY SCHEMAS
// =============================================

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional(),
  parent_category_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().min(0).default(0),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  is_active: z.boolean().optional(),
});

// =============================================
// DOCUMENT SCHEMAS
// =============================================

export const documentUploadMetadataSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  visibility: documentVisibilitySchema.default('chapter'),
  event_id: z.string().uuid().optional().nullable(),
});

export const createDocumentSchema = documentUploadMetadataSchema.extend({
  file_name: z.string().min(1, 'File name is required').max(255),
  file_path: z.string().min(1, 'File path is required'),
  file_type: z.string().min(1, 'File type is required').max(50),
  file_size_kb: z.number().int().min(0, 'File size must be positive'),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  visibility: documentVisibilitySchema.optional(),
  vertical_tags: z.array(z.string()).optional().nullable(),
  event_id: z.string().uuid().optional().nullable(),
  year_tag: z.number().int().min(2000).max(2100).optional().nullable(),
});

export const documentFiltersSchema = z.object({
  search: z.string().optional(),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  year: z.number().int().optional(),
  visibility: documentVisibilitySchema.optional(),
  uploaded_by: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  event_id: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

// =============================================
// WIKI PAGE SCHEMAS
// =============================================

export const createWikiPageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  slug: z.string().min(1, 'Slug is required').max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  category: wikiCategorySchema.default('general'),
  content: z.string().min(1, 'Content is required'),
  summary: z.string().max(500).optional(),
  visibility: documentVisibilitySchema.default('chapter'),
});

export const updateWikiPageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  summary: z.string().max(500).optional().nullable(),
  change_summary: z.string().max(500).optional(),
  visibility: documentVisibilitySchema.optional(),
});

export const wikiPageFiltersSchema = z.object({
  search: z.string().optional(),
  category: wikiCategorySchema.optional(),
  visibility: documentVisibilitySchema.optional(),
  is_locked: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

// =============================================
// BEST PRACTICE SCHEMAS
// =============================================

export const impactMetricsSchema = z.object({
  beneficiaries: z.number().int().min(0).optional(),
  cost_saved: z.number().min(0).optional(),
  time_saved_hours: z.number().min(0).optional(),
}).catchall(z.number());

export const createBestPracticeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().min(1, 'Description is required'),
  full_content: z.string().optional(),
  impact_metrics: impactMetricsSchema.optional(),
  document_ids: z.array(z.string().uuid()).optional(),
});

export const updateBestPracticeSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  full_content: z.string().optional().nullable(),
  impact_metrics: impactMetricsSchema.optional(),
  document_ids: z.array(z.string().uuid()).optional(),
});

export const reviewBestPracticeSchema = z.object({
  action: z.enum(['approve', 'reject']),
  review_notes: z.string().min(1, 'Review notes are required'),
});

export const bestPracticeFiltersSchema = z.object({
  search: z.string().optional(),
  status: bestPracticeStatusSchema.optional(),
  submitted_by: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

// =============================================
// TAG SCHEMAS
// =============================================

export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

// =============================================
// ACCESS LOG SCHEMAS
// =============================================

export const createAccessLogSchema = z.object({
  document_id: z.string().uuid().optional().nullable(),
  wiki_page_id: z.string().uuid().optional().nullable(),
  action: accessLogActionSchema,
  ip_address: z.string().optional().nullable(),
  user_agent: z.string().optional().nullable(),
}).refine(
  (data) => (data.document_id !== null && data.wiki_page_id === null) || (data.document_id === null && data.wiki_page_id !== null),
  {
    message: 'Either document_id or wiki_page_id must be provided, but not both',
  }
);

// =============================================
// SEARCH & EXPORT SCHEMAS
// =============================================

export const searchDocumentsSchema = z.object({
  query: z.string().optional(),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const exportOptionsSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json', 'pdf']),
  include_fields: z.array(z.string()).optional(),
  filters: z.union([
    documentFiltersSchema,
    wikiPageFiltersSchema,
    bestPracticeFiltersSchema,
  ]).optional(),
});

// =============================================
// DOCUMENT VERSION SCHEMAS
// =============================================

export const createDocumentVersionSchema = z.object({
  document_id: z.string().uuid(),
  file_path: z.string().min(1, 'File path is required'),
  file_size_kb: z.number().int().min(0),
  change_summary: z.string().max(500).optional(),
});

// =============================================
// WIKI PAGE VERSION SCHEMAS
// =============================================

export const createWikiPageVersionSchema = z.object({
  wiki_page_id: z.string().uuid(),
  content: z.string().min(1, 'Content is required'),
  change_summary: z.string().max(500).optional(),
});

// =============================================
// TYPE EXPORTS (inferred from schemas)
// =============================================

export type DocumentVisibility = z.infer<typeof documentVisibilitySchema>;
export type WikiCategory = z.infer<typeof wikiCategorySchema>;
export type BestPracticeStatus = z.infer<typeof bestPracticeStatusSchema>;
export type AccessLogAction = z.infer<typeof accessLogActionSchema>;
export type NationalSyncStatus = z.infer<typeof nationalSyncStatusSchema>;

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export type DocumentUploadMetadata = z.infer<typeof documentUploadMetadataSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentFilters = z.infer<typeof documentFiltersSchema>;

export type CreateWikiPageInput = z.infer<typeof createWikiPageSchema>;
export type UpdateWikiPageInput = z.infer<typeof updateWikiPageSchema>;
export type WikiPageFilters = z.infer<typeof wikiPageFiltersSchema>;

export type ImpactMetrics = z.infer<typeof impactMetricsSchema>;
export type CreateBestPracticeInput = z.infer<typeof createBestPracticeSchema>;
export type UpdateBestPracticeInput = z.infer<typeof updateBestPracticeSchema>;
export type ReviewBestPracticeInput = z.infer<typeof reviewBestPracticeSchema>;
export type BestPracticeFilters = z.infer<typeof bestPracticeFiltersSchema>;

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type CreateAccessLogInput = z.infer<typeof createAccessLogSchema>;
export type SearchDocumentsInput = z.infer<typeof searchDocumentsSchema>;
export type ExportOptions = z.infer<typeof exportOptionsSchema>;
