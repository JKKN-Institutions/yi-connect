/**
 * Trainer Assignment Server Actions
 *
 * Server Actions for trainer assignment to service events.
 * Handles automatic/manual assignment, invitations, confirmations.
 */

'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendBatchEmails } from '@/lib/email'
import { trainerAssignmentEmail } from '@/lib/email/templates'
import { getCurrentUser } from '@/lib/data/auth'
import {
  assignTrainersSchema,
  updateTrainerAssignmentSchema,
  respondToTrainerInviteSchema,
  confirmTrainerSchema,
  rateTrainerSchema,
  rateCoordinatorSchema,
  type AssignTrainersInput,
  type UpdateTrainerAssignmentInput,
  type RespondToTrainerInviteInput,
  type ConfirmTrainerInput,
  type RateTrainerInput,
  type RateCoordinatorInput,
} from '@/lib/validations/event'
import type { TrainerScoreBreakdown } from '@/types/event'
import { getEligibleTrainersForEvent } from '@/lib/data/trainer-scoring'

type ActionResponse<T = void> = {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Assignment Actions
// ============================================================================

/**
 * Assign trainers to a service event (auto or manual)
 */
export async function assignTrainersToEvent(
  input: AssignTrainersInput
): Promise<ActionResponse<{ assignmentIds: string[] }>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = assignTrainersSchema.parse(input)

    // Get event details for scoring
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, service_type, stakeholder_id, trainers_needed')
      .eq('id', validated.event_id)
      .eq('is_service_event', true)
      .single()

    if (eventError || !event) {
      return { success: false, error: 'Service event not found' }
    }

    // Get stakeholder city for location scoring
    let stakeholderCity: string | null = null
    if (event.stakeholder_id) {
      const { data: stakeholder } = await supabase
        .from('stakeholders')
        .select('city')
        .eq('id', event.stakeholder_id)
        .single()
      stakeholderCity = stakeholder?.city || null
    }

    // Get trainer scores if auto selection
    let trainerScores = new Map<string, { score: number; breakdown: TrainerScoreBreakdown }>()
    if (validated.selection_method === 'auto') {
      const recommendations = await getEligibleTrainersForEvent({
        eventId: validated.event_id,
        stakeholderCity: stakeholderCity || undefined,
        serviceType: event.service_type,
        trainersNeeded: event.trainers_needed || 1,
      })

      recommendations.forEach((rec) => {
        if (validated.trainer_profile_ids.includes(rec.trainer_profile_id)) {
          trainerScores.set(rec.trainer_profile_id, {
            score: rec.match_score,
            breakdown: rec.score_breakdown,
          })
        }
      })
    }

    // Create assignments
    const assignments = validated.trainer_profile_ids.map((trainerId, index) => {
      const scoreInfo = trainerScores.get(trainerId)
      return {
        event_id: validated.event_id,
        trainer_profile_id: trainerId,
        status: 'selected' as const,
        is_lead_trainer: index === 0, // First trainer is lead
        match_score: scoreInfo?.score || null,
        score_breakdown: scoreInfo?.breakdown || null,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        selection_method: validated.selection_method,
        notes: validated.notes || null,
      }
    })

    const { data, error } = await supabase
      .from('event_trainer_assignments')
      .insert(assignments)
      .select('id')

    if (error) {
      console.error('Error assigning trainers:', error)
      return { success: false, error: 'Failed to assign trainers' }
    }

    // Invalidate caches
    updateTag('trainer-assignments')
    updateTag('service-events')
    revalidatePath(`/events/${validated.event_id}`)
    revalidatePath('/events/service')

    return {
      success: true,
      data: { assignmentIds: data.map((d) => d.id) },
    }
  } catch (error) {
    console.error('Error in assignTrainersToEvent:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Send invitation to assigned trainers
 */
export async function sendTrainerInvitations(
  eventId: string,
  trainerIds?: string[]
): Promise<ActionResponse<{ sentCount: number }>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get assignments with trainer details
    let query = supabase
      .from('event_trainer_assignments')
      .select(`
        id,
        trainer_profile_id,
        session_topic,
        trainer:profiles!event_trainer_assignments_trainer_profile_id_fkey(
          full_name,
          email
        )
      `)
      .eq('event_id', eventId)
      .eq('status', 'selected')

    if (trainerIds && trainerIds.length > 0) {
      query = query.in('trainer_profile_id', trainerIds)
    }

    const { data: assignments, error: fetchError } = await query

    if (fetchError || !assignments || assignments.length === 0) {
      return { success: false, error: 'No trainers to invite' }
    }

    // Get event details for email
    const { data: event } = await supabase
      .from('events')
      .select('title, start_date, location')
      .eq('id', eventId)
      .single()

    // Calculate response deadline (3 days from now)
    const responseDeadline = new Date()
    responseDeadline.setDate(responseDeadline.getDate() + 3)

    // Update status to invited
    const { error: updateError } = await supabase
      .from('event_trainer_assignments')
      .update({
        status: 'invited',
        response_deadline: responseDeadline.toISOString(),
      })
      .in(
        'id',
        assignments.map((a) => a.id)
      )

    if (updateError) {
      console.error('Error sending invitations:', updateError)
      return { success: false, error: 'Failed to send invitations' }
    }

    // Send invitation emails to trainers
    if (event) {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app'
      const trainerEmails = assignments
        .filter((a) => {
          const trainer = a.trainer as { email?: string; full_name?: string }[] | null;
          return trainer?.[0]?.email;
        })
        .map((assignment) => {
          const trainer = assignment.trainer as { email: string; full_name?: string }[];
          const emailTemplate = trainerAssignmentEmail({
            trainerName: trainer[0]?.full_name || 'Trainer',
            eventTitle: event.title,
            sessionTopic: assignment.session_topic || 'Training Session',
            eventDate: new Date(event.start_date).toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            eventVenue: event.location || 'TBD',
            eventLink: `${APP_URL}/events/${eventId}`,
          })
          return {
            to: trainer[0].email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          }
        })

      await sendBatchEmails(trainerEmails)
    }

    updateTag('trainer-assignments')
    revalidatePath(`/events/${eventId}`)

    return { success: true, data: { sentCount: assignments.length } }
  } catch (error) {
    console.error('Error in sendTrainerInvitations:', error)
    return { success: false, error: 'Failed to send invitations' }
  }
}

/**
 * Trainer responds to invitation
 */
export async function respondToTrainerInvite(
  input: RespondToTrainerInviteInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = respondToTrainerInviteSchema.parse(input)

    // Get the assignment
    const { data: assignment, error: fetchError } = await supabase
      .from('event_trainer_assignments')
      .select('id, event_id, trainer_profile_id, status, response_deadline')
      .eq('id', validated.assignment_id)
      .single()

    if (fetchError || !assignment) {
      return { success: false, error: 'Assignment not found' }
    }

    // Verify trainer owns this assignment
    const { data: trainerProfile } = await supabase
      .from('trainer_profiles')
      .select('id')
      .eq('member_id', user.id)
      .single()

    if (!trainerProfile || trainerProfile.id !== assignment.trainer_profile_id) {
      return { success: false, error: 'Not authorized to respond to this invitation' }
    }

    if (assignment.status !== 'invited') {
      return { success: false, error: 'Invitation already responded to' }
    }

    // Check if deadline passed
    if (assignment.response_deadline && new Date(assignment.response_deadline) < new Date()) {
      return { success: false, error: 'Response deadline has passed' }
    }

    // Update assignment
    const newStatus = validated.accept ? 'accepted' : 'declined'
    const { error: updateError } = await supabase
      .from('event_trainer_assignments')
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
        decline_reason: validated.accept ? null : validated.decline_reason,
      })
      .eq('id', validated.assignment_id)

    if (updateError) {
      console.error('Error responding to invitation:', updateError)
      return { success: false, error: 'Failed to respond to invitation' }
    }

    updateTag('trainer-assignments')
    revalidatePath(`/events/${assignment.event_id}`)
    revalidatePath('/dashboard/trainer')

    return { success: true }
  } catch (error) {
    console.error('Error in respondToTrainerInvite:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Confirm trainer for event (by coordinator)
 */
export async function confirmTrainer(
  input: ConfirmTrainerInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = confirmTrainerSchema.parse(input)

    // Get assignment
    const { data: assignment, error: fetchError } = await supabase
      .from('event_trainer_assignments')
      .select('id, event_id, status')
      .eq('id', validated.assignment_id)
      .single()

    if (fetchError || !assignment) {
      return { success: false, error: 'Assignment not found' }
    }

    if (assignment.status !== 'accepted') {
      return { success: false, error: 'Trainer must accept invitation before confirmation' }
    }

    // Update to confirmed
    const { error: updateError } = await supabase
      .from('event_trainer_assignments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,
        notes: validated.notes || null,
      })
      .eq('id', validated.assignment_id)

    if (updateError) {
      console.error('Error confirming trainer:', updateError)
      return { success: false, error: 'Failed to confirm trainer' }
    }

    updateTag('trainer-assignments')
    revalidatePath(`/events/${assignment.event_id}`)

    return { success: true }
  } catch (error) {
    console.error('Error in confirmTrainer:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Update trainer assignment
 */
export async function updateTrainerAssignment(
  input: UpdateTrainerAssignmentInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = updateTrainerAssignmentSchema.parse(input)

    const { id, ...updateData } = validated

    const { data: assignment } = await supabase
      .from('event_trainer_assignments')
      .select('event_id')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('event_trainer_assignments')
      .update(updateData)
      .eq('id', id)

    if (error) {
      console.error('Error updating assignment:', error)
      return { success: false, error: 'Failed to update assignment' }
    }

    updateTag('trainer-assignments')
    if (assignment) {
      revalidatePath(`/events/${assignment.event_id}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Error in updateTrainerAssignment:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Cancel trainer assignment
 */
export async function cancelTrainerAssignment(
  assignmentId: string,
  reason?: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: assignment } = await supabase
      .from('event_trainer_assignments')
      .select('event_id')
      .eq('id', assignmentId)
      .single()

    const { error } = await supabase
      .from('event_trainer_assignments')
      .update({
        status: 'cancelled',
        notes: reason || null,
      })
      .eq('id', assignmentId)

    if (error) {
      console.error('Error cancelling assignment:', error)
      return { success: false, error: 'Failed to cancel assignment' }
    }

    updateTag('trainer-assignments')
    if (assignment) {
      revalidatePath(`/events/${assignment.event_id}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Error in cancelTrainerAssignment:', error)
    return { success: false, error: 'Failed to cancel assignment' }
  }
}

// ============================================================================
// Rating Actions
// ============================================================================

/**
 * Rate trainer after session (by coordinator)
 */
export async function rateTrainer(input: RateTrainerInput): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = rateTrainerSchema.parse(input)

    // Get assignment to verify status
    const { data: assignment, error: fetchError } = await supabase
      .from('event_trainer_assignments')
      .select('id, event_id, status, trainer_profile_id')
      .eq('id', validated.assignment_id)
      .single()

    if (fetchError || !assignment) {
      return { success: false, error: 'Assignment not found' }
    }

    if (assignment.status !== 'confirmed' && assignment.status !== 'completed') {
      return { success: false, error: 'Can only rate confirmed or completed sessions' }
    }

    // Update rating
    const { error: updateError } = await supabase
      .from('event_trainer_assignments')
      .update({
        trainer_rating: validated.trainer_rating,
        trainer_feedback: validated.trainer_feedback || null,
        status: 'completed',
      })
      .eq('id', validated.assignment_id)

    if (updateError) {
      console.error('Error rating trainer:', updateError)
      return { success: false, error: 'Failed to rate trainer' }
    }

    // Update trainer profile average rating
    await updateTrainerAverageRating(assignment.trainer_profile_id)

    updateTag('trainer-assignments')
    updateTag('trainers')
    revalidatePath(`/events/${assignment.event_id}`)

    return { success: true }
  } catch (error) {
    console.error('Error in rateTrainer:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Rate coordinator after session (by trainer)
 */
export async function rateCoordinator(input: RateCoordinatorInput): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = rateCoordinatorSchema.parse(input)

    // Verify trainer owns this assignment
    const { data: trainerProfile } = await supabase
      .from('trainer_profiles')
      .select('id')
      .eq('member_id', user.id)
      .single()

    const { data: assignment, error: fetchError } = await supabase
      .from('event_trainer_assignments')
      .select('id, event_id, trainer_profile_id')
      .eq('id', validated.assignment_id)
      .single()

    if (fetchError || !assignment) {
      return { success: false, error: 'Assignment not found' }
    }

    if (!trainerProfile || trainerProfile.id !== assignment.trainer_profile_id) {
      return { success: false, error: 'Not authorized to rate this session' }
    }

    // Update rating
    const { error: updateError } = await supabase
      .from('event_trainer_assignments')
      .update({
        coordinator_rating: validated.coordinator_rating,
        coordinator_feedback: validated.coordinator_feedback || null,
      })
      .eq('id', validated.assignment_id)

    if (updateError) {
      console.error('Error rating coordinator:', updateError)
      return { success: false, error: 'Failed to rate coordinator' }
    }

    updateTag('trainer-assignments')
    revalidatePath(`/events/${assignment.event_id}`)

    return { success: true }
  } catch (error) {
    console.error('Error in rateCoordinator:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Update trainer's average rating based on all completed sessions
 */
async function updateTrainerAverageRating(trainerProfileId: string): Promise<void> {
  const supabase = await createClient()

  // Get all ratings for this trainer
  const { data: assignments } = await supabase
    .from('event_trainer_assignments')
    .select('trainer_rating')
    .eq('trainer_profile_id', trainerProfileId)
    .eq('status', 'completed')
    .not('trainer_rating', 'is', null)

  if (!assignments || assignments.length === 0) {
    return
  }

  const avgRating =
    assignments.reduce((sum, a) => sum + (a.trainer_rating || 0), 0) /
    assignments.length

  // Update trainer profile
  await supabase
    .from('trainer_profiles')
    .update({
      average_rating: Math.round(avgRating * 100) / 100,
      total_sessions: assignments.length,
    })
    .eq('id', trainerProfileId)
}

/**
 * Mark trainer attendance for session
 */
export async function markTrainerAttendance(
  assignmentId: string,
  attended: boolean
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: assignment } = await supabase
      .from('event_trainer_assignments')
      .select('event_id')
      .eq('id', assignmentId)
      .single()

    const { error } = await supabase
      .from('event_trainer_assignments')
      .update({
        attendance_confirmed: attended,
      })
      .eq('id', assignmentId)

    if (error) {
      console.error('Error marking attendance:', error)
      return { success: false, error: 'Failed to mark attendance' }
    }

    updateTag('trainer-assignments')
    if (assignment) {
      revalidatePath(`/events/${assignment.event_id}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Error in markTrainerAttendance:', error)
    return { success: false, error: 'Failed to mark attendance' }
  }
}
