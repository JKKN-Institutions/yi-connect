/**
 * Industry Opportunity Data Layer
 *
 * Cached data fetching functions for Industry Opportunities bidirectional system.
 */

import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import type {
  IndustryOpportunity,
  OpportunityListItem,
  OpportunityWithDetails,
  OpportunityApplication,
  ApplicationListItem,
  ApplicationWithDetails,
  MemberVisitRequest,
  VisitRequestWithDetails,
  IndustryImpactMetrics,
  OpportunityFilters,
  ApplicationFilters,
  VisitRequestFilters,
  PaginatedOpportunities,
  PaginatedApplications,
  PaginatedVisitRequests,
  OpportunityType,
  OpportunityStatus,
  MatchScoreBreakdown,
} from '@/types/industry-opportunity'

// Helper function to map DB opportunity types to UI-friendly types
function mapOpportunityType(dbType: OpportunityType | null | undefined): string {
  const typeMap: Record<OpportunityType, string> = {
    'industrial_visit': 'visit',
    'internship': 'internship',
    'mentorship': 'mentorship',
    'guest_lecture': 'training',
    'job_opening': 'job',
    'project_collaboration': 'project',
    'training_program': 'training',
    'sponsorship': 'other',
    'csr_partnership': 'other',
    'other': 'other',
  }
  return dbType ? typeMap[dbType] || dbType : 'other'
}

// Helper function to map UI-friendly types back to DB enum values
function mapUiTypeToDbType(uiType: string): OpportunityType | null {
  const reverseMap: Record<string, OpportunityType> = {
    'visit': 'industrial_visit',
    'internship': 'internship',
    'mentorship': 'mentorship',
    'training': 'training_program',
    'job': 'job_opening',
    'project': 'project_collaboration',
    'other': 'other',
  }
  return reverseMap[uiType] || null
}

// ============================================================================
// Opportunity Queries
// ============================================================================

/**
 * Get paginated opportunities with filters
 */
export const getOpportunities = cache(
  async (params?: {
    page?: number
    pageSize?: number
    filters?: OpportunityFilters
    sortField?: string
    sortDirection?: 'asc' | 'desc'
    memberId?: string // For match score calculation
  }): Promise<PaginatedOpportunities> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 10
    const offset = (page - 1) * pageSize
    const filters = params?.filters
    const sortField = params?.sortField || 'created_at'
    const sortDirection = params?.sortDirection || 'desc'

    let query = supabase
      .from('industry_opportunities')
      .select(
        `
        *,
        industry:industries!industry_id(
          id,
          company_name,
          industry_sector,
          city
        )
      `,
        { count: 'exact' }
      )

    // Apply filters
    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      )
    }
    if (filters?.opportunity_type && filters.opportunity_type.length > 0) {
      query = query.in('opportunity_type', filters.opportunity_type)
    }
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    if (filters?.industry_id) {
      query = query.eq('industry_id', filters.industry_id)
    }
    if (filters?.is_remote !== undefined) {
      query = query.eq('is_remote', filters.is_remote)
    }
    if (filters?.is_paid !== undefined) {
      query = query.eq('is_paid', filters.is_paid)
    }
    if (filters?.is_featured !== undefined) {
      query = query.eq('is_featured', filters.is_featured)
    }
    if (filters?.deadline_within_days) {
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + filters.deadline_within_days)
      query = query.lte('application_deadline', deadline.toISOString())
    }
    if (filters?.has_spots_available) {
      query = query.or(
        'max_participants.is.null,positions_filled.lt.max_participants'
      )
    }

    // Apply sorting and pagination
    query = query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching opportunities:', error)
      throw new Error(`Failed to fetch opportunities: ${error.message}`)
    }

    // Get member-specific data if memberId provided
    let memberApplications = new Set<string>()
    let memberBookmarks = new Set<string>()

    if (params?.memberId && data && data.length > 0) {
      const opportunityIds = data.map((o: any) => o.id)

      const [applicationsResult, bookmarksResult] = await Promise.all([
        supabase
          .from('opportunity_applications')
          .select('opportunity_id')
          .eq('member_id', params.memberId)
          .in('opportunity_id', opportunityIds),
        supabase
          .from('opportunity_bookmarks')
          .select('opportunity_id')
          .eq('member_id', params.memberId)
          .in('opportunity_id', opportunityIds),
      ])

      memberApplications = new Set(
        applicationsResult.data?.map((a: any) => a.opportunity_id) || []
      )
      memberBookmarks = new Set(
        bookmarksResult.data?.map((b: any) => b.opportunity_id) || []
      )
    }

    // Transform data
    const transformedData: OpportunityListItem[] = (data || []).map((opp: any) => {
      const deadline = new Date(opp.application_deadline)
      const now = new Date()
      const daysUntil = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      return {
        ...opp,
        industry_name: opp.industry?.company_name || 'Unknown',
        industry_sector: opp.industry?.industry_sector || 'Other',
        industry_logo_url: opp.industry?.logo_url || null,
        has_applied: memberApplications.has(opp.id),
        is_bookmarked: memberBookmarks.has(opp.id),
        days_until_deadline: Math.max(0, daysUntil),
        spots_remaining: opp.max_participants
          ? Math.max(0, opp.max_participants - opp.positions_filled)
          : null,
      }
    })

    return {
      data: transformedData,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }
  }
)

/**
 * Get opportunity by ID with full details
 */
export const getOpportunityById = cache(
  async (opportunityId: string): Promise<OpportunityWithDetails | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('industry_opportunities')
      .select(
        `
        *,
        industry:industries!industry_id(
          id,
          company_name,
          industry_sector,
          city,
          website
        )
      `
      )
      .eq('id', opportunityId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch opportunity: ${error.message}`)
    }

    // Get applications summary
    const { data: applications } = await supabase
      .from('opportunity_applications')
      .select('status')
      .eq('opportunity_id', opportunityId)

    const appSummary = (applications || []).reduce(
      (acc: any, app: any) => {
        acc.total++
        if (app.status === 'pending_review' || app.status === 'under_review') {
          acc.pending++
        } else if (app.status === 'shortlisted') {
          acc.shortlisted++
        } else if (app.status === 'accepted') {
          acc.accepted++
        } else if (app.status === 'declined') {
          acc.declined++
        }
        return acc
      },
      { total: 0, pending: 0, shortlisted: 0, accepted: 0, declined: 0 }
    )

    // Increment view count
    await supabase.rpc('increment_opportunity_views', {
      opportunity_id: opportunityId,
    })

    // Return with UI-friendly aliases
    return {
      ...data,
      industry: data.industry,
      applications_summary: appSummary,
      // UI-friendly aliases
      deadline: data.application_deadline,
      type: mapOpportunityType(data.opportunity_type),
      stakeholder: data.industry ? {
        id: data.industry.id,
        name: data.industry.company_name,
        industry_type: data.industry.industry_sector,
        city: data.industry.city,
        state: null,
        logo_url: data.industry.logo_url,
        website: data.industry.website,
      } : null,
      skills_required: data.eligibility_criteria?.skills || null,
      duration: data.duration_description,
      positions_available: data.max_participants,
    } as OpportunityWithDetails
  }
)

/**
 * Get featured opportunities
 */
export const getFeaturedOpportunities = cache(
  async (limit: number = 5): Promise<OpportunityListItem[]> => {
    const result = await getOpportunities({
      page: 1,
      pageSize: limit,
      filters: {
        status: ['accepting_applications'],
        is_featured: true,
      },
      sortField: 'application_deadline',
      sortDirection: 'asc',
    })

    return result.data
  }
)

/**
 * Get opportunities by industry
 */
export const getIndustryOpportunities = cache(
  async (industryId: string): Promise<OpportunityListItem[]> => {
    const result = await getOpportunities({
      page: 1,
      pageSize: 50,
      filters: {
        industry_id: industryId,
        status: ['published', 'accepting_applications', 'closed', 'completed'],
      },
      sortField: 'created_at',
      sortDirection: 'desc',
    })

    return result.data
  }
)

// ============================================================================
// Application Queries
// ============================================================================

/**
 * Get paginated applications with filters
 */
export const getApplications = cache(
  async (params?: {
    page?: number
    pageSize?: number
    filters?: ApplicationFilters
  }): Promise<PaginatedApplications> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 10
    const offset = (page - 1) * pageSize
    const filters = params?.filters
    const sortBy = filters?.sort_by || 'applied_at'
    const sortDirection = filters?.sort_direction || 'desc'

    let query = supabase
      .from('opportunity_applications')
      .select(
        `
        *,
        member:members!member_id(
          id,
          company,
          designation,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        ),
        opportunity:industry_opportunities(
          id,
          title,
          opportunity_type,
          application_deadline,
          industry:industries!industry_id(
            company_name
          )
        )
      `,
        { count: 'exact' }
      )

    // Apply filters
    if (filters?.opportunity_id) {
      query = query.eq('opportunity_id', filters.opportunity_id)
    }
    if (filters?.member_id) {
      query = query.eq('member_id', filters.member_id)
    }
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    if (filters?.min_match_score !== undefined) {
      query = query.gte('match_score', filters.min_match_score)
    }
    if (filters?.max_match_score !== undefined) {
      query = query.lte('match_score', filters.max_match_score)
    }
    if (filters?.search) {
      // Search in member name
      query = query.ilike('member.profile.full_name', `%${filters.search}%`)
    }

    // Apply sorting and pagination
    query = query
      .order(sortBy, { ascending: sortDirection === 'asc' })
      .range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching applications:', error)
      throw new Error(`Failed to fetch applications: ${error.message}`)
    }

    // Transform data
    const transformedData: ApplicationListItem[] = (data || []).map((app: any) => ({
      ...app,
      member: {
        id: app.member?.id,
        full_name: (app.member?.profile as any)?.full_name || 'Unknown',
        email: (app.member?.profile as any)?.email || '',
        avatar_url: (app.member?.profile as any)?.avatar_url || null,
        company: app.member?.company,
        designation: app.member?.designation,
        engagement_score: null, // engagement_score is in engagement_metrics table, not members
      },
      opportunity: app.opportunity
        ? {
            id: app.opportunity.id,
            title: app.opportunity.title,
            opportunity_type: app.opportunity.opportunity_type,
            industry_name: app.opportunity.industry?.company_name || 'Unknown',
            application_deadline: app.opportunity.application_deadline,
          }
        : undefined,
    }))

    return {
      data: transformedData,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }
  }
)

/**
 * Get application by ID
 */
export const getApplicationById = cache(
  async (applicationId: string): Promise<ApplicationWithDetails | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('opportunity_applications')
      .select(
        `
        *,
        opportunity:industry_opportunities(
          *,
          industry:industries!industry_id(
            id,
            company_name,
            industry_sector,
            city,
            website
          )
        )
      `
      )
      .eq('id', applicationId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch application: ${error.message}`)
    }

    return data as ApplicationWithDetails
  }
)

/**
 * Get member's applications
 */
export const getMemberApplications = cache(
  async (memberId: string): Promise<any[]> => {
    const result = await getApplications({
      page: 1,
      pageSize: 100,
      filters: {
        member_id: memberId,
      },
    })

    // Add UI-friendly aliases to the opportunity
    return result.data.map((app) => ({
      ...app,
      opportunity: app.opportunity ? {
        ...app.opportunity,
        type: mapOpportunityType(app.opportunity.opportunity_type as OpportunityType),
        deadline: app.opportunity.application_deadline,
        stakeholder: app.opportunity.industry_name ? {
          name: app.opportunity.industry_name,
        } : null,
      } : null,
    }))
  }
)

/**
 * Check if member has applied to opportunity
 */
export const checkMemberApplication = cache(
  async (
    opportunityId: string,
    memberId: string
  ): Promise<OpportunityApplication | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('opportunity_applications')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('member_id', memberId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to check application: ${error.message}`)
    }

    return data as OpportunityApplication
  }
)

// ============================================================================
// Visit Request Queries
// ============================================================================

/**
 * Get paginated visit requests with filters
 */
export const getVisitRequests = cache(
  async (params?: {
    page?: number
    pageSize?: number
    filters?: VisitRequestFilters
    sortField?: string
    sortDirection?: 'asc' | 'desc'
  }): Promise<PaginatedVisitRequests> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 10
    const offset = (page - 1) * pageSize
    const filters = params?.filters
    const sortField = params?.sortField || 'created_at'
    const sortDirection = params?.sortDirection || 'desc'

    let query = supabase
      .from('member_visit_requests')
      .select(
        `
        *,
        member:profiles!requested_by(
          id,
          full_name,
          email,
          avatar_url
        ),
        industry:industries!industry_id(
          id,
          company_name,
          city,
          industry_sector
        ),
        mou:stakeholder_mous(
          id,
          mou_title,
          expiry_date,
          partnership_stage
        ),
        yi_reviewer:profiles!yi_reviewer_id(
          id,
          full_name
        )
      `,
        { count: 'exact' }
      )

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    if (filters?.visit_type && filters.visit_type.length > 0) {
      query = query.in('visit_type', filters.visit_type)
    }
    if (filters?.industry_id) {
      query = query.eq('industry_id', filters.industry_id)
    }
    if (filters?.member_id) {
      query = query.eq('requested_by', filters.member_id)
    }
    if (filters?.chapter_id) {
      query = query.eq('chapter_id', filters.chapter_id)
    }

    // Apply sorting and pagination
    query = query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching visit requests:', error)
      throw new Error(`Failed to fetch visit requests: ${error.message}`)
    }

    // Get interested members count
    const requestIds = (data || []).map((r: any) => r.id)
    let interestCounts = new Map<string, number>()

    if (requestIds.length > 0) {
      const { data: interests } = await supabase
        .from('visit_request_interests')
        .select('visit_request_id')
        .in('visit_request_id', requestIds)

      interests?.forEach((i: any) => {
        const count = interestCounts.get(i.visit_request_id) || 0
        interestCounts.set(i.visit_request_id, count + 1)
      })
    }

    // Transform data
    const transformedData: VisitRequestWithDetails[] = (data || []).map((req: any) => ({
      ...req,
      member: req.member,
      industry: req.industry,
      mou: req.mou,
      yi_reviewer: req.yi_reviewer,
      interest_count: interestCounts.get(req.id) || 0,
    }))

    return {
      data: transformedData,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }
  }
)

/**
 * Get visit request by ID
 */
export const getVisitRequestById = cache(
  async (requestId: string): Promise<VisitRequestWithDetails | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('member_visit_requests')
      .select(
        `
        *,
        member:profiles!requested_by(
          id,
          full_name,
          email,
          avatar_url
        ),
        industry:industries!industry_id(
          id,
          company_name,
          city,
          industry_sector
        ),
        mou:stakeholder_mous(
          id,
          mou_title,
          expiry_date,
          partnership_stage
        ),
        yi_reviewer:profiles!yi_reviewer_id(
          id,
          full_name
        )
      `
      )
      .eq('id', requestId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch visit request: ${error.message}`)
    }

    // Get interested members
    const { data: interests } = await supabase
      .from('visit_request_interests')
      .select(
        `
        member:profiles!member_id(
          id,
          full_name,
          avatar_url
        )
      `
      )
      .eq('visit_request_id', requestId)

    return {
      ...data,
      interested_members: interests?.map((i: any) => i.member) || [],
    } as VisitRequestWithDetails
  }
)

/**
 * Get pending visit requests for Yi review
 */
export const getPendingVisitRequests = cache(
  async (): Promise<VisitRequestWithDetails[]> => {
    const result = await getVisitRequests({
      page: 1,
      pageSize: 50,
      filters: {
        status: ['pending_yi_review'],
      },
      sortField: 'created_at',
      sortDirection: 'asc',
    })

    return result.data
  }
)

// ============================================================================
// Industry Impact Metrics
// ============================================================================

/**
 * Get industry impact metrics
 */
export const getIndustryImpactMetrics = cache(
  async (industryId: string): Promise<IndustryImpactMetrics | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('industry_impact_metrics')
      .select('*')
      .eq('industry_id', industryId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch metrics: ${error.message}`)
    }

    return data as IndustryImpactMetrics
  }
)

/**
 * Get top industries by engagement
 */
export const getTopIndustriesByEngagement = cache(
  async (limit: number = 10): Promise<Array<IndustryImpactMetrics & { industry_name: string }>> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('industry_impact_metrics')
      .select(
        `
        *,
        industry:industries!industry_id(
          company_name
        )
      `
      )
      .order('engagement_score', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching top industries:', error)
      throw new Error(`Failed to fetch top industries: ${error.message}`)
    }

    return (data || []).map((m: any) => ({
      ...m,
      industry_name: m.industry?.company_name || 'Unknown',
    }))
  }
)

// ============================================================================
// Bookmarks
// ============================================================================

/**
 * Get member's bookmarked opportunities
 */
export const getMemberBookmarks = cache(
  async (memberId: string): Promise<OpportunityListItem[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data: bookmarks, error } = await supabase
      .from('opportunity_bookmarks')
      .select('opportunity_id')
      .eq('member_id', memberId)

    if (error) {
      throw new Error(`Failed to fetch bookmarks: ${error.message}`)
    }

    if (!bookmarks || bookmarks.length === 0) {
      return []
    }

    const opportunityIds = bookmarks.map((b: any) => b.opportunity_id)

    const result = await getOpportunities({
      page: 1,
      pageSize: 100,
      filters: {
        status: ['published', 'accepting_applications', 'closed'],
      },
    })

    return result.data.filter((o) => opportunityIds.includes(o.id))
  }
)

/**
 * Check if member has bookmarked an opportunity
 */
export const checkMemberBookmark = cache(
  async (opportunityId: string, memberId: string): Promise<boolean> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('opportunity_bookmarks')
      .select('id')
      .eq('opportunity_id', opportunityId)
      .eq('member_id', memberId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check bookmark: ${error.message}`)
    }

    return !!data
  }
)

// ============================================================================
// Match Score Calculation
// ============================================================================

/**
 * Calculate match score between member and opportunity
 */
export const calculateMemberOpportunityMatch = cache(
  async (
    memberId: string,
    opportunityId: string
  ): Promise<MatchScoreBreakdown | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Use database function if available
    const { data, error } = await supabase.rpc('calculate_opportunity_match_score', {
      p_member_id: memberId,
      p_opportunity_id: opportunityId,
    })

    if (error) {
      console.error('Error calculating match score:', error)
      // Return null if function not available
      return null
    }

    return data as MatchScoreBreakdown
  }
)

// ============================================================================
// Additional Query Functions
// ============================================================================

/**
 * Get active industry partners for selection dropdowns
 */
export const getActiveIndustryPartners = cache(
  async (chapterId?: string): Promise<Array<{
    id: string
    name: string
    city?: string | null
    industry_type?: string | null
    logo_url?: string | null
    contact_person?: string | null
    contact_email?: string | null
  }>> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    let query = supabase
      .from('industries')
      .select(`
        id,
        name: company_name,
        city,
        industry_type: industry_sector,
        contact_person: csr_contact_name,
        contact_email: csr_contact_email
      `)
      .eq('status', 'active')
      .order('company_name', { ascending: true })

    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching industry partners:', error)
      return []
    }

    return data || []
  }
)

/**
 * Get opportunities for a member with match scores
 */
export const getOpportunitiesForMember = cache(
  async (
    memberId: string,
    filters?: {
      type?: 'internship' | 'project' | 'mentorship' | 'training' | 'job' | 'visit'
      industry?: string
      status?: string
      search?: string
    }
  ): Promise<Array<any & { match_score?: number }>> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    let query = supabase
      .from('industry_opportunities')
      .select(`
        *,
        stakeholder:industries!industry_id(
          id,
          name: company_name,
          industry_type: industry_sector,
          city,
          state,
          website
        )
      `)
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters?.type) {
      const dbType = mapUiTypeToDbType(filters.type)
      if (dbType) {
        query = query.eq('opportunity_type', dbType)
      }
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching opportunities for member:', error)
      return []
    }

    // Calculate mock match scores and add UI-friendly aliases
    const opportunitiesWithScores = (data || []).map((opp: any) => ({
      ...opp,
      // UI-friendly aliases
      type: mapOpportunityType(opp.opportunity_type),
      deadline: opp.application_deadline,
      match_score: Math.floor(Math.random() * 40) + 60, // Mock score 60-100
      match_breakdown: {
        industry: Math.floor(Math.random() * 100),
        skills: Math.floor(Math.random() * 100),
        experience: Math.floor(Math.random() * 100),
        engagement: Math.floor(Math.random() * 100),
      }
    }))

    return opportunitiesWithScores
  }
)

/**
 * Get opportunity categories/industries for filters
 */
export const getOpportunityCategories = cache(
  async (): Promise<Array<{ industry: string; count: number }>> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('industry_opportunities')
      .select(`
        stakeholder:industries!industry_id(
          industry_type: industry_sector
        )
      `)
      .eq('status', 'accepting_applications')

    if (error) {
      console.error('Error fetching categories:', error)
      return []
    }

    // Count by industry type
    const counts = new Map<string, number>()
    ;(data || []).forEach((opp: any) => {
      const industry = opp.stakeholder?.industry_type || 'Other'
      counts.set(industry, (counts.get(industry) || 0) + 1)
    })

    return Array.from(counts.entries())
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count)
  }
)

/**
 * Get opportunity with match score for detail page
 */
export const getOpportunityWithMatchScore = cache(
  async (
    opportunityId: string,
    memberId: string
  ): Promise<(any & { match_score?: number; match_breakdown?: any }) | null> => {
    const opportunity = await getOpportunityById(opportunityId)

    if (!opportunity) {
      return null
    }

    // Calculate match score (mock implementation)
    const matchScore = Math.floor(Math.random() * 40) + 60
    const matchBreakdown = {
      industry: Math.floor(Math.random() * 100),
      skills: Math.floor(Math.random() * 100),
      experience: Math.floor(Math.random() * 100),
      engagement: Math.floor(Math.random() * 100),
    }

    return {
      ...opportunity,
      match_score: matchScore,
      match_breakdown: matchBreakdown,
    }
  }
)

/**
 * Get member's application for a specific opportunity
 */
export const getMemberApplication = cache(
  async (opportunityId: string, memberId: string): Promise<any | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('opportunity_applications')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching member application:', error)
      return null
    }

    return data
  }
)

/**
 * Get visit requests for a member (my requests)
 */
export const getMyVisitRequests = cache(
  async (memberId: string): Promise<any[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('member_visit_requests')
      .select(`
        *,
        stakeholder:industries!industry_id(
          id,
          name: company_name,
          city,
          state
        ),
        requester:profiles!requested_by(
          full_name,
          avatar_url
        )
      `)
      .eq('requested_by', memberId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching my visit requests:', error)
      return []
    }

    return data || []
  }
)

/**
 * Get opportunities for management (coordinator view)
 */
export const getOpportunitiesForManagement = cache(
  async (chapterId?: string): Promise<Array<any>> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    let query = supabase
      .from('industry_opportunities')
      .select(`
        *,
        stakeholder:industries!industry_id(
          name: company_name
        )
      `)
      .order('created_at', { ascending: false })

    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching opportunities for management:', error)
      return []
    }

    // Get application counts for each opportunity
    const opportunityIds = (data || []).map((o: any) => o.id)

    if (opportunityIds.length > 0) {
      const { data: applications } = await supabase
        .from('opportunity_applications')
        .select('opportunity_id, status')
        .in('opportunity_id', opportunityIds)

      const appCounts = new Map<string, { total: number; pending: number }>()
      ;(applications || []).forEach((app: any) => {
        const current = appCounts.get(app.opportunity_id) || { total: 0, pending: 0 }
        current.total++
        if (app.status === 'pending_review' || app.status === 'under_review') {
          current.pending++
        }
        appCounts.set(app.opportunity_id, current)
      })

      return (data || []).map((opp: any) => {
        const counts = appCounts.get(opp.id) || { total: 0, pending: 0 }
        return {
          ...opp,
          // UI-friendly aliases
          type: mapOpportunityType(opp.opportunity_type),
          deadline: opp.application_deadline,
          applications_count: counts.total,
          pending_applications: counts.pending,
        }
      })
    }

    return (data || []).map((opp: any) => ({
      ...opp,
      // UI-friendly aliases
      type: mapOpportunityType(opp.opportunity_type),
      deadline: opp.application_deadline,
      applications_count: 0,
      pending_applications: 0,
    }))
  }
)

/**
 * Get applications for a specific opportunity
 */
export const getOpportunityApplications = cache(
  async (opportunityId: string): Promise<any[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('opportunity_applications')
      .select(`
        id,
        opportunity_id,
        member_id,
        status,
        motivation_statement,
        learning_goals,
        relevant_experience,
        skills_to_contribute,
        availability_notes,
        resume_url,
        portfolio_url,
        match_score,
        match_breakdown,
        submitted_at,
        reviewed_at,
        review_notes,
        applied_at,
        member:members!member_id(
          id,
          company,
          designation,
          industry,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        )
      `)
      .eq('opportunity_id', opportunityId)
      .order('applied_at', { ascending: false })

    if (error) {
      console.error('Error fetching opportunity applications:', error)
      return []
    }

    // Transform to match ApplicationWithMember shape
    return (data || []).map((app: any) => ({
      ...app,
      submitted_at: app.submitted_at || app.applied_at,
      member: app.member ? {
        id: app.member.id,
        full_name: app.member.profile?.full_name || 'Unknown',
        email: app.member.profile?.email || '',
        avatar_url: app.member.profile?.avatar_url || null,
        company: app.member.company || null,
        designation: app.member.designation || null,
        industry_sector: app.member.industry || null,
        engagement_score: null,
      } : null,
    }))
  }
)
