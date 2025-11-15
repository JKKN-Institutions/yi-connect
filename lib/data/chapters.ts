/**
 * Chapter Data Fetching Layer
 *
 * Cached data fetching functions for chapters following Next.js 16 patterns.
 *
 * IMPORTANT: We don't use Next.js 16's 'use cache' directive here because
 * all functions access Supabase client which uses cookies() - a dynamic data source.
 * React's cache() would provide request-level deduplication if needed.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  ChapterListItem,
  ChapterOption,
  PaginatedChapters,
  ChapterFilters,
  ChapterSort
} from '@/types/chapter'

/**
 * Get all chapters with server-side filtering, sorting, and pagination
 *
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of items per page
 * @param filters - Filter parameters (search, region)
 * @param sort - Sort parameters (column, direction)
 * @returns Paginated chapters with member counts
 */
export async function getChapters(
  page: number = 1,
  pageSize: number = 10,
  filters?: ChapterFilters,
  sort?: ChapterSort
): Promise<PaginatedChapters> {
  const supabase = await createServerSupabaseClient()

  // Start building the query
  let query = supabase
    .from('chapters')
    .select('*', { count: 'exact' })

  // Apply search filter (searches in name and location)
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,location.ilike.%${filters.search}%`)
  }

  // Apply region filter
  if (filters?.region && filters.region.length > 0) {
    query = query.in('region', filters.region)
  }

  // Apply sorting
  if (sort) {
    query = query.order(sort.column, { ascending: sort.direction === 'asc' })
  } else {
    // Default sort by name
    query = query.order('name', { ascending: true })
  }

  // Calculate pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Apply pagination
  query = query.range(from, to)

  // Execute query
  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching chapters:', error)
    throw new Error('Failed to fetch chapters')
  }

  return {
    data: (data || []) as ChapterListItem[],
    total: count || 0,
    page,
    pageSize,
  }
}

/**
 * Get unique regions for filter dropdown
 *
 * @returns Array of unique region names
 */
export async function getUniqueRegions(): Promise<string[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('chapters')
    .select('region')
    .not('region', 'is', null)
    .order('region')

  if (error) {
    console.error('Error fetching regions:', error)
    return []
  }

  // Extract unique regions
  const uniqueRegions = Array.from(new Set(data.map(item => item.region).filter(Boolean)))
  return uniqueRegions as string[]
}

/**
 * Get all chapters (for dropdowns/selects)
 *
 * @returns Array of chapter options
 */
export async function getAllChapters(): Promise<ChapterOption[]> {
  console.log('🔍 getAllChapters: Starting to fetch chapters...')

  const supabase = await createServerSupabaseClient()
  console.log('✅ getAllChapters: Supabase client created')

  const { data, error } = await supabase
    .from('chapters')
    .select('id, name, location')
    .order('name')

  console.log('📊 getAllChapters: Query result:', {
    hasData: !!data,
    dataLength: data?.length || 0,
    hasError: !!error,
    error: error
  })

  if (error) {
    console.error('❌ Error fetching all chapters:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    throw new Error('Failed to fetch chapters')
  }

  console.log('✅ getAllChapters: Returning chapters:', data)
  return (data || []) as ChapterOption[]
}

/**
 * Get single chapter by ID
 *
 * @param id - Chapter ID
 * @returns Chapter data or null
 */
export async function getChapterById(id: string) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching chapter:', error)
    return null
  }

  return data
}

/**
 * Get chapter statistics
 *
 * @returns Chapter statistics
 */
export async function getChapterStats() {
  const supabase = await createServerSupabaseClient()

  const { count: totalChapters } = await supabase
    .from('chapters')
    .select('*', { count: 'exact', head: true })

  const { count: totalMembers } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })

  return {
    totalChapters: totalChapters || 0,
    totalMembers: totalMembers || 0,
    averageMembersPerChapter:
      totalChapters && totalMembers
        ? Math.round(totalMembers / totalChapters)
        : 0,
  }
}
