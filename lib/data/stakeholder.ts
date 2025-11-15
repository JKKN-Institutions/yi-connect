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
} from '@/types/stakeholder'

// ============================================================================
// SCHOOL DATA FUNCTIONS
// ============================================================================

export const getSchools = cache(async (chapterId: string): Promise<SchoolListItem[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('schools')
    .select(`
      *,
      connected_member:members!schools_connected_through_member_id_fkey(id, full_name),
      contacts:stakeholder_contacts(id),
      interactions:stakeholder_interactions(id),
      mous:stakeholder_mous(mou_status),
      health:relationship_health_scores(overall_score, health_tier, days_since_last_interaction)
    `)
    .eq('chapter_id', chapterId)
    .order('school_name')

  if (error) {
    console.error('Error fetching schools:', error)
    return []
  }

  return (data || []).map((school) => ({
    ...school,
    contact_count: school.contacts?.length || 0,
    interaction_count: school.interactions?.length || 0,
    mou_status: school.mous?.[0]?.mou_status || 'none',
    health_score: school.health?.[0]?.overall_score,
    health_tier: school.health?.[0]?.health_tier,
    days_since_last_contact: school.health?.[0]?.days_since_last_interaction,
  })) as SchoolListItem[]
})

export const getSchoolById = cache(async (schoolId: string): Promise<SchoolDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: school, error } = await supabase
    .from('schools')
    .select(`
      *,
      connected_member:members!schools_connected_through_member_id_fkey(id, full_name)
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

export const getColleges = cache(async (chapterId: string): Promise<CollegeListItem[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('colleges')
    .select(`
      *,
      connected_member:members!colleges_connected_through_member_id_fkey(id, full_name),
      contacts:stakeholder_contacts(id),
      interactions:stakeholder_interactions(id),
      mous:stakeholder_mous(mou_status),
      health:relationship_health_scores(overall_score, health_tier, days_since_last_interaction)
    `)
    .eq('chapter_id', chapterId)
    .order('college_name')

  if (error) {
    console.error('Error fetching colleges:', error)
    return []
  }

  return (data || []).map((college) => ({
    ...college,
    contact_count: college.contacts?.length || 0,
    interaction_count: college.interactions?.length || 0,
    mou_status: college.mous?.[0]?.mou_status || 'none',
    health_score: college.health?.[0]?.overall_score,
    health_tier: college.health?.[0]?.health_tier,
    days_since_last_contact: college.health?.[0]?.days_since_last_interaction,
  })) as CollegeListItem[]
})

export const getCollegeById = cache(async (collegeId: string): Promise<CollegeDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: college, error } = await supabase
    .from('colleges')
    .select(`
      *,
      connected_member:members!colleges_connected_through_member_id_fkey(id, full_name)
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

export const getIndustries = cache(async (chapterId: string): Promise<IndustryListItem[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('industries')
    .select(`
      *,
      connected_member:members!industries_connected_through_member_id_fkey(id, full_name),
      contacts:stakeholder_contacts(id),
      interactions:stakeholder_interactions(id),
      mous:stakeholder_mous(mou_status),
      health:relationship_health_scores(overall_score, health_tier, days_since_last_interaction)
    `)
    .eq('chapter_id', chapterId)
    .order('organization_name')

  if (error) {
    console.error('Error fetching industries:', error)
    return []
  }

  return (data || []).map((industry) => ({
    ...industry,
    contact_count: industry.contacts?.length || 0,
    interaction_count: industry.interactions?.length || 0,
    mou_status: industry.mous?.[0]?.mou_status || 'none',
    health_score: industry.health?.[0]?.overall_score,
    health_tier: industry.health?.[0]?.health_tier,
    days_since_last_contact: industry.health?.[0]?.days_since_last_interaction,
  })) as IndustryListItem[]
})

export const getIndustryById = cache(async (industryId: string): Promise<IndustryDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: industry, error } = await supabase
    .from('industries')
    .select(`
      *,
      connected_member:members!industries_connected_through_member_id_fkey(id, full_name)
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

export const getGovernmentStakeholders = cache(async (chapterId: string): Promise<GovernmentStakeholderListItem[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('government_stakeholders')
    .select(`
      *,
      connected_member:members!government_stakeholders_connected_through_member_id_fkey(id, full_name),
      contacts:stakeholder_contacts(id),
      interactions:stakeholder_interactions(id),
      mous:stakeholder_mous(mou_status),
      health:relationship_health_scores(overall_score, health_tier, days_since_last_interaction)
    `)
    .eq('chapter_id', chapterId)
    .order('official_name')

  if (error) {
    console.error('Error fetching government stakeholders:', error)
    return []
  }

  return (data || []).map((stakeholder) => {
    // Calculate tenure status
    let tenure_status: 'active' | 'expiring_soon' | 'expired' = 'active'
    if (stakeholder.tenure_end_date) {
      const endDate = new Date(stakeholder.tenure_end_date)
      const now = new Date()
      const daysUntilExpiry = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntilExpiry < 0) tenure_status = 'expired'
      else if (daysUntilExpiry <= 90) tenure_status = 'expiring_soon'
    }

    return {
      ...stakeholder,
      contact_count: stakeholder.contacts?.length || 0,
      interaction_count: stakeholder.interactions?.length || 0,
      mou_status: stakeholder.mous?.[0]?.mou_status || 'none',
      health_score: stakeholder.health?.[0]?.overall_score,
      health_tier: stakeholder.health?.[0]?.health_tier,
      days_since_last_contact: stakeholder.health?.[0]?.days_since_last_interaction,
      tenure_status,
    }
  }) as GovernmentStakeholderListItem[]
})

export const getGovernmentStakeholderById = cache(async (stakeholderId: string): Promise<GovernmentStakeholderDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: stakeholder, error } = await supabase
    .from('government_stakeholders')
    .select(`
      *,
      connected_member:members!government_stakeholders_connected_through_member_id_fkey(id, full_name)
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

export const getNGOs = cache(async (chapterId: string): Promise<NGOListItem[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('ngos')
    .select(`
      *,
      connected_member:members!ngos_connected_through_member_id_fkey(id, full_name),
      contacts:stakeholder_contacts(id),
      interactions:stakeholder_interactions(id),
      mous:stakeholder_mous(mou_status),
      health:relationship_health_scores(overall_score, health_tier, days_since_last_interaction)
    `)
    .eq('chapter_id', chapterId)
    .order('ngo_name')

  if (error) {
    console.error('Error fetching NGOs:', error)
    return []
  }

  return (data || []).map((ngo) => ({
    ...ngo,
    contact_count: ngo.contacts?.length || 0,
    interaction_count: ngo.interactions?.length || 0,
    mou_status: ngo.mous?.[0]?.mou_status || 'none',
    health_score: ngo.health?.[0]?.overall_score,
    health_tier: ngo.health?.[0]?.health_tier,
    days_since_last_contact: ngo.health?.[0]?.days_since_last_interaction,
  })) as NGOListItem[]
})

export const getNGOById = cache(async (ngoId: string): Promise<NGODetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: ngo, error } = await supabase
    .from('ngos')
    .select(`
      *,
      connected_member:members!ngos_connected_through_member_id_fkey(id, full_name)
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

export const getVendors = cache(async (chapterId: string): Promise<VendorListItem[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('vendors')
    .select(`
      *,
      connected_member:members!vendors_connected_through_member_id_fkey(id, full_name),
      contacts:stakeholder_contacts(id),
      interactions:stakeholder_interactions(id),
      health:relationship_health_scores(overall_score, health_tier, days_since_last_interaction)
    `)
    .eq('chapter_id', chapterId)
    .order('vendor_name')

  if (error) {
    console.error('Error fetching vendors:', error)
    return []
  }

  return (data || []).map((vendor) => ({
    ...vendor,
    contact_count: vendor.contacts?.length || 0,
    interaction_count: vendor.interactions?.length || 0,
    health_score: vendor.health?.[0]?.overall_score,
    health_tier: vendor.health?.[0]?.health_tier,
    days_since_last_contact: vendor.health?.[0]?.days_since_last_interaction,
  })) as VendorListItem[]
})

export const getVendorById = cache(async (vendorId: string): Promise<VendorDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: vendor, error } = await supabase
    .from('vendors')
    .select(`
      *,
      connected_member:members!vendors_connected_through_member_id_fkey(id, full_name)
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

export const getSpeakers = cache(async (chapterId: string): Promise<SpeakerListItem[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('speakers')
    .select(`
      *,
      connected_member:members!speakers_connected_through_member_id_fkey(id, full_name),
      contacts:stakeholder_contacts(id),
      interactions:stakeholder_interactions(id),
      health:relationship_health_scores(overall_score, health_tier, days_since_last_interaction)
    `)
    .eq('chapter_id', chapterId)
    .order('speaker_name')

  if (error) {
    console.error('Error fetching speakers:', error)
    return []
  }

  return (data || []).map((speaker) => {
    // Determine availability indicator
    let availability_indicator: 'available' | 'busy' | 'unknown' = 'unknown'
    if (speaker.availability_status) {
      availability_indicator = speaker.availability_status === 'available' ? 'available' : 'busy'
    }

    return {
      ...speaker,
      contact_count: speaker.contacts?.length || 0,
      interaction_count: speaker.interactions?.length || 0,
      health_score: speaker.health?.[0]?.overall_score,
      health_tier: speaker.health?.[0]?.health_tier,
      days_since_last_contact: speaker.health?.[0]?.days_since_last_interaction,
      availability_indicator,
    }
  }) as SpeakerListItem[]
})

export const getSpeakerById = cache(async (speakerId: string): Promise<SpeakerDetail | null> => {
  const supabase = await createServerSupabaseClient()

  const { data: speaker, error } = await supabase
    .from('speakers')
    .select(`
      *,
      connected_member:members!speakers_connected_through_member_id_fkey(id, full_name)
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
        creator:profiles!stakeholder_interactions_created_by_fkey(id, full_name, email)
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
      .select(`
        *,
        uploader:profiles!stakeholder_documents_uploaded_by_fkey(id, full_name)
      `)
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
        .select('id, organization_name, status, city, state, last_contact_date')
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
        name: i.organization_name,
        status: i.status,
        last_contact_date: i.last_contact_date,
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

export const getStakeholderOverview = cache(async (chapterId: string): Promise<StakeholderOverviewStats> => {
  const supabase = await createServerSupabaseClient()

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
    supabase.from('schools').select('id, status', { count: 'exact' }).eq('chapter_id', chapterId),
    supabase.from('colleges').select('id, status', { count: 'exact' }).eq('chapter_id', chapterId),
    supabase.from('industries').select('id, status', { count: 'exact' }).eq('chapter_id', chapterId),
    supabase.from('government_stakeholders').select('id, status', { count: 'exact' }).eq('chapter_id', chapterId),
    supabase.from('ngos').select('id, status', { count: 'exact' }).eq('chapter_id', chapterId),
    supabase.from('vendors').select('id, status', { count: 'exact' }).eq('chapter_id', chapterId),
    supabase.from('speakers').select('id, status', { count: 'exact' }).eq('chapter_id', chapterId),
    supabase.from('relationship_health_scores').select('health_tier').eq('chapter_id', chapterId),
    supabase
      .from('stakeholder_mous')
      .select('id', { count: 'exact' })
      .eq('chapter_id', chapterId)
      .eq('mou_status', 'signed'),
    supabase
      .from('stakeholder_mous')
      .select('id, valid_to')
      .eq('chapter_id', chapterId)
      .eq('mou_status', 'signed'),
    supabase
      .from('stakeholder_interactions')
      .select('id', { count: 'exact' })
      .eq('chapter_id', chapterId)
      .gte('interaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('stakeholder_interactions')
      .select('id', { count: 'exact' })
      .eq('chapter_id', chapterId)
      .eq('requires_follow_up', true),
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
    healthy: (healthScores.data || []).filter((h) => h.health_tier === 'healthy').length,
    needs_attention: (healthScores.data || []).filter((h) => h.health_tier === 'needs_attention').length,
    at_risk: (healthScores.data || []).filter((h) => h.health_tier === 'at_risk').length,
  }

  // Count expiring MoUs (within 30 days)
  const now = new Date()
  const expiringCount = (expiringMous.data || []).filter((mou) => {
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

export const getPendingFollowUps = cache(async (chapterId: string): Promise<StakeholderInteraction[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('stakeholder_interactions')
    .select(`
      *,
      creator:profiles!stakeholder_interactions_created_by_fkey(id, full_name)
    `)
    .eq('chapter_id', chapterId)
    .eq('requires_follow_up', true)
    .lte('follow_up_date', new Date().toISOString())
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

export const getExpiringMous = cache(async (chapterId: string, daysAhead: number = 30): Promise<StakeholderMou[]> => {
  const supabase = await createServerSupabaseClient()

  const now = new Date()
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('stakeholder_mous')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('mou_status', 'signed')
    .gte('valid_to', now.toISOString())
    .lte('valid_to', futureDate.toISOString())
    .order('valid_to')

  if (error) {
    console.error('Error fetching expiring MoUs:', error)
    return []
  }

  return (data || []) as StakeholderMou[]
})
