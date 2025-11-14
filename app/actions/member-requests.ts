/**
 * Member Request Server Actions
 *
 * Handles public membership applications and admin approval workflow.
 *
 * Flow:
 * 1. Public submits application via submitMemberRequest()
 * 2. Admin reviews via getMemberRequests()
 * 3. Admin approves via approveMemberRequest() → adds email to whitelist
 * 4. User can now login with Google OAuth
 * 5. First login creates member record automatically
 */

'use server'

import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { FormState } from '@/types'
import { z } from 'zod'

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const memberRequestSchema = z.object({
  // Basic Information
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),

  // Professional Information
  company: z.string().optional(),
  designation: z.string().optional(),
  industry: z.string().optional(),
  years_of_experience: z.coerce.number().int().min(0).optional(),
  linkedin_url: z.string().url().optional().or(z.literal('')),

  // Personal Information
  address: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  country: z.string().default('India'),
  pincode: z.string().optional(),

  // Emergency Contact
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),

  // Why join Yi
  motivation: z.string().min(20, 'Please tell us why you want to join Yi (minimum 20 characters)'),
  how_did_you_hear: z.string().optional(),

  // Chapter
  preferred_chapter_id: z.string().uuid('Please select a chapter'),
})

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Submit a new membership request (PUBLIC - anyone can call)
 */
export async function submitMemberRequest(formData: FormData): Promise<FormState> {
  // Use admin client to bypass RLS for public submissions
  // This is safe because we validate all input data before insertion
  const supabase = createAdminSupabaseClient()

  // Parse and validate form data
  const rawData = {
    full_name: formData.get('full_name') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    date_of_birth: formData.get('date_of_birth') as string,
    gender: formData.get('gender') as string,
    company: formData.get('company') as string,
    designation: formData.get('designation') as string,
    industry: formData.get('industry') as string,
    years_of_experience: formData.get('years_of_experience') as string,
    linkedin_url: formData.get('linkedin_url') as string,
    address: formData.get('address') as string,
    city: formData.get('city') as string,
    state: formData.get('state') as string,
    country: formData.get('country') as string,
    pincode: formData.get('pincode') as string,
    emergency_contact_name: formData.get('emergency_contact_name') as string,
    emergency_contact_phone: formData.get('emergency_contact_phone') as string,
    emergency_contact_relationship: formData.get('emergency_contact_relationship') as string,
    motivation: formData.get('motivation') as string,
    how_did_you_hear: formData.get('how_did_you_hear') as string,
    preferred_chapter_id: formData.get('preferred_chapter_id') as string,
  }

  console.log('🔍 Validating member request data...')
  const validation = memberRequestSchema.safeParse(rawData)

  if (!validation.success) {
    console.error('❌ Validation failed:', validation.error.flatten().fieldErrors)
    return {
      success: false,
      message: 'Please check your form for errors',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  console.log('✅ Validation passed. Checking for existing requests...')

  try {
    // Check if email already has a pending or approved request
    const { data: existingRequest } = await supabase
      .from('member_requests')
      .select('id, status')
      .eq('email', validation.data.email)
      .in('status', ['pending', 'approved'])
      .single()

    if (existingRequest) {
      console.log('⚠️ Existing request found:', existingRequest)
      return {
        success: false,
        message: existingRequest.status === 'pending'
          ? 'You already have a pending application. Please wait for admin review.'
          : 'This email has already been approved. Please login with Google.',
        errors: { email: ['Email already has an active application'] },
      }
    }

    console.log('📝 Creating member request...')
    // Create member request
    const { data, error } = await supabase
      .from('member_requests')
      .insert({
        ...validation.data,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating member request:', error)
      throw error
    }

    console.log('✅ Member request created successfully:', data?.id)

    // Invalidate cache
    revalidateTag('member-requests', 'max')

    return {
      success: true,
      message: 'Application submitted successfully! We will review your application and contact you soon.',
      data,
    }
  } catch (error: any) {
    console.error('Error submitting member request:', error)
    return {
      success: false,
      message: 'Failed to submit application. Please try again.',
      errors: { _form: [error.message] },
    }
  }
}

// ============================================================================
// ADMIN ACTIONS (Require Executive Member+)
// ============================================================================

/**
 * Get all member requests with filters (ADMIN ONLY)
 */
export async function getMemberRequests(params?: {
  status?: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  chapter_id?: string
  limit?: number
  offset?: number
}) {
  // Require Executive Member or above
  await requireRole(['Super Admin', 'National Admin', 'Executive Member'])

  // Use admin client to avoid FK validation issues with auth.users
  // This is safe because requireRole() ensures only admins can access this
  const supabase = createAdminSupabaseClient()

  let query = supabase
    .from('member_requests')
    .select(`
      *,
      chapter:preferred_chapter_id(id, name, location)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  // Apply filters
  if (params?.status) {
    query = query.eq('status', params.status)
  }

  if (params?.chapter_id) {
    query = query.eq('preferred_chapter_id', params.chapter_id)
  }

  if (params?.limit) {
    query = query.limit(params.limit)
  }

  if (params?.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 10) - 1)
  }

  const { data, error, count } = await query

  if (error) throw error

  return { data, count }
}

/**
 * Get single member request by ID (ADMIN ONLY)
 */
export async function getMemberRequestById(id: string) {
  await requireRole(['Super Admin', 'National Admin', 'Executive Member'])

  // Use admin client to avoid FK validation issues with auth.users
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('member_requests')
    .select(`
      *,
      chapter:preferred_chapter_id(id, name, location)
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  return data
}

/**
 * Approve member request and add email to whitelist (ADMIN ONLY)
 */
export async function approveMemberRequest(requestId: string, notes?: string): Promise<FormState> {
  try {
    // Require Executive Member or above
    const { user } = await requireRole(['Super Admin', 'National Admin', 'Executive Member'])

    // Use admin client to avoid FK validation issues with auth.users
    const supabase = createAdminSupabaseClient()

    // 1. Get request details
    const { data: request, error: fetchError } = await supabase
      .from('member_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !request) {
      return { success: false, message: 'Request not found' }
    }

    if (request.status !== 'pending') {
      return { success: false, message: `Request is already ${request.status}` }
    }

    // 2. Check if email is already in whitelist
    const { data: existingApproval } = await supabase
      .from('approved_emails')
      .select('id')
      .eq('email', request.email)
      .single()

    if (existingApproval) {
      return {
        success: false,
        message: 'This email is already approved in the system',
      }
    }

    // 3. Add email to whitelist
    const { data: approvedEmail, error: whitelistError } = await supabase
      .from('approved_emails')
      .insert({
        email: request.email,
        approved_by: user.id,
        member_request_id: requestId,
        assigned_chapter_id: request.preferred_chapter_id,
        is_active: true,
        notes: notes,
      })
      .select()
      .single()

    if (whitelistError) throw whitelistError

    // 4. Update request status to approved
    const { error: updateError } = await supabase
      .from('member_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes,
      })
      .eq('id', requestId)

    if (updateError) throw updateError

    // 5. TODO: Send approval email to applicant
    // await sendApprovalEmail({
    //   email: request.email,
    //   fullName: request.full_name,
    //   loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`
    // })

    // 6. Invalidate caches
    revalidateTag('member-requests', 'max')
    revalidateTag('approved-emails', 'max')
    revalidatePath('/member-requests')

    return {
      success: true,
      message: `${request.full_name} has been approved! They can now login with Google.`,
      data: approvedEmail,
    }
  } catch (error: any) {
    console.error('Error approving member request:', error)
    return {
      success: false,
      message: 'Failed to approve request',
      errors: { _form: [error.message] },
    }
  }
}

/**
 * Reject member request (ADMIN ONLY)
 */
export async function rejectMemberRequest(requestId: string, notes: string): Promise<FormState> {
  try {
    // Require Executive Member or above
    const { user } = await requireRole(['Super Admin', 'National Admin', 'Executive Member'])

    // Use admin client to avoid FK validation issues with auth.users
    const supabase = createAdminSupabaseClient()

    // 1. Get request details
    const { data: request, error: fetchError } = await supabase
      .from('member_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !request) {
      return { success: false, message: 'Request not found' }
    }

    if (request.status !== 'pending') {
      return { success: false, message: `Request is already ${request.status}` }
    }

    // 2. Update request status to rejected
    const { error: updateError } = await supabase
      .from('member_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes,
      })
      .eq('id', requestId)

    if (updateError) throw updateError

    // 3. TODO: Send rejection email (optional)
    // await sendRejectionEmail({
    //   email: request.email,
    //   fullName: request.full_name
    // })

    // 4. Invalidate cache
    revalidateTag('member-requests', 'max')
    revalidatePath('/member-requests')

    return {
      success: true,
      message: `Application from ${request.full_name} has been rejected.`,
    }
  } catch (error: any) {
    console.error('Error rejecting member request:', error)
    return {
      success: false,
      message: 'Failed to reject request',
      errors: { _form: [error.message] },
    }
  }
}

/**
 * Withdraw a member request (user or admin can call)
 */
export async function withdrawMemberRequest(requestId: string): Promise<FormState> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, message: 'Not authenticated' }
    }

    // Get request
    const { data: request, error: fetchError } = await supabase
      .from('member_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !request) {
      return { success: false, message: 'Request not found' }
    }

    // Only allow if user owns the request or is an admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const isOwner = profile?.email === request.email

    if (!isOwner) {
      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role:roles(hierarchy_level)')
        .eq('user_id', user.id)

      const isAdmin = roles?.some((r: any) => r.role?.hierarchy_level >= 5)

      if (!isAdmin) {
        return { success: false, message: 'Not authorized' }
      }
    }

    // Update status
    const { error: updateError } = await supabase
      .from('member_requests')
      .update({ status: 'withdrawn' })
      .eq('id', requestId)

    if (updateError) throw updateError

    revalidateTag('member-requests', 'max')
    revalidatePath('/member-requests')

    return {
      success: true,
      message: 'Application withdrawn successfully',
    }
  } catch (error: any) {
    console.error('Error withdrawing member request:', error)
    return {
      success: false,
      message: 'Failed to withdraw request',
      errors: { _form: [error.message] },
    }
  }
}
