// ============================================================================
// Module 6: Take Pride Award Automation - Data Layer
// Description: Cached data fetching functions with Next.js 16 patterns
// ============================================================================

import { cache } from 'react'
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  AwardCategory,
  AwardCycle,
  AwardCycleWithDetails,
  Nomination,
  NominationWithDetails,
  JuryMember,
  JuryMemberWithDetails,
  JuryScore,
  AwardWinner,
  AwardWinnerWithDetails,
  AwardCategoryFilters,
  AwardCycleFilters,
  NominationFilters,
  NominationScoreCalculation,
  RankedNomination,
  EligibilityCheck,
  LeaderboardEntry,
  AwardStatistics,
  CycleStatistics,
} from '@/types/award'

// ============================================================================
// AWARD CATEGORIES
// ============================================================================

/**
 * Get all award categories with optional filtering
 */
export const getAwardCategories = cache(async (filters?: AwardCategoryFilters) => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('award_categories')
    .select('*', { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (filters?.chapter_id) {
    query = query.eq('chapter_id', filters.chapter_id)
  }

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  }

  if (filters?.frequency) {
    query = query.eq('frequency', filters.frequency)
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return { data: (data || []) as AwardCategory[], total: count || 0 }
})

/**
 * Get single award category by ID
 */
export const getAwardCategoryById = cache(async (id: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('award_categories')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as AwardCategory
})

// ============================================================================
// AWARD CYCLES
// ============================================================================

/**
 * Get all award cycles with optional filtering
 */
export const getAwardCycles = cache(async (filters?: AwardCycleFilters) => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('award_cycles')
    .select(`
      *,
      category:award_categories(*)
    `, { count: 'exact' })
    .order('year', { ascending: false })
    .order('start_date', { ascending: false })

  if (filters?.category_id) {
    query = query.eq('category_id', filters.category_id)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.year) {
    query = query.eq('year', filters.year)
  }

  if (filters?.search) {
    query = query.or(`cycle_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return { data: (data || []) as AwardCycle[], total: count || 0 }
})

/**
 * Get single award cycle by ID with details
 */
export const getAwardCycleById = cache(async (id: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('award_cycles')
    .select(`
      *,
      category:award_categories(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  return data as AwardCycle
})

/**
 * Get active/open award cycles
 */
export const getActiveCycles = cache(async () => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('award_cycles')
    .select(`
      *,
      category:award_categories(*)
    `)
    .eq('status', 'open')
    .order('nomination_deadline', { ascending: true })

  if (error) throw error

  return (data || []) as AwardCycle[]
})

// ============================================================================
// NOMINATIONS
// ============================================================================

/**
 * Get all nominations with optional filtering
 */
export const getNominations = cache(async (filters?: NominationFilters) => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles(
        *,
        category:award_categories(*)
      ),
      nominee:members!nominations_nominee_id_fkey(
        id,
        full_name,
        avatar_url,
        company,
        designation
      ),
      nominator:members!nominations_nominator_id_fkey(
        id,
        full_name,
        avatar_url
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters?.cycle_id) {
    query = query.eq('cycle_id', filters.cycle_id)
  }

  if (filters?.nominee_id) {
    query = query.eq('nominee_id', filters.nominee_id)
  }

  if (filters?.nominator_id) {
    query = query.eq('nominator_id', filters.nominator_id)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.search) {
    query = query.or(`justification.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return { data: (data || []) as NominationWithDetails[], total: count || 0 }
})

/**
 * Get single nomination by ID with full details
 */
export const getNominationById = cache(async (id: string) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles(
        *,
        category:award_categories(*)
      ),
      nominee:members!nominations_nominee_id_fkey(
        id,
        full_name,
        avatar_url,
        company,
        designation
      ),
      nominator:members!nominations_nominator_id_fkey(
        id,
        full_name,
        avatar_url
      ),
      jury_scores:jury_scores(
        *,
        jury_member:jury_members(
          *,
          member:members(id, full_name, avatar_url)
        )
      ),
      winner:award_winners(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  return data as NominationWithDetails
})

/**
 * Get my nominations (as nominator)
 */
export const getMyNominations = cache(async (memberId: string) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles(
        *,
        category:award_categories(*)
      ),
      nominee:members!nominations_nominee_id_fkey(
        id,
        full_name,
        avatar_url,
        company,
        designation
      )
    `)
    .eq('nominator_id', memberId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []) as NominationWithDetails[]
})

// ============================================================================
// JURY MEMBERS & SCORES
// ============================================================================

/**
 * Get jury members for a cycle
 */
export const getJuryMembers = cache(async (cycleId: string) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('jury_members')
    .select(`
      *,
      member:members(
        id,
        full_name,
        avatar_url,
        company,
        designation
      )
    `)
    .eq('cycle_id', cycleId)
    .order('assigned_at', { ascending: true })

  if (error) throw error

  return (data || []) as JuryMemberWithDetails[]
})

/**
 * Get jury member's assignments
 */
export const getMyJuryAssignments = cache(async (memberId: string) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('jury_members')
    .select(`
      *,
      cycle:award_cycles(
        *,
        category:award_categories(*)
      )
    `)
    .eq('member_id', memberId)
    .is('completed_at', null)
    .order('assigned_at', { ascending: false })

  if (error) throw error

  return (data || []) as JuryMemberWithDetails[]
})

/**
 * Get jury scores for a nomination
 */
export const getJuryScores = cache(async (nominationId: string) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('jury_scores')
    .select(`
      *,
      jury_member:jury_members(
        *,
        member:members(id, full_name, avatar_url)
      )
    `)
    .eq('nomination_id', nominationId)
    .order('scored_at', { ascending: false })

  if (error) throw error

  return (data || []) as JuryScore[]
})

/**
 * Get nominations assigned to a jury member for scoring
 */
export const getNominationsForJury = cache(async (juryMemberId: string) => {

  const supabase = await createServerSupabaseClient()

  // Get the cycle for this jury member
  const { data: juryMember, error: juryError } = await supabase
    .from('jury_members')
    .select('cycle_id')
    .eq('id', juryMemberId)
    .single()

  if (juryError) throw juryError

  // Get all nominations for this cycle with jury score status
  const { data, error } = await supabase
    .from('nominations')
    .select(`
      *,
      nominee:members!nominations_nominee_id_fkey(
        id,
        full_name,
        avatar_url,
        company,
        designation
      ),
      jury_scores!left(
        id,
        weighted_score,
        scored_at
      )
    `)
    .eq('cycle_id', juryMember.cycle_id)
    .in('status', ['submitted', 'under_review', 'verified'])

  if (error) throw error

  return (data || []) as NominationWithDetails[]
})

// ============================================================================
// AWARD WINNERS
// ============================================================================

/**
 * Get winners for a cycle
 */
export const getWinnersByCycle = cache(async (cycleId: string) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('award_winners')
    .select(`
      *,
      nomination:nominations(
        *,
        nominee:members!nominations_nominee_id_fkey(
          id,
          full_name,
          avatar_url,
          company,
          designation
        )
      )
    `)
    .eq('cycle_id', cycleId)
    .order('rank', { ascending: true })

  if (error) throw error

  return (data || []) as AwardWinnerWithDetails[]
})

/**
 * Get all announced winners
 */
export const getAnnouncedWinners = cache(async (limit = 20) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('award_winners')
    .select(`
      *,
      cycle:award_cycles(
        *,
        category:award_categories(*)
      ),
      nomination:nominations(
        *,
        nominee:members!nominations_nominee_id_fkey(
          id,
          full_name,
          avatar_url,
          company,
          designation
        )
      )
    `)
    .not('announced_at', 'is', null)
    .order('announced_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data || []) as AwardWinnerWithDetails[]
})

// ============================================================================
// DATABASE FUNCTIONS (ADVANCED QUERIES)
// ============================================================================

/**
 * Calculate nomination score using database function
 */
export const calculateNominationScore = cache(async (nominationId: string) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .rpc('calculate_nomination_score', { p_nomination_id: nominationId })

  if (error) throw error

  return data[0] as NominationScoreCalculation
})

/**
 * Get ranked nominations for a cycle
 */
export const getRankedNominations = cache(async (cycleId: string) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .rpc('rank_nominations_by_cycle', { p_cycle_id: cycleId })

  if (error) throw error

  return (data || []) as RankedNomination[]
})

/**
 * Check if a member is eligible for nomination in a cycle
 */
export const checkEligibility = cache(async (memberId: string, cycleId: string) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .rpc('check_nomination_eligibility', {
      p_member_id: memberId,
      p_cycle_id: cycleId,
    })

  if (error) throw error

  return data[0] as EligibilityCheck
})

/**
 * Get leaderboard data for a category
 */
export const getLeaderboard = cache(async (categoryId: string, year?: number) => {

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .rpc('get_leaderboard_data', {
      p_category_id: categoryId,
      p_year: year || null,
    })

  if (error) throw error

  return (data || []) as LeaderboardEntry[]
})

// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

/**
 * Get overall award statistics
 */
export const getAwardStatistics = cache(async (chapterId: string) => {

  const supabase = await createServerSupabaseClient()

  // Parallel queries for better performance
  const [categoriesResult, cyclesResult, nominationsResult, winnersResult] = await Promise.all([
    supabase.from('award_categories').select('id', { count: 'exact', head: true }).eq('chapter_id', chapterId),
    supabase.from('award_cycles').select('id', { count: 'exact', head: true }),
    supabase.from('nominations').select('id', { count: 'exact', head: true }),
    supabase.from('award_winners').select('id', { count: 'exact', head: true }),
  ])

  const activeCyclesResult = await supabase
    .from('award_cycles')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'nominations_closed', 'judging', 'review'])

  const pendingNominationsResult = await supabase
    .from('nominations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted')

  return {
    total_categories: categoriesResult.count || 0,
    total_cycles: cyclesResult.count || 0,
    total_nominations: nominationsResult.count || 0,
    total_winners: winnersResult.count || 0,
    active_cycles: activeCyclesResult.count || 0,
    pending_nominations: pendingNominationsResult.count || 0,
    pending_jury_scores: 0, // Calculated separately if needed
  } as AwardStatistics
})

/**
 * Get statistics for a specific cycle
 */
export const getCycleStatistics = cache(async (cycleId: string) => {

  const supabase = await createServerSupabaseClient()

  const [nominationsResult, juryMembersResult, juryScoresResult] = await Promise.all([
    supabase.from('nominations').select('id', { count: 'exact', head: true }).eq('cycle_id', cycleId),
    supabase.from('jury_members').select('id', { count: 'exact', head: true }).eq('cycle_id', cycleId),
    supabase.from('jury_scores').select('weighted_score').eq('nomination_id', cycleId), // Fix: need proper join
  ])

  const scores = juryScoresResult.data?.map(s => s.weighted_score) || []
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

  return {
    total_nominations: nominationsResult.count || 0,
    total_jury_members: juryMembersResult.count || 0,
    total_jury_scores: scores.length,
    jury_completion_rate: 0, // Calculate if needed
    average_score: avgScore,
    highest_score: scores.length > 0 ? Math.max(...scores) : 0,
    lowest_score: scores.length > 0 ? Math.min(...scores) : 0,
  } as CycleStatistics
})
