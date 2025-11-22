/**
 * Vertical Performance Tracker Module Data Layer
 *
 * Cached data fetching functions for vertical performance tracking module.
 * Uses React cache() for request-level deduplication.
 *
 * IMPORTANT: We don't use Next.js 16's 'use cache' directive here because
 * all functions access Supabase client which uses cookies() - a dynamic data source.
 * Next.js 16 doesn't allow dynamic data sources inside 'use cache' boundaries.
 * React's cache() provides request-level deduplication which is sufficient.
 */

import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import type {
  Vertical,
  VerticalWithChair,
  VerticalPlan,
  VerticalPlanWithKPIs,
  VerticalKPI,
  VerticalKPIWithActuals,
  VerticalKPIActual,
  VerticalMember,
  VerticalMemberWithDetails,
  VerticalActivity,
  VerticalActivityWithDetails,
  VerticalPerformanceReview,
  VerticalPerformanceReviewWithDetails,
  VerticalAchievement,
  VerticalAchievementWithDetails,
  VerticalDashboardSummary,
  VerticalRanking,
  KPIAlert,
  VerticalComparison,
  VerticalQuarterlyTrend,
  VerticalFilters,
  VerticalSortOptions,
  KPIFilters,
  ActivityFilters,
  ReviewFilters,
  PaginatedVerticals,
  PaginatedPlans,
  PaginatedKPIs,
  PaginatedActivities,
  PaginatedReviews,
  PaginatedMembers,
  PaginatedAchievements,
} from '@/types/vertical'

// ============================================================================
// VERTICAL QUERIES
// ============================================================================

/**
 * Get all verticals for a chapter with optional filters
 */
export const getVerticals = cache(
  async (
    filters?: VerticalFilters,
    sort?: VerticalSortOptions
  ): Promise<VerticalWithChair[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Note: chapter_id filtering is handled by RLS policies
    let query = supabase
      .from('verticals')
      .select(
        `
        *,
        current_chair:vertical_chairs!vertical_chairs_vertical_id_fkey(
          id,
          member_id,
          role,
          start_date,
          member:members!vertical_chairs_member_id_fkey(
            id,
            avatar_url,
            profile:profiles(full_name, email)
          )
        )
      `
      )
      .eq('vertical_chairs.is_active', true)

    // Apply filters
    if (filters) {
      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active)
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }
    }

    // Apply sorting
    if (sort) {
      query = query.order(sort.field, { ascending: sort.direction === 'asc' })
    } else {
      query = query.order('display_order', { ascending: true })
    }

    const { data, error } = await query

    if (error) throw error

    // Supabase returns current_chair as an array for each vertical, we need the first (active) chair
    const results = (data || []).map((vertical: any) => {
      if (vertical && Array.isArray(vertical.current_chair)) {
        vertical.current_chair = vertical.current_chair[0] || null
      }
      return vertical
    })

    return results as VerticalWithChair[]
  }
)

/**
 * Get a single vertical by ID with chair information
 */
export const getVerticalById = cache(async (id: string): Promise<VerticalWithChair | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('verticals')
    .select(
      `
      *,
      current_chair:vertical_chairs!vertical_chairs_vertical_id_fkey(
        id,
        member_id,
        role,
        start_date,
        member:members!vertical_chairs_member_id_fkey(
          id,
          avatar_url,
          profile:profiles(full_name, email)
        )
      )
    `
    )
    .eq('id', id)
    .eq('vertical_chairs.is_active', true)
    .single()

  if (error) throw error

  // Supabase returns current_chair as an array, we need the first (active) chair
  const result = data as any
  if (result && Array.isArray(result.current_chair)) {
    result.current_chair = result.current_chair[0] || null
  }

  return result as VerticalWithChair
})

/**
 * Get vertical by slug
 */
export const getVerticalBySlug = cache(async (slug: string): Promise<VerticalWithChair | null> => {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Note: chapter_id filtering is handled by RLS policies
  const { data, error} = await supabase
    .from('verticals')
    .select(
      `
      *,
      current_chair:vertical_chairs!vertical_chairs_vertical_id_fkey(
        id,
        member_id,
        role,
        start_date,
        member:members!vertical_chairs_member_id_fkey(
          id,
          avatar_url,
          profile:profiles(full_name, email)
        )
      )
    `
    )
    .eq('slug', slug)
    .eq('vertical_chairs.is_active', true)
    .single()

  if (error) throw error

  // Supabase returns current_chair as an array, we need the first (active) chair
  const result = data as any
  if (result && Array.isArray(result.current_chair)) {
    result.current_chair = result.current_chair[0] || null
  }

  return result as VerticalWithChair
})

// ============================================================================
// VERTICAL PLAN QUERIES
// ============================================================================

/**
 * Get plans for a vertical
 */
export const getVerticalPlans = cache(async (verticalId: string): Promise<VerticalPlanWithKPIs[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vertical_plans')
    .select(
      `
      *,
      vertical:verticals(id, name, slug, color, icon),
      kpis:vertical_kpis(*),
      created_by_member:members!vertical_plans_created_by_fkey(
        id,
        profile:profiles(full_name, email)
      ),
      approved_by_member:members!vertical_plans_approved_by_fkey(
        id,
        profile:profiles(full_name, email)
      )
    `
    )
    .eq('vertical_id', verticalId)
    .order('fiscal_year', { ascending: false })

  if (error) throw error
  return (data as VerticalPlanWithKPIs[]) || []
})

/**
 * Get current plan for a vertical (any status, for the given fiscal year)
 * This returns the plan regardless of status (draft, submitted, approved, active, completed)
 */
export const getActiveVerticalPlan = cache(
  async (verticalId: string, fiscalYear?: number): Promise<VerticalPlanWithKPIs | null> => {
    const supabase = await createClient()

    let query = supabase
      .from('vertical_plans')
      .select(
        `
        *,
        vertical:verticals(id, name, slug, color, icon),
        kpis:vertical_kpis(*),
        created_by_member:members!vertical_plans_created_by_fkey(
          id,
          profile:profiles(full_name, email)
        ),
        approved_by_member:members!vertical_plans_approved_by_fkey(
          id,
          profile:profiles(full_name, email)
        )
      `
      )
      .eq('vertical_id', verticalId)

    if (fiscalYear) {
      query = query.eq('fiscal_year', fiscalYear)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw error
    return data as VerticalPlanWithKPIs | null
  }
)

/**
 * Get plan by ID with KPIs and actuals
 */
export const getPlanById = cache(async (id: string): Promise<VerticalPlanWithKPIs | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vertical_plans')
    .select(
      `
      *,
      vertical:verticals(id, name, slug, color, icon),
      kpis:vertical_kpis(
        *,
        actuals:vertical_kpi_actuals(*)
      ),
      created_by_member:members!vertical_plans_created_by_fkey(
        id,
        profile:profiles(full_name, email)
      ),
      approved_by_member:members!vertical_plans_approved_by_fkey(
        id,
        profile:profiles(full_name, email)
      )
    `
    )
    .eq('id', id)
    .single()

  if (error) throw error
  return data as VerticalPlanWithKPIs
})

// ============================================================================
// KPI QUERIES
// ============================================================================

/**
 * Get KPIs for a plan with actuals
 */
export const getPlanKPIs = cache(async (planId: string): Promise<VerticalKPIWithActuals[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vertical_kpis')
    .select(
      `
      *,
      actuals:vertical_kpi_actuals(*)
    `
    )
    .eq('plan_id', planId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw error

  // Transform data to match VerticalKPIWithActuals structure
  const kpisWithActuals: VerticalKPIWithActuals[] = (data || []).map((kpi: any) => {
    const actualsMap: { q1?: VerticalKPIActual; q2?: VerticalKPIActual; q3?: VerticalKPIActual; q4?: VerticalKPIActual } = {}
    kpi.actuals?.forEach((actual: VerticalKPIActual) => {
      if (actual.quarter === 1) actualsMap.q1 = actual
      if (actual.quarter === 2) actualsMap.q2 = actual
      if (actual.quarter === 3) actualsMap.q3 = actual
      if (actual.quarter === 4) actualsMap.q4 = actual
    })

    const currentAchievement =
      (actualsMap.q1?.actual_value || 0) +
      (actualsMap.q2?.actual_value || 0) +
      (actualsMap.q3?.actual_value || 0) +
      (actualsMap.q4?.actual_value || 0)

    const completionPercentage = kpi.target_annual > 0 ? (currentAchievement / kpi.target_annual) * 100 : 0

    let status: 'not_started' | 'in_progress' | 'completed' | 'at_risk' = 'not_started'
    if (completionPercentage === 0) status = 'not_started'
    else if (completionPercentage >= 100) status = 'completed'
    else if (completionPercentage < 50) status = 'at_risk'
    else status = 'in_progress'

    return {
      ...kpi,
      actuals: actualsMap,
      current_achievement: currentAchievement,
      completion_percentage: completionPercentage,
      status,
    }
  })

  return kpisWithActuals
})

/**
 * Get KPI by ID with actuals
 */
export const getKPIById = cache(async (id: string): Promise<VerticalKPIWithActuals | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vertical_kpis')
    .select(
      `
      *,
      actuals:vertical_kpi_actuals(*)
    `
    )
    .eq('id', id)
    .single()

  if (error) throw error

  // Transform to VerticalKPIWithActuals
  const actualsMap: { q1?: VerticalKPIActual; q2?: VerticalKPIActual; q3?: VerticalKPIActual; q4?: VerticalKPIActual } = {}
  data.actuals?.forEach((actual: VerticalKPIActual) => {
    if (actual.quarter === 1) actualsMap.q1 = actual
    if (actual.quarter === 2) actualsMap.q2 = actual
    if (actual.quarter === 3) actualsMap.q3 = actual
    if (actual.quarter === 4) actualsMap.q4 = actual
  })

  const currentAchievement =
    (actualsMap.q1?.actual_value || 0) +
    (actualsMap.q2?.actual_value || 0) +
    (actualsMap.q3?.actual_value || 0) +
    (actualsMap.q4?.actual_value || 0)

  const completionPercentage = data.target_annual > 0 ? (currentAchievement / data.target_annual) * 100 : 0

  let status: 'not_started' | 'in_progress' | 'completed' | 'at_risk' = 'not_started'
  if (completionPercentage === 0) status = 'not_started'
  else if (completionPercentage >= 100) status = 'completed'
  else if (completionPercentage < 50) status = 'at_risk'
  else status = 'in_progress'

  return {
    ...data,
    actuals: actualsMap,
    current_achievement: currentAchievement,
    completion_percentage: completionPercentage,
    status,
  }
})

// ============================================================================
// ACTIVITY QUERIES
// ============================================================================

/**
 * Get activities for a vertical with filters
 */
export const getVerticalActivities = cache(
  async (verticalId: string, filters?: ActivityFilters): Promise<VerticalActivityWithDetails[]> => {
    const supabase = await createClient()

    let query = supabase
      .from('vertical_activities')
      .select(
        `
        *,
        vertical:verticals(id, name, slug, color),
        event:events(id, title, start_date, status),
        created_by_member:members!vertical_activities_created_by_fkey(
          id,
          avatar_url,
          profile:profiles(full_name, email)
        )
      `
      )
      .eq('vertical_id', verticalId)

    // Apply filters
    if (filters) {
      if (filters.fiscal_year) {
        const fiscalYearStart = `${filters.fiscal_year}-04-01`
        const fiscalYearEnd = `${filters.fiscal_year + 1}-03-31`
        query = query.gte('activity_date', fiscalYearStart).lte('activity_date', fiscalYearEnd)
      }
      if (filters.quarter) {
        // Calculate quarter date range
        const quarterStartMonth = (filters.quarter - 1) * 3 + 4 // Q1=Apr(4), Q2=Jul(7), Q3=Oct(10), Q4=Jan(1)
        const fiscalYear = filters.fiscal_year || new Date().getFullYear()
        const year = quarterStartMonth >= 4 ? fiscalYear : fiscalYear + 1
        const month = quarterStartMonth >= 4 ? quarterStartMonth : quarterStartMonth
        const quarterStart = `${year}-${String(month).padStart(2, '0')}-01`
        const endMonth = month + 2
        const endYear = endMonth > 12 ? year + 1 : year
        const endMonthAdjusted = endMonth > 12 ? endMonth - 12 : endMonth
        const quarterEnd = `${endYear}-${String(endMonthAdjusted).padStart(2, '0')}-31`
        query = query.gte('activity_date', quarterStart).lte('activity_date', quarterEnd)
      }
      if (filters.activity_type) {
        query = query.eq('activity_type', filters.activity_type)
      }
      if (filters.date_from) {
        query = query.gte('activity_date', filters.date_from)
      }
      if (filters.date_to) {
        query = query.lte('activity_date', filters.date_to)
      }
      if (filters.has_event !== undefined) {
        if (filters.has_event) {
          query = query.not('event_id', 'is', null)
        } else {
          query = query.is('event_id', null)
        }
      }
      if (filters.created_by) {
        query = query.eq('created_by', filters.created_by)
      }
      if (filters.min_beneficiaries) {
        query = query.gte('beneficiaries_count', filters.min_beneficiaries)
      }
    }

    query = query.order('activity_date', { ascending: false })

    const { data, error } = await query

    if (error) throw error
    return (data as VerticalActivityWithDetails[]) || []
  }
)

/**
 * Get activity by ID
 */
export const getActivityById = cache(async (id: string): Promise<VerticalActivityWithDetails | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vertical_activities')
    .select(
      `
      *,
      vertical:verticals(id, name, slug, color),
      event:events(id, title, start_date, status),
      created_by_member:members!vertical_activities_created_by_fkey(
        id,
        avatar_url,
        profile:profiles(full_name, email)
      )
    `
    )
    .eq('id', id)
    .single()

  if (error) throw error
  return data as VerticalActivityWithDetails
})

// ============================================================================
// PERFORMANCE REVIEW QUERIES
// ============================================================================

/**
 * Get performance reviews for a vertical
 */
export const getVerticalReviews = cache(
  async (verticalId: string, filters?: ReviewFilters): Promise<VerticalPerformanceReviewWithDetails[]> => {
    const supabase = await createClient()

    let query = supabase
      .from('vertical_performance_reviews')
      .select(
        `
        *,
        vertical:verticals(id, name, slug, color),
        chair:vertical_chairs(
          id,
          role,
          member:members!vertical_chairs_member_id_fkey(
            id,
            avatar_url,
            profile:profiles(full_name, email)
          )
        ),
        reviewed_by_member:members!vertical_performance_reviews_reviewed_by_fkey(
          id,
          profile:profiles(full_name, email)
        )
      `
      )
      .eq('vertical_id', verticalId)

    // Apply filters
    if (filters) {
      if (filters.fiscal_year) {
        query = query.eq('fiscal_year', filters.fiscal_year)
      }
      if (filters.quarter) {
        query = query.eq('quarter', filters.quarter)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.reviewed_by) {
        query = query.eq('reviewed_by', filters.reviewed_by)
      }
      if (filters.min_rating) {
        query = query.gte('overall_rating', filters.min_rating)
      }
    }

    query = query.order('fiscal_year', { ascending: false }).order('quarter', { ascending: false })

    const { data, error } = await query

    if (error) throw error
    return (data as VerticalPerformanceReviewWithDetails[]) || []
  }
)

/**
 * Get review by ID
 */
export const getReviewById = cache(async (id: string): Promise<VerticalPerformanceReviewWithDetails | null> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vertical_performance_reviews')
    .select(
      `
      *,
      vertical:verticals(id, name, slug, color),
      chair:vertical_chairs(
        id,
        role,
        member:members!vertical_chairs_member_id_fkey(
          id,
          avatar_url,
          profile:profiles(full_name, email)
        )
      ),
      reviewed_by_member:members!vertical_performance_reviews_reviewed_by_fkey(
        id,
        profile:profiles(full_name, email)
      )
    `
    )
    .eq('id', id)
    .single()

  if (error) throw error
  return data as VerticalPerformanceReviewWithDetails
})

// ============================================================================
// MEMBER QUERIES
// ============================================================================

/**
 * Get members of a vertical
 */
export const getVerticalMembers = cache(async (verticalId: string): Promise<VerticalMemberWithDetails[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vertical_members')
    .select(
      `
      *,
      member:members(
        id,
        avatar_url,
        profile:profiles(full_name, email, phone)
      ),
      vertical:verticals(id, name, slug, color)
    `
    )
    .eq('vertical_id', verticalId)
    .eq('is_active', true)
    .order('joined_date', { ascending: false })

  if (error) throw error
  return (data as VerticalMemberWithDetails[]) || []
})

// ============================================================================
// ACHIEVEMENT QUERIES
// ============================================================================

/**
 * Get achievements for a vertical
 */
export const getVerticalAchievements = cache(async (verticalId: string): Promise<VerticalAchievementWithDetails[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vertical_achievements')
    .select(
      `
      *,
      vertical:verticals(id, name, slug, color, icon),
      created_by_member:members!vertical_achievements_created_by_fkey(
        id,
        profile:profiles(full_name, email)
      )
    `
    )
    .eq('vertical_id', verticalId)
    .order('achievement_date', { ascending: false })

  if (error) throw error
  return (data as VerticalAchievementWithDetails[]) || []
})

// ============================================================================
// DASHBOARD AND ANALYTICS QUERIES
// ============================================================================

/**
 * Get complete dashboard summary for a vertical
 */
export const getVerticalDashboard = cache(async (verticalId: string, fiscalYear: number): Promise<VerticalDashboardSummary> => {
  const supabase = await createClient()

  // Get vertical with chair
  const vertical = await getVerticalById(verticalId)
  if (!vertical) throw new Error('Vertical not found')

  // Get active plan
  const currentPlan = await getActiveVerticalPlan(verticalId, fiscalYear)

  // Get KPI summary from view
  const { data: kpiProgressData } = await supabase
    .from('vertical_kpi_progress')
    .select('*')
    .eq('vertical_id', verticalId)
    .eq('fiscal_year', fiscalYear)
    .single()

  const kpiSummary = {
    total_kpis: kpiProgressData?.total_kpis || 0,
    completed: kpiProgressData?.completed_kpis || 0,
    in_progress: kpiProgressData?.in_progress_kpis || 0,
    not_started: kpiProgressData?.not_started_kpis || 0,
    at_risk: 0, // Calculate from KPIs
    overall_completion_percentage: kpiProgressData?.overall_completion || 0,
    weighted_achievement_percentage: kpiProgressData?.weighted_achievement || 0,
  }

  // Get impact metrics from view
  const { data: impactData } = await supabase
    .from('vertical_impact_metrics')
    .select('*')
    .eq('vertical_id', verticalId)
    .eq('fiscal_year', fiscalYear)
    .single()

  const impactMetrics = {
    total_activities: impactData?.total_activities || 0,
    total_events: impactData?.total_events || 0,
    total_beneficiaries: impactData?.total_beneficiaries || 0,
    total_volunteer_hours: impactData?.total_volunteer_hours || 0,
    total_cost: impactData?.total_cost || 0,
    avg_beneficiaries_per_activity: impactData?.avg_beneficiaries_per_activity || 0,
    cost_per_beneficiary: impactData?.cost_per_beneficiary || 0,
  }

  // Get budget summary (assuming budget is in vertical_plans)
  // Database column is total_budget, not budget_allocated
  const totalBudget = (currentPlan as any)?.total_budget || 0
  const budgetSummary = {
    allocated: totalBudget,
    spent: impactMetrics.total_cost,
    committed: 0, // TODO: Get from expenses
    available: totalBudget - impactMetrics.total_cost,
    utilization_percentage:
      totalBudget > 0
        ? (impactMetrics.total_cost / totalBudget) * 100
        : 0,
  }

  // Get recent activities (last 5)
  const recentActivities = await getVerticalActivities(verticalId, {
    fiscal_year: fiscalYear,
  })

  // Get recent achievements (last 5)
  const recentAchievements = await getVerticalAchievements(verticalId)

  // Get member count
  const members = await getVerticalMembers(verticalId)

  return {
    vertical,
    current_chair: vertical.current_chair,
    current_plan: currentPlan,
    kpi_summary: kpiSummary,
    impact_metrics: impactMetrics,
    budget_summary: budgetSummary,
    recent_activities: recentActivities.slice(0, 5),
    recent_achievements: recentAchievements.slice(0, 5),
    members: members,
    member_count: members.length,
    active_member_count: members.filter((m) => m.is_active).length,
  }
})

/**
 * Get vertical rankings using database function
 */
export const getVerticalRankings = cache(async (fiscalYear: number): Promise<VerticalRanking[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('calculate_vertical_ranking', {
    p_fiscal_year: fiscalYear,
  })

  // If function doesn't exist, return empty array
  if (error) {
    if (error.code === 'PGRST202') {
      console.warn('calculate_vertical_ranking function not found, returning empty rankings')
      return []
    }
    throw error
  }
  return (data as VerticalRanking[]) || []
})

/**
 * Get KPI alerts for a vertical using database function
 */
export const getKPIAlerts = cache(async (verticalId: string, quarter: number): Promise<KPIAlert[]> => {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('check_kpi_alerts', {
    p_vertical_id: verticalId,
    p_quarter: quarter,
  })

  // If function doesn't exist, return empty array
  if (error) {
    if (error.code === 'PGRST202') {
      console.warn('check_kpi_alerts function not found, returning empty alerts')
      return []
    }
    throw error
  }
  return (data as KPIAlert[]) || []
})

/**
 * Get comparative analytics across all verticals for a chapter
 */
export const getVerticalComparison = cache(async (fiscalYear: number, quarter?: number): Promise<VerticalComparison> => {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get all verticals (chapter filtering handled by RLS)
  const verticals = await getVerticals({ is_active: true })

  // For each vertical, get its metrics
  const verticalMetrics = await Promise.all(
    verticals.map(async (vertical) => {
      const dashboard = await getVerticalDashboard(vertical.id, fiscalYear)

      return {
        vertical_id: vertical.id,
        vertical_name: vertical.name,
        color: vertical.color,
        kpi_achievement_rate: dashboard.kpi_summary.weighted_achievement_percentage,
        budget_utilization_rate: dashboard.budget_summary.utilization_percentage,
        total_beneficiaries: dashboard.impact_metrics.total_beneficiaries,
        total_volunteer_hours: dashboard.impact_metrics.total_volunteer_hours,
        event_completion_rate: 0, // TODO: Calculate from events
        overall_score:
          (dashboard.kpi_summary.weighted_achievement_percentage * 0.4 +
            dashboard.budget_summary.utilization_percentage * 0.3 +
            (dashboard.impact_metrics.total_beneficiaries > 0 ? 100 : 0) * 0.3) /
          3,
      }
    })
  )

  return {
    fiscal_year: fiscalYear,
    quarter,
    verticals: verticalMetrics,
  }
})

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current fiscal year
 */
export function getCurrentFiscalYear(): number {
  const now = new Date()
  const month = now.getMonth() + 1 // JavaScript months are 0-indexed
  const year = now.getFullYear()

  // Fiscal year starts in April (month 4)
  if (month >= 4) {
    return year
  } else {
    return year - 1
  }
}

/**
 * Get current quarter (1-4)
 */
export function getCurrentQuarter(): number {
  const now = new Date()
  const month = now.getMonth() + 1 // JavaScript months are 0-indexed

  // Q1: Apr-Jun (4-6), Q2: Jul-Sep (7-9), Q3: Oct-Dec (10-12), Q4: Jan-Mar (1-3)
  if (month >= 4 && month <= 6) return 1
  if (month >= 7 && month <= 9) return 2
  if (month >= 10 && month <= 12) return 3
  return 4 // Jan-Mar
}
