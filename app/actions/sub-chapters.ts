'use server'

/**
 * Sub-Chapter Server Actions
 *
 * Server actions for managing Yuva and Thalir sub-chapters.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'
import type {
  CreateSubChapterInput,
  CreateSubChapterLeadInput,
  CreateSubChapterMemberInput,
  CreateSubChapterEventInput,
  UpdateSubChapterEventInput,
  CompleteSubChapterEventInput,
  SubChapterStatus,
  SubChapterEventStatus,
} from '@/types/sub-chapter'

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ============================================================================
// Sub-Chapter Actions
// ============================================================================

/**
 * Create a new sub-chapter
 */
export async function createSubChapter(
  input: CreateSubChapterInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sub_chapters')
    .insert({
      chapter_id: input.chapter_id,
      type: input.type,
      stakeholder_type: input.stakeholder_type,
      stakeholder_id: input.stakeholder_id,
      name: input.name,
      description: input.description || null,
      yi_mentor_id: input.yi_mentor_id || null,
      vertical_id: input.vertical_id || null,
      status: 'pending',
      established_date: new Date().toISOString().split('T')[0],
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating sub-chapter:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath('/dashboard')

  return { success: true, data: { id: data.id } }
}

/**
 * Update sub-chapter status
 */
export async function updateSubChapterStatus(
  id: string,
  status: SubChapterStatus
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('sub_chapters')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error updating sub-chapter status:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath(`/sub-chapters/${id}`)

  return { success: true }
}

/**
 * Assign Yi mentor to sub-chapter
 */
export async function assignYiMentor(
  subChapterId: string,
  mentorId: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('sub_chapters')
    .update({
      yi_mentor_id: mentorId,
      yi_mentor_assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subChapterId)

  if (error) {
    console.error('Error assigning Yi mentor:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath(`/sub-chapters/${subChapterId}`)

  return { success: true }
}

/**
 * Update sub-chapter details
 */
export async function updateSubChapter(
  id: string,
  updates: Partial<{
    name: string
    description: string
    logo_url: string
    vertical_id: string
  }>
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('sub_chapters')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error updating sub-chapter:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath(`/sub-chapters/${id}`)

  return { success: true }
}

// ============================================================================
// Sub-Chapter Lead Actions
// ============================================================================

/**
 * Generate a random password
 */
function generatePassword(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

/**
 * Create a new sub-chapter lead
 */
export async function createSubChapterLead(
  input: CreateSubChapterLeadInput
): Promise<ActionResult<{ id: string; temporaryPassword: string }>> {
  const supabase = await createClient()

  // Check if email already exists
  const { data: existing } = await supabase
    .from('sub_chapter_leads')
    .select('id')
    .eq('email', input.email)
    .single()

  if (existing) {
    return { success: false, error: 'A lead with this email already exists' }
  }

  // Generate temporary password
  const temporaryPassword = generatePassword()
  const passwordHash = await bcrypt.hash(temporaryPassword, 10)

  const { data, error } = await supabase
    .from('sub_chapter_leads')
    .insert({
      sub_chapter_id: input.sub_chapter_id,
      full_name: input.full_name,
      email: input.email,
      phone: input.phone || null,
      student_id: input.student_id || null,
      department: input.department || null,
      year_of_study: input.year_of_study || null,
      password_hash: passwordHash,
      role: input.role || 'lead',
      is_primary_lead: input.is_primary_lead ?? false,
      status: 'pending',
      requires_password_change: true,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating sub-chapter lead:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/sub-chapters/${input.sub_chapter_id}`)

  // TODO: Send welcome email with temporary password

  return {
    success: true,
    data: { id: data.id, temporaryPassword },
  }
}

/**
 * Update lead status
 */
export async function updateLeadStatus(
  id: string,
  status: 'pending' | 'active' | 'inactive'
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('sub_chapter_leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error updating lead status:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath('/chapter-lead')

  return { success: true }
}

/**
 * Change lead password
 */
export async function changeLeadPassword(
  leadId: string,
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  const supabase = await createClient()

  // Get current password hash
  const { data: lead, error: fetchError } = await supabase
    .from('sub_chapter_leads')
    .select('password_hash')
    .eq('id', leadId)
    .single()

  if (fetchError || !lead) {
    return { success: false, error: 'Lead not found' }
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, lead.password_hash)
  if (!isValid) {
    return { success: false, error: 'Current password is incorrect' }
  }

  // Hash and update new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10)

  const { error } = await supabase
    .from('sub_chapter_leads')
    .update({
      password_hash: newPasswordHash,
      requires_password_change: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (error) {
    console.error('Error changing password:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ============================================================================
// Sub-Chapter Member Actions
// ============================================================================

/**
 * Add a member to sub-chapter
 */
export async function addSubChapterMember(
  input: CreateSubChapterMemberInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sub_chapter_members')
    .insert({
      sub_chapter_id: input.sub_chapter_id,
      full_name: input.full_name,
      email: input.email || null,
      phone: input.phone || null,
      student_id: input.student_id || null,
      department: input.department || null,
      year_of_study: input.year_of_study || null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error adding sub-chapter member:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/sub-chapters/${input.sub_chapter_id}`)
  revalidatePath('/chapter-lead/members')

  return { success: true, data: { id: data.id } }
}

/**
 * Bulk add members to sub-chapter
 */
export async function bulkAddSubChapterMembers(
  subChapterId: string,
  members: Array<Omit<CreateSubChapterMemberInput, 'sub_chapter_id'>>
): Promise<ActionResult<{ addedCount: number }>> {
  const supabase = await createClient()

  const membersToInsert = members.map((m) => ({
    sub_chapter_id: subChapterId,
    full_name: m.full_name,
    email: m.email || null,
    phone: m.phone || null,
    student_id: m.student_id || null,
    department: m.department || null,
    year_of_study: m.year_of_study || null,
    is_active: true,
  }))

  const { data, error } = await supabase
    .from('sub_chapter_members')
    .insert(membersToInsert)
    .select('id')

  if (error) {
    console.error('Error bulk adding members:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/sub-chapters/${subChapterId}`)
  revalidatePath('/chapter-lead/members')

  return { success: true, data: { addedCount: data?.length || 0 } }
}

/**
 * Update member active status
 */
export async function updateMemberStatus(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient()

  const updates: Record<string, any> = {
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }

  if (!isActive) {
    updates.left_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('sub_chapter_members')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Error updating member status:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath('/chapter-lead/members')

  return { success: true }
}

// ============================================================================
// Sub-Chapter Event Actions
// ============================================================================

/**
 * Create a new event
 */
export async function createSubChapterEvent(
  input: CreateSubChapterEventInput,
  createdBy?: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sub_chapter_events')
    .insert({
      sub_chapter_id: input.sub_chapter_id,
      event_type: input.event_type,
      title: input.title,
      description: input.description || null,
      event_date: input.event_date,
      start_time: input.start_time || null,
      end_time: input.end_time || null,
      venue: input.venue || null,
      is_online: input.is_online ?? false,
      meeting_link: input.meeting_link || null,
      expected_participants: input.expected_participants || null,
      requested_speaker_id: input.requested_speaker_id || null,
      speaker_topic: input.speaker_topic || null,
      industry_id: input.industry_id || null,
      visit_purpose: input.visit_purpose || null,
      status: 'draft',
      created_by: createdBy || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating event:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/sub-chapters/${input.sub_chapter_id}`)
  revalidatePath('/chapter-lead/events')

  return { success: true, data: { id: data.id } }
}

/**
 * Update an event
 */
export async function updateSubChapterEvent(
  input: UpdateSubChapterEventInput
): Promise<ActionResult> {
  const supabase = await createClient()

  const { id, ...updates } = input

  const { error } = await supabase
    .from('sub_chapter_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error updating event:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath('/chapter-lead/events')

  return { success: true }
}

/**
 * Submit event for approval
 */
export async function submitEventForApproval(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('sub_chapter_events')
    .update({
      status: 'pending_approval',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'draft')

  if (error) {
    console.error('Error submitting event:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath('/chapter-lead/events')
  revalidatePath('/speaker-requests')

  return { success: true }
}

/**
 * Approve an event (by Yi mentor or speaker)
 */
export async function approveEvent(
  id: string,
  approvedBy: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('sub_chapter_events')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending_approval')

  if (error) {
    console.error('Error approving event:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath('/chapter-lead/events')
  revalidatePath('/speaker-requests')

  return { success: true }
}

/**
 * Reject an event
 */
export async function rejectEvent(
  id: string,
  rejectedBy: string,
  reason: string
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('sub_chapter_events')
    .update({
      status: 'rejected',
      approved_by: rejectedBy,
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending_approval')

  if (error) {
    console.error('Error rejecting event:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath('/chapter-lead/events')
  revalidatePath('/speaker-requests')

  return { success: true }
}

/**
 * Confirm speaker for an event
 */
export async function confirmSpeaker(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('sub_chapter_events')
    .update({
      speaker_confirmed: true,
      speaker_confirmed_at: new Date().toISOString(),
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'approved')

  if (error) {
    console.error('Error confirming speaker:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath('/chapter-lead/events')
  revalidatePath('/speaker-requests')

  return { success: true }
}

/**
 * Update event status
 */
export async function updateEventStatus(
  id: string,
  status: SubChapterEventStatus
): Promise<ActionResult> {
  const supabase = await createClient()

  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'in_progress') {
    // Event has started
  } else if (status === 'cancelled') {
    // Event cancelled
  }

  const { error } = await supabase
    .from('sub_chapter_events')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Error updating event status:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath('/chapter-lead/events')

  return { success: true }
}

/**
 * Complete an event with outcomes
 */
export async function completeSubChapterEvent(
  input: CompleteSubChapterEventInput
): Promise<ActionResult> {
  const supabase = await createClient()

  const { id, ...outcomes } = input

  const { error } = await supabase
    .from('sub_chapter_events')
    .update({
      status: 'completed',
      actual_participants: outcomes.actual_participants,
      impact_summary: outcomes.impact_summary || null,
      photos_url: outcomes.photos_url || null,
      report_url: outcomes.report_url || null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Error completing event:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/sub-chapters')
  revalidatePath('/chapter-lead/events')

  return { success: true }
}

/**
 * Record event feedback
 */
export async function recordEventFeedback(
  eventId: string,
  score: number
): Promise<ActionResult> {
  const supabase = await createClient()

  // Get current feedback stats
  const { data: event, error: fetchError } = await supabase
    .from('sub_chapter_events')
    .select('feedback_score, feedback_count')
    .eq('id', eventId)
    .single()

  if (fetchError) {
    return { success: false, error: 'Event not found' }
  }

  // Calculate new average
  const currentCount = event.feedback_count || 0
  const currentScore = event.feedback_score || 0
  const newCount = currentCount + 1
  const newScore = (currentScore * currentCount + score) / newCount

  const { error } = await supabase
    .from('sub_chapter_events')
    .update({
      feedback_score: newScore,
      feedback_count: newCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  if (error) {
    console.error('Error recording feedback:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
