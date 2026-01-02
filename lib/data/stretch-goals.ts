/**
 * Stretch Goals Data Layer
 * Server-side data fetching functions
 */

import { createClient } from '@/lib/supabase/server'
import type {
  StretchGoal,
  StretchGoalProgress,
  StretchGoalFilters,
} from '@/types/stretch-goals'

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get stretch goals with optional filters
 */
export async function getStretchGoals(
  filters?: StretchGoalFilters
): Promise<StretchGoal[]> {
  const supabase = await createClient()

  let query = supabase
    .from('stretch_goals')
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name),
      cmp_target:cmp_targets(id, min_activities, min_participants, min_ec_participation)
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

  if (filters?.is_achieved !== undefined) {
    query = query.eq('is_achieved', filters.is_achieved)
  }

  const { data, error } = await query

  if (error) {
    // Handle case where table doesn't exist yet (migration not run)
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('Stretch goals table not found - migration may need to be run')
      return []
    }
    console.error('Error fetching stretch goals:', error)
    return []
  }

  return data as StretchGoal[]
}

/**
 * Get a single stretch goal by ID
 */
export async function getStretchGoalById(id: string): Promise<StretchGoal | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('stretch_goals')
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name),
      cmp_target:cmp_targets(id, min_activities, min_participants, min_ec_participation)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    if (error.code === '42P01') return null // Table doesn't exist
    console.error('Error fetching stretch goal:', error)
    return null
  }

  return data as StretchGoal
}

/**
 * Get stretch goal progress for all verticals
 */
export async function getStretchGoalProgress(
  filters?: StretchGoalFilters
): Promise<StretchGoalProgress[]> {
  const supabase = await createClient()

  let query = supabase
    .from('stretch_goal_progress')
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

  if (filters?.is_achieved !== undefined) {
    query = query.eq('is_achieved', filters.is_achieved)
  }

  const { data, error } = await query

  if (error) {
    // Handle case where view doesn't exist yet
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('Stretch goal progress view not found - migration may need to be run')
      return []
    }
    console.error('Error fetching stretch goal progress:', error)
    return []
  }

  return data as StretchGoalProgress[]
}

/**
 * Get stretch goals summary for dashboard
 */
export async function getStretchGoalsSummary(
  chapterId: string | null,
  fiscalYear: number
): Promise<{
  totalStretchGoals: number
  achievedCount: number
  inProgressCount: number
  progressItems: StretchGoalProgress[]
}> {
  const progress = await getStretchGoalProgress({
    chapter_id: chapterId || undefined,
    fiscal_year: fiscalYear,
  })

  const achievedCount = progress.filter((p) => p.is_achieved).length
  const inProgressCount = progress.filter(
    (p) => !p.is_achieved && p.actual_activities > 0
  ).length

  return {
    totalStretchGoals: progress.length,
    achievedCount,
    inProgressCount,
    progressItems: progress,
  }
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new stretch goal
 */
export async function createStretchGoal(
  data: Omit<StretchGoal, 'id' | 'created_at' | 'updated_at' | 'vertical' | 'chapter' | 'cmp_target' | 'is_achieved' | 'achieved_at'>
): Promise<StretchGoal> {
  const supabase = await createClient()

  const { data: goal, error } = await supabase
    .from('stretch_goals')
    .insert(data)
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name),
      cmp_target:cmp_targets(id, min_activities, min_participants, min_ec_participation)
    `)
    .single()

  if (error) {
    console.error('Error creating stretch goal:', error)
    throw new Error('Failed to create stretch goal')
  }

  return goal as StretchGoal
}

/**
 * Update a stretch goal
 */
export async function updateStretchGoal(
  id: string,
  data: Partial<StretchGoal>
): Promise<StretchGoal> {
  const supabase = await createClient()

  // If marking as achieved, set achieved_at
  if (data.is_achieved === true && !data.achieved_at) {
    data.achieved_at = new Date().toISOString()
  }

  const { data: goal, error } = await supabase
    .from('stretch_goals')
    .update(data)
    .eq('id', id)
    .select(`
      *,
      vertical:verticals(id, name, color),
      chapter:chapters(id, name),
      cmp_target:cmp_targets(id, min_activities, min_participants, min_ec_participation)
    `)
    .single()

  if (error) {
    console.error('Error updating stretch goal:', error)
    throw new Error('Failed to update stretch goal')
  }

  return goal as StretchGoal
}

/**
 * Delete a stretch goal
 */
export async function deleteStretchGoal(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from('stretch_goals').delete().eq('id', id)

  if (error) {
    console.error('Error deleting stretch goal:', error)
    throw new Error('Failed to delete stretch goal')
  }
}

/**
 * Create default stretch goals from CMP targets
 */
export async function createDefaultStretchGoals(
  fiscalYear: number,
  chapterId?: string,
  multiplier: number = 1.5
): Promise<{ count: number }> {
  const supabase = await createClient()

  // Get CMP targets for the fiscal year
  let cmpQuery = supabase
    .from('cmp_targets')
    .select('*')
    .eq('fiscal_year', fiscalYear)

  if (chapterId) {
    cmpQuery = cmpQuery.or(`chapter_id.eq.${chapterId},is_national_target.eq.true`)
  } else {
    cmpQuery = cmpQuery.eq('is_national_target', true)
  }

  const { data: cmpTargets, error: cmpError } = await cmpQuery

  if (cmpError) {
    console.error('Error fetching CMP targets:', cmpError)
    throw new Error('Failed to fetch CMP targets')
  }

  if (!cmpTargets || cmpTargets.length === 0) {
    return { count: 0 }
  }

  // Create stretch goals from CMP targets
  const stretchGoals = cmpTargets.map((cmp) => ({
    cmp_target_id: cmp.id,
    vertical_id: cmp.vertical_id,
    chapter_id: chapterId || null,
    fiscal_year: fiscalYear,
    stretch_activities: Math.ceil(cmp.min_activities * multiplier),
    stretch_participants: Math.ceil(cmp.min_participants * multiplier),
    stretch_ec_participation: Math.ceil(cmp.min_ec_participation * 2), // 2x for EC
    name: 'Stretch Goal',
  }))

  const { data, error } = await supabase
    .from('stretch_goals')
    .insert(stretchGoals)
    .select()

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      console.warn('Stretch goals already exist for this fiscal year')
      return { count: 0 }
    }
    console.error('Error creating stretch goals:', error)
    throw new Error('Failed to create stretch goals')
  }

  return { count: data?.length || 0 }
}
