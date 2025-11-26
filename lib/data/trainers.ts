/**
 * Trainer Data Layer
 *
 * Cached data fetching functions for Trainer Profile feature.
 * Uses React cache() for request-level deduplication.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type {
  TrainerProfileFull,
  TrainerCertificationWithDetails,
  TrainerProfileSummary,
  TrainerSessionStats,
} from '@/types/trainer'

// ============================================================================
// Trainer Profile Queries
// ============================================================================

/**
 * Get trainer profile for a member
 */
export const getTrainerProfile = cache(
  async (memberId: string): Promise<TrainerProfileFull | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('trainer_profiles')
      .select(
        `
        *,
        member:members(
          id,
          company,
          designation,
          profile:profiles(
            full_name,
            email,
            avatar_url,
            phone
          )
        )
      `
      )
      .eq('member_id', memberId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to fetch trainer profile: ${error.message}`)
    }

    // Fetch certifications
    const { data: certifications } = await supabase
      .from('trainer_certifications')
      .select('*')
      .eq('trainer_profile_id', data.id)
      .order('issued_date', { ascending: false })

    // Add expiry info to certifications
    const today = new Date()
    const certsWithExpiry: TrainerCertificationWithDetails[] = (certifications || []).map(
      (cert: any) => {
        const expiryDate = cert.expiry_date ? new Date(cert.expiry_date) : null
        const daysUntilExpiry = expiryDate
          ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : null

        return {
          ...cert,
          days_until_expiry: daysUntilExpiry,
          is_expiring_soon: daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry >= 0,
        }
      }
    )

    return {
      ...data,
      certifications: certsWithExpiry,
    } as TrainerProfileFull
  }
)

/**
 * Get trainer profile by ID
 */
export const getTrainerProfileById = cache(
  async (id: string): Promise<TrainerProfileFull | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('trainer_profiles')
      .select(
        `
        *,
        member:members(
          id,
          company,
          designation,
          profile:profiles(
            full_name,
            email,
            avatar_url,
            phone
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
      throw new Error(`Failed to fetch trainer profile: ${error.message}`)
    }

    // Fetch certifications
    const { data: certifications } = await supabase
      .from('trainer_certifications')
      .select('*')
      .eq('trainer_profile_id', data.id)
      .order('issued_date', { ascending: false })

    const today = new Date()
    const certsWithExpiry: TrainerCertificationWithDetails[] = (certifications || []).map(
      (cert: any) => {
        const expiryDate = cert.expiry_date ? new Date(cert.expiry_date) : null
        const daysUntilExpiry = expiryDate
          ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : null

        return {
          ...cert,
          days_until_expiry: daysUntilExpiry,
          is_expiring_soon: daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry >= 0,
        }
      }
    )

    return {
      ...data,
      certifications: certsWithExpiry,
    } as TrainerProfileFull
  }
)

/**
 * Get all trainers for a chapter
 */
export const getChapterTrainers = cache(
  async (chapterId: string): Promise<TrainerProfileSummary[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('trainer_profiles')
      .select(
        `
        *,
        member:members!inner(
          id,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        )
      `
      )
      .eq('chapter_id', chapterId)
      .eq('is_trainer_eligible', true)

    if (error) {
      throw new Error(`Failed to fetch chapter trainers: ${error.message}`)
    }

    // Get certification counts for each trainer
    const trainerIds = (data || []).map((t: any) => t.id)
    const certCountsMap = new Map<string, { total: number; expiring: number }>()

    if (trainerIds.length > 0) {
      const today = new Date()
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      const { data: certifications } = await supabase
        .from('trainer_certifications')
        .select('trainer_profile_id, expiry_date')
        .in('trainer_profile_id', trainerIds)

      ;(certifications || []).forEach((cert: any) => {
        const existing = certCountsMap.get(cert.trainer_profile_id) || { total: 0, expiring: 0 }
        existing.total++

        if (cert.expiry_date) {
          const expiryDate = new Date(cert.expiry_date)
          if (expiryDate >= today && expiryDate <= thirtyDaysFromNow) {
            existing.expiring++
          }
        }

        certCountsMap.set(cert.trainer_profile_id, existing)
      })
    }

    // Transform to summary format
    const trainers: TrainerProfileSummary[] = (data || []).map((trainer: any) => {
      const certCounts = certCountsMap.get(trainer.id) || { total: 0, expiring: 0 }

      return {
        id: trainer.id,
        member_id: trainer.member_id,
        full_name: trainer.member?.profile?.full_name || '',
        email: trainer.member?.profile?.email || '',
        avatar_url: trainer.member?.profile?.avatar_url || null,
        is_trainer_eligible: trainer.is_trainer_eligible,
        distribution_status: trainer.distribution_status,
        eligible_verticals: trainer.eligible_verticals || [],
        eligible_session_types: trainer.eligible_session_types || [],
        total_sessions: trainer.total_sessions,
        total_students_impacted: trainer.total_students_impacted,
        average_rating: trainer.average_rating,
        last_session_date: trainer.last_session_date,
        sessions_this_month: trainer.sessions_this_month,
        sessions_this_quarter: trainer.sessions_this_quarter,
        days_since_last_session: trainer.days_since_last_session,
        certifications_count: certCounts.total,
        expiring_certifications: certCounts.expiring,
      }
    })

    return trainers
  }
)

/**
 * Get trainer session statistics
 */
export const getTrainerSessionStats = cache(
  async (trainerProfileId: string): Promise<TrainerSessionStats | null> => {
    const supabase = await createServerSupabaseClient()

    // Get the trainer profile
    const { data: trainer, error } = await supabase
      .from('trainer_profiles')
      .select('*')
      .eq('id', trainerProfileId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch trainer stats: ${error.message}`)
    }

    // Get session bookings for this trainer (for detailed stats)
    const { data: sessions } = await supabase
      .from('session_bookings')
      .select('session_type_id, attendance_count, feedback_score, status')
      .eq('assigned_trainer_id', trainerProfileId)
      .eq('status', 'completed')

    // Calculate session type distribution
    const sessionsByType: Record<string, number> = {}
    const sessionsByVertical: Record<string, number> = {}
    const ratingDistribution = {
      five_star: 0,
      four_star: 0,
      three_star: 0,
      two_star: 0,
      one_star: 0,
    }

    ;(sessions || []).forEach((session: any) => {
      // Count by session type (would need to join with session_types for actual names)
      const typeId = session.session_type_id || 'unknown'
      sessionsByType[typeId] = (sessionsByType[typeId] || 0) + 1

      // Count ratings
      if (session.feedback_score) {
        const score = Math.round(session.feedback_score)
        if (score >= 4.5) ratingDistribution.five_star++
        else if (score >= 3.5) ratingDistribution.four_star++
        else if (score >= 2.5) ratingDistribution.three_star++
        else if (score >= 1.5) ratingDistribution.two_star++
        else ratingDistribution.one_star++
      }
    })

    return {
      total_sessions: trainer.total_sessions,
      total_students_impacted: trainer.total_students_impacted,
      average_rating: trainer.average_rating,
      sessions_this_month: trainer.sessions_this_month,
      sessions_this_quarter: trainer.sessions_this_quarter,
      sessions_by_type: sessionsByType,
      sessions_by_vertical: sessionsByVertical,
      rating_distribution: ratingDistribution,
    }
  }
)

/**
 * Check if a member has a trainer profile
 */
export const checkIsTrainer = cache(async (memberId: string): Promise<boolean> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('trainer_profiles')
    .select('id, is_trainer_eligible')
    .eq('member_id', memberId)
    .single()

  if (error) {
    return false
  }

  return data?.is_trainer_eligible || false
})

/**
 * Get available trainers for a session
 */
export const getAvailableTrainersForSession = cache(
  async (
    date: string,
    timeSlot: string,
    sessionTypeId?: string,
    chapterId?: string
  ): Promise<TrainerProfileSummary[]> => {
    const supabase = await createServerSupabaseClient()

    // Use the database function to get available trainers
    const { data, error } = await supabase.rpc('get_available_trainers_for_session', {
      p_date: date,
      p_time_slot: timeSlot,
      p_session_type_id: sessionTypeId || null,
      p_chapter_id: chapterId || null,
    })

    if (error) {
      throw new Error(`Failed to fetch available trainers: ${error.message}`)
    }

    // Transform to TrainerProfileSummary format
    return (data || []).map((trainer: any) => ({
      id: trainer.trainer_id,
      member_id: trainer.member_id,
      full_name: trainer.full_name,
      email: '',
      avatar_url: null,
      is_trainer_eligible: true,
      distribution_status: null,
      eligible_verticals: [],
      eligible_session_types: trainer.expertise_areas || [],
      total_sessions: trainer.total_sessions,
      total_students_impacted: 0,
      average_rating: trainer.avg_rating,
      last_session_date: null,
      sessions_this_month: 0,
      sessions_this_quarter: 0,
      days_since_last_session: null,
      certifications_count: 0,
      expiring_certifications: 0,
    }))
  }
)
