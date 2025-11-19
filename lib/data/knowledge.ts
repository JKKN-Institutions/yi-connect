// Module 8: Knowledge Management - Data Layer with React cache()

import { cache } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type {
  KnowledgeCategory,
  KnowledgeDocument,
  DocumentListItem,
  WikiPage,
  WikiPageListItem,
  BestPractice,
  BestPracticeListItem,
  PaginatedDocuments,
  PaginatedWikiPages,
  PaginatedBestPractices,
  DocumentFilters,
  WikiPageFilters,
  BestPracticeFilters,
  KnowledgeAnalytics,
  KnowledgeTag,
  CategoryListItem,
} from '@/types/knowledge';

// =============================================
// CATEGORIES
// =============================================

export const getCategories = cache(
  async (chapterId: string): Promise<KnowledgeCategory[]> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('knowledge_categories')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }
);

export const getCategoryById = cache(
  async (categoryId: string): Promise<KnowledgeCategory | null> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('knowledge_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }
);

export const getCategoriesWithCounts = cache(
  async (chapterId: string): Promise<CategoryListItem[]> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('knowledge_categories')
      .select(`
        id,
        name,
        slug,
        icon,
        color,
        sort_order,
        knowledge_documents(count)
      `)
      .eq('chapter_id', chapterId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return (data || []).map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      color: cat.color,
      document_count: cat.knowledge_documents?.[0]?.count || 0,
      sort_order: cat.sort_order,
    }));
  }
);

// =============================================
// DOCUMENTS
// =============================================

export const getDocuments = cache(
  async (chapterId: string, filters: DocumentFilters = {}): Promise<PaginatedDocuments> => {
    const supabase = await createServerSupabaseClient();

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

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
        view_count,
        created_at,
        visibility,
        category:knowledge_categories(name),
        uploader:members!knowledge_documents_uploaded_by_fkey(
          profile:profiles(full_name)
        )
      `, { count: 'exact' })
      .eq('chapter_id', chapterId)
      .eq('is_latest_version', true);

    // Apply filters
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }
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
    if (filters.event_id) {
      query = query.eq('event_id', filters.event_id);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const documents: DocumentListItem[] = (data || []).map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      file_name: doc.file_name,
      file_type: doc.file_type,
      file_size_kb: doc.file_size_kb,
      category_name: doc.category?.name || null,
      tags: doc.tags,
      download_count: doc.download_count,
      view_count: doc.view_count,
      uploaded_by_name: doc.uploader?.profile?.full_name || 'Unknown',
      created_at: doc.created_at,
      visibility: doc.visibility,
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

export const getDocumentById = cache(
  async (documentId: string): Promise<KnowledgeDocument | null> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }
);

// =============================================
// WIKI PAGES
// =============================================

export const getWikiPages = cache(
  async (chapterId: string, filters: WikiPageFilters = {}): Promise<PaginatedWikiPages> => {
    const supabase = await createServerSupabaseClient();

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('wiki_pages')
      .select(`
        id,
        title,
        slug,
        category,
        summary,
        version,
        visibility,
        is_locked,
        updated_at,
        created_by:members!wiki_pages_created_by_fkey(profile:profiles(full_name)),
        last_edited_by:members!wiki_pages_last_edited_by_fkey(profile:profiles(full_name))
      `, { count: 'exact' })
      .eq('chapter_id', chapterId);

    // Apply filters
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,summary.ilike.%${filters.search}%`);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.visibility) {
      query = query.eq('visibility', filters.visibility);
    }
    if (filters.is_locked !== undefined) {
      query = query.eq('is_locked', filters.is_locked);
    }

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const wikiPages: WikiPageListItem[] = (data || []).map((page: any) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      category: page.category,
      summary: page.summary,
      version: page.version,
      visibility: page.visibility,
      is_locked: page.is_locked,
      created_by_name: page.created_by?.profile?.full_name || 'Unknown',
      last_edited_by_name: page.last_edited_by?.profile?.full_name || null,
      updated_at: page.updated_at,
    }));

    return {
      data: wikiPages,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }
);

export const getWikiPageById = cache(
  async (pageId: string): Promise<WikiPage | null> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('wiki_pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }
);

export const getWikiPageBySlug = cache(
  async (chapterId: string, slug: string): Promise<WikiPage | null> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('wiki_pages')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }
);

// =============================================
// BEST PRACTICES
// =============================================

export const getBestPractices = cache(
  async (chapterId: string, filters: BestPracticeFilters = {}): Promise<PaginatedBestPractices> => {
    const supabase = await createServerSupabaseClient();

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('best_practices')
      .select(`
        id,
        title,
        description,
        status,
        upvote_count,
        view_count,
        created_at,
        published_at,
        submitter:members!best_practices_submitted_by_fkey(profile:profiles(full_name))
      `, { count: 'exact' })
      .eq('chapter_id', chapterId);

    // Apply filters
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.submitted_by) {
      query = query.eq('submitted_by', filters.submitted_by);
    }
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const bestPractices: BestPracticeListItem[] = (data || []).map((bp: any) => ({
      id: bp.id,
      title: bp.title,
      description: bp.description,
      status: bp.status,
      upvote_count: bp.upvote_count,
      view_count: bp.view_count,
      submitted_by_name: bp.submitter?.profile?.full_name || 'Unknown',
      created_at: bp.created_at,
      published_at: bp.published_at,
    }));

    return {
      data: bestPractices,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  }
);

export const getBestPracticeById = cache(
  async (practiceId: string): Promise<BestPractice | null> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('best_practices')
      .select('*')
      .eq('id', practiceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }
);

// =============================================
// TAGS
// =============================================

export const getTags = cache(
  async (chapterId: string): Promise<KnowledgeTag[]> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('knowledge_tags')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('usage_count', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  }
);

// =============================================
// ANALYTICS
// =============================================

export const getKnowledgeAnalytics = cache(
  async (chapterId: string): Promise<KnowledgeAnalytics | null> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .rpc('get_knowledge_analytics', { p_chapter_id: chapterId });

    if (error) throw error;
    return data;
  }
);
