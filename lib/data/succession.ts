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
          avatar_url,
          company,
          designation,
          profiles!inner(
            email,
            full_name,
            phone
          )
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
          avatar_url,
          company,
          designation,
          profiles!inner(
            email,
            full_name
          )
        ),
        nominator:members!succession_nominations_nominated_by_id_fkey (
          id,
          profiles!inner(
            full_name
          )
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
        avatar_url,
        company,
        designation,
        profiles!inner(
          email,
          full_name,
          phone
        )
      ),
      nominator:members!succession_nominations_nominated_by_id_fkey (
        id,
        profiles!inner(
          email,
          full_name
        )
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
        id,
        profiles!inner(
          full_name
        )
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
        id,
        avatar_url,
        profiles!inner(
          email,
          full_name
        )
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
        id,
        profiles!inner(
          full_name
        )
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
          avatar_url,
          company,
          designation,
          profiles!inner(
            email,
            full_name
          )
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
        avatar_url,
        designation,
        company,
        profiles!inner(
          email,
          full_name,
          phone
        )
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
        profiles!inner(
          full_name
        )
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
          avatar_url,
          company,
          designation,
          profiles!inner(
            email,
            full_name
          )
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
        avatar_url,
        company,
        designation,
        profiles!inner(
          email,
          full_name
        )
      ),
      assigned_by:members!succession_evaluators_assigned_by_id_fkey (
        id,
        profiles!inner(
          full_name
        )
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
        avatar_url,
        company,
        designation,
        profiles!inner(
          email,
          full_name
        )
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
            profiles!inner(
              full_name
            )
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
          profiles!inner(
            full_name
          )
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

// ============================================================================
// TIMELINE STEPS DATA LAYER
// ============================================================================

/**
 * Get timeline steps for a succession cycle
 * Returns the 7-week timeline with current status
 */
export const getTimelineSteps = cache(async (cycleId: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_timeline_steps')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('step_number', { ascending: true })

  if (error) {
    console.error('Error fetching timeline steps:', error)
    throw new Error('Failed to fetch timeline steps')
  }

  return data || []
})

/**
 * Get current active timeline step for a cycle
 */
export const getCurrentTimelineStep = cache(async (cycleId: string) => {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('succession_timeline_steps')
    .select('*')
    .eq('cycle_id', cycleId)
    .lte('start_date', today)
    .gte('end_date', today)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching current timeline step:', error)
    return null
  }

  return data
})

/**
 * Get timeline step by ID
 */
export const getTimelineStepById = cache(async (id: string) => {
  const supabase = await createClient()

  const { data, error} = await supabase
    .from('succession_timeline_steps')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching timeline step:', error)
    throw new Error('Failed to fetch timeline step')
  }

  return data
})

// ============================================================================
// CANDIDATE APPROACH DATA LAYER
// ============================================================================

/**
 * Get all approaches for a cycle with nominee and position details
 */
export const getApproaches = cache(async (cycleId?: string) => {
  const supabase = await createClient()

  let query = supabase
    .from('succession_approaches')
    .select(`
      *,
      cycle:succession_cycles (
        id,
        cycle_name,
        year
      ),
      position:succession_positions (
        id,
        title,
        hierarchy_level
      ),
      nominee:members!succession_approaches_nominee_id_fkey (
        id,
        avatar_url,
        company,
        designation,
        profiles!inner(
          email,
          full_name,
          phone
        )
      ),
      approached_by_member:members!succession_approaches_approached_by_fkey (
        id,
        profiles!inner(
          full_name
        )
      )
    `)
    .order('approached_at', { ascending: false })

  if (cycleId) {
    query = query.eq('cycle_id', cycleId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching approaches:', error)
    throw new Error('Failed to fetch approaches')
  }

  return data || []
})

/**
 * Get approach by ID with full details
 */
export const getApproachById = cache(async (id: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_approaches')
    .select(`
      *,
      cycle:succession_cycles (
        id,
        cycle_name,
        year
      ),
      position:succession_positions (
        id,
        title,
        description,
        hierarchy_level
      ),
      nominee:members!succession_approaches_nominee_id_fkey (
        id,
        avatar_url,
        designation,
        company,
        profiles!inner(
          email,
          full_name,
          phone
        )
      ),
      approached_by_member:members!succession_approaches_approached_by_fkey (
        id,
        profiles!inner(
          email,
          full_name
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching approach:', error)
    throw new Error('Failed to fetch approach')
  }

  return data
})

/**
 * Get approaches for a specific position
 */
export const getApproachesForPosition = cache(async (positionId: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_approaches')
    .select(`
      *,
      nominee:members!succession_approaches_nominee_id_fkey (
        id,
        avatar_url,
        company,
        designation,
        profiles!inner(
          email,
          full_name
        )
      )
    `)
    .eq('position_id', positionId)
    .order('approached_at', { ascending: false })

  if (error) {
    console.error('Error fetching position approaches:', error)
    throw new Error('Failed to fetch approaches')
  }

  return data || []
})

/**
 * Get approaches where current user is the nominee
 */
export const getMyApproaches = cache(async () => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('succession_approaches')
    .select(`
      *,
      position:succession_positions (
        id,
        title,
        hierarchy_level,
        description
      ),
      cycle:succession_cycles (
        id,
        cycle_name,
        year
      ),
      approached_by_member:members!succession_approaches_approached_by_fkey (
        id,
        profiles!inner(
          full_name
        )
      )
    `)
    .eq('nominee_id', user.id)
    .order('approached_at', { ascending: false })

  if (error) {
    console.error('Error fetching my approaches:', error)
    throw new Error('Failed to fetch approaches')
  }

  return data || []
})

// ============================================================================
// STEERING COMMITTEE MEETINGS DATA LAYER
// ============================================================================

/**
 * Get meetings for a succession cycle
 */
export const getMeetings = cache(async (cycleId?: string) => {
  const supabase = await createClient()

  let query = supabase
    .from('succession_meetings')
    .select(`
      *,
      cycle:succession_cycles (
        id,
        cycle_name,
        year
      ),
      created_by_member:members!succession_meetings_created_by_fkey (
        id,
        profiles!inner(
          full_name
        )
      )
    `)
    .order('meeting_date', { ascending: false })

  if (cycleId) {
    query = query.eq('cycle_id', cycleId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching meetings:', error)
    throw new Error('Failed to fetch meetings')
  }

  return data || []
})

/**
 * Get meeting by ID with full details
 */
export const getMeetingById = cache(async (id: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_meetings')
    .select(`
      *,
      cycle:succession_cycles (
        id,
        cycle_name,
        year,
        status
      ),
      created_by_member:members!succession_meetings_created_by_fkey (
        id,
        profiles!inner(
          email,
          full_name
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching meeting:', error)
    throw new Error('Failed to fetch meeting')
  }

  return data
})

/**
 * Get upcoming meetings for a cycle
 */
export const getUpcomingMeetings = cache(async (cycleId: string) => {
  const supabase = await createClient()
  const today = new Date().toISOString()

  const { data, error } = await supabase
    .from('succession_meetings')
    .select(`
      *,
      cycle:succession_cycles (
        id,
        cycle_name,
        year
      )
    `)
    .eq('cycle_id', cycleId)
    .gte('meeting_date', today)
    .in('status', ['scheduled', 'in_progress'])
    .order('meeting_date', { ascending: true })

  if (error) {
    console.error('Error fetching upcoming meetings:', error)
    throw new Error('Failed to fetch upcoming meetings')
  }

  return data || []
})

// ============================================================================
// VOTING DATA LAYER
// ============================================================================

/**
 * Get votes for a specific meeting
 */
export const getVotesForMeeting = cache(async (meetingId: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_votes')
    .select(`
      *,
      position:succession_positions (
        id,
        title
      ),
      nominee:members!succession_votes_nominee_id_fkey (
        id,
        avatar_url,
        profiles!inner(
          full_name
        )
      ),
      voter:members!succession_votes_voter_member_id_fkey (
        id,
        profiles!inner(
          full_name
        )
      )
    `)
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching votes:', error)
    throw new Error('Failed to fetch votes')
  }

  return data || []
})

/**
 * Get votes for a specific nominee across all positions
 */
export const getVotesForNominee = cache(async (nomineeId: string, meetingId?: string) => {
  const supabase = await createClient()

  let query = supabase
    .from('succession_votes')
    .select(`
      *,
      position:succession_positions (
        id,
        title,
        hierarchy_level
      ),
      voter:members!succession_votes_voter_member_id_fkey (
        id,
        profiles!inner(
          full_name
        )
      ),
      meeting:succession_meetings (
        id,
        meeting_date,
        meeting_type
      )
    `)
    .eq('nominee_id', nomineeId)
    .order('created_at', { ascending: false })

  if (meetingId) {
    query = query.eq('meeting_id', meetingId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching nominee votes:', error)
    throw new Error('Failed to fetch votes')
  }

  return data || []
})

/**
 * Get vote results aggregated by position for a meeting
 */
export const getVoteResultsByPosition = cache(async (meetingId: string) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_votes')
    .select(`
      vote,
      position_id,
      nominee_id,
      position:succession_positions (
        id,
        title,
        hierarchy_level
      ),
      nominee:members!succession_votes_nominee_id_fkey (
        id,
        avatar_url,
        profiles!inner(
          full_name
        )
      )
    `)
    .eq('meeting_id', meetingId)

  if (error) {
    console.error('Error fetching vote results:', error)
    throw new Error('Failed to fetch vote results')
  }

  // Group by position and nominee, count votes
  const results = (data || []).reduce((acc: any, vote: any) => {
    const key = `${vote.position_id}-${vote.nominee_id}`
    if (!acc[key]) {
      acc[key] = {
        position: vote.position,
        nominee: vote.nominee,
        votes: { yes: 0, no: 0, abstain: 0 },
      }
    }
    acc[key].votes[vote.vote]++
    return acc
  }, {})

  return Object.values(results)
})

/**
 * Get current user's votes for a meeting
 */
export const getMyVotesForMeeting = cache(async (meetingId: string) => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('succession_votes')
    .select(`
      *,
      position:succession_positions (
        id,
        title
      ),
      nominee:members!succession_votes_nominee_id_fkey (
        id,
        avatar_url,
        profiles!inner(
          full_name
        )
      )
    `)
    .eq('meeting_id', meetingId)
    .eq('voter_member_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching my votes:', error)
    throw new Error('Failed to fetch votes')
  }

  return data || []
})

// ============================================================================
// KNOWLEDGE BASE & HISTORICAL DATA LAYER
// ============================================================================

/**
 * Get all completed/archived succession cycles for knowledge base
 * Returns cycles with full statistics for pattern analysis
 */
export const getHistoricalCycles = cache(async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_cycles')
    .select('*')
    .in('status', ['completed', 'archived'])
    .order('year', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching historical cycles:', error)
    throw new Error('Failed to fetch historical cycles')
  }

  return data || []
})

/**
 * Get statistics for a completed cycle
 * Used for pattern analysis and insights
 */
export const getCycleStatistics = cache(async (cycleId: string) => {
  const supabase = await createClient()

  // Get all counts in parallel
  const [
    { count: positionCount },
    { count: nominationCount },
    { count: applicationCount },
    { count: evaluatorCount },
    { count: selectionCount },
  ] = await Promise.all([
    supabase
      .from('succession_positions')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId),
    supabase
      .from('succession_nominations')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId),
    supabase
      .from('succession_applications')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId),
    supabase
      .from('succession_evaluators')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId),
    supabase
      .from('succession_selections')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId),
  ])

  // Get nomination status breakdown
  const { data: nominationsByStatus } = await supabase
    .from('succession_nominations')
    .select('status')
    .eq('cycle_id', cycleId)

  const nominationStatusCounts = (nominationsByStatus || []).reduce(
    (acc: Record<string, number>, n: any) => {
      acc[n.status] = (acc[n.status] || 0) + 1
      return acc
    },
    {}
  )

  // Get application status breakdown
  const { data: applicationsByStatus } = await supabase
    .from('succession_applications')
    .select('status')
    .eq('cycle_id', cycleId)

  const applicationStatusCounts = (applicationsByStatus || []).reduce(
    (acc: Record<string, number>, a: any) => {
      acc[a.status] = (acc[a.status] || 0) + 1
      return acc
    },
    {}
  )

  return {
    positions: positionCount || 0,
    nominations: nominationCount || 0,
    applications: applicationCount || 0,
    evaluators: evaluatorCount || 0,
    selections: selectionCount || 0,
    nominationsByStatus: nominationStatusCounts,
    applicationsByStatus: applicationStatusCounts,
  }
})

/**
 * Get pattern insights from historical data
 * Analyzes trends across completed cycles
 */
export const getSuccessionInsights = cache(async () => {
  const supabase = await createClient()

  // Get all completed cycles
  const { data: cycles } = await supabase
    .from('succession_cycles')
    .select('id, year, cycle_name')
    .in('status', ['completed', 'archived'])
    .order('year', { ascending: true })

  if (!cycles || cycles.length === 0) {
    return {
      totalCycles: 0,
      averageNominationsPerCycle: 0,
      averageApplicationsPerCycle: 0,
      positionPopularity: [],
      yearOverYearTrends: [],
    }
  }

  // Get aggregate data for insights
  const insights = {
    totalCycles: cycles.length,
    averageNominationsPerCycle: 0,
    averageApplicationsPerCycle: 0,
    positionPopularity: [] as any[],
    yearOverYearTrends: [] as any[],
  }

  // Calculate averages across all cycles
  let totalNominations = 0
  let totalApplications = 0

  for (const cycle of cycles) {
    const { count: nomCount } = await supabase
      .from('succession_nominations')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycle.id)

    const { count: appCount } = await supabase
      .from('succession_applications')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycle.id)

    totalNominations += nomCount || 0
    totalApplications += appCount || 0

    insights.yearOverYearTrends.push({
      year: cycle.year,
      cycleName: cycle.cycle_name,
      nominations: nomCount || 0,
      applications: appCount || 0,
    })
  }

  insights.averageNominationsPerCycle = Math.round(totalNominations / cycles.length)
  insights.averageApplicationsPerCycle = Math.round(totalApplications / cycles.length)

  // Get position popularity across all cycles
  const { data: positionData } = await supabase
    .from('succession_positions')
    .select(`
      title,
      cycle_id
    `)

  // Count nominations per position title
  const positionNominations: Record<string, number> = {}
  if (positionData) {
    for (const pos of positionData) {
      const { count } = await supabase
        .from('succession_nominations')
        .select('id', { count: 'exact', head: true })
        .eq('position_id', pos.cycle_id)

      positionNominations[pos.title] = (positionNominations[pos.title] || 0) + (count || 0)
    }
  }

  insights.positionPopularity = Object.entries(positionNominations)
    .map(([title, count]) => ({ title, nominations: count }))
    .sort((a, b) => b.nominations - a.nominations)
    .slice(0, 5)

  return insights
})

/**
 * Get selected candidates from completed cycles
 * Used for success pattern analysis
 */
export const getHistoricalSelections = cache(async () => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_selections')
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
        year
      ),
      nomination:succession_nominations (
        id,
        nominee:members!succession_nominations_nominee_id_fkey (
          id,
          avatar_url,
          profiles!inner(
            full_name
          )
        )
      )
    `)
    .order('announced_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching historical selections:', error)
    throw new Error('Failed to fetch historical selections')
  }

  return data || []
})

/**
 * Get audit log for a cycle
 * Useful for reviewing decision history
 */
export const getCycleAuditLog = cache(async (cycleId: string, limit = 50) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('succession_audit_log')
    .select(`
      *,
      performed_by:members!succession_audit_log_performed_by_id_fkey (
        id,
        profiles!inner(
          full_name
        )
      )
    `)
    .eq('cycle_id', cycleId)
    .order('performed_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching audit log:', error)
    throw new Error('Failed to fetch audit log')
  }

  return data || []
})

// ============================================================================
// RC REVIEW PORTAL DATA LAYER
// ============================================================================

/**
 * Get candidates pending RC review
 * Returns nominations approved by steering committee awaiting RC approval
 */
export const getCandidatesPendingRCReview = cache(async (cycleId: string) => {
  const supabase = await createClient()

  // Get approaches that are accepted but need RC approval
  const { data, error } = await supabase
    .from('succession_approaches')
    .select(`
      *,
      position:succession_positions (
        id,
        title,
        description,
        hierarchy_level,
        number_of_openings
      ),
      nominee:members!succession_approaches_nominee_id_fkey (
        id,
        avatar_url,
        designation,
        company,
        member_since,
        profiles!inner(
          email,
          full_name,
          phone
        )
      ),
      cycle:succession_cycles (
        id,
        cycle_name,
        year
      )
    `)
    .eq('cycle_id', cycleId)
    .eq('response_status', 'accepted')
    .is('rc_approved_at', null)
    .order('approached_at', { ascending: true })

  if (error) {
    console.error('Error fetching candidates for RC review:', error)
    throw new Error('Failed to fetch candidates')
  }

  return data || []
})

/**
 * Get candidate profiles with scores for RC review
 * Includes evaluation scores, interview feedback, and voting results
 */
export const getCandidateProfileForReview = cache(
  async (nomineeId: string, cycleId: string) => {
    const supabase = await createClient()

    // Get member details
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select(`
        *,
        skills:member_skills (
          skill:skills (
            name,
            category
          ),
          proficiency,
          years_of_experience
        )
      `)
      .eq('id', nomineeId)
      .single()

    if (memberError) {
      console.error('Error fetching member:', memberError)
      throw new Error('Failed to fetch member')
    }

    // Get their nominations in this cycle
    const { data: nominations } = await supabase
      .from('succession_nominations')
      .select(`
        *,
        position:succession_positions (
          id,
          title,
          hierarchy_level
        ),
        nominator:members!succession_nominations_nominated_by_id_fkey (
          id,
          profiles!inner(
            full_name
          )
        )
      `)
      .eq('nominee_id', nomineeId)
      .eq('cycle_id', cycleId)

    // Get their applications
    const { data: applications } = await supabase
      .from('succession_applications')
      .select(`
        *,
        position:succession_positions (
          id,
          title,
          hierarchy_level
        )
      `)
      .eq('member_id', nomineeId)
      .eq('cycle_id', cycleId)

    // Get evaluation scores
    const { data: scores } = await supabase
      .from('succession_evaluation_scores')
      .select(`
        score,
        comments,
        criterion:succession_evaluation_criteria (
          criterion_name,
          weight,
          max_score
        )
      `)
      .eq('cycle_id', cycleId)
      .in(
        'nomination_id',
        (nominations || []).map((n: any) => n.id)
      )

    // Calculate average score
    const totalScore =
      scores && scores.length > 0
        ? scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / scores.length
        : 0

    // Get EC experience
    const { data: ecHistory } = await supabase
      .from('event_volunteers')
      .select('id')
      .eq('member_id', nomineeId)
      .eq('status', 'completed')

    // Get leadership assessment
    const { data: assessment } = await supabase
      .from('leadership_assessments')
      .select('*')
      .eq('member_id', nomineeId)
      .single()

    return {
      member,
      nominations: nominations || [],
      applications: applications || [],
      evaluationScores: scores || [],
      averageScore: totalScore,
      ecEventsParticipated: (ecHistory || []).length,
      leadershipAssessment: assessment || null,
    }
  }
)
