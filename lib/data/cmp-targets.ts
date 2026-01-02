/**
 * CMP (Common Minimum Program) Targets Data Layer
 * Server-side data fetching functions
 */

import { createClient } from '@/lib/supabase/server'
import type { CMPTarget, CMPProgress, CMPTargetFilters } from '@/types/cmp-targets'

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get CMP targets with optional filters
 */
export async function getCMPTargets(
  filters?: CMPTargetFilters
): Promise<CMPTarget[]> {
  const supabase = await createClient()

  let query = supabase
    .from('cmp_targets')
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name)
    `)
    .order('fiscal_year', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.vertical_id) {
    query = query.eq('vertical_id', filters.vertical_id)
  }

  if (filters?.fiscal_year) {
    query = query.eq('fiscal_year', filters.fiscal_year)
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
}

/**
 * Get a single CMP target by ID
 */
export async function getCMPTargetById(id: string): Promise<CMPTarget | null> {
  const supabase = await createClient()

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
}

/**
 * Get CMP progress for all verticals
 */
export async function getCMPProgress(
  filters?: CMPTargetFilters
): Promise<CMPProgress[]> {
  const supabase = await createClient()

  let query = supabase
    .from('cmp_progress')
    .select('*')
    .order('vertical_name', { ascending: true })

  if (filters?.vertical_id) {
    query = query.eq('vertical_id', filters.vertical_id)
  }

  if (filters?.fiscal_year) {
    query = query.eq('fiscal_year', filters.fiscal_year)
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
}

/**
 * Get CMP progress summary for dashboard
 */
export async function getCMPProgressSummary(
  chapterId: string,
  fiscalYear?: number
): Promise<{
  totalTargets: number
  completedTargets: number
  inProgressTargets: number
  overallProgress: number
  verticalProgress: CMPProgress[]
}> {
  const year = fiscalYear || new Date().getFullYear()

  const progress = await getCMPProgress({
    chapter_id: chapterId,
    fiscal_year: year,
  })

  // Also get national targets for reference
  const nationalProgress = await getCMPProgress({
    is_national_target: true,
    fiscal_year: year,
  })

  // Merge: use chapter targets if available, fall back to national
  const verticalProgress = progress.length > 0 ? progress : nationalProgress

  const completedTargets = verticalProgress.filter(
    (p) => p.activity_progress_pct >= 100
  ).length

  const inProgressTargets = verticalProgress.filter(
    (p) => p.activity_progress_pct > 0 && p.activity_progress_pct < 100
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
    overallProgress: Math.min(overallProgress, 100),
    verticalProgress,
  }
}

/**
 * Check if targets exist for a fiscal year
 */
export async function hasTargetsForYear(
  fiscalYear: number,
  chapterId?: string
): Promise<boolean> {
  const supabase = await createClient()

  let query = supabase
    .from('cmp_targets')
    .select('id', { count: 'exact', head: true })
    .eq('fiscal_year', fiscalYear)

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
}

// ============================================================================
// MUTATIONS (for server actions)
// ============================================================================

/**
 * Create a new CMP target
 */
export async function createCMPTarget(
  data: Omit<CMPTarget, 'id' | 'created_at' | 'updated_at' | 'vertical' | 'chapter'>
): Promise<CMPTarget> {
  const supabase = await createClient()

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
  const supabase = await createClient()

  const { data: target, error } = await supabase
    .from('cmp_targets')
    .update(data)
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
  const supabase = await createClient()

  const { error } = await supabase.from('cmp_targets').delete().eq('id', id)

  if (error) {
    console.error('Error deleting CMP target:', error)
    throw new Error('Failed to delete CMP target')
  }
}
