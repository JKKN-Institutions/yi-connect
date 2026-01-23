/**
 * Bulk Member Server Actions
 *
 * Server actions for bulk member creation via Excel upload.
 */

'use server'

import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidateTag } from 'next/cache'
import {
  validateBulkMemberRow,
  type BulkMemberRow,
  type BulkUploadOptions,
  type BulkUploadResult,
  type BulkUploadRowResult
} from '@/lib/validations/bulk-member'

/**
 * Process bulk member upload
 *
 * This action:
 * 1. Validates each row
 * 2. Checks for existing emails
 * 3. Creates approved_email, auth user, profile, and member records
 * 4. Sends password reset emails (optional)
 */
export async function processBulkMemberUpload(
  members: Array<{ rowNumber: number; data: Record<string, any> }>,
  options: BulkUploadOptions
): Promise<BulkUploadResult> {
  // Require leadership roles (Chair, Co-Chair, EC Member) or above
  const { user: currentUser } = await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
    'EC Member'
  ])

  const adminClient = createAdminSupabaseClient()
  const supabase = await createServerSupabaseClient()

  const results: BulkUploadRowResult[] = []
  let successCount = 0
  let skippedCount = 0
  let errorCount = 0
  let updatedCount = 0
  const errors: string[] = []

  // Get all chapters for lookup by name
  const { data: allChapters } = await adminClient
    .from('chapters')
    .select('id, name')

  // Create a map of chapter name (lowercase) to chapter ID
  const chapterNameToId = new Map<string, string>()
  allChapters?.forEach(chapter => {
    chapterNameToId.set(chapter.name.toLowerCase(), chapter.id)
  })

  // Get all existing emails for quick lookup
  const { data: existingEmails } = await adminClient
    .from('approved_emails')
    .select('email')

  const existingEmailSet = new Set(
    existingEmails?.map(e => e.email.toLowerCase()) || []
  )

  // Get all existing profiles
  const { data: existingProfiles } = await adminClient
    .from('profiles')
    .select('email')

  const existingProfileSet = new Set(
    existingProfiles?.map(p => p.email.toLowerCase()) || []
  )

  // Process each member
  for (const { rowNumber, data } of members) {
    try {
      // Validate row data
      const validation = validateBulkMemberRow(data)

      if (!validation.success || !validation.data) {
        results.push({
          rowNumber,
          email: data.email || 'Unknown',
          fullName: data.full_name || 'Unknown',
          status: 'error',
          message: `Validation failed: ${validation.errors.join(', ')}`
        })
        errorCount++
        continue
      }

      const memberData = validation.data
      const email = memberData.email.toLowerCase()

      // Check if email already exists
      if (existingEmailSet.has(email) || existingProfileSet.has(email)) {
        if (options.skipExisting) {
          results.push({
            rowNumber,
            email,
            fullName: memberData.full_name,
            status: 'skipped',
            message: 'Email already exists in the system'
          })
          skippedCount++
          continue
        } else if (options.updateExisting) {
          // Update existing member
          const updateResult = await updateExistingMember(
            adminClient,
            email,
            memberData,
            options
          )
          results.push({
            rowNumber,
            email,
            fullName: memberData.full_name,
            status: updateResult.success ? 'updated' : 'error',
            message: updateResult.message,
            memberId: updateResult.memberId
          })
          if (updateResult.success) {
            updatedCount++
          } else {
            errorCount++
          }
          continue
        }
      }

      // Create new member
      const createResult = await createNewMember(
        adminClient,
        supabase,
        memberData,
        options,
        currentUser.id,
        chapterNameToId
      )

      results.push({
        rowNumber,
        email,
        fullName: memberData.full_name,
        status: createResult.success ? 'success' : 'error',
        message: createResult.message,
        memberId: createResult.memberId
      })

      if (createResult.success) {
        successCount++
        existingEmailSet.add(email) // Add to set to prevent duplicates in same batch
      } else {
        errorCount++
      }
    } catch (error: unknown) {
      results.push({
        rowNumber,
        email: data.email || 'Unknown',
        fullName: data.full_name || 'Unknown',
        status: 'error',
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      errorCount++
    }
  }

  // Invalidate caches
  revalidateTag('members-list', 'max')
  revalidateTag('approved-emails', 'max')
  revalidateTag('analytics-all', 'max')

  return {
    success: errorCount === 0,
    totalProcessed: members.length,
    successCount,
    skippedCount,
    errorCount,
    updatedCount,
    results,
    errors
  }
}

/**
 * Create a new member with all related records
 */
async function createNewMember(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  memberData: BulkMemberRow,
  options: BulkUploadOptions,
  approvedById: string,
  chapterNameToId: Map<string, string>
): Promise<{ success: boolean; message: string; memberId?: string }> {
  try {
    // Determine chapter ID - first check if chapter name is specified in the Excel row
    let chapterId: string | null = null

    if (memberData.chapter_name && typeof memberData.chapter_name === 'string') {
      // Look up chapter by name (case-insensitive)
      const lookupId = chapterNameToId.get(memberData.chapter_name.toLowerCase())
      if (lookupId) {
        chapterId = lookupId
      } else {
        // Chapter name specified but not found - use default
        console.warn(`Chapter "${memberData.chapter_name}" not found, using default`)
        chapterId = options.defaultChapterId || null
      }
    } else {
      // No chapter specified in row - use default
      chapterId = options.defaultChapterId || null
    }

    // 1. Add email to approved_emails whitelist
    const { error: whitelistError } = await adminClient.from('approved_emails').insert({
      email: memberData.email,
      assigned_chapter_id: chapterId,
      approved_by: approvedById,
      approved_at: new Date().toISOString(),
      is_active: true,
      member_created: false,
      notes: 'Created via bulk upload'
    })

    if (whitelistError) {
      // Check if it's a duplicate error
      if (whitelistError.code === '23505') {
        return { success: false, message: 'Email already in whitelist' }
      }
      throw whitelistError
    }

    // 2. Create auth user (this will trigger handle_new_user which creates profile and member)
    const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email: memberData.email,
      email_confirm: true,
      user_metadata: {
        full_name: memberData.full_name,
        phone: memberData.phone || ''
      }
    })

    if (createUserError || !newUser.user) {
      // Rollback: delete from approved_emails
      await adminClient.from('approved_emails').delete().eq('email', memberData.email)
      throw createUserError || new Error('Failed to create user')
    }

    const userId = newUser.user.id

    // 3. Update member record with additional data
    // The handle_new_user trigger creates a basic member record, we need to update it with full data
    const { error: updateMemberError } = await adminClient
      .from('members')
      .update({
        company: memberData.company || null,
        designation: memberData.designation || null,
        industry: memberData.industry || null,
        years_of_experience: memberData.years_of_experience || null,
        linkedin_url: memberData.linkedin_url || null,
        date_of_birth: memberData.date_of_birth || null,
        gender: memberData.gender || null,
        address: memberData.address || null,
        city: memberData.city || null,
        state: memberData.state || null,
        country: memberData.country || 'India',
        pincode: memberData.pincode || null,
        emergency_contact_name: memberData.emergency_contact_name || null,
        emergency_contact_phone: memberData.emergency_contact_phone || null,
        emergency_contact_relationship: memberData.emergency_contact_relationship || null,
        membership_number: memberData.membership_number || null,
        member_since: memberData.member_since || new Date().toISOString().split('T')[0],
        membership_status: memberData.membership_status || options.defaultMembershipStatus || 'active'
      })
      .eq('id', userId)

    if (updateMemberError) {
      console.error('Failed to update member with additional data:', updateMemberError)
      // Don't fail the whole operation, member was created with basic data
    }

    // 4. Update profile with phone if provided
    if (memberData.phone) {
      await adminClient
        .from('profiles')
        .update({ phone: memberData.phone })
        .eq('id', userId)
    }

    // 5. Send password reset email (optional)
    if (options.sendWelcomeEmail) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        memberData.email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=recovery`
        }
      )
      if (resetError) {
        console.error('Failed to send password reset email:', resetError)
        // Don't fail the whole operation
      }
    }

    return {
      success: true,
      message: options.sendWelcomeEmail
        ? 'Created successfully. Welcome email sent.'
        : 'Created successfully.',
      memberId: userId
    }
  } catch (error: unknown) {
    console.error('Error creating member:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create member'
    }
  }
}

/**
 * Update an existing member (or create member record if profile exists but member doesn't)
 */
async function updateExistingMember(
  adminClient: ReturnType<typeof createAdminSupabaseClient>,
  email: string,
  memberData: BulkMemberRow,
  options: BulkUploadOptions
): Promise<{ success: boolean; message: string; memberId?: string }> {
  try {
    // Get profile by email
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (profileError || !profile) {
      return { success: false, message: 'Profile not found for this email' }
    }

    // Check if member record exists
    const { data: existingMember } = await adminClient
      .from('members')
      .select('id')
      .eq('id', profile.id)
      .single()

    const memberRecord = {
      company: memberData.company || null,
      designation: memberData.designation || null,
      industry: memberData.industry || null,
      years_of_experience: memberData.years_of_experience || null,
      linkedin_url: memberData.linkedin_url || null,
      date_of_birth: memberData.date_of_birth || null,
      gender: memberData.gender || null,
      address: memberData.address || null,
      city: memberData.city || null,
      state: memberData.state || null,
      country: memberData.country || 'India',
      pincode: memberData.pincode || null,
      emergency_contact_name: memberData.emergency_contact_name || null,
      emergency_contact_phone: memberData.emergency_contact_phone || null,
      emergency_contact_relationship: memberData.emergency_contact_relationship || null,
      membership_number: memberData.membership_number || null,
      membership_status: memberData.membership_status || 'active'
    }

    if (existingMember) {
      // Update existing member record
      const { error: updateError } = await adminClient
        .from('members')
        .update(memberRecord)
        .eq('id', profile.id)

      if (updateError) {
        throw updateError
      }
    } else {
      // Create new member record (profile exists but member doesn't)
      const { error: insertError } = await adminClient
        .from('members')
        .insert({
          id: profile.id,
          chapter_id: options.defaultChapterId,
          ...memberRecord,
          is_active: true,
          member_since: new Date().toISOString().split('T')[0]
        })

      if (insertError) {
        throw insertError
      }
    }

    // Update profile name and phone
    await adminClient
      .from('profiles')
      .update({
        full_name: memberData.full_name,
        phone: memberData.phone || null
      })
      .eq('id', profile.id)

    return {
      success: true,
      message: existingMember ? 'Updated successfully' : 'Member record created and updated',
      memberId: profile.id
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update member'
    }
  }
}

/**
 * Check for duplicate emails in the upload data
 */
export async function checkDuplicateEmails(
  emails: string[]
): Promise<{
  existing: string[]
  duplicatesInFile: string[]
}> {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])

  const adminClient = createAdminSupabaseClient()

  // Check against database
  const { data: existingEmails } = await adminClient
    .from('approved_emails')
    .select('email')
    .in('email', emails.map(e => e.toLowerCase()))

  const existing = existingEmails?.map(e => e.email) || []

  // Check for duplicates within the file
  const seen = new Set<string>()
  const duplicatesInFile: string[] = []

  for (const email of emails) {
    const lower = email.toLowerCase()
    if (seen.has(lower)) {
      duplicatesInFile.push(email)
    }
    seen.add(lower)
  }

  return { existing, duplicatesInFile }
}

/**
 * Get chapter options for bulk upload
 */
export async function getChaptersForBulkUpload(): Promise<
  Array<{ id: string; name: string; location: string }>
> {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('chapters')
    .select('id, name, location')
    .order('name')

  if (error) throw error

  return data || []
}
