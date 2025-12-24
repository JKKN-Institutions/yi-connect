/**
 * Industry Opportunity Server Actions
 *
 * Server Actions for Industry Opportunities bidirectional system.
 * Handles opportunities, applications, visit requests, and bookmarks.
 */

'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import { sendEmail } from '@/lib/email'
import {
  opportunityApplicationAcceptedEmail,
  opportunityApplicationDeclinedEmail,
  opportunityApplicationShortlistedEmail,
} from '@/lib/email/templates'
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  publishOpportunitySchema,
  closeOpportunitySchema,
  submitApplicationSchema,
  updateApplicationSchema,
  withdrawApplicationSchema,
  reviewApplicationSchema,
  bulkReviewApplicationsSchema,
  createVisitRequestSchema,
  reviewVisitRequestSchema,
  scheduleVisitSchema,
  completeVisitSchema,
  cancelVisitRequestSchema,
  expressInterestSchema,
  bookmarkOpportunitySchema,
  type CreateOpportunityInput,
  type UpdateOpportunityInput,
  type SubmitApplicationInput,
  type UpdateApplicationInput,
  type ReviewApplicationInput,
  type BulkReviewApplicationsInput,
  type CreateVisitRequestInput,
  type ReviewVisitRequestInput,
  type ScheduleVisitInput,
  type CompleteVisitInput,
} from '@/lib/validations/industry-opportunity'

type ActionResponse<T = void> = {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Opportunity Actions
// ============================================================================

/**
 * Create a new opportunity
 */
export async function createOpportunity(
  input: CreateOpportunityInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = createOpportunitySchema.parse(input)

    // Get user's chapter
    const { data: member } = await supabase
      .from('members')
      .select('chapter_id')
      .eq('id', user.id)
      .single()

    if (!member?.chapter_id) {
      return { success: false, error: 'Member chapter not found' }
    }

    // Insert opportunity
    const { data, error } = await supabase
      .from('industry_opportunities')
      .insert({
        chapter_id: member.chapter_id,
        industry_id: validated.industry_id,
        title: validated.title,
        description: validated.description,
        opportunity_type: validated.opportunity_type,
        start_date: validated.start_date || null,
        end_date: validated.end_date || null,
        duration_description: validated.duration_description || null,
        application_deadline: validated.application_deadline,
        max_participants: validated.max_participants || null,
        eligibility_criteria: validated.eligibility_criteria,
        location: validated.location || null,
        is_remote: validated.is_remote || false,
        meeting_link: validated.meeting_link || null,
        is_paid: validated.is_paid || false,
        compensation_type: validated.compensation_type || null,
        compensation_details: validated.compensation_details || null,
        benefits: validated.benefits || null,
        learning_outcomes: validated.learning_outcomes || null,
        requirements: validated.requirements || null,
        what_to_bring: validated.what_to_bring || null,
        contact_person_name: validated.contact_person_name || null,
        contact_person_email: validated.contact_person_email || null,
        contact_person_phone: validated.contact_person_phone || null,
        tags: validated.tags || null,
        status: 'draft',
        created_by: user.id,
        current_applications: 0,
        accepted_count: 0,
        positions_filled: 0,
        view_count: 0,
        bookmark_count: 0,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating opportunity:', error)
      return { success: false, error: 'Failed to create opportunity' }
    }

    updateTag('opportunities')
    revalidatePath('/opportunities')

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Error in createOpportunity:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Update an opportunity
 */
export async function updateOpportunity(
  opportunityId: string,
  input: UpdateOpportunityInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = updateOpportunitySchema.parse(input)

    const { error } = await supabase
      .from('industry_opportunities')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunityId)

    if (error) {
      console.error('Error updating opportunity:', error)
      return { success: false, error: 'Failed to update opportunity' }
    }

    updateTag('opportunities')
    revalidatePath('/opportunities')
    revalidatePath(`/opportunities/${opportunityId}`)

    return { success: true }
  } catch (error) {
    console.error('Error in updateOpportunity:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Publish an opportunity
 */
export async function publishOpportunity(
  opportunityId: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase
      .from('industry_opportunities')
      .update({
        status: 'accepting_applications',
        published_at: new Date().toISOString(),
      })
      .eq('id', opportunityId)
      .eq('status', 'draft')

    if (error) {
      console.error('Error publishing opportunity:', error)
      return { success: false, error: 'Failed to publish opportunity' }
    }

    updateTag('opportunities')
    revalidatePath('/opportunities')
    revalidatePath(`/opportunities/${opportunityId}`)

    return { success: true }
  } catch (error) {
    console.error('Error in publishOpportunity:', error)
    return { success: false, error: 'Failed to publish' }
  }
}

/**
 * Close an opportunity
 */
export async function closeOpportunity(
  opportunityId: string,
  reason?: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase
      .from('industry_opportunities')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', opportunityId)

    if (error) {
      console.error('Error closing opportunity:', error)
      return { success: false, error: 'Failed to close opportunity' }
    }

    updateTag('opportunities')
    revalidatePath('/opportunities')
    revalidatePath(`/opportunities/${opportunityId}`)

    return { success: true }
  } catch (error) {
    console.error('Error in closeOpportunity:', error)
    return { success: false, error: 'Failed to close' }
  }
}

// ============================================================================
// Application Actions
// ============================================================================

/**
 * Submit an application
 */
export async function submitApplication(
  input: SubmitApplicationInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = submitApplicationSchema.parse(input)

    // Check if already applied
    const { data: existing } = await supabase
      .from('opportunity_applications')
      .select('id')
      .eq('opportunity_id', validated.opportunity_id)
      .eq('member_id', user.id)
      .single()

    if (existing) {
      return { success: false, error: 'You have already applied to this opportunity' }
    }

    // Check if opportunity is accepting applications
    const { data: opportunity } = await supabase
      .from('industry_opportunities')
      .select('status, application_deadline, max_participants, positions_filled')
      .eq('id', validated.opportunity_id)
      .single()

    if (!opportunity || opportunity.status !== 'accepting_applications') {
      return { success: false, error: 'Opportunity is not accepting applications' }
    }

    if (new Date(opportunity.application_deadline) < new Date()) {
      return { success: false, error: 'Application deadline has passed' }
    }

    if (
      opportunity.max_participants &&
      opportunity.positions_filled >= opportunity.max_participants
    ) {
      return { success: false, error: 'No positions available' }
    }

    // Get member snapshot for application
    const { data: member } = await supabase
      .from('members')
      .select(`
        id,
        company,
        designation,
        industry,
        business_type,
        years_of_experience,
        engagement_score,
        yi_activity_score,
        profile:profiles(
          full_name,
          email,
          phone,
          avatar_url
        ),
        skills:member_skills(
          skill_name,
          proficiency_level
        )
      `)
      .eq('id', user.id)
      .single()

    const memberSnapshot = member
      ? {
          id: member.id,
          full_name: (member.profile as any)?.full_name || '',
          email: (member.profile as any)?.email || '',
          phone: (member.profile as any)?.phone || null,
          avatar_url: (member.profile as any)?.avatar_url || null,
          company: member.company,
          designation: member.designation,
          industry: member.industry,
          business_type: member.business_type,
          years_of_experience: member.years_of_experience,
          skills: (member.skills as any[])?.map((s: any) => ({
            name: s.skill_name,
            proficiency: s.proficiency_level,
          })) || [],
          engagement_score: member.engagement_score,
          yi_activity_score: member.yi_activity_score,
        }
      : null

    // Calculate match score
    let matchScore: number | null = null
    try {
      const { data: score } = await supabase.rpc('calculate_opportunity_match_score', {
        p_member_id: user.id,
        p_opportunity_id: validated.opportunity_id,
      })
      matchScore = score
    } catch {
      // Match score calculation optional
    }

    // Insert application
    const { data, error } = await supabase
      .from('opportunity_applications')
      .insert({
        opportunity_id: validated.opportunity_id,
        member_id: user.id,
        motivation_statement: validated.motivation_statement,
        learning_goals: validated.learning_goals || null,
        relevant_experience: validated.relevant_experience || null,
        transportation_preference: validated.transportation_preference || null,
        dietary_preference: validated.dietary_preference || null,
        special_requirements: validated.special_requirements || null,
        resume_url: validated.resume_url || null,
        portfolio_url: validated.portfolio_url || null,
        additional_documents: validated.additional_documents || null,
        member_snapshot: memberSnapshot,
        match_score: matchScore,
        status: 'pending_review',
        applied_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error submitting application:', error)
      return { success: false, error: 'Failed to submit application' }
    }

    // Update application count
    await supabase.rpc('increment_opportunity_applications', {
      opportunity_id: validated.opportunity_id,
    })

    updateTag('applications')
    updateTag('opportunities')
    revalidatePath('/opportunities')
    revalidatePath(`/opportunities/${validated.opportunity_id}`)
    revalidatePath('/my-applications')

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Error in submitApplication:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Withdraw an application
 */
export async function withdrawApplication(
  applicationId: string,
  reason?: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: application } = await supabase
      .from('opportunity_applications')
      .select('id, opportunity_id, member_id, status')
      .eq('id', applicationId)
      .single()

    if (!application || application.member_id !== user.id) {
      return { success: false, error: 'Application not found' }
    }

    if (application.status === 'withdrawn') {
      return { success: false, error: 'Application already withdrawn' }
    }

    const { error } = await supabase
      .from('opportunity_applications')
      .update({
        status: 'withdrawn',
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', applicationId)

    if (error) {
      return { success: false, error: 'Failed to withdraw application' }
    }

    updateTag('applications')
    revalidatePath('/my-applications')

    return { success: true }
  } catch (error) {
    console.error('Error in withdrawApplication:', error)
    return { success: false, error: 'Failed to withdraw' }
  }
}

/**
 * Review an application
 */
export async function reviewApplication(
  input: ReviewApplicationInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = reviewApplicationSchema.parse(input)

    const { data: application } = await supabase
      .from('opportunity_applications')
      .select(`
        id,
        opportunity_id,
        member_id,
        member:member_id(
          id,
          profile:profiles(full_name, email)
        ),
        opportunity:opportunity_id(
          id,
          title,
          industry:industry_id(name)
        )
      `)
      .eq('id', validated.application_id)
      .single()

    if (!application) {
      return { success: false, error: 'Application not found' }
    }

    const { error } = await supabase
      .from('opportunity_applications')
      .update({
        status: validated.status,
        reviewer_notes: validated.reviewer_notes || null,
        outcome_notes: validated.outcome_notes || null,
        priority_rank: validated.priority_rank || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        status_changed_at: new Date().toISOString(),
        status_changed_by: user.id,
        outcome_at: ['accepted', 'declined'].includes(validated.status)
          ? new Date().toISOString()
          : null,
      })
      .eq('id', validated.application_id)

    if (error) {
      console.error('Error reviewing application:', error)
      return { success: false, error: 'Failed to review application' }
    }

    // Update counts if accepted
    if (validated.status === 'accepted') {
      await supabase.rpc('increment_opportunity_accepted', {
        opportunity_id: application.opportunity_id,
      })
    }

    // Send notification to applicant
    const memberProfile = (application.member as any)?.profile
    const applicantEmail = memberProfile?.email
    const applicantName = memberProfile?.full_name || 'Member'
    const opportunityTitle = (application.opportunity as any)?.title || 'Opportunity'
    const industryName = (application.opportunity as any)?.industry?.name || 'Industry Partner'

    if (applicantEmail) {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app'

      try {
        if (validated.status === 'accepted') {
          const emailTemplate = opportunityApplicationAcceptedEmail({
            applicantName,
            opportunityTitle,
            industryName,
            reviewerNotes: validated.reviewer_notes || validated.outcome_notes,
            viewLink: `${APP_URL}/my-applications`,
          })
          await sendEmail({
            to: applicantEmail,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          })
        } else if (validated.status === 'declined') {
          const emailTemplate = opportunityApplicationDeclinedEmail({
            applicantName,
            opportunityTitle,
            industryName,
            reviewerNotes: validated.reviewer_notes || validated.outcome_notes,
            exploreLink: `${APP_URL}/opportunities`,
          })
          await sendEmail({
            to: applicantEmail,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          })
        } else if (validated.status === 'shortlisted') {
          const emailTemplate = opportunityApplicationShortlistedEmail({
            applicantName,
            opportunityTitle,
            industryName,
            reviewerNotes: validated.reviewer_notes,
            viewLink: `${APP_URL}/my-applications`,
          })
          await sendEmail({
            to: applicantEmail,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          })
        }
      } catch (emailError) {
        console.error('Error sending application review email:', emailError)
        // Don't fail the review if email fails
      }
    }

    updateTag('applications')
    revalidatePath(`/opportunities/${application.opportunity_id}/applications`)

    return { success: true }
  } catch (error) {
    console.error('Error in reviewApplication:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Bulk review applications
 */
export async function bulkReviewApplications(
  input: BulkReviewApplicationsInput
): Promise<ActionResponse<{ updatedCount: number }>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = bulkReviewApplicationsSchema.parse(input)

    const { data, error } = await supabase
      .from('opportunity_applications')
      .update({
        status: validated.status,
        reviewer_notes: validated.reviewer_notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        status_changed_at: new Date().toISOString(),
        status_changed_by: user.id,
        outcome_at: ['accepted', 'declined'].includes(validated.status)
          ? new Date().toISOString()
          : null,
      })
      .in('id', validated.application_ids)
      .select('id')

    if (error) {
      return { success: false, error: 'Failed to update applications' }
    }

    updateTag('applications')

    return { success: true, data: { updatedCount: data?.length || 0 } }
  } catch (error) {
    console.error('Error in bulkReviewApplications:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

// ============================================================================
// Visit Request Actions
// ============================================================================

/**
 * Create a visit request
 */
export async function createVisitRequest(
  input: CreateVisitRequestInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = createVisitRequestSchema.parse(input)

    // Get member's chapter
    const { data: member } = await supabase
      .from('members')
      .select('chapter_id')
      .eq('id', user.id)
      .single()

    if (!member?.chapter_id) {
      return { success: false, error: 'Member chapter not found' }
    }

    // Check for active MoU with industry
    const { data: mou } = await supabase
      .from('stakeholder_mous')
      .select('id')
      .eq('stakeholder_id', validated.industry_id)
      .eq('mou_status', 'signed')
      .gte('expiry_date', new Date().toISOString())
      .single()

    const { data, error } = await supabase
      .from('member_visit_requests')
      .insert({
        chapter_id: member.chapter_id,
        requested_by: user.id,
        industry_id: validated.industry_id,
        mou_id: mou?.id || null,
        request_title: validated.request_title,
        visit_purpose: validated.visit_purpose,
        visit_type: validated.visit_type,
        preferred_dates: validated.preferred_dates,
        expected_participants: validated.expected_participants || null,
        participant_profile: validated.participant_profile || null,
        group_details: validated.group_details || null,
        additional_notes: validated.additional_notes || null,
        status: 'pending_yi_review',
        interest_count: 0,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating visit request:', error)
      return { success: false, error: 'Failed to create visit request' }
    }

    updateTag('visit-requests')
    revalidatePath('/visit-requests')
    revalidatePath('/my-visit-requests')

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Error in createVisitRequest:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Review a visit request (Yi internal review)
 */
export async function reviewVisitRequest(
  input: ReviewVisitRequestInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = reviewVisitRequestSchema.parse(input)

    let newStatus: string
    switch (validated.action) {
      case 'approve':
        newStatus = 'yi_approved'
        break
      case 'decline':
        newStatus = 'cancelled'
        break
      case 'forward_to_industry':
        newStatus = 'forwarded_to_industry'
        break
      default:
        return { success: false, error: 'Invalid action' }
    }

    const { error } = await supabase
      .from('member_visit_requests')
      .update({
        status: newStatus,
        yi_reviewer_id: user.id,
        yi_reviewed_at: new Date().toISOString(),
        yi_approval_notes: validated.notes || null,
        rejection_reason:
          validated.action === 'decline' ? validated.rejection_reason : null,
      })
      .eq('id', validated.request_id)
      .eq('status', 'pending_yi_review')

    if (error) {
      console.error('Error reviewing visit request:', error)
      return { success: false, error: 'Failed to review request' }
    }

    updateTag('visit-requests')
    revalidatePath('/visit-requests')
    revalidatePath('/visit-requests/pending')

    return { success: true }
  } catch (error) {
    console.error('Error in reviewVisitRequest:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Schedule a visit
 */
export async function scheduleVisit(
  input: ScheduleVisitInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = scheduleVisitSchema.parse(input)

    const { error } = await supabase
      .from('member_visit_requests')
      .update({
        status: 'scheduled',
        scheduled_date: validated.scheduled_date,
        scheduled_time: validated.scheduled_time || null,
        scheduled_duration: validated.scheduled_duration || null,
        visit_location: validated.visit_location || null,
      })
      .eq('id', validated.request_id)

    if (error) {
      return { success: false, error: 'Failed to schedule visit' }
    }

    // TODO: Create event from visit request

    updateTag('visit-requests')
    revalidatePath('/visit-requests')

    return { success: true }
  } catch (error) {
    console.error('Error in scheduleVisit:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Complete a visit
 */
export async function completeVisit(
  input: CompleteVisitInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = completeVisitSchema.parse(input)

    const { error } = await supabase
      .from('member_visit_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        feedback: validated.feedback || null,
        feedback_rating: validated.feedback_rating || null,
      })
      .eq('id', validated.request_id)
      .eq('status', 'scheduled')

    if (error) {
      return { success: false, error: 'Failed to complete visit' }
    }

    updateTag('visit-requests')
    revalidatePath('/visit-requests')

    return { success: true }
  } catch (error) {
    console.error('Error in completeVisit:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

// ============================================================================
// Bookmark Actions
// ============================================================================

/**
 * Toggle bookmark on an opportunity
 */
export async function toggleBookmark(
  opportunityId: string
): Promise<ActionResponse<{ bookmarked: boolean }>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if already bookmarked
    const { data: existing } = await supabase
      .from('opportunity_bookmarks')
      .select('id')
      .eq('opportunity_id', opportunityId)
      .eq('member_id', user.id)
      .single()

    if (existing) {
      // Remove bookmark
      await supabase
        .from('opportunity_bookmarks')
        .delete()
        .eq('id', existing.id)

      updateTag('bookmarks')
      return { success: true, data: { bookmarked: false } }
    } else {
      // Add bookmark
      await supabase.from('opportunity_bookmarks').insert({
        opportunity_id: opportunityId,
        member_id: user.id,
      })

      updateTag('bookmarks')
      return { success: true, data: { bookmarked: true } }
    }
  } catch (error) {
    console.error('Error in toggleBookmark:', error)
    return { success: false, error: 'Failed to toggle bookmark' }
  }
}

/**
 * Express interest in a visit request
 */
export async function expressInterestInVisit(
  visitRequestId: string,
  reason?: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if already expressed interest
    const { data: existing } = await supabase
      .from('visit_request_interests')
      .select('id')
      .eq('visit_request_id', visitRequestId)
      .eq('member_id', user.id)
      .single()

    if (existing) {
      return { success: false, error: 'Already expressed interest' }
    }

    const { error } = await supabase.from('visit_request_interests').insert({
      visit_request_id: visitRequestId,
      member_id: user.id,
      interest_reason: reason || null,
    })

    if (error) {
      return { success: false, error: 'Failed to express interest' }
    }

    // Increment interest count
    await supabase.rpc('increment_visit_interest_count', {
      request_id: visitRequestId,
    })

    updateTag('visit-requests')

    return { success: true }
  } catch (error) {
    console.error('Error in expressInterestInVisit:', error)
    return { success: false, error: 'Failed to express interest' }
  }
}
