/**
 * Session Reports Server Actions
 *
 * Server Actions for post-session reports.
 * Handles report submission, verification, and follow-ups.
 */

'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import {
  submitSessionReportSchema,
  updateSessionReportSchema,
  verifySessionReportSchema,
  completeFollowUpSchema,
  type SubmitSessionReportInput,
  type UpdateSessionReportInput,
  type VerifySessionReportInput,
  type CompleteFollowUpInput,
} from '@/lib/validations/event'
import { isAdminLevel } from '@/lib/permissions'

type ActionResponse<T = void> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Get user's hierarchy level from database
 */
async function getUserHierarchyLevel(userId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_user_hierarchy_level', {
    user_id: userId
  })
  return data || 0
}

// ============================================================================
// Session Report Actions
// ============================================================================

/**
 * Submit a session report
 */
export async function submitSessionReport(
  input: SubmitSessionReportInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = submitSessionReportSchema.parse(input)

    // Verify event exists and is a service event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, status, is_service_event, expected_students')
      .eq('id', validated.event_id)
      .eq('is_service_event', true)
      .single()

    if (eventError || !event) {
      return { success: false, error: 'Service event not found' }
    }

    // Check if report already exists
    const { data: existing } = await supabase
      .from('event_session_reports')
      .select('id')
      .eq('event_id', validated.event_id)
      .single()

    if (existing) {
      return { success: false, error: 'Session report already exists for this event' }
    }

    // Calculate actual duration if times provided
    let actualDurationMinutes: number | null = null
    if (validated.actual_start_time && validated.actual_end_time) {
      const start = new Date(validated.actual_start_time)
      const end = new Date(validated.actual_end_time)
      actualDurationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
    }

    // Insert report
    const { data, error } = await supabase
      .from('event_session_reports')
      .insert({
        event_id: validated.event_id,
        trainer_assignment_id: validated.trainer_assignment_id || null,
        expected_attendance: event.expected_students,
        actual_attendance: validated.actual_attendance,
        male_count: validated.male_count || null,
        female_count: validated.female_count || null,
        staff_present: validated.staff_present || null,
        class_breakdown: validated.class_breakdown || null,
        actual_start_time: validated.actual_start_time || null,
        actual_end_time: validated.actual_end_time || null,
        actual_duration_minutes: actualDurationMinutes,
        topics_covered: validated.topics_covered || null,
        venue_condition: validated.venue_condition || null,
        av_equipment_worked: validated.av_equipment_worked ?? null,
        logistical_issues: validated.logistical_issues || null,
        engagement_level: validated.engagement_level || null,
        knowledge_retention_score: validated.knowledge_retention_score || null,
        behavioral_change_observed: validated.behavioral_change_observed || null,
        coordinator_name: validated.coordinator_name || null,
        coordinator_feedback: validated.coordinator_feedback || null,
        coordinator_rating: validated.coordinator_rating || null,
        willing_to_host_again: validated.willing_to_host_again ?? null,
        follow_up_required: validated.follow_up_required || false,
        follow_up_notes: validated.follow_up_notes || null,
        follow_up_date: validated.follow_up_date || null,
        follow_up_completed: false,
        photo_urls: validated.photo_urls || null,
        attendance_sheet_url: validated.attendance_sheet_url || null,
        trainer_notes: validated.trainer_notes || null,
        highlights: validated.highlights || null,
        challenges_faced: validated.challenges_faced || null,
        recommendations: validated.recommendations || null,
        best_practices_noted: validated.best_practices_noted || null,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error submitting session report:', error)
      return { success: false, error: 'Failed to submit session report' }
    }

    // Update event status to completed
    await supabase
      .from('events')
      .update({ status: 'completed' })
      .eq('id', validated.event_id)

    // Update trainer profile stats if trainer assignment provided
    if (validated.trainer_assignment_id) {
      await updateTrainerStats(validated.trainer_assignment_id, validated.actual_attendance)
    }

    // Invalidate caches
    updateTag('session-reports')
    updateTag('service-events')
    updateTag('events')
    revalidatePath(`/events/${validated.event_id}`)
    revalidatePath('/events/service')
    revalidatePath('/reports')

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Error in submitSessionReport:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Update an existing session report
 */
export async function updateSessionReport(
  reportId: string,
  input: UpdateSessionReportInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updateSessionReportSchema.parse(input)

    // Get report to verify ownership/permissions
    const { data: report, error: fetchError } = await supabase
      .from('event_session_reports')
      .select('id, event_id, submitted_by, verified_at')
      .eq('id', reportId)
      .single()

    if (fetchError || !report) {
      return { success: false, error: 'Report not found' }
    }

    // Can only edit if not yet verified
    if (report.verified_at) {
      return { success: false, error: 'Cannot edit verified reports' }
    }

    // Check if user can edit (submitter or admin)
    if (report.submitted_by !== user.id) {
      // Check if user has admin privileges (Chair level or higher)
      const hierarchyLevel = await getUserHierarchyLevel(user.id)
      if (!isAdminLevel(hierarchyLevel)) {
        return { success: false, error: 'Not authorized to edit this report' }
      }
    }

    // Calculate actual duration if times provided
    let actualDurationMinutes = undefined
    if (validated.actual_start_time && validated.actual_end_time) {
      const start = new Date(validated.actual_start_time)
      const end = new Date(validated.actual_end_time)
      actualDurationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
    }

    // Update report
    const { error } = await supabase
      .from('event_session_reports')
      .update({
        ...validated,
        actual_duration_minutes: actualDurationMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)

    if (error) {
      console.error('Error updating report:', error)
      return { success: false, error: 'Failed to update report' }
    }

    updateTag('session-reports')
    revalidatePath(`/events/${report.event_id}`)
    revalidatePath('/reports')

    return { success: true }
  } catch (error) {
    console.error('Error in updateSessionReport:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Verify a session report
 */
export async function verifySessionReport(
  input: VerifySessionReportInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = verifySessionReportSchema.parse(input)

    // Get report
    const { data: report, error: fetchError } = await supabase
      .from('event_session_reports')
      .select('id, event_id, verified_at')
      .eq('id', validated.report_id)
      .single()

    if (fetchError || !report) {
      return { success: false, error: 'Report not found' }
    }

    if (report.verified_at) {
      return { success: false, error: 'Report already verified' }
    }

    // Permission check: Verification requires admin-level access
    // RLS policies ensure only authorized users (Chapter leadership) can verify
    const hierarchyLevel = await getUserHierarchyLevel(user.id)
    if (!isAdminLevel(hierarchyLevel)) {
      return { success: false, error: 'Not authorized to verify reports' }
    }

    // Update report
    const { error } = await supabase
      .from('event_session_reports')
      .update({
        verified_at: validated.verified ? new Date().toISOString() : null,
        verified_by: validated.verified ? user.id : null,
      })
      .eq('id', validated.report_id)

    if (error) {
      console.error('Error verifying report:', error)
      return { success: false, error: 'Failed to verify report' }
    }

    updateTag('session-reports')
    revalidatePath(`/events/${report.event_id}`)
    revalidatePath('/reports')
    revalidatePath('/reports/pending')

    return { success: true }
  } catch (error) {
    console.error('Error in verifySessionReport:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Complete a follow-up
 */
export async function completeFollowUp(
  input: CompleteFollowUpInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = completeFollowUpSchema.parse(input)

    // Get report
    const { data: report, error: fetchError } = await supabase
      .from('event_session_reports')
      .select('id, event_id, follow_up_required, follow_up_completed, follow_up_notes')
      .eq('id', validated.report_id)
      .single()

    if (fetchError || !report) {
      return { success: false, error: 'Report not found' }
    }

    if (!report.follow_up_required) {
      return { success: false, error: 'No follow-up required for this report' }
    }

    if (report.follow_up_completed) {
      return { success: false, error: 'Follow-up already completed' }
    }

    // Update report
    const { error } = await supabase
      .from('event_session_reports')
      .update({
        follow_up_completed: true,
        follow_up_completed_at: new Date().toISOString(),
        follow_up_notes: validated.notes
          ? `${report.follow_up_notes || ''}\n\nCompleted: ${validated.notes}`
          : report.follow_up_notes,
      })
      .eq('id', validated.report_id)

    if (error) {
      console.error('Error completing follow-up:', error)
      return { success: false, error: 'Failed to complete follow-up' }
    }

    updateTag('session-reports')
    revalidatePath(`/events/${report.event_id}`)
    revalidatePath('/reports/follow-ups')

    return { success: true }
  } catch (error) {
    console.error('Error in completeFollowUp:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Add photos to session report
 */
export async function addReportPhotos(
  reportId: string,
  photoUrls: string[]
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get current report
    const { data: report, error: fetchError } = await supabase
      .from('event_session_reports')
      .select('id, event_id, photo_urls, submitted_by')
      .eq('id', reportId)
      .single()

    if (fetchError || !report) {
      return { success: false, error: 'Report not found' }
    }

    // Verify ownership
    if (report.submitted_by !== user.id) {
      return { success: false, error: 'Not authorized to edit this report' }
    }

    // Merge existing and new photos
    const existingPhotos = report.photo_urls || []
    const allPhotos = [...existingPhotos, ...photoUrls]

    const { error } = await supabase
      .from('event_session_reports')
      .update({
        photo_urls: allPhotos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)

    if (error) {
      console.error('Error adding photos:', error)
      return { success: false, error: 'Failed to add photos' }
    }

    updateTag('session-reports')
    revalidatePath(`/events/${report.event_id}`)

    return { success: true }
  } catch (error) {
    console.error('Error in addReportPhotos:', error)
    return { success: false, error: 'Failed to add photos' }
  }
}

/**
 * Upload attendance sheet
 */
export async function uploadAttendanceSheet(
  reportId: string,
  sheetUrl: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: report } = await supabase
      .from('event_session_reports')
      .select('event_id, submitted_by')
      .eq('id', reportId)
      .single()

    if (!report) {
      return { success: false, error: 'Report not found' }
    }

    if (report.submitted_by !== user.id) {
      return { success: false, error: 'Not authorized' }
    }

    const { error } = await supabase
      .from('event_session_reports')
      .update({
        attendance_sheet_url: sheetUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)

    if (error) {
      return { success: false, error: 'Failed to upload attendance sheet' }
    }

    updateTag('session-reports')
    revalidatePath(`/events/${report.event_id}`)

    return { success: true }
  } catch (error) {
    console.error('Error in uploadAttendanceSheet:', error)
    return { success: false, error: 'Failed to upload' }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Update trainer stats after session completion
 */
async function updateTrainerStats(
  assignmentId: string,
  studentsImpacted: number
): Promise<void> {
  const supabase = await createClient()

  // Get trainer profile ID from assignment
  const { data: assignment } = await supabase
    .from('event_trainer_assignments')
    .select('trainer_profile_id')
    .eq('id', assignmentId)
    .single()

  if (!assignment) return

  // Update trainer profile stats
  const { data: profile } = await supabase
    .from('trainer_profiles')
    .select('total_sessions, total_students_impacted')
    .eq('id', assignment.trainer_profile_id)
    .single()

  if (!profile) return

  await supabase
    .from('trainer_profiles')
    .update({
      total_sessions: (profile.total_sessions || 0) + 1,
      total_students_impacted: (profile.total_students_impacted || 0) + studentsImpacted,
      last_session_date: new Date().toISOString(),
    })
    .eq('id', assignment.trainer_profile_id)

  // Mark assignment as completed
  await supabase
    .from('event_trainer_assignments')
    .update({ status: 'completed' })
    .eq('id', assignmentId)
}

/**
 * Get session report summary for dashboard
 */
export async function getSessionReportSummary(): Promise<ActionResponse<{
  total: number
  verified: number
  pending: number
  pendingFollowUps: number
}>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .from('event_session_reports')
      .select('id, verified_at, follow_up_required, follow_up_completed')

    if (error) {
      return { success: false, error: 'Failed to fetch summary' }
    }

    const reports = data || []
    const verified = reports.filter((r: { verified_at?: string | null }) => r.verified_at).length
    const pending = reports.filter((r: { verified_at?: string | null }) => !r.verified_at).length
    const pendingFollowUps = reports.filter(
      (r: { follow_up_required?: boolean; follow_up_completed?: boolean }) => r.follow_up_required && !r.follow_up_completed
    ).length

    return {
      success: true,
      data: {
        total: reports.length,
        verified,
        pending,
        pendingFollowUps,
      },
    }
  } catch (error) {
    console.error('Error in getSessionReportSummary:', error)
    return { success: false, error: 'Failed to fetch summary' }
  }
}
