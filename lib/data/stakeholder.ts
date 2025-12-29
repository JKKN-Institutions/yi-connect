/**
 * Stakeholder Relationship CRM Data Layer
 *
 * Cached data fetching functions for Module 2: Stakeholder Relationship CRM
 * Uses React cache() for request-level deduplication
 * Note: Not using Next.js 'use cache' directive because Supabase uses cookies (dynamic data source)
 */

import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  School,
  SchoolListItem,
  SchoolDetail,
  College,
  CollegeListItem,
  CollegeDetail,
  Industry,
  IndustryListItem,
  IndustryDetail,
  GovernmentStakeholder,
  GovernmentStakeholderListItem,
  GovernmentStakeholderDetail,
  NGO,
  NGOListItem,
  NGODetail,
  Vendor,
  VendorListItem,
  VendorDetail,
  Speaker,
  SpeakerListItem,
  SpeakerDetail,
  StakeholderContact,
  StakeholderInteraction,
  StakeholderMou,
  StakeholderDocument,
  RelationshipHealthScore,
  StakeholderOverviewStats,
  UnifiedStakeholderSearchResult,
  // Pagination types
  StakeholderQueryParams,
  StakeholderFilters,
  PaginatedSchools,
  PaginatedColleges,
  PaginatedIndustries,
  PaginatedGovernmentStakeholders,
  PaginatedNGOs,
  PaginatedVendors,
  PaginatedSpeakers,
} from '@/types/stakeholder'

// ============================================================================
// SCHOOL DATA FUNCTIONS
// ============================================================================

/**
 * Get paginated schools for a chapter
 * Supports filtering, sorting, and pagination
 * If chapterId is null, fetches all schools (for super admins)
 */
export const getSchoolsPaginated = cache(
  async (params: StakeholderQueryParams): Promise<PaginatedSchools> => {
    const supabase = await createServerSupabaseClient()
    const { chapterId, page = 1, pageSize = 20, filters = {}, sort } = params

    // Base query - get schools with optional chapter filter
    let schoolsQuery = supabase.from('schools').select('*', { count: 'exact' })

    if (chapterId) {
      schoolsQuery = schoolsQuery.eq('chapter_id', chapterId)
    }

    // Apply filters
    if (filters.search) {
      schoolsQuery = schoolsQuery.or(
        `school_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
      )
    }
    if (filters.status && filters.status.length > 0) {
      schoolsQuery = schoolsQuery.in('status', filters.status)
    }
    if (filters.city) {
      schoolsQuery = schoolsQuery.ilike('city', `%${filters.city}%`)
    }
    if (filters.state) {
      schoolsQuery = schoolsQuery.eq('state', filters.state)
    }

    // Apply sorting
    const sortField = sort?.field || 'school_name'
    const sortDirection = sort?.direction === 'desc'
    schoolsQuery = schoolsQuery.order(sortField, { ascending: !sortDirection })

    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    schoolsQuery = schoolsQuery.range(from, to)

    const { data: schools, error: schoolsError, count } = await schoolsQuery

    if (schoolsError) {
      console.error('Error fetching schools:', schoolsError)
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }

    if (!schools || schools.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }

    const schoolIds = schools.map((s) => s.id)

    // Fetch related data for counts
    const [contactsData, interactionsData, mousData, healthData] = await Promise.all([
      supabase
        .from('stakeholder_contacts')
        .select('stakeholder_id')
        .eq('stakeholder_type', 'schools')
        .in('stakeholder_id', schoolIds),
      supabase
        .from('stakeholder_interactions')
        .select('stakeholder_id')
        .eq('stakeholder_type', 'schools')
        .in('stakeholder_id', schoolIds),
      supabase
        .from('stakeholder_mous')
        .select('stakeholder_id, mou_status')
        .eq('stakeholder_type', 'schools')
        .in('stakeholder_id', schoolIds),
      supabase
        .from('relationship_health_scores')
        .select('stakeholder_id, overall_score, health_tier, days_since_last_interaction')
        .eq('stakeholder_type', 'schools')
        .in('stakeholder_id', schoolIds),
    ])

    // Create lookup maps for counts
    const contactCounts = new Map<string, number>()
    contactsData.data?.forEach((c) => {
      contactCounts.set(c.stakeholder_id, (contactCounts.get(c.stakeholder_id) || 0) + 1)
    })

    const interactionCounts = new Map<string, number>()
    interactionsData.data?.forEach((i) => {
      interactionCounts.set(i.stakeholder_id, (interactionCounts.get(i.stakeholder_id) || 0) + 1)
    })

    const mouStatusMap = new Map<string, string>()
    mousData.data?.forEach((m) => {
      if (m.mou_status === 'signed') {
        mouStatusMap.set(m.stakeholder_id, 'signed')
      }
    })

    const healthMap = new Map<string, any>()
    healthData.data?.forEach((h) => {
      healthMap.set(h.stakeholder_id, h)
    })

    // Apply health tier filter (post-fetch since it's from a different table)
    let filteredSchools = schools
    if (filters.health_tier && filters.health_tier.length > 0) {
      filteredSchools = schools.filter((s) => {
        const health = healthMap.get(s.id)
        return health && filters.health_tier!.includes(health.health_tier)
      })
    }
    if (filters.mou_status && filters.mou_status.length > 0) {
      filteredSchools = filteredSchools.filter((s) => {
        const mouStatus = mouStatusMap.get(s.id) || 'none'
        return filters.mou_status!.includes(mouStatus as any)
      })
    }

    // Combine data
    const data = filteredSchools.map((school) => {
      const health = healthMap.get(school.id)
      return {
        ...school,
        contact_count: contactCounts.get(school.id) || 0,
        interaction_count: interactionCounts.get(school.id) || 0,
        mou_status: mouStatusMap.get(school.id) || 'none',
        health_score: health?.overall_score,
        health_tier: health?.health_tier,
        days_since_last_contact: health?.days_since_last_interaction,
      }
    }) as SchoolListItem[]

    const total = count || 0
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }
)

/**
 * Get all schools for a chapter (legacy - for backward compatibility)
 * Consider using getSchoolsPaginated for large datasets
 */
export const getSchools = cache(async (chapterId: string | null): Promise<SchoolListItem[]> => {
  const result = await getSchoolsPaginated({ chapterId, pageSize: 1000 })
  return result.data
})

export const getSchoolById = cache(async (schoolId: string): Promise<SchoolDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: school, error } = await supabase
    .from('schools')
    .select(`
      *,
      connected_member:members!schools_connected_through_member_id_fkey(
        id,
        profiles!inner(full_name)
      )
    `)
    .eq('id', schoolId)
    .single()

  if (error || !school) {
    console.error('Error fetching school:', error)
    return null
  }

  // Fetch all related data
  const [contacts, interactions, mous, documents, healthScore] = await Promise.all([
    getStakeholderContacts('school', schoolId),
    getStakeholderInteractions('school', schoolId),
    getStakeholderMous('school', schoolId),
    getStakeholderDocuments('school', schoolId),
    getStakeholderHealthScore('school', schoolId),
  ])

  return {
    ...school,
    contacts,
    interactions,
    mous,
    documents,
    health_score: healthScore,
  } as SchoolDetail
})

// ============================================================================
// COLLEGE DATA FUNCTIONS
// ============================================================================

/**
 * Get paginated colleges for a chapter
 * Supports filtering, sorting, and pagination
 */
export const getCollegesPaginated = cache(
  async (params: StakeholderQueryParams): Promise<PaginatedColleges> => {
    const supabase = await createServerSupabaseClient()
    const { chapterId, page = 1, pageSize = 20, filters = {}, sort } = params

    let collegesQuery = supabase.from('colleges').select('*', { count: 'exact' })
    if (chapterId) collegesQuery = collegesQuery.eq('chapter_id', chapterId)

    // Apply filters
    if (filters.search) {
      collegesQuery = collegesQuery.or(
        `college_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
      )
    }
    if (filters.status && filters.status.length > 0) {
      collegesQuery = collegesQuery.in('status', filters.status)
    }
    if (filters.city) collegesQuery = collegesQuery.ilike('city', `%${filters.city}%`)
    if (filters.state) collegesQuery = collegesQuery.eq('state', filters.state)

    // Apply sorting
    const sortField = sort?.field || 'college_name'
    collegesQuery = collegesQuery.order(sortField, { ascending: sort?.direction !== 'desc' })

    // Apply pagination
    const from = (page - 1) * pageSize
    collegesQuery = collegesQuery.range(from, from + pageSize - 1)

    const { data: colleges, error: collegesError, count } = await collegesQuery
    if (collegesError) {
      console.error('Error fetching colleges:', collegesError)
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }
    if (!colleges || colleges.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }

    const collegeIds = colleges.map((c) => c.id)
    const [contactsData, interactionsData, mousData, healthData] = await Promise.all([
      supabase.from('stakeholder_contacts').select('stakeholder_id').eq('stakeholder_type', 'colleges').in('stakeholder_id', collegeIds),
      supabase.from('stakeholder_interactions').select('stakeholder_id').eq('stakeholder_type', 'colleges').in('stakeholder_id', collegeIds),
      supabase.from('stakeholder_mous').select('stakeholder_id, mou_status').eq('stakeholder_type', 'colleges').in('stakeholder_id', collegeIds),
      supabase.from('relationship_health_scores').select('stakeholder_id, overall_score, health_tier, days_since_last_interaction').eq('stakeholder_type', 'colleges').in('stakeholder_id', collegeIds),
    ])

    const contactCounts = new Map<string, number>()
    contactsData.data?.forEach((c) => contactCounts.set(c.stakeholder_id, (contactCounts.get(c.stakeholder_id) || 0) + 1))

    const interactionCounts = new Map<string, number>()
    interactionsData.data?.forEach((i) => interactionCounts.set(i.stakeholder_id, (interactionCounts.get(i.stakeholder_id) || 0) + 1))

    const mouStatusMap = new Map<string, string>()
    mousData.data?.forEach((m) => { if (m.mou_status === 'signed') mouStatusMap.set(m.stakeholder_id, 'signed') })

    const healthMap = new Map<string, any>()
    healthData.data?.forEach((h) => healthMap.set(h.stakeholder_id, h))

    const data = colleges.map((college) => {
      const health = healthMap.get(college.id)
      return {
        ...college,
        contact_count: contactCounts.get(college.id) || 0,
        interaction_count: interactionCounts.get(college.id) || 0,
        mou_status: mouStatusMap.get(college.id) || 'none',
        health_score: health?.overall_score,
        health_tier: health?.health_tier,
        days_since_last_contact: health?.days_since_last_interaction,
      }
    }) as CollegeListItem[]

    const total = count || 0
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
)

/**
 * Get all colleges for a chapter (legacy - for backward compatibility)
 */
export const getColleges = cache(async (chapterId: string | null): Promise<CollegeListItem[]> => {
  const result = await getCollegesPaginated({ chapterId, pageSize: 1000 })
  return result.data
})

export const getCollegeById = cache(async (collegeId: string): Promise<CollegeDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: college, error } = await supabase
    .from('colleges')
    .select(`
      *,
      connected_member:members!colleges_connected_through_member_id_fkey(id, profiles!inner(full_name))
    `)
    .eq('id', collegeId)
    .single()

  if (error || !college) {
    console.error('Error fetching college:', error)
    return null
  }

  const [contacts, interactions, mous, documents, healthScore] = await Promise.all([
    getStakeholderContacts('college', collegeId),
    getStakeholderInteractions('college', collegeId),
    getStakeholderMous('college', collegeId),
    getStakeholderDocuments('college', collegeId),
    getStakeholderHealthScore('college', collegeId),
  ])

  return {
    ...college,
    contacts,
    interactions,
    mous,
    documents,
    health_score: healthScore,
  } as CollegeDetail
})

// ============================================================================
// INDUSTRY DATA FUNCTIONS
// ============================================================================

/**
 * Get paginated industries for a chapter
 * Supports filtering, sorting, and pagination
 */
export const getIndustriesPaginated = cache(
  async (params: StakeholderQueryParams): Promise<PaginatedIndustries> => {
    const supabase = await createServerSupabaseClient()
    const { chapterId, page = 1, pageSize = 20, filters = {}, sort } = params

    let industriesQuery = supabase.from('industries').select('*', { count: 'exact' })
    if (chapterId) industriesQuery = industriesQuery.eq('chapter_id', chapterId)

    // Apply filters
    if (filters.search) {
      industriesQuery = industriesQuery.or(
        `company_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
      )
    }
    if (filters.status && filters.status.length > 0) {
      industriesQuery = industriesQuery.in('status', filters.status)
    }
    if (filters.city) industriesQuery = industriesQuery.ilike('city', `%${filters.city}%`)
    if (filters.state) industriesQuery = industriesQuery.eq('state', filters.state)

    // Apply sorting
    const sortField = sort?.field || 'company_name'
    industriesQuery = industriesQuery.order(sortField, { ascending: sort?.direction !== 'desc' })

    // Apply pagination
    const from = (page - 1) * pageSize
    industriesQuery = industriesQuery.range(from, from + pageSize - 1)

    const { data: industries, error: industriesError, count } = await industriesQuery
    if (industriesError) {
      console.error('Error fetching industries:', industriesError)
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }
    if (!industries || industries.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }

    const industryIds = industries.map((i) => i.id)
    const [contactsData, interactionsData, mousData, healthData] = await Promise.all([
      supabase.from('stakeholder_contacts').select('stakeholder_id').eq('stakeholder_type', 'industries').in('stakeholder_id', industryIds),
      supabase.from('stakeholder_interactions').select('stakeholder_id').eq('stakeholder_type', 'industries').in('stakeholder_id', industryIds),
      supabase.from('stakeholder_mous').select('stakeholder_id, mou_status').eq('stakeholder_type', 'industries').in('stakeholder_id', industryIds),
      supabase.from('relationship_health_scores').select('stakeholder_id, overall_score, health_tier, days_since_last_interaction').eq('stakeholder_type', 'industries').in('stakeholder_id', industryIds),
    ])

    const contactCounts = new Map<string, number>()
    contactsData.data?.forEach((c) => contactCounts.set(c.stakeholder_id, (contactCounts.get(c.stakeholder_id) || 0) + 1))

    const interactionCounts = new Map<string, number>()
    interactionsData.data?.forEach((i) => interactionCounts.set(i.stakeholder_id, (interactionCounts.get(i.stakeholder_id) || 0) + 1))

    const mouStatusMap = new Map<string, string>()
    mousData.data?.forEach((m) => { if (m.mou_status === 'signed') mouStatusMap.set(m.stakeholder_id, 'signed') })

    const healthMap = new Map<string, any>()
    healthData.data?.forEach((h) => healthMap.set(h.stakeholder_id, h))

    const data = industries.map((industry) => {
      const health = healthMap.get(industry.id)
      return {
        ...industry,
        contact_count: contactCounts.get(industry.id) || 0,
        interaction_count: interactionCounts.get(industry.id) || 0,
        mou_status: mouStatusMap.get(industry.id) || 'none',
        health_score: health?.overall_score,
        health_tier: health?.health_tier,
        days_since_last_contact: health?.days_since_last_interaction,
      }
    }) as IndustryListItem[]

    const total = count || 0
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
)

/**
 * Get all industries for a chapter (legacy - for backward compatibility)
 */
export const getIndustries = cache(async (chapterId: string | null): Promise<IndustryListItem[]> => {
  const result = await getIndustriesPaginated({ chapterId, pageSize: 1000 })
  return result.data
})

export const getIndustryById = cache(async (industryId: string): Promise<IndustryDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: industry, error } = await supabase
    .from('industries')
    .select(`
      *,
      connected_member:members!industries_connected_through_member_id_fkey(id, profiles!inner(full_name))
    `)
    .eq('id', industryId)
    .single()

  if (error || !industry) {
    console.error('Error fetching industry:', error)
    return null
  }

  const [contacts, interactions, mous, documents, healthScore] = await Promise.all([
    getStakeholderContacts('industry', industryId),
    getStakeholderInteractions('industry', industryId),
    getStakeholderMous('industry', industryId),
    getStakeholderDocuments('industry', industryId),
    getStakeholderHealthScore('industry', industryId),
  ])

  return {
    ...industry,
    contacts,
    interactions,
    mous,
    documents,
    health_score: healthScore,
  } as IndustryDetail
})

// ============================================================================
// GOVERNMENT STAKEHOLDER DATA FUNCTIONS
// ============================================================================

/**
 * Get paginated government stakeholders for a chapter
 * Supports filtering, sorting, and pagination
 */
export const getGovernmentStakeholdersPaginated = cache(
  async (params: StakeholderQueryParams): Promise<PaginatedGovernmentStakeholders> => {
    const supabase = await createServerSupabaseClient()
    const { chapterId, page = 1, pageSize = 20, filters = {}, sort } = params

    let govQuery = supabase.from('government_stakeholders').select('*', { count: 'exact' })
    if (chapterId) govQuery = govQuery.eq('chapter_id', chapterId)

    // Apply filters
    if (filters.search) {
      govQuery = govQuery.or(
        `official_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,department.ilike.%${filters.search}%`
      )
    }
    if (filters.status && filters.status.length > 0) {
      govQuery = govQuery.in('status', filters.status)
    }
    if (filters.city) govQuery = govQuery.ilike('city', `%${filters.city}%`)
    if (filters.state) govQuery = govQuery.eq('state', filters.state)

    // Apply sorting
    const sortField = sort?.field || 'official_name'
    govQuery = govQuery.order(sortField, { ascending: sort?.direction !== 'desc' })

    // Apply pagination
    const from = (page - 1) * pageSize
    govQuery = govQuery.range(from, from + pageSize - 1)

    const { data: govStakeholders, error: govError, count } = await govQuery
    if (govError) {
      console.error('Error fetching government stakeholders:', govError)
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }
    if (!govStakeholders || govStakeholders.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }

    const govIds = govStakeholders.map((g) => g.id)
    const [contactsData, interactionsData, mousData, healthData] = await Promise.all([
      supabase.from('stakeholder_contacts').select('stakeholder_id').eq('stakeholder_type', 'government').in('stakeholder_id', govIds),
      supabase.from('stakeholder_interactions').select('stakeholder_id').eq('stakeholder_type', 'government').in('stakeholder_id', govIds),
      supabase.from('stakeholder_mous').select('stakeholder_id, mou_status').eq('stakeholder_type', 'government').in('stakeholder_id', govIds),
      supabase.from('relationship_health_scores').select('stakeholder_id, overall_score, health_tier, days_since_last_interaction').eq('stakeholder_type', 'government').in('stakeholder_id', govIds),
    ])

    const contactCounts = new Map<string, number>()
    contactsData.data?.forEach((c) => contactCounts.set(c.stakeholder_id, (contactCounts.get(c.stakeholder_id) || 0) + 1))

    const interactionCounts = new Map<string, number>()
    interactionsData.data?.forEach((i) => interactionCounts.set(i.stakeholder_id, (interactionCounts.get(i.stakeholder_id) || 0) + 1))

    const mouStatusMap = new Map<string, string>()
    mousData.data?.forEach((m) => { if (m.mou_status === 'signed') mouStatusMap.set(m.stakeholder_id, 'signed') })

    const healthMap = new Map<string, any>()
    healthData.data?.forEach((h) => healthMap.set(h.stakeholder_id, h))

    const data = govStakeholders.map((stakeholder) => {
      let tenure_status: 'active' | 'expiring_soon' | 'expired' = 'active'
      if (stakeholder.tenure_end_date) {
        const endDate = new Date(stakeholder.tenure_end_date)
        const now = new Date()
        const daysUntilExpiry = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (daysUntilExpiry < 0) tenure_status = 'expired'
        else if (daysUntilExpiry <= 90) tenure_status = 'expiring_soon'
      }

      const health = healthMap.get(stakeholder.id)
      return {
        ...stakeholder,
        contact_count: contactCounts.get(stakeholder.id) || 0,
        interaction_count: interactionCounts.get(stakeholder.id) || 0,
        mou_status: mouStatusMap.get(stakeholder.id) || 'none',
        health_score: health?.overall_score,
        health_tier: health?.health_tier,
        days_since_last_contact: health?.days_since_last_interaction,
        tenure_status,
      }
    }) as GovernmentStakeholderListItem[]

    const total = count || 0
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
)

/**
 * Get all government stakeholders for a chapter (legacy - for backward compatibility)
 */
export const getGovernmentStakeholders = cache(async (chapterId: string | null): Promise<GovernmentStakeholderListItem[]> => {
  const result = await getGovernmentStakeholdersPaginated({ chapterId, pageSize: 1000 })
  return result.data
})

export const getGovernmentStakeholderById = cache(async (stakeholderId: string): Promise<GovernmentStakeholderDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: stakeholder, error } = await supabase
    .from('government_stakeholders')
    .select(`
      *,
      connected_member:members!government_stakeholders_connected_through_member_id_fkey(id, profiles!inner(full_name))
    `)
    .eq('id', stakeholderId)
    .single()

  if (error || !stakeholder) {
    console.error('Error fetching government stakeholder:', error)
    return null
  }

  const [contacts, interactions, mous, documents, healthScore] = await Promise.all([
    getStakeholderContacts('government', stakeholderId),
    getStakeholderInteractions('government', stakeholderId),
    getStakeholderMous('government', stakeholderId),
    getStakeholderDocuments('government', stakeholderId),
    getStakeholderHealthScore('government', stakeholderId),
  ])

  return {
    ...stakeholder,
    contacts,
    interactions,
    mous,
    documents,
    health_score: healthScore,
  } as GovernmentStakeholderDetail
})

// ============================================================================
// NGO DATA FUNCTIONS
// ============================================================================

/**
 * Get paginated NGOs for a chapter
 * Supports filtering, sorting, and pagination
 */
export const getNGOsPaginated = cache(
  async (params: StakeholderQueryParams): Promise<PaginatedNGOs> => {
    const supabase = await createServerSupabaseClient()
    const { chapterId, page = 1, pageSize = 20, filters = {}, sort } = params

    let ngosQuery = supabase.from('ngos').select('*', { count: 'exact' })
    if (chapterId) ngosQuery = ngosQuery.eq('chapter_id', chapterId)

    // Apply filters
    if (filters.search) {
      ngosQuery = ngosQuery.or(
        `ngo_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,focus_area.ilike.%${filters.search}%`
      )
    }
    if (filters.status && filters.status.length > 0) {
      ngosQuery = ngosQuery.in('status', filters.status)
    }
    if (filters.city) ngosQuery = ngosQuery.ilike('city', `%${filters.city}%`)
    if (filters.state) ngosQuery = ngosQuery.eq('state', filters.state)

    // Apply sorting
    const sortField = sort?.field || 'ngo_name'
    ngosQuery = ngosQuery.order(sortField, { ascending: sort?.direction !== 'desc' })

    // Apply pagination
    const from = (page - 1) * pageSize
    ngosQuery = ngosQuery.range(from, from + pageSize - 1)

    const { data: ngos, error: ngosError, count } = await ngosQuery
    if (ngosError) {
      console.error('Error fetching NGOs:', ngosError)
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }
    if (!ngos || ngos.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }

    const ngoIds = ngos.map((n) => n.id)
    const [contactsData, interactionsData, mousData, healthData] = await Promise.all([
      supabase.from('stakeholder_contacts').select('stakeholder_id').eq('stakeholder_type', 'ngos').in('stakeholder_id', ngoIds),
      supabase.from('stakeholder_interactions').select('stakeholder_id').eq('stakeholder_type', 'ngos').in('stakeholder_id', ngoIds),
      supabase.from('stakeholder_mous').select('stakeholder_id, mou_status').eq('stakeholder_type', 'ngos').in('stakeholder_id', ngoIds),
      supabase.from('relationship_health_scores').select('stakeholder_id, overall_score, health_tier, days_since_last_interaction').eq('stakeholder_type', 'ngos').in('stakeholder_id', ngoIds),
    ])

    const contactCounts = new Map<string, number>()
    contactsData.data?.forEach((c) => contactCounts.set(c.stakeholder_id, (contactCounts.get(c.stakeholder_id) || 0) + 1))

    const interactionCounts = new Map<string, number>()
    interactionsData.data?.forEach((i) => interactionCounts.set(i.stakeholder_id, (interactionCounts.get(i.stakeholder_id) || 0) + 1))

    const mouStatusMap = new Map<string, string>()
    mousData.data?.forEach((m) => { if (m.mou_status === 'signed') mouStatusMap.set(m.stakeholder_id, 'signed') })

    const healthMap = new Map<string, any>()
    healthData.data?.forEach((h) => healthMap.set(h.stakeholder_id, h))

    const data = ngos.map((ngo) => {
      const health = healthMap.get(ngo.id)
      return {
        ...ngo,
        contact_count: contactCounts.get(ngo.id) || 0,
        interaction_count: interactionCounts.get(ngo.id) || 0,
        mou_status: mouStatusMap.get(ngo.id) || 'none',
        health_score: health?.overall_score,
        health_tier: health?.health_tier,
        days_since_last_contact: health?.days_since_last_interaction,
      }
    }) as NGOListItem[]

    const total = count || 0
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
)

/**
 * Get all NGOs for a chapter (legacy - for backward compatibility)
 */
export const getNGOs = cache(async (chapterId: string | null): Promise<NGOListItem[]> => {
  const result = await getNGOsPaginated({ chapterId, pageSize: 1000 })
  return result.data
})

export const getNGOById = cache(async (ngoId: string): Promise<NGODetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: ngo, error } = await supabase
    .from('ngos')
    .select(`
      *,
      connected_member:members!ngos_connected_through_member_id_fkey(id, profiles!inner(full_name))
    `)
    .eq('id', ngoId)
    .single()

  if (error || !ngo) {
    console.error('Error fetching NGO:', error)
    return null
  }

  const [contacts, interactions, mous, documents, healthScore] = await Promise.all([
    getStakeholderContacts('ngo', ngoId),
    getStakeholderInteractions('ngo', ngoId),
    getStakeholderMous('ngo', ngoId),
    getStakeholderDocuments('ngo', ngoId),
    getStakeholderHealthScore('ngo', ngoId),
  ])

  return {
    ...ngo,
    contacts,
    interactions,
    mous,
    documents,
    health_score: healthScore,
  } as NGODetail
})

// ============================================================================
// VENDOR DATA FUNCTIONS
// ============================================================================

/**
 * Get paginated vendors for a chapter
 * Supports filtering, sorting, and pagination
 */
export const getVendorsPaginated = cache(
  async (params: StakeholderQueryParams): Promise<PaginatedVendors> => {
    const supabase = await createServerSupabaseClient()
    const { chapterId, page = 1, pageSize = 20, filters = {}, sort } = params

    let vendorsQuery = supabase.from('vendors').select('*', { count: 'exact' })
    if (chapterId) vendorsQuery = vendorsQuery.eq('chapter_id', chapterId)

    // Apply filters
    if (filters.search) {
      vendorsQuery = vendorsQuery.or(
        `vendor_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,service_category.ilike.%${filters.search}%`
      )
    }
    if (filters.status && filters.status.length > 0) {
      vendorsQuery = vendorsQuery.in('status', filters.status)
    }
    if (filters.city) vendorsQuery = vendorsQuery.ilike('city', `%${filters.city}%`)
    if (filters.state) vendorsQuery = vendorsQuery.eq('state', filters.state)

    // Apply sorting
    const sortField = sort?.field || 'vendor_name'
    vendorsQuery = vendorsQuery.order(sortField, { ascending: sort?.direction !== 'desc' })

    // Apply pagination
    const from = (page - 1) * pageSize
    vendorsQuery = vendorsQuery.range(from, from + pageSize - 1)

    const { data: vendors, error: vendorsError, count } = await vendorsQuery
    if (vendorsError) {
      console.error('Error fetching vendors:', vendorsError)
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }
    if (!vendors || vendors.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }

    const vendorIds = vendors.map((v) => v.id)
    const [contactsData, interactionsData, healthData] = await Promise.all([
      supabase.from('stakeholder_contacts').select('stakeholder_id').eq('stakeholder_type', 'vendors').in('stakeholder_id', vendorIds),
      supabase.from('stakeholder_interactions').select('stakeholder_id').eq('stakeholder_type', 'vendors').in('stakeholder_id', vendorIds),
      supabase.from('relationship_health_scores').select('stakeholder_id, overall_score, health_tier, days_since_last_interaction').eq('stakeholder_type', 'vendors').in('stakeholder_id', vendorIds),
    ])

    const contactCounts = new Map<string, number>()
    contactsData.data?.forEach((c) => contactCounts.set(c.stakeholder_id, (contactCounts.get(c.stakeholder_id) || 0) + 1))

    const interactionCounts = new Map<string, number>()
    interactionsData.data?.forEach((i) => interactionCounts.set(i.stakeholder_id, (interactionCounts.get(i.stakeholder_id) || 0) + 1))

    const healthMap = new Map<string, any>()
    healthData.data?.forEach((h) => healthMap.set(h.stakeholder_id, h))

    const data = vendors.map((vendor) => {
      const health = healthMap.get(vendor.id)
      return {
        ...vendor,
        contact_count: contactCounts.get(vendor.id) || 0,
        interaction_count: interactionCounts.get(vendor.id) || 0,
        health_score: health?.overall_score,
        health_tier: health?.health_tier,
        days_since_last_contact: health?.days_since_last_interaction,
      }
    }) as VendorListItem[]

    const total = count || 0
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
)

/**
 * Get all vendors for a chapter (legacy - for backward compatibility)
 */
export const getVendors = cache(async (chapterId: string | null): Promise<VendorListItem[]> => {
  const result = await getVendorsPaginated({ chapterId, pageSize: 1000 })
  return result.data
})

export const getVendorById = cache(async (vendorId: string): Promise<VendorDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: vendor, error } = await supabase
    .from('vendors')
    .select(`
      *,
      connected_member:members!vendors_connected_through_member_id_fkey(id, profiles!inner(full_name))
    `)
    .eq('id', vendorId)
    .single()

  if (error || !vendor) {
    console.error('Error fetching vendor:', error)
    return null
  }

  const [contacts, interactions, documents, healthScore] = await Promise.all([
    getStakeholderContacts('vendor', vendorId),
    getStakeholderInteractions('vendor', vendorId),
    getStakeholderDocuments('vendor', vendorId),
    getStakeholderHealthScore('vendor', vendorId),
  ])

  return {
    ...vendor,
    contacts,
    interactions,
    documents,
    health_score: healthScore,
  } as VendorDetail
})

// ============================================================================
// SPEAKER DATA FUNCTIONS
// ============================================================================

/**
 * Get paginated speakers for a chapter
 * Supports filtering, sorting, and pagination
 */
export const getSpeakersPaginated = cache(
  async (params: StakeholderQueryParams): Promise<PaginatedSpeakers> => {
    const supabase = await createServerSupabaseClient()
    const { chapterId, page = 1, pageSize = 20, filters = {}, sort } = params

    let speakersQuery = supabase.from('speakers').select('*', { count: 'exact' })
    if (chapterId) speakersQuery = speakersQuery.eq('chapter_id', chapterId)

    // Apply filters
    if (filters.search) {
      speakersQuery = speakersQuery.or(
        `speaker_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,expertise.ilike.%${filters.search}%`
      )
    }
    if (filters.status && filters.status.length > 0) {
      speakersQuery = speakersQuery.in('status', filters.status)
    }
    if (filters.city) speakersQuery = speakersQuery.ilike('city', `%${filters.city}%`)
    if (filters.state) speakersQuery = speakersQuery.eq('state', filters.state)

    // Apply sorting
    const sortField = sort?.field || 'speaker_name'
    speakersQuery = speakersQuery.order(sortField, { ascending: sort?.direction !== 'desc' })

    // Apply pagination
    const from = (page - 1) * pageSize
    speakersQuery = speakersQuery.range(from, from + pageSize - 1)

    const { data: speakers, error: speakersError, count } = await speakersQuery
    if (speakersError) {
      console.error('Error fetching speakers:', speakersError)
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }
    if (!speakers || speakers.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 }
    }

    const speakerIds = speakers.map((s) => s.id)
    const [contactsData, interactionsData, healthData] = await Promise.all([
      supabase.from('stakeholder_contacts').select('stakeholder_id').eq('stakeholder_type', 'speakers').in('stakeholder_id', speakerIds),
      supabase.from('stakeholder_interactions').select('stakeholder_id').eq('stakeholder_type', 'speakers').in('stakeholder_id', speakerIds),
      supabase.from('relationship_health_scores').select('stakeholder_id, overall_score, health_tier, days_since_last_interaction').eq('stakeholder_type', 'speakers').in('stakeholder_id', speakerIds),
    ])

    const contactCounts = new Map<string, number>()
    contactsData.data?.forEach((c) => contactCounts.set(c.stakeholder_id, (contactCounts.get(c.stakeholder_id) || 0) + 1))

    const interactionCounts = new Map<string, number>()
    interactionsData.data?.forEach((i) => interactionCounts.set(i.stakeholder_id, (interactionCounts.get(i.stakeholder_id) || 0) + 1))

    const healthMap = new Map<string, any>()
    healthData.data?.forEach((h) => healthMap.set(h.stakeholder_id, h))

    const data = speakers.map((speaker) => {
      let availability_indicator: 'available' | 'busy' | 'unknown' = 'unknown'
      if (speaker.availability_status) {
        availability_indicator = speaker.availability_status === 'available' ? 'available' : 'busy'
      }

      const health = healthMap.get(speaker.id)
      return {
        ...speaker,
        contact_count: contactCounts.get(speaker.id) || 0,
        interaction_count: interactionCounts.get(speaker.id) || 0,
        health_score: health?.overall_score,
        health_tier: health?.health_tier,
        days_since_last_contact: health?.days_since_last_interaction,
        availability_indicator,
      }
    }) as SpeakerListItem[]

    const total = count || 0
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
)

/**
 * Get all speakers for a chapter (legacy - for backward compatibility)
 */
export const getSpeakers = cache(async (chapterId: string | null): Promise<SpeakerListItem[]> => {
  const result = await getSpeakersPaginated({ chapterId, pageSize: 1000 })
  return result.data
})

export const getSpeakerById = cache(async (speakerId: string): Promise<SpeakerDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: speaker, error } = await supabase
    .from('speakers')
    .select(`
      *,
      connected_member:members!speakers_connected_through_member_id_fkey(id, profiles!inner(full_name))
    `)
    .eq('id', speakerId)
    .single()

  if (error || !speaker) {
    console.error('Error fetching speaker:', error)
    return null
  }

  const [contacts, interactions, documents, healthScore] = await Promise.all([
    getStakeholderContacts('speaker', speakerId),
    getStakeholderInteractions('speaker', speakerId),
    getStakeholderDocuments('speaker', speakerId),
    getStakeholderHealthScore('speaker', speakerId),
  ])

  return {
    ...speaker,
    contacts,
    interactions,
    documents,
    health_score: healthScore,
  } as SpeakerDetail
})

// ============================================================================
// SHARED RELATIONSHIP DATA FUNCTIONS
// ============================================================================

export const getStakeholderContacts = cache(
  async (stakeholderType: string, stakeholderId: string): Promise<StakeholderContact[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('stakeholder_contacts')
      .select('*')
      .eq('stakeholder_type', stakeholderType)
      .eq('stakeholder_id', stakeholderId)
      .order('is_primary_contact', { ascending: false })
      .order('contact_name')

    if (error) {
      console.error('Error fetching stakeholder contacts:', error)
      return []
    }

    return (data || []) as StakeholderContact[]
  }
)

export const getStakeholderInteractions = cache(
  async (stakeholderType: string, stakeholderId: string): Promise<StakeholderInteraction[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('stakeholder_interactions')
      .select(`
        *,
        led_by:members!stakeholder_interactions_led_by_member_id_fkey(
          id,
          profiles!members_id_fkey(id, full_name, email)
        )
      `)
      .eq('stakeholder_type', stakeholderType)
      .eq('stakeholder_id', stakeholderId)
      .order('interaction_date', { ascending: false })

    if (error) {
      console.error('Error fetching stakeholder interactions:', error)
      return []
    }

    return (data || []) as StakeholderInteraction[]
  }
)

export const getStakeholderMous = cache(
  async (stakeholderType: string, stakeholderId: string): Promise<StakeholderMou[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('stakeholder_mous')
      .select('*')
      .eq('stakeholder_type', stakeholderType)
      .eq('stakeholder_id', stakeholderId)
      .order('signed_date', { ascending: false })

    if (error) {
      console.error('Error fetching stakeholder MoUs:', error)
      return []
    }

    return (data || []) as StakeholderMou[]
  }
)

export const getStakeholderDocuments = cache(
  async (stakeholderType: string, stakeholderId: string): Promise<StakeholderDocument[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('stakeholder_documents')
      .select('*')
      .eq('stakeholder_type', stakeholderType)
      .eq('stakeholder_id', stakeholderId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching stakeholder documents:', error)
      return []
    }

    return (data || []) as StakeholderDocument[]
  }
)

export const getStakeholderHealthScore = cache(
  async (stakeholderType: string, stakeholderId: string): Promise<RelationshipHealthScore | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('relationship_health_scores')
      .select('*')
      .eq('stakeholder_type', stakeholderType)
      .eq('stakeholder_id', stakeholderId)
      .single()

    if (error) {
      // It's ok if no health score exists yet
      return null
    }

    return data as RelationshipHealthScore
  }
)

// ============================================================================
// UNIFIED SEARCH & DASHBOARD FUNCTIONS
// ============================================================================

export const searchStakeholders = cache(
  async (chapterId: string, searchTerm: string): Promise<UnifiedStakeholderSearchResult[]> => {
    const supabase = await createServerSupabaseClient()

    // Search across all stakeholder types
    const [schools, colleges, industries, government, ngos, vendors, speakers] = await Promise.all([
      supabase
        .from('schools')
        .select('id, school_name, status, city, state, last_contact_date')
        .eq('chapter_id', chapterId)
        .textSearch('search_vector', searchTerm)
        .limit(5),
      supabase
        .from('colleges')
        .select('id, college_name, status, city, state, last_contact_date')
        .eq('chapter_id', chapterId)
        .textSearch('search_vector', searchTerm)
        .limit(5),
      supabase
        .from('industries')
        .select('id, company_name, status, city, state')
        .eq('chapter_id', chapterId)
        .textSearch('search_vector', searchTerm)
        .limit(5),
      supabase
        .from('government_stakeholders')
        .select('id, official_name, status, city, state, last_contact_date')
        .eq('chapter_id', chapterId)
        .textSearch('search_vector', searchTerm)
        .limit(5),
      supabase
        .from('ngos')
        .select('id, ngo_name, status, city, state, last_contact_date')
        .eq('chapter_id', chapterId)
        .textSearch('search_vector', searchTerm)
        .limit(5),
      supabase
        .from('vendors')
        .select('id, vendor_name, status, city, state, last_contact_date')
        .eq('chapter_id', chapterId)
        .textSearch('search_vector', searchTerm)
        .limit(5),
      supabase
        .from('speakers')
        .select('id, speaker_name, status, city, state, last_contact_date')
        .eq('chapter_id', chapterId)
        .textSearch('search_vector', searchTerm)
        .limit(5),
    ])

    // Combine and format results
    const results: UnifiedStakeholderSearchResult[] = []

    schools.data?.forEach((s) => {
      results.push({
        id: s.id,
        type: 'school',
        name: s.school_name,
        status: s.status,
        last_contact_date: s.last_contact_date,
        city: s.city,
        state: s.state,
      })
    })

    colleges.data?.forEach((c) => {
      results.push({
        id: c.id,
        type: 'college',
        name: c.college_name,
        status: c.status,
        last_contact_date: c.last_contact_date,
        city: c.city,
        state: c.state,
      })
    })

    industries.data?.forEach((i) => {
      results.push({
        id: i.id,
        type: 'industry',
        name: i.company_name,
        status: i.status,
        city: i.city,
        state: i.state,
      })
    })

    government.data?.forEach((g) => {
      results.push({
        id: g.id,
        type: 'government',
        name: g.official_name,
        status: g.status,
        last_contact_date: g.last_contact_date,
        city: g.city,
        state: g.state,
      })
    })

    ngos.data?.forEach((n) => {
      results.push({
        id: n.id,
        type: 'ngo',
        name: n.ngo_name,
        status: n.status,
        last_contact_date: n.last_contact_date,
        city: n.city,
        state: n.state,
      })
    })

    vendors.data?.forEach((v) => {
      results.push({
        id: v.id,
        type: 'vendor',
        name: v.vendor_name,
        status: v.status,
        last_contact_date: v.last_contact_date,
        city: v.city,
        state: v.state,
      })
    })

    speakers.data?.forEach((sp) => {
      results.push({
        id: sp.id,
        type: 'speaker',
        name: sp.speaker_name,
        status: sp.status,
        last_contact_date: sp.last_contact_date,
        city: sp.city,
        state: sp.state,
      })
    })

    return results
  }
)

/**
 * Get stakeholder overview statistics
 * If chapterId is null, aggregates across all chapters (for super admins)
 */
export const getStakeholderOverview = cache(async (chapterId: string | null): Promise<StakeholderOverviewStats> => {
  const supabase = await createServerSupabaseClient()

  // Helper to conditionally add chapter filter
  const applyChapterFilter = <T extends { chapter_id?: string }>(query: any) => {
    return chapterId ? query.eq('chapter_id', chapterId) : query
  }

  // Get counts for each stakeholder type
  const [
    schoolsCount,
    collegesCount,
    industriesCount,
    governmentCount,
    ngosCount,
    vendorsCount,
    speakersCount,
    healthScores,
    activeMous,
    expiringMous,
    recentInteractions,
    pendingFollowUps,
  ] = await Promise.all([
    applyChapterFilter(supabase.from('schools').select('id, status', { count: 'exact' })),
    applyChapterFilter(supabase.from('colleges').select('id, status', { count: 'exact' })),
    applyChapterFilter(supabase.from('industries').select('id, status', { count: 'exact' })),
    applyChapterFilter(supabase.from('government_stakeholders').select('id, status', { count: 'exact' })),
    applyChapterFilter(supabase.from('ngos').select('id, status', { count: 'exact' })),
    applyChapterFilter(supabase.from('vendors').select('id, status', { count: 'exact' })),
    applyChapterFilter(supabase.from('speakers').select('id, status', { count: 'exact' })),
    applyChapterFilter(supabase.from('relationship_health_scores').select('health_tier')),
    applyChapterFilter(supabase.from('stakeholder_mous').select('id', { count: 'exact' }).eq('mou_status', 'signed')),
    applyChapterFilter(supabase.from('stakeholder_mous').select('id, valid_to').eq('mou_status', 'signed')),
    applyChapterFilter(supabase.from('stakeholder_interactions').select('id', { count: 'exact' }).gte('interaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())),
    applyChapterFilter(supabase.from('stakeholder_interactions').select('id', { count: 'exact' }).eq('requires_follow_up', true)),
  ])

  // Calculate status distributions
  const allStakeholders = [
    ...(schoolsCount.data || []),
    ...(collegesCount.data || []),
    ...(industriesCount.data || []),
    ...(governmentCount.data || []),
    ...(ngosCount.data || []),
    ...(vendorsCount.data || []),
    ...(speakersCount.data || []),
  ]

  const statusCounts = {
    active: allStakeholders.filter((s) => s.status === 'active').length,
    prospective: allStakeholders.filter((s) => s.status === 'prospective').length,
    inactive: allStakeholders.filter((s) => s.status === 'inactive').length,
    dormant: allStakeholders.filter((s) => s.status === 'dormant').length,
  }

  // Calculate health distribution
  const healthDistribution = {
    healthy: (healthScores.data || []).filter((h: any) => h.health_tier === 'healthy').length,
    needs_attention: (healthScores.data || []).filter((h: any) => h.health_tier === 'needs_attention').length,
    at_risk: (healthScores.data || []).filter((h: any) => h.health_tier === 'at_risk').length,
  }

  // Count expiring MoUs (within 30 days)
  const now = new Date()
  const expiringCount = (expiringMous.data || []).filter((mou: any) => {
    if (!mou.valid_to) return false
    const expiryDate = new Date(mou.valid_to)
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30
  }).length

  return {
    total_stakeholders: allStakeholders.length,
    by_type: {
      schools: schoolsCount.count || 0,
      colleges: collegesCount.count || 0,
      industries: industriesCount.count || 0,
      government: governmentCount.count || 0,
      ngos: ngosCount.count || 0,
      vendors: vendorsCount.count || 0,
      speakers: speakersCount.count || 0,
    },
    by_status: statusCounts,
    health_distribution: healthDistribution,
    active_mous: activeMous.count || 0,
    expiring_soon_mous: expiringCount,
    interactions_this_month: recentInteractions.count || 0,
    follow_ups_pending: pendingFollowUps.count || 0,
  }
})

// ============================================================================
// PENDING FOLLOW-UPS
// ============================================================================

/**
 * Get pending follow-ups
 * If chapterId is null, fetches all pending follow-ups (for super admins)
 */
export const getPendingFollowUps = cache(async (chapterId: string | null): Promise<StakeholderInteraction[]> => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('stakeholder_interactions')
    .select(`
      *,
      led_by:members!stakeholder_interactions_led_by_member_id_fkey(
        id,
        profiles!members_id_fkey(id, full_name)
      )
    `)
    .eq('requires_follow_up', true)
    .lte('follow_up_date', new Date().toISOString())

  // Filter by chapter only if chapterId is provided
  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  const { data, error } = await query
    .order('follow_up_date')

  if (error) {
    console.error('Error fetching pending follow-ups:', error)
    return []
  }

  return (data || []) as StakeholderInteraction[]
})

// ============================================================================
// EXPIRING MOUS
// ============================================================================

/**
 * Get expiring MoUs
 * If chapterId is null, fetches all expiring MoUs (for super admins)
 */
export const getExpiringMous = cache(async (chapterId: string | null, daysAhead: number = 30): Promise<StakeholderMou[]> => {
  const supabase = await createServerSupabaseClient()

  const now = new Date()
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  let query = supabase
    .from('stakeholder_mous')
    .select('*')
    .eq('mou_status', 'signed')
    .gte('valid_to', now.toISOString())
    .lte('valid_to', futureDate.toISOString())

  // Filter by chapter only if chapterId is provided
  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  const { data, error } = await query.order('valid_to')

  if (error) {
    console.error('Error fetching expiring MoUs:', error)
    return []
  }

  return (data || []) as StakeholderMou[]
})
