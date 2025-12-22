/**
 * Chapter Server Actions
 *
 * Server actions for chapter management (National Admin only).
 * Uses updateTag() for instant cache invalidation following Next.js 16 patterns.
 */

'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import {
  createChapterSchema,
  updateChapterSchema,
  type CreateChapterInput,
  type UpdateChapterInput,
} from '@/lib/validations/chapter'
import { sendWhatsAppMessage } from '@/app/actions/whatsapp'

export interface ActionResponse {
  success: boolean
  message?: string
  errors?: Record<string, string[]>
  redirectTo?: string
}

/**
 * Check if user has National Admin role
 */
async function requireNationalAdmin() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized: Please log in')
  }

  const supabase = await createServerSupabaseClient()

  // Check if user has National Admin role
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role:roles(name, hierarchy_level)')
    .eq('user_id', user.id)

  const hasNationalAdminRole = userRoles?.some(
    (ur: any) => ur.role?.name === 'National Admin'
  )

  if (!hasNationalAdminRole) {
    throw new Error('Unauthorized: National Admin access required')
  }

  return user
}

/**
 * Create a new chapter
 *
 * Only accessible to National Admin users.
 */
export async function createChapter(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    // Check authorization
    await requireNationalAdmin()

    // Extract and validate data
    const data: CreateChapterInput = {
      name: formData.get('name') as string,
      location: formData.get('location') as string,
      region: (formData.get('region') as string) || undefined,
      established_date: (formData.get('established_date') as string) || undefined,
    }

    const validation = createChapterSchema.safeParse(data)
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      }
    }

    // Create chapter
    const supabase = await createServerSupabaseClient()
    const { data: chapter, error } = await supabase
      .from('chapters')
      .insert([
        {
          name: validation.data.name,
          location: validation.data.location,
          region: validation.data.region || null,
          established_date: validation.data.established_date || null,
          member_count: 0,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Error creating chapter:', error)
      return {
        success: false,
        message: 'Failed to create chapter. Please try again.',
      }
    }

    // Instant cache invalidation
    updateTag('chapters')
    updateTag('chapters-list')
    updateTag('chapter-stats')

    // Return success response
    return {
      success: true,
      message: 'Chapter created successfully!',
      redirectTo: '/admin/chapters',
    }
  } catch (error: any) {
    // Don't catch NEXT_REDIRECT errors
    if (error.message === 'NEXT_REDIRECT') {
      throw error
    }

    console.error('Unexpected error in createChapter:', error)
    return {
      success: false,
      message: error.message || 'An unexpected error occurred.',
    }
  }
}

/**
 * Update an existing chapter
 *
 * Only accessible to National Admin users.
 */
export async function updateChapter(
  id: string,
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    // Check authorization
    await requireNationalAdmin()

    // Extract and validate data
    const data: UpdateChapterInput = {
      name: formData.get('name') as string | undefined,
      location: formData.get('location') as string | undefined,
      region: (formData.get('region') as string) || undefined,
      established_date: (formData.get('established_date') as string) || undefined,
    }

    const validation = updateChapterSchema.safeParse(data)
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      }
    }

    // Update chapter
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('chapters')
      .update({
        name: validation.data.name,
        location: validation.data.location,
        region: validation.data.region || null,
        established_date: validation.data.established_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating chapter:', error)
      return {
        success: false,
        message: 'Failed to update chapter. Please try again.',
      }
    }

    // Instant cache invalidation
    updateTag('chapters')
    updateTag(`chapter-${id}`)
    updateTag('chapters-list')

    return {
      success: true,
      message: 'Chapter updated successfully',
    }
  } catch (error: any) {
    console.error('Unexpected error in updateChapter:', error)
    return {
      success: false,
      message: error.message || 'An unexpected error occurred.',
    }
  }
}

/**
 * Create a chapter with chair invitation and feature toggles
 *
 * This is the main function for the Create Chapter Wizard.
 * Creates chapter, invitation, and initializes features in one transaction.
 */
export async function createChapterWithInvitation(
  input: import('@/types/chapter').CreateChapterInput
): Promise<import('@/types/chapter').CreateChapterResult> {
  try {
    // Check authorization
    const user = await requireNationalAdmin()
    const supabase = await createServerSupabaseClient()

    // 1. Create the chapter with pending_chair status
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .insert({
        name: input.name,
        location: input.location,
        region: input.region,
        established_date: input.established_date || null,
        member_count: 0,
        status: 'pending_chair',
        settings: {},
      })
      .select()
      .single()

    if (chapterError || !chapter) {
      console.error('Error creating chapter:', chapterError)
      return {
        success: false,
        error: 'Failed to create chapter',
      }
    }

    // 2. Create chair invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('chapter_invitations')
      .insert({
        chapter_id: chapter.id,
        email: input.chair_email || null,
        phone: input.chair_phone || null,
        full_name: input.chair_name,
        invited_role: 'Chair',
        personal_message: input.personal_message || null,
        invited_by: user.id,
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invitation:', inviteError)
      // Still continue - chapter is created
    }

    // 3. Initialize feature toggles
    const allFeatures = [
      'events',
      'communications',
      'stakeholder_crm',
      'session_bookings',
      'opportunities',
      'knowledge_base',
      'awards',
      'finance',
      'analytics',
      'member_intelligence',
      'succession_planning',
      'verticals',
      'sub_chapters',
      'industrial_visits',
    ] as const

    const featureInserts = allFeatures.map((feature) => ({
      chapter_id: chapter.id,
      feature: feature,
      is_enabled: input.enabled_features.includes(feature),
      enabled_at: input.enabled_features.includes(feature)
        ? new Date().toISOString()
        : null,
      changed_by: user.id,
    }))

    const { error: featuresError } = await supabase
      .from('chapter_feature_toggles')
      .insert(featureInserts)

    if (featuresError) {
      console.error('Error setting features:', featuresError)
      // Still continue - chapter is created
    }

    // Invalidate caches
    updateTag('chapters')
    updateTag('chapters-list')
    updateTag('chapter-stats')

    return {
      success: true,
      chapter_id: chapter.id,
      invitation_id: invitation?.id,
      invitation_token: invitation?.token,
    }
  } catch (error: any) {
    console.error('Error in createChapterWithInvitation:', error)
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    }
  }
}

/**
 * Delete a chapter
 *
 * Only accessible to National Admin users.
 * Cannot delete chapters with members.
 */
export async function deleteChapter(id: string): Promise<ActionResponse> {
  try {
    // Check authorization
    await requireNationalAdmin()

    const supabase = await createServerSupabaseClient()

    // Check if chapter has members
    const { count } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', id)

    if (count && count > 0) {
      return {
        success: false,
        message: `Cannot delete chapter with ${count} member(s). Please reassign members first.`,
      }
    }

    // Delete chapter
    const { error } = await supabase.from('chapters').delete().eq('id', id)

    if (error) {
      console.error('Error deleting chapter:', error)
      return {
        success: false,
        message: 'Failed to delete chapter. Please try again.',
      }
    }

    // Instant cache invalidation
    updateTag('chapters')
    updateTag(`chapter-${id}`)
    updateTag('chapters-list')
    updateTag('chapter-stats')

    return {
      success: true,
      message: 'Chapter deleted successfully',
    }
  } catch (error: any) {
    console.error('Unexpected error in deleteChapter:', error)
    return {
      success: false,
      message: error.message || 'An unexpected error occurred.',
    }
  }
}

// ============================================================================
// INVITATION MANAGEMENT
// ============================================================================

/**
 * Send chair invitation via WhatsApp
 */
export async function sendChairInvitationWhatsApp(
  invitationId: string
): Promise<ActionResponse> {
  try {
    await requireNationalAdmin()
    const supabase = await createServerSupabaseClient()

    // Get invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('chapter_invitations')
      .select(`
        *,
        chapter:chapters(name, location),
        inviter:profiles!invited_by(full_name)
      `)
      .eq('id', invitationId)
      .single()

    if (inviteError || !invitation) {
      return { success: false, message: 'Invitation not found' }
    }

    if (!invitation.phone) {
      return { success: false, message: 'No phone number for this invitation' }
    }

    // Build the accept URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect.vercel.app'
    const acceptUrl = `${baseUrl}/accept-invite?token=${invitation.token}`

    // Format message
    const message = `🎉 *Yi Connect - Chapter Chair Invitation*

Hello ${invitation.full_name}!

You've been invited to lead *${invitation.chapter?.name}* chapter on Yi Connect.

As Chapter Chair, you'll have access to:
• Member management
• Event planning & tracking
• Communications hub
• And much more!

${invitation.personal_message ? `\n_"${invitation.personal_message}"_\n` : ''}
👉 *Accept your invitation:*
${acceptUrl}

This link expires in 7 days.

Best regards,
${invitation.inviter?.full_name}
Yi Connect`

    // Send via WhatsApp
    const result = await sendWhatsAppMessage(invitation.phone, message)

    if (!result.success) {
      return {
        success: false,
        message: result.error || 'Failed to send WhatsApp message',
      }
    }

    return {
      success: true,
      message: 'Invitation sent via WhatsApp successfully!',
    }
  } catch (error: any) {
    console.error('Error sending invitation:', error)
    return {
      success: false,
      message: error.message || 'Failed to send invitation',
    }
  }
}

/**
 * Get invitation by token (public - no auth required)
 */
export async function getInvitationByToken(token: string): Promise<{
  found: boolean
  invitation?: import('@/types/chapter').InvitationLookup
  error?: string
}> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase.rpc('get_invitation_by_token', {
      p_token: token,
    })

    if (error) {
      console.error('Error fetching invitation:', error)
      return { found: false, error: 'Failed to lookup invitation' }
    }

    return {
      found: data?.found ?? false,
      invitation: data as import('@/types/chapter').InvitationLookup,
    }
  } catch (error: any) {
    console.error('Error in getInvitationByToken:', error)
    return { found: false, error: error.message }
  }
}

/**
 * Accept chapter invitation (requires authenticated user)
 */
export async function acceptInvitation(token: string): Promise<{
  success: boolean
  chapter_id?: string
  error?: string
}> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Please log in first' }
    }

    const supabase = await createServerSupabaseClient()

    // Call the database function to accept
    const { data, error } = await supabase.rpc('accept_chapter_invitation', {
      p_token: token,
    })

    if (error) {
      console.error('Error accepting invitation:', error)
      return { success: false, error: 'Failed to accept invitation' }
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Invalid invitation' }
    }

    // Invalidate caches
    updateTag('chapters')
    updateTag('chapter-invitations')
    updateTag(`chapter-${data.chapter_id}`)

    return {
      success: true,
      chapter_id: data.chapter_id,
    }
  } catch (error: any) {
    console.error('Error in acceptInvitation:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Resend invitation
 */
export async function resendInvitation(
  invitationId: string
): Promise<ActionResponse> {
  try {
    await requireNationalAdmin()
    const supabase = await createServerSupabaseClient()

    // Reset token expiry
    const { error: updateError } = await supabase
      .from('chapter_invitations')
      .update({
        token_expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        status: 'pending',
      })
      .eq('id', invitationId)
      .eq('status', 'pending') // Only update pending invitations

    if (updateError) {
      return { success: false, message: 'Failed to update invitation' }
    }

    // Send via WhatsApp
    return sendChairInvitationWhatsApp(invitationId)
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

/**
 * Revoke invitation
 */
export async function revokeInvitation(
  invitationId: string
): Promise<ActionResponse> {
  try {
    await requireNationalAdmin()
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('chapter_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId)

    if (error) {
      return { success: false, message: 'Failed to revoke invitation' }
    }

    updateTag('chapter-invitations')
    return { success: true, message: 'Invitation revoked' }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}
