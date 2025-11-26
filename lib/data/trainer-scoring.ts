/**
 * Trainer Scoring Data Layer
 *
 * Data fetching functions for smart trainer assignment algorithm.
 * Implements the scoring system: Location (30), Distribution (30), Performance (25), Engagement (15)
 */

import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import type {
  TrainerRecommendation,
  TrainerScoreBreakdown,
  TrainerStats,
  EventTrainerAssignment,
  EventTrainerAssignmentWithDetails,
} from '@/types/event'

// ============================================================================
// Types
// ============================================================================

export interface TrainerScoringParams {
  eventId: string
  stakeholderCity?: string
  serviceType: string
  trainersNeeded: number
}

export interface TrainerCandidate {
  trainer_profile_id: string
  member_id: string
  full_name: string
  email: string
  avatar_url: string | null
  city: string | null
  eligible_session_types: string[]
  total_sessions: number
  average_rating: number | null
  last_session_date: string | null
  sessions_this_month: number
  days_since_last_session: number | null
  certifications_count: number
}

// ============================================================================
// Scoring Constants
// ============================================================================

const SCORE_WEIGHTS = {
  location: 30,
  distribution: 30,
  performance: 25,
  engagement: 15,
} as const

// ============================================================================
// Trainer Scoring Functions
// ============================================================================

/**
 * Calculate location score for a trainer
 * Same city = 30, Same state = 20, Different = 10
 */
function calculateLocationScore(
  trainerCity: string | null,
  stakeholderCity: string | null
): number {
  if (!trainerCity || !stakeholderCity) {
    return 10 // Default score when location unknown
  }

  const normalizedTrainer = trainerCity.toLowerCase().trim()
  const normalizedStakeholder = stakeholderCity.toLowerCase().trim()

  if (normalizedTrainer === normalizedStakeholder) {
    return SCORE_WEIGHTS.location // 30 points for same city
  }

  // TODO: Add state comparison logic
  return 10 // Base score for different locations
}

/**
 * Calculate fair distribution score
 * Higher score for trainers with fewer recent sessions
 */
function calculateDistributionScore(
  daysSinceLastSession: number | null,
  sessionsThisMonth: number
): number {
  // Trainers who haven't done sessions recently get higher scores
  let dayScore = 0
  if (daysSinceLastSession === null) {
    // Never done a session - highest priority
    dayScore = 15
  } else if (daysSinceLastSession > 30) {
    dayScore = 15
  } else if (daysSinceLastSession > 14) {
    dayScore = 12
  } else if (daysSinceLastSession > 7) {
    dayScore = 8
  } else {
    dayScore = 4
  }

  // Fewer sessions this month = higher score
  let monthScore = 0
  if (sessionsThisMonth === 0) {
    monthScore = 15
  } else if (sessionsThisMonth === 1) {
    monthScore = 12
  } else if (sessionsThisMonth === 2) {
    monthScore = 8
  } else if (sessionsThisMonth <= 4) {
    monthScore = 4
  } else {
    monthScore = 0
  }

  return dayScore + monthScore
}

/**
 * Calculate performance score based on ratings
 */
function calculatePerformanceScore(
  averageRating: number | null,
  totalSessions: number
): number {
  if (averageRating === null || totalSessions === 0) {
    // New trainers get a baseline score
    return 12.5 // 50% of max
  }

  // Scale: 4.5+ = 25pts, 4.0+ = 22pts, 3.5+ = 18pts, 3.0+ = 12pts, else = 6pts
  if (averageRating >= 4.5) return 25
  if (averageRating >= 4.0) return 22
  if (averageRating >= 3.5) return 18
  if (averageRating >= 3.0) return 12
  return 6
}

/**
 * Calculate engagement score based on certifications and activity
 */
function calculateEngagementScore(
  certificationsCount: number,
  totalSessions: number
): number {
  // Certifications contribute up to 10 points
  const certScore = Math.min(10, certificationsCount * 2.5)

  // Activity contributes up to 5 points
  let activityScore = 0
  if (totalSessions >= 20) activityScore = 5
  else if (totalSessions >= 10) activityScore = 4
  else if (totalSessions >= 5) activityScore = 3
  else if (totalSessions >= 2) activityScore = 2
  else if (totalSessions >= 1) activityScore = 1

  return certScore + activityScore
}

/**
 * Calculate complete trainer score breakdown
 */
function calculateTrainerScore(
  trainer: TrainerCandidate,
  stakeholderCity: string | null
): TrainerScoreBreakdown {
  return {
    location_score: calculateLocationScore(trainer.city, stakeholderCity),
    distribution_score: calculateDistributionScore(
      trainer.days_since_last_session,
      trainer.sessions_this_month
    ),
    performance_score: calculatePerformanceScore(
      trainer.average_rating,
      trainer.total_sessions
    ),
    engagement_score: calculateEngagementScore(
      trainer.certifications_count,
      trainer.total_sessions
    ),
  }
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Get eligible trainers for a service event
 */
export const getEligibleTrainersForEvent = cache(
  async (params: TrainerScoringParams): Promise<TrainerRecommendation[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get trainers eligible for the service type
    const { data: trainers, error } = await supabase
      .from('trainer_profiles')
      .select(`
        id,
        member_id,
        city,
        eligible_session_types,
        total_sessions,
        average_rating,
        last_session_date,
        sessions_this_month,
        days_since_last_session,
        member:members!inner(
          id,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        )
      `)
      .eq('is_trainer_eligible', true)
      .contains('eligible_session_types', [params.serviceType])

    if (error) {
      console.error('Error fetching eligible trainers:', error)
      throw new Error(`Failed to fetch eligible trainers: ${error.message}`)
    }

    if (!trainers || trainers.length === 0) {
      return []
    }

    // Get certification counts for each trainer
    const trainerIds = trainers.map((t: any) => t.id)
    const { data: certifications } = await supabase
      .from('trainer_certifications')
      .select('trainer_profile_id')
      .in('trainer_profile_id', trainerIds)
      .eq('is_active', true)

    const certCountMap = new Map<string, number>()
    certifications?.forEach((cert: any) => {
      const count = certCountMap.get(cert.trainer_profile_id) || 0
      certCountMap.set(cert.trainer_profile_id, count + 1)
    })

    // Check for existing assignments to this event
    const { data: existingAssignments } = await supabase
      .from('event_trainer_assignments')
      .select('trainer_profile_id')
      .eq('event_id', params.eventId)
      .not('status', 'in', '("declined","cancelled")')

    const assignedTrainerIds = new Set(
      existingAssignments?.map((a: any) => a.trainer_profile_id) || []
    )

    // Calculate scores and build recommendations
    const recommendations: TrainerRecommendation[] = trainers
      .filter((t: any) => !assignedTrainerIds.has(t.id))
      .map((trainer: any) => {
        const candidate: TrainerCandidate = {
          trainer_profile_id: trainer.id,
          member_id: trainer.member_id,
          full_name: (trainer.member as any)?.profile?.full_name || 'Unknown',
          email: (trainer.member as any)?.profile?.email || '',
          avatar_url: (trainer.member as any)?.profile?.avatar_url || null,
          city: trainer.city,
          eligible_session_types: trainer.eligible_session_types || [],
          total_sessions: trainer.total_sessions || 0,
          average_rating: trainer.average_rating,
          last_session_date: trainer.last_session_date,
          sessions_this_month: trainer.sessions_this_month || 0,
          days_since_last_session: trainer.days_since_last_session,
          certifications_count: certCountMap.get(trainer.id) || 0,
        }

        const scoreBreakdown = calculateTrainerScore(candidate, params.stakeholderCity || null)
        const totalScore =
          scoreBreakdown.location_score +
          scoreBreakdown.distribution_score +
          scoreBreakdown.performance_score +
          scoreBreakdown.engagement_score

        return {
          trainer_profile_id: trainer.id,
          member_id: trainer.member_id,
          full_name: candidate.full_name,
          email: candidate.email,
          avatar_url: candidate.avatar_url,
          match_score: totalScore,
          score_breakdown: scoreBreakdown,
          trainer_stats: {
            days_since_last_session: candidate.days_since_last_session,
            average_rating: candidate.average_rating,
            total_sessions: candidate.total_sessions,
            sessions_this_month: candidate.sessions_this_month,
          },
          eligible_session_types: candidate.eligible_session_types,
          certifications_count: candidate.certifications_count,
          is_available: true, // TODO: Check availability calendar
        }
      })
      .sort((a, b) => b.match_score - a.match_score)

    return recommendations
  }
)

/**
 * Get trainer assignments for an event
 */
export const getEventTrainerAssignments = cache(
  async (eventId: string): Promise<EventTrainerAssignmentWithDetails[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('event_trainer_assignments')
      .select(`
        *,
        trainer:trainer_profiles(
          id,
          member_id,
          total_sessions,
          average_rating,
          member:members(
            id,
            profile:profiles(
              full_name,
              email,
              avatar_url,
              phone
            )
          )
        )
      `)
      .eq('event_id', eventId)
      .order('is_lead_trainer', { ascending: false })
      .order('match_score', { ascending: false })

    if (error) {
      console.error('Error fetching trainer assignments:', error)
      throw new Error(`Failed to fetch trainer assignments: ${error.message}`)
    }

    return (data || []) as EventTrainerAssignmentWithDetails[]
  }
)

/**
 * Get trainer assignment by ID
 */
export const getTrainerAssignmentById = cache(
  async (assignmentId: string): Promise<EventTrainerAssignmentWithDetails | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('event_trainer_assignments')
      .select(`
        *,
        trainer:trainer_profiles(
          id,
          member_id,
          total_sessions,
          average_rating,
          member:members(
            id,
            profile:profiles(
              full_name,
              email,
              avatar_url,
              phone
            )
          )
        ),
        event:events(
          id,
          title,
          start_date,
          end_date,
          service_type,
          stakeholder_id
        )
      `)
      .eq('id', assignmentId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch trainer assignment: ${error.message}`)
    }

    return data as EventTrainerAssignmentWithDetails
  }
)

/**
 * Get pending trainer invitations for a member
 */
export const getTrainerPendingInvitations = cache(
  async (memberId: string): Promise<EventTrainerAssignmentWithDetails[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // First get the trainer profile ID for this member
    const { data: trainerProfile } = await supabase
      .from('trainer_profiles')
      .select('id')
      .eq('member_id', memberId)
      .single()

    if (!trainerProfile) {
      return []
    }

    const { data, error } = await supabase
      .from('event_trainer_assignments')
      .select(`
        *,
        event:events(
          id,
          title,
          start_date,
          end_date,
          service_type,
          expected_students,
          venue_address,
          stakeholder:stakeholders(
            id,
            name:school_name,
            city
          )
        )
      `)
      .eq('trainer_profile_id', trainerProfile.id)
      .eq('status', 'invited')
      .gt('response_deadline', new Date().toISOString())
      .order('response_deadline', { ascending: true })

    if (error) {
      console.error('Error fetching pending invitations:', error)
      throw new Error(`Failed to fetch pending invitations: ${error.message}`)
    }

    return (data || []) as EventTrainerAssignmentWithDetails[]
  }
)

/**
 * Get trainer's upcoming assigned sessions
 */
export const getTrainerUpcomingSessions = cache(
  async (memberId: string): Promise<EventTrainerAssignmentWithDetails[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // First get the trainer profile ID for this member
    const { data: trainerProfile } = await supabase
      .from('trainer_profiles')
      .select('id')
      .eq('member_id', memberId)
      .single()

    if (!trainerProfile) {
      return []
    }

    const { data, error } = await supabase
      .from('event_trainer_assignments')
      .select(`
        *,
        event:events(
          id,
          title,
          start_date,
          end_date,
          service_type,
          expected_students,
          venue_address,
          status,
          stakeholder:stakeholders(
            id,
            name:school_name,
            city
          )
        )
      `)
      .eq('trainer_profile_id', trainerProfile.id)
      .in('status', ['accepted', 'confirmed'])
      .gte('event.start_date', new Date().toISOString())
      .order('event.start_date', { ascending: true })

    if (error) {
      console.error('Error fetching upcoming sessions:', error)
      throw new Error(`Failed to fetch upcoming sessions: ${error.message}`)
    }

    return (data || []) as EventTrainerAssignmentWithDetails[]
  }
)

/**
 * Get trainer leaderboard for fair distribution view
 */
export const getTrainerDistributionStats = cache(
  async (chapterId?: string): Promise<Array<{
    trainer_profile_id: string
    full_name: string
    avatar_url: string | null
    total_sessions: number
    sessions_this_month: number
    sessions_this_quarter: number
    days_since_last_session: number | null
    average_rating: number | null
  }>> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    let query = supabase
      .from('trainer_profiles')
      .select(`
        id,
        total_sessions,
        sessions_this_month,
        sessions_this_quarter,
        days_since_last_session,
        average_rating,
        member:members!inner(
          id,
          profile:profiles(
            full_name,
            avatar_url
          )
        )
      `)
      .eq('is_trainer_eligible', true)
      .order('sessions_this_month', { ascending: true })
      .order('days_since_last_session', { ascending: false, nullsFirst: true })

    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching trainer distribution stats:', error)
      throw new Error(`Failed to fetch trainer distribution stats: ${error.message}`)
    }

    return (data || []).map((trainer: any) => ({
      trainer_profile_id: trainer.id,
      full_name: (trainer.member as any)?.profile?.full_name || 'Unknown',
      avatar_url: (trainer.member as any)?.profile?.avatar_url || null,
      total_sessions: trainer.total_sessions || 0,
      sessions_this_month: trainer.sessions_this_month || 0,
      sessions_this_quarter: trainer.sessions_this_quarter || 0,
      days_since_last_session: trainer.days_since_last_session,
      average_rating: trainer.average_rating,
    }))
  }
)

/**
 * Use database function to calculate trainer score (alternative to client-side calculation)
 */
export const calculateTrainerScoreViaDB = cache(
  async (trainerProfileId: string, eventId: string): Promise<number> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase.rpc('calculate_event_trainer_score', {
      p_trainer_profile_id: trainerProfileId,
      p_event_id: eventId,
    })

    if (error) {
      console.error('Error calculating trainer score via DB:', error)
      // Fall back to 0 if function fails
      return 0
    }

    return data || 0
  }
)
