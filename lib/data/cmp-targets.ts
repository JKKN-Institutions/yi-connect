// ================================================
// CMP (Common Minimum Program) Targets Data Layer
// ================================================
// Cached data fetching functions for CMP targets module
// Uses React cache() for request-level deduplication
// Note: Not using Next.js 'use cache' directive because Supabase uses cookies (dynamic data source)
// ================================================

import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  CMPTarget,
  CMPProgress,
  CMPTargetFilters,
  CreateCMPTargetInput,
} from '@/types/cmp-targets'

// ================================================
// CMP TARGET QUERIES
// ================================================

/**
 * Get paginated list of CMP targets with filters
 * Used in CMP targets listing pages
 * If chapterId is null, fetches all targets (for super admins)
 */
export const getCMPTargets = cache(async (
  chapterId: string | null,
  filters?: CMPTargetFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<{
  data: CMPTarget[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('cmp_targets')
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name)
    `, { count: 'exact' })

  // Filter by chapter only if chapterId is provided (regular members)
  // Super admins without chapterId see all targets
  if (chapterId) {
    query = query.or(`chapter_id.eq.${chapterId},is_national_target.eq.true`)
  }

  // Apply filters
  if (filters?.vertical_id) {
    query = query.eq('vertical_id', filters.vertical_id)
  }

  if (filters?.calendar_year) {
    query = query.eq('calendar_year', filters.calendar_year)
  }

  if (filters?.chapter_id) {
    query = query.eq('chapter_id', filters.chapter_id)
  }

  if (filters?.is_national_target !== undefined) {
    query = query.eq('is_national_target', filters.is_national_target)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  // Sorting
  query = query
    .order('calendar_year', { ascending: false })
    .order('created_at', { ascending: false })

  const { data, error, count } = await query

  if (error) {
    // Handle case where table doesn't exist yet (migration not run)
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('CMP targets table not found - migration may need to be run')
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }
    console.error('Error fetching CMP targets:', error)
    throw new Error('Failed to fetch CMP targets')
  }

  return {
    data: (data as CMPTarget[]) || [],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
})

/**
 * Get all CMP targets without pagination (for dropdowns, etc.)
 */
export const getAllCMPTargets = cache(async (
  filters?: CMPTargetFilters
): Promise<CMPTarget[]> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('cmp_targets')
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name)
    `)
    .order('calendar_year', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.vertical_id) {
    query = query.eq('vertical_id', filters.vertical_id)
  }

  if (filters?.calendar_year) {
    query = query.eq('calendar_year', filters.calendar_year)
  }

  if (filters?.chapter_id) {
    query = query.eq('chapter_id', filters.chapter_id)
  }

  if (filters?.is_national_target !== undefined) {
    query = query.eq('is_national_target', filters.is_national_target)
  }

  const { data, error } = await query

  if (error) {
    // Handle case where table doesn't exist yet (migration not run)
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('CMP targets table not found - migration may need to be run')
      return []
    }
    console.error('Error fetching CMP targets:', error)
    return [] // Return empty instead of throwing to prevent page crash
  }

  return data as CMPTarget[]
})

/**
 * Get a single CMP target by ID
 */
export const getCMPTargetById = cache(async (id: string): Promise<CMPTarget | null> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('cmp_targets')
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    console.error('Error fetching CMP target:', error)
    throw new Error('Failed to fetch CMP target')
  }

  return data as CMPTarget
})

/**
 * Get CMP targets by vertical (category)
 * Useful for filtering targets by specific program areas
 */
export const getCMPTargetsByVertical = cache(async (
  verticalId: string,
  calendarYear?: number
): Promise<CMPTarget[]> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('cmp_targets')
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name)
    `)
    .eq('vertical_id', verticalId)
    .order('calendar_year', { ascending: false })

  if (calendarYear) {
    query = query.eq('calendar_year', calendarYear)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('CMP targets table not found - migration may need to be run')
      return []
    }
    console.error('Error fetching CMP targets by vertical:', error)
    return []
  }

  return data as CMPTarget[]
})

// ================================================
// CMP PROGRESS QUERIES
// ================================================

/**
 * Get CMP progress for a chapter and calendar year
 * This uses the cmp_progress view which joins targets with health_card_entries
 */
export const getCMPProgress = cache(async (
  chapterId: string | null,
  calendarYear?: number
): Promise<CMPProgress[]> => {
  const supabase = await createServerSupabaseClient()

  const year = calendarYear || new Date().getFullYear()

  let query = supabase
    .from('cmp_progress')
    .select('*')
    .eq('calendar_year', year)
    .order('vertical_name', { ascending: true })

  // Filter by chapter if provided
  if (chapterId) {
    query = query.or(`chapter_id.eq.${chapterId},is_national_target.eq.true`)
  }

  const { data, error } = await query

  if (error) {
    // Handle case where view doesn't exist yet (migration not run)
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('CMP progress view not found - migration may need to be run')
      return []
    }
    console.error('Error fetching CMP progress:', error)
    return [] // Return empty instead of throwing to prevent page crash
  }

  return data as CMPProgress[]
})

/**
 * Get CMP progress with filters
 */
export const getCMPProgressFiltered = cache(async (
  filters?: CMPTargetFilters
): Promise<CMPProgress[]> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('cmp_progress')
    .select('*')
    .order('vertical_name', { ascending: true })

  if (filters?.vertical_id) {
    query = query.eq('vertical_id', filters.vertical_id)
  }

  if (filters?.calendar_year) {
    query = query.eq('calendar_year', filters.calendar_year)
  }

  if (filters?.chapter_id) {
    query = query.eq('chapter_id', filters.chapter_id)
  }

  if (filters?.is_national_target !== undefined) {
    query = query.eq('is_national_target', filters.is_national_target)
  }

  const { data, error } = await query

  if (error) {
    // Handle case where view doesn't exist yet (migration not run)
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('CMP progress view not found - migration may need to be run')
      return []
    }
    console.error('Error fetching CMP progress:', error)
    return [] // Return empty instead of throwing to prevent page crash
  }

  return data as CMPProgress[]
})

/**
 * Get CMP progress summary for dashboard
 */
export const getCMPProgressSummary = cache(async (
  chapterId: string | null,
  calendarYear?: number
): Promise<{
  totalTargets: number
  completedTargets: number
  inProgressTargets: number
  notStartedTargets: number
  overallProgress: number
  verticalProgress: CMPProgress[]
}> => {
  const year = calendarYear || new Date().getFullYear()

  const progress = await getCMPProgress(chapterId, year)

  // Also get national targets for reference if chapter has none
  let verticalProgress = progress
  if (progress.length === 0 && chapterId) {
    verticalProgress = await getCMPProgress(null, year)
  }

  const completedTargets = verticalProgress.filter(
    (p) => p.activity_progress_pct >= 100
  ).length

  const inProgressTargets = verticalProgress.filter(
    (p) => p.activity_progress_pct > 0 && p.activity_progress_pct < 100
  ).length

  const notStartedTargets = verticalProgress.filter(
    (p) => p.activity_progress_pct === 0 || p.actual_activities === 0
  ).length

  const overallProgress =
    verticalProgress.length > 0
      ? Math.round(
          verticalProgress.reduce((sum, p) => sum + p.activity_progress_pct, 0) /
            verticalProgress.length
        )
      : 0

  return {
    totalTargets: verticalProgress.length,
    completedTargets,
    inProgressTargets,
    notStartedTargets,
    overallProgress: Math.min(overallProgress, 100),
    verticalProgress,
  }
})

/**
 * Check if targets exist for a calendar year
 */
export const hasTargetsForYear = cache(async (
  calendarYear: number,
  chapterId?: string
): Promise<boolean> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('cmp_targets')
    .select('id', { count: 'exact', head: true })
    .eq('calendar_year', calendarYear)

  if (chapterId) {
    query = query.or(`chapter_id.eq.${chapterId},is_national_target.eq.true`)
  } else {
    query = query.eq('is_national_target', true)
  }

  const { count, error } = await query

  if (error) {
    console.error('Error checking targets:', error)
    return false
  }

  return (count || 0) > 0
})

/**
 * Get verticals for CMP target dropdown
 */
export const getVerticalsForCMPTargets = cache(async (): Promise<{
  id: string
  name: string
  color: string | null
}[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('verticals')
    .select('id, name, color')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error fetching verticals:', error)
    return []
  }

  return data || []
})

// ================================================
// MUTATIONS (for server actions)
// ================================================

/**
 * Create a new CMP target
 */
export async function createCMPTarget(
  data: Omit<CMPTarget, 'id' | 'created_at' | 'updated_at' | 'vertical' | 'chapter'>
): Promise<CMPTarget> {
  const supabase = await createServerSupabaseClient()

  const { data: target, error } = await supabase
    .from('cmp_targets')
    .insert(data)
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name)
    `)
    .single()

  if (error) {
    console.error('Error creating CMP target:', error)
    if (error.code === '23505') {
      throw new Error('A target already exists for this vertical and calendar year')
    }
    throw new Error('Failed to create CMP target')
  }

  return target as CMPTarget
}

/**
 * Update a CMP target
 */
export async function updateCMPTarget(
  id: string,
  data: Partial<CMPTarget>
): Promise<CMPTarget> {
  const supabase = await createServerSupabaseClient()

  // Remove joined fields if present
  const { vertical, chapter, ...updateData } = data as CMPTarget & {
    vertical?: unknown
    chapter?: unknown
  }

  const { data: target, error } = await supabase
    .from('cmp_targets')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name)
    `)
    .single()

  if (error) {
    console.error('Error updating CMP target:', error)
    throw new Error('Failed to update CMP target')
  }

  return target as CMPTarget
}

/**
 * Delete a CMP target
 */
export async function deleteCMPTarget(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.from('cmp_targets').delete().eq('id', id)

  if (error) {
    console.error('Error deleting CMP target:', error)
    throw new Error('Failed to delete CMP target')
  }
}

/**
 * Create default CMP targets for all verticals
 */
export async function createDefaultCMPTargets(
  calendarYear: number,
  chapterId?: string,
  createdBy?: string
): Promise<{ count: number }> {
  const supabase = await createServerSupabaseClient()

  // Get all active verticals
  const { data: verticals, error: verticalError } = await supabase
    .from('verticals')
    .select('id, name')
    .eq('is_active', true)

  if (verticalError || !verticals || verticals.length === 0) {
    throw new Error('Failed to fetch verticals or no active verticals found')
  }

  // Default targets based on Yi guidelines
  const defaultTargets = verticals.map((v) => ({
    vertical_id: v.id,
    calendar_year: calendarYear,
    min_activities: 4, // 1 per quarter
    min_participants: 50,
    min_ec_participation: 10,
    min_awareness_activities: 1,
    min_action_activities: 2,
    min_advocacy_activities: 1,
    chapter_id: chapterId || null,
    is_national_target: !chapterId,
    created_by: createdBy || null,
    description: `Default CMP target for ${v.name}`,
  }))

  // Insert all targets (upsert to handle duplicates)
  const { data, error } = await supabase
    .from('cmp_targets')
    .upsert(defaultTargets, {
      onConflict: 'vertical_id,calendar_year,chapter_id,is_national_target',
      ignoreDuplicates: false,
    })
    .select()

  if (error) {
    console.error('Error creating default targets:', error)
    throw new Error('Failed to create default targets')
  }

  return { count: data?.length || 0 }
}

/**
 * Copy CMP targets from one year to another
 */
export async function copyCMPTargetsToYear(
  sourceYear: number,
  targetYear: number,
  chapterId?: string,
  createdBy?: string
): Promise<{ count: number }> {
  const supabase = await createServerSupabaseClient()

  // Get existing targets for source year
  let query = supabase
    .from('cmp_targets')
    .select('*')
    .eq('calendar_year', sourceYear)

  if (chapterId) {
    query = query.or(`chapter_id.eq.${chapterId},is_national_target.eq.true`)
  }

  const { data: sourceTargets, error: fetchError } = await query

  if (fetchError || !sourceTargets || sourceTargets.length === 0) {
    throw new Error('No targets found for source year')
  }

  // Create new targets for target year
  const newTargets = sourceTargets.map((t) => ({
    vertical_id: t.vertical_id,
    calendar_year: targetYear,
    min_activities: t.min_activities,
    min_participants: t.min_participants,
    min_ec_participation: t.min_ec_participation,
    min_awareness_activities: t.min_awareness_activities,
    min_action_activities: t.min_action_activities,
    min_advocacy_activities: t.min_advocacy_activities,
    chapter_id: chapterId || t.chapter_id,
    is_national_target: chapterId ? false : t.is_national_target,
    created_by: createdBy || null,
    description: t.description,
  }))

  const { data, error } = await supabase
    .from('cmp_targets')
    .upsert(newTargets, {
      onConflict: 'vertical_id,calendar_year,chapter_id,is_national_target',
      ignoreDuplicates: false,
    })
    .select()

  if (error) {
    console.error('Error copying targets:', error)
    throw new Error('Failed to copy targets to new year')
  }

  return { count: data?.length || 0 }
}
