/**
 * Service Events Data Layer
 *
 * Cached data fetching functions for service events (Masoom, Thalir, Yuva, etc.)
 * Extends the base events module with Part 2 features.
 */

import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import type {
  EventWithServiceDetails,
  EventSessionReport,
  ServiceEventType,
  StakeholderType,
} from '@/types/event'

// ============================================================================
// Types
// ============================================================================

export interface ServiceEventListItem {
  id: string
  title: string
  description: string | null
  category: string
  status: string
  start_date: string
  end_date: string
  service_type: ServiceEventType
  stakeholder_type: StakeholderType | null
  stakeholder_id: string | null
  stakeholder_name: string | null
  stakeholder_city: string | null
  expected_students: number | null
  trainers_needed: number
  trainers_assigned: number
  trainers_confirmed: number
  materials_approved: boolean
  has_session_report: boolean
  created_at: string
}

export interface ServiceEventFilters {
  search?: string
  status?: string[]
  service_type?: ServiceEventType[]
  stakeholder_type?: StakeholderType[]
  stakeholder_id?: string
  start_date_from?: string
  start_date_to?: string
  has_trainers?: boolean
  materials_pending?: boolean
}

export interface PaginatedServiceEvents {
  data: ServiceEventListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============================================================================
// Service Event Queries
// ============================================================================

/**
 * Get paginated service events with filters
 */
export const getServiceEvents = cache(
  async (params?: {
    page?: number
    pageSize?: number
    filters?: ServiceEventFilters
    sortField?: string
    sortDirection?: 'asc' | 'desc'
  }): Promise<PaginatedServiceEvents> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 10
    const offset = (page - 1) * pageSize
    const filters = params?.filters
    const sortField = params?.sortField || 'start_date'
    const sortDirection = params?.sortDirection || 'desc'

    // Start building query
    let query = supabase
      .from('events')
      .select(
        `
        id,
        title,
        description,
        category,
        status,
        start_date,
        end_date,
        service_type,
        stakeholder_type,
        stakeholder_id,
        expected_students,
        trainers_needed,
        created_at,
        stakeholder:stakeholders(
          id,
          name:school_name,
          city
        ),
        trainer_assignments:event_trainer_assignments(
          id,
          status
        ),
        materials:event_materials(
          id,
          status
        ),
        session_reports:event_session_reports(
          id
        )
      `,
        { count: 'exact' }
      )
      .eq('is_service_event', true)

    // Apply filters
    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      )
    }
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    if (filters?.service_type && filters.service_type.length > 0) {
      query = query.in('service_type', filters.service_type)
    }
    if (filters?.stakeholder_type && filters.stakeholder_type.length > 0) {
      query = query.in('stakeholder_type', filters.stakeholder_type)
    }
    if (filters?.stakeholder_id) {
      query = query.eq('stakeholder_id', filters.stakeholder_id)
    }
    if (filters?.start_date_from) {
      query = query.gte('start_date', filters.start_date_from)
    }
    if (filters?.start_date_to) {
      query = query.lte('start_date', filters.start_date_to)
    }

    // Apply sorting and pagination
    query = query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching service events:', error)
      throw new Error(`Failed to fetch service events: ${error.message}`)
    }

    // Transform data
    const transformedData: ServiceEventListItem[] = (data || []).map((event: any) => {
      const assignments = event.trainer_assignments || []
      const materials = event.materials || []
      const reports = event.session_reports || []

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        status: event.status,
        start_date: event.start_date,
        end_date: event.end_date,
        service_type: event.service_type,
        stakeholder_type: event.stakeholder_type,
        stakeholder_id: event.stakeholder_id,
        stakeholder_name: event.stakeholder?.name || null,
        stakeholder_city: event.stakeholder?.city || null,
        expected_students: event.expected_students,
        trainers_needed: event.trainers_needed || 0,
        trainers_assigned: assignments.length,
        trainers_confirmed: assignments.filter(
          (a: any) => a.status === 'confirmed' || a.status === 'completed'
        ).length,
        materials_approved: materials.some((m: any) => m.status === 'approved'),
        has_session_report: reports.length > 0,
        created_at: event.created_at,
      }
    })

    // Apply post-query filters
    let filteredData = transformedData
    if (filters?.has_trainers !== undefined) {
      filteredData = filteredData.filter(
        (e) => (e.trainers_assigned > 0) === filters.has_trainers
      )
    }
    if (filters?.materials_pending) {
      filteredData = filteredData.filter((e) => !e.materials_approved)
    }

    return {
      data: filteredData,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }
  }
)

/**
 * Get service event by ID with full details
 */
export const getServiceEventById = cache(
  async (eventId: string): Promise<EventWithServiceDetails | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('events')
      .select(
        `
        *,
        venue:venues(*),
        template:event_templates(*),
        organizer:members!organizer_id(
          id,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        ),
        chapter:chapters(
          id,
          name,
          location
        ),
        stakeholder:stakeholders(
          id,
          school_name,
          stakeholder_type,
          city,
          address_line1
        )
      `
      )
      .eq('id', eventId)
      .eq('is_service_event', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching service event:', error)
      throw new Error(`Failed to fetch service event: ${error.message}`)
    }

    return {
      ...data,
      service_details: {
        is_service_event: data.is_service_event,
        service_type: data.service_type,
        stakeholder_type: data.stakeholder_type,
        stakeholder_id: data.stakeholder_id,
        contact_person_name: data.contact_person_name,
        contact_person_phone: data.contact_person_phone,
        contact_person_email: data.contact_person_email,
        expected_students: data.expected_students,
        trainers_needed: data.trainers_needed,
      },
      stakeholder: data.stakeholder
        ? {
            id: data.stakeholder.id,
            name: data.stakeholder.school_name,
            type: data.stakeholder.stakeholder_type,
            city: data.stakeholder.city,
          }
        : null,
    } as EventWithServiceDetails
  }
)

/**
 * Get upcoming service events for dashboard
 */
export const getUpcomingServiceEvents = cache(
  async (limit: number = 5): Promise<ServiceEventListItem[]> => {
    const result = await getServiceEvents({
      page: 1,
      pageSize: limit,
      filters: {
        status: ['published', 'ongoing'],
        start_date_from: new Date().toISOString(),
      },
      sortField: 'start_date',
      sortDirection: 'asc',
    })

    return result.data
  }
)

/**
 * Get service events needing trainers
 */
export const getEventsNeedingTrainers = cache(
  async (): Promise<ServiceEventListItem[]> => {
    const result = await getServiceEvents({
      page: 1,
      pageSize: 20,
      filters: {
        status: ['published'],
        has_trainers: false,
      },
      sortField: 'start_date',
      sortDirection: 'asc',
    })

    return result.data.filter((e) => e.trainers_assigned < e.trainers_needed)
  }
)

/**
 * Get service events with pending materials
 */
export const getEventsWithPendingMaterials = cache(
  async (): Promise<ServiceEventListItem[]> => {
    const result = await getServiceEvents({
      page: 1,
      pageSize: 20,
      filters: {
        status: ['published', 'ongoing'],
        materials_pending: true,
      },
      sortField: 'start_date',
      sortDirection: 'asc',
    })

    return result.data
  }
)

// ============================================================================
// Session Report Queries
// ============================================================================

/**
 * Get session report for an event
 */
export const getEventSessionReport = cache(
  async (eventId: string): Promise<EventSessionReport | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('event_session_reports')
      .select('*')
      .eq('event_id', eventId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching session report:', error)
      throw new Error(`Failed to fetch session report: ${error.message}`)
    }

    return data as EventSessionReport
  }
)

/**
 * Get session reports needing verification
 */
export const getUnverifiedSessionReports = cache(
  async (): Promise<Array<EventSessionReport & { event_title: string }>> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('event_session_reports')
      .select(
        `
        *,
        event:events(
          title
        )
      `
      )
      .is('verified_at', null)
      .order('submitted_at', { ascending: false })

    if (error) {
      console.error('Error fetching unverified reports:', error)
      throw new Error(`Failed to fetch unverified reports: ${error.message}`)
    }

    return (data || []).map((report: any) => ({
      ...report,
      event_title: report.event?.title || 'Unknown Event',
    }))
  }
)

/**
 * Get reports with pending follow-ups
 */
export const getReportsWithPendingFollowUps = cache(
  async (): Promise<Array<EventSessionReport & { event_title: string }>> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('event_session_reports')
      .select(
        `
        *,
        event:events(
          title
        )
      `
      )
      .eq('follow_up_required', true)
      .eq('follow_up_completed', false)
      .order('follow_up_date', { ascending: true })

    if (error) {
      console.error('Error fetching pending follow-ups:', error)
      throw new Error(`Failed to fetch pending follow-ups: ${error.message}`)
    }

    return (data || []).map((report: any) => ({
      ...report,
      event_title: report.event?.title || 'Unknown Event',
    }))
  }
)

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get service event analytics
 */
export const getServiceEventAnalytics = cache(
  async (chapterId?: string): Promise<{
    total_events: number
    events_by_type: Record<ServiceEventType, number>
    total_students_impacted: number
    total_sessions: number
    average_rating: number | null
    events_this_month: number
    events_this_quarter: number
  }> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    let query = supabase
      .from('events')
      .select(
        `
        id,
        service_type,
        status,
        start_date,
        session_reports:event_session_reports(
          actual_attendance,
          coordinator_rating
        )
      `
      )
      .eq('is_service_event', true)
      .eq('status', 'completed')

    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching service event analytics:', error)
      throw new Error(`Failed to fetch analytics: ${error.message}`)
    }

    const events = data || []
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)

    // Count by service type
    const eventsByType = events.reduce((acc: any, event: any) => {
      const type = event.service_type as ServiceEventType
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    // Calculate totals
    let totalStudents = 0
    let totalRatings = 0
    let ratingCount = 0

    events.forEach((event: any) => {
      const reports = event.session_reports || []
      reports.forEach((report: any) => {
        totalStudents += report.actual_attendance || 0
        if (report.coordinator_rating) {
          totalRatings += report.coordinator_rating
          ratingCount++
        }
      })
    })

    const eventsThisMonth = events.filter(
      (e: any) => new Date(e.start_date) >= startOfMonth
    ).length
    const eventsThisQuarter = events.filter(
      (e: any) => new Date(e.start_date) >= startOfQuarter
    ).length

    return {
      total_events: events.length,
      events_by_type: eventsByType,
      total_students_impacted: totalStudents,
      total_sessions: events.length,
      average_rating: ratingCount > 0 ? totalRatings / ratingCount : null,
      events_this_month: eventsThisMonth,
      events_this_quarter: eventsThisQuarter,
    }
  }
)
