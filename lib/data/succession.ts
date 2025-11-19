// ============================================================================
// MODULE 5: SUCCESSION & LEADERSHIP PIPELINE - DATA LAYER
// ============================================================================
// Server-side data fetching functions with React cache() for request deduplication
// All functions query Supabase with proper error handling and return typed data
// ============================================================================

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type {
  SuccessionCycle,
  SuccessionCycleWithPositions,
  SuccessionPosition,
  SuccessionCycleFilters,
} from '@/lib/types/succession'

// ============================================================================
// CYCLE FUNCTIONS
// ============================================================================

/**
 * Get all succession cycles with optional filtering
 * Cached at request level to prevent duplicate queries
 */
export const getSuccessionCycles = cache(
  async (filters?: SuccessionCycleFilters): Promise<SuccessionCycle[]> => {
    const supabase = await createClient()

    let query = supabase
      .from('succession_cycles')
      .select('*')
      .order('year', { ascending: false })
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status)
      } else {
        query = query.eq('status', filters.status)
      }
    }

    if (filters?.year) {
      query = query.eq('year', filters.year)
    }

    if (filters?.search) {
      query = query.or(
        `cycle_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching succession cycles:', error)
      throw new Error('Failed to fetch succession cycles')
    }

    return data || []
  }
)

/**
 * Get a single succession cycle by ID with full details
 * Cached at request level
 */
export const getSuccessionCycleById = cache(
  async (id: string): Promise<SuccessionCycle | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('succession_cycles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      console.error('Error fetching succession cycle:', error)
      throw new Error('Failed to fetch succession cycle')
    }

    return data
  }
)

/**
 * Get the currently active succession cycle
 * Returns the cycle with status in active nomination/application phases
 * Cached at request level
 */
export const getCurrentActiveCycle = cache(
  async (): Promise<SuccessionCycle | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('succession_cycles')
      .select('*')
      .in('status', [
        'active',
        'nominations_open',
        'applications_open',
        'evaluations',
        'interviews',
        'selection',
      ])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No active cycle found
        return null
      }
      console.error('Error fetching active cycle:', error)
      throw new Error('Failed to fetch active cycle')
    }

    return data
  }
)

/**
 * Get a succession cycle with all its positions and counts
 * Cached at request level
 */
export const getSuccessionCycleWithPositions = cache(
  async (id: string): Promise<SuccessionCycleWithPositions | null> => {
    const supabase = await createClient()

    // Get cycle
    const { data: cycle, error: cycleError } = await supabase
      .from('succession_cycles')
      .select('*')
      .eq('id', id)
      .single()

    if (cycleError) {
      if (cycleError.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching cycle:', cycleError)
      throw new Error('Failed to fetch cycle')
    }

    // Get positions
    const { data: positions, error: positionsError } = await supabase
      .from('succession_positions')
      .select('*')
      .eq('cycle_id', id)
      .eq('is_active', true)
      .order('hierarchy_level', { ascending: true })

    if (positionsError) {
      console.error('Error fetching positions:', positionsError)
      throw new Error('Failed to fetch positions')
    }

    // Get counts
    const { count: nominationCount } = await supabase
      .from('succession_nominations')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', id)

    const { count: applicationCount } = await supabase
      .from('succession_applications')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', id)

    return {
      ...cycle,
      positions: positions || [],
      position_count: positions?.length || 0,
      nomination_count: nominationCount || 0,
      application_count: applicationCount || 0,
    }
  }
)

// ============================================================================
// POSITION FUNCTIONS
// ============================================================================

/**
 * Get all succession positions, optionally filtered by cycle
 * Cached at request level
 */
export const getSuccessionPositions = cache(
  async (cycleId?: string): Promise<SuccessionPosition[]> => {
    const supabase = await createClient()

    let query = supabase
      .from('succession_positions')
      .select('*')
      .eq('is_active', true)
      .order('hierarchy_level', { ascending: true })

    if (cycleId) {
      query = query.eq('cycle_id', cycleId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching succession positions:', error)
      throw new Error('Failed to fetch succession positions')
    }

    return data || []
  }
)

/**
 * Get a single succession position by ID with full details
 * Cached at request level
 */
export const getPositionById = cache(
  async (id: string): Promise<SuccessionPosition | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('succession_positions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching position:', error)
      throw new Error('Failed to fetch position')
    }

    return data
  }
)

// ============================================================================
// ELIGIBILITY FUNCTIONS
// ============================================================================

/**
 * Calculate a member's eligibility for a position
 * Returns eligibility status, score, and breakdown
 */
export const calculateMemberEligibility = cache(
  async (
    memberId: string,
    positionId: string
  ): Promise<{
    is_eligible: boolean
    total_score: number
    breakdown: any
  } | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('calculate_member_eligibility', {
      p_member_id: memberId,
      p_position_id: positionId,
    })

    if (error) {
      console.error('Error calculating eligibility:', error)
      return null
    }

    return data?.[0] || null
  }
)

/**
 * Get eligibility records for a member in a specific cycle
 * Cached at request level
 */
export const getMemberEligibilityForCycle = cache(
  async (memberId: string, cycleId: string) => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('succession_eligibility_records')
      .select(
        `
        *,
        position:succession_positions (
          id,
          title,
          description,
          hierarchy_level,
          number_of_openings
        )
      `
      )
      .eq('member_id', memberId)
      .eq('cycle_id', cycleId)
      .eq('is_eligible', true)
      .order('eligibility_score', { ascending: false })

    if (error) {
      console.error('Error fetching member eligibility:', error)
      throw new Error('Failed to fetch member eligibility')
    }

    return data || []
  }
)

/**
 * Get all eligible members for a position
 * Cached at request level
 */
export const getEligibleMembersForPosition = cache(
  async (positionId: string) => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('succession_eligibility_records')
      .select(
        `
        *,
        member:members (
          id,
          first_name,
          last_name,
          email,
          phone,
          avatar_url
        )
      `
      )
      .eq('position_id', positionId)
      .eq('is_eligible', true)
      .order('eligibility_score', { ascending: false })

    if (error) {
      console.error('Error fetching eligible members:', error)
      throw new Error('Failed to fetch eligible members')
    }

    return data || []
  }
)

/**
 * Bulk calculate eligibility for all members in a cycle
 * Server action should call this via RPC
 */
export const bulkCalculateCycleEligibility = async (
  cycleId: string
): Promise<number> => {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('bulk_calculate_cycle_eligibility', {
    p_cycle_id: cycleId,
  })

  if (error) {
    console.error('Error bulk calculating eligibility:', error)
    throw new Error('Failed to bulk calculate eligibility')
  }

  return data || 0
}

// ============================================================================
// NOMINATION FUNCTIONS
// ============================================================================

/**
 * Get all nominations for a cycle with filters
 * Cached at request level
 */
export const getNominations = cache(
  async (cycleId?: string, statusFilter?: string[]) => {
    const supabase = await createClient()

    let query = supabase
      .from('succession_nominations')
      .select(
        `
        *,
        nominee:members!succession_nominations_nominee_id_fkey (
          id,
          first_name,
          last_name,
          email,
          avatar_url
        ),
        nominator:members!succession_nominations_nominated_by_id_fkey (
          id,
          first_name,
          last_name
        ),
        position:succession_positions (
          id,
          title,
          hierarchy_level
        ),
        cycle:succession_cycles (
          id,
          cycle_name,
          year
        )
      `
      )
      .order('created_at', { ascending: false })

    if (cycleId) {
      query = query.eq('cycle_id', cycleId)
    }

    if (statusFilter && statusFilter.length > 0) {
      query = query.in('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching nominations:', error)
      throw new Error('Failed to fetch nominations')
    }

    return data || []
  }
)

/**
 * Get a single nomination by ID with full details
 * Cached at request level
 */
export const getNominationById = cache(async (id: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_nominations')
    .select(
      `
      *,
      nominee:members!succession_nominations_nominee_id_fkey (
        id,
        first_name,
        last_name,
        email,
        phone,
        avatar_url
      ),
      nominator:members!succession_nominations_nominated_by_id_fkey (
        id,
        first_name,
        last_name,
        email
      ),
      position:succession_positions (
        id,
        title,
        description,
        hierarchy_level,
        eligibility_criteria
      ),
      cycle:succession_cycles (
        id,
        cycle_name,
        year,
        status
      ),
      reviewed_by:members!succession_nominations_reviewed_by_id_fkey (
        first_name,
        last_name
      )
    `
    )
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching nomination:', error)
    throw new Error('Failed to fetch nomination')
  }

  return data
})

/**
 * Get nominations by the current user
 * Cached at request level
 */
export const getMyNominations = cache(async () => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('succession_nominations')
    .select(
      `
      *,
      nominee:members!succession_nominations_nominee_id_fkey (
        first_name,
        last_name,
        email
      ),
      position:succession_positions (
        title,
        hierarchy_level
      ),
      cycle:succession_cycles (
        cycle_name,
        year
      )
    `
    )
    .eq('nominated_by_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching my nominations:', error)
    throw new Error('Failed to fetch nominations')
  }

  return data || []
})

/**
 * Get nominations where current user is the nominee
 * Cached at request level
 */
export const getNominationsForMe = cache(async () => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('succession_nominations')
    .select(
      `
      *,
      nominator:members!succession_nominations_nominated_by_id_fkey (
        first_name,
        last_name
      ),
      position:succession_positions (
        title,
        hierarchy_level
      ),
      cycle:succession_cycles (
        cycle_name,
        year
      )
    `
    )
    .eq('nominee_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching nominations for me:', error)
    throw new Error('Failed to fetch nominations')
  }

  return data || []
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a member is a succession admin
 * Admins have access to all succession management features
 */
export const isSuccessionAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data, error } = await supabase.rpc('is_succession_admin')

  if (error) {
    console.error('Error checking admin status:', error)
    return false
  }

  return data || false
})

/**
 * Check if a member is on the selection committee for a cycle
 */
export const isSelectionCommittee = cache(
  async (cycleId: string): Promise<boolean> => {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const { data, error } = await supabase.rpc('is_succession_committee', {
      p_cycle_id: cycleId,
    })

    if (error) {
      console.error('Error checking committee status:', error)
      return false
    }

    return data || false
  }
)

/**
 * Check if a member is an evaluator for a cycle
 */
export const isSuccessionEvaluator = cache(
  async (cycleId: string): Promise<boolean> => {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const { data, error } = await supabase.rpc('is_succession_evaluator', {
      p_cycle_id: cycleId,
    })

    if (error) {
      console.error('Error checking evaluator status:', error)
      return false
    }

    return data || false
  }
)

// ============================================================================
// APPLICATION DATA LAYER
// ============================================================================

/**
 * Get all applications (optionally filtered)
 */
export const getApplications = cache(
  async (cycleId?: string, statusFilter?: string[]) => {
    const supabase = await createClient()

    let query = supabase
      .from('succession_applications')
      .select(`
        *,
        applicant:members!succession_applications_member_id_fkey (
          id,
          first_name,
          last_name,
          email,
          avatar_url
        ),
        position:succession_positions (
          id,
          title,
          hierarchy_level
        ),
        cycle:succession_cycles (
          id,
          cycle_name,
          year
        )
      `)
      .order('created_at', { ascending: false })

    if (cycleId) {
      query = query.eq('cycle_id', cycleId)
    }

    if (statusFilter && statusFilter.length > 0) {
      query = query.in('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching applications:', error)
      throw new Error('Failed to fetch applications')
    }

    return data || []
  }
)

/**
 * Get application by ID
 */
export const getApplicationById = cache(async (id: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_applications')
    .select(`
      *,
      applicant:members!succession_applications_member_id_fkey (
        id,
        first_name,
        last_name,
        email,
        avatar_url,
        phone,
        designation,
        company
      ),
      position:succession_positions (
        id,
        title,
        description,
        hierarchy_level,
        number_of_openings,
        eligibility_criteria
      ),
      cycle:succession_cycles (
        id,
        cycle_name,
        year,
        status
      ),
      reviewed_by:members!succession_applications_reviewed_by_id_fkey (
        id,
        first_name,
        last_name
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching application:', error)
    throw new Error('Failed to fetch application')
  }

  return data
})

/**
 * Get my applications (as applicant)
 */
export const getMyApplications = cache(async () => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('succession_applications')
    .select(`
      *,
      position:succession_positions (
        id,
        title,
        hierarchy_level
      ),
      cycle:succession_cycles (
        id,
        cycle_name,
        year,
        status
      )
    `)
    .eq('member_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching my applications:', error)
    throw new Error('Failed to fetch applications')
  }

  return data || []
})

/**
 * Get applications for a specific position
 */
export const getApplicationsForPosition = cache(
  async (positionId: string) => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('succession_applications')
      .select(`
        *,
        applicant:members!succession_applications_member_id_fkey (
          id,
          first_name,
          last_name,
          email,
          avatar_url
        )
      `)
      .eq('position_id', positionId)
      .in('status', ['submitted', 'under_review'])
      .order('submitted_at', { ascending: false })

    if (error) {
      console.error('Error fetching position applications:', error)
      throw new Error('Failed to fetch applications')
    }

    return data || []
  }
)

// ============================================================================
// EVALUATION CRITERIA DATA LAYER
// ============================================================================

/**
 * Get evaluation criteria for a position
 */
export const getEvaluationCriteria = cache(async (positionId: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_evaluation_criteria')
    .select('*')
    .eq('position_id', positionId)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('Error fetching evaluation criteria:', error)
    throw new Error('Failed to fetch evaluation criteria')
  }

  return data || []
})

/**
 * Get evaluation criteria by ID
 */
export const getEvaluationCriteriaById = cache(async (id: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_evaluation_criteria')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching evaluation criteria:', error)
    throw new Error('Failed to fetch evaluation criteria')
  }

  return data
})

// ============================================================================
// EVALUATOR DATA LAYER
// ============================================================================

/**
 * Get evaluators for a cycle
 */
export const getEvaluators = cache(async (cycleId: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_evaluators')
    .select(`
      *,
      evaluator:members!succession_evaluators_member_id_fkey (
        id,
        first_name,
        last_name,
        email,
        avatar_url
      ),
      assigned_by:members!succession_evaluators_assigned_by_id_fkey (
        id,
        first_name,
        last_name
      )
    `)
    .eq('cycle_id', cycleId)
    .order('assigned_at', { ascending: false })

  if (error) {
    console.error('Error fetching evaluators:', error)
    throw new Error('Failed to fetch evaluators')
  }

  return data || []
})

/**
 * Get evaluator by ID
 */
export const getEvaluatorById = cache(async (id: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_evaluators')
    .select(`
      *,
      evaluator:members!succession_evaluators_member_id_fkey (
        id,
        first_name,
        last_name,
        email,
        avatar_url
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching evaluator:', error)
    throw new Error('Failed to fetch evaluator')
  }

  return data
})

// ============================================================================
// EVALUATION SCORES DATA LAYER
// ============================================================================

/**
 * Get evaluation scores for a nomination
 */
export const getEvaluationScores = cache(
  async (nominationId: string) => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('succession_evaluation_scores')
      .select(`
        *,
        evaluator:succession_evaluators!succession_evaluation_scores_evaluator_id_fkey (
          id,
          evaluator:members!succession_evaluators_member_id_fkey (
            id,
            first_name,
            last_name
          )
        ),
        criterion:succession_evaluation_criteria (
          id,
          criterion_name,
          weight,
          max_score
        )
      `)
      .eq('nomination_id', nominationId)
      .order('submitted_at', { ascending: false })

    if (error) {
      console.error('Error fetching evaluation scores:', error)
      throw new Error('Failed to fetch evaluation scores')
    }

    return data || []
  }
)

/**
 * Get my evaluation scores (as evaluator)
 */
export const getMyEvaluationScores = cache(async (cycleId: string) => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // First get my evaluator record
  const { data: evaluator, error: evaluatorError } = await supabase
    .from('succession_evaluators')
    .select('id')
    .eq('cycle_id', cycleId)
    .eq('member_id', user.id)
    .single()

  if (evaluatorError || !evaluator) return []

  // Then get my scores
  const { data, error } = await supabase
    .from('succession_evaluation_scores')
    .select(`
      *,
      nomination:succession_nominations!succession_evaluation_scores_nomination_id_fkey (
        id,
        nominee:members!succession_nominations_nominee_id_fkey (
          id,
          first_name,
          last_name
        ),
        position:succession_positions (
          id,
          title
        )
      ),
      criterion:succession_evaluation_criteria (
        id,
        criterion_name,
        weight,
        max_score
      )
    `)
    .eq('evaluator_id', evaluator.id)
    .order('submitted_at', { ascending: false })

  if (error) {
    console.error('Error fetching my evaluation scores:', error)
    throw new Error('Failed to fetch evaluation scores')
  }

  return data || []
})
