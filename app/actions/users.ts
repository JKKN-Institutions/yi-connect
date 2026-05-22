/**
 * User Management Server Actions
 *
 * Server actions for admin user management operations.
 * All mutations use Zod validation and cache invalidation.
 */

'use server'

import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  updateUserProfileSchema,
  assignRoleSchema,
  removeRoleSchema,
  bulkAssignRoleSchema,
  bulkRemoveRoleSchema,
  changeUserStatusSchema,
  bulkAssignChapterSchema,
  inviteUserSchema
} from '@/lib/validations/user'
import type { FormState } from '@/types'
import type { BulkOperationResult } from '@/types/user'
import { sendEmail } from '@/lib/email'
import { memberInvitationEmail } from '@/lib/email/templates'

// ============================================================================
// User Profile Actions
// ============================================================================

/**
 * Update user profile (Admin only)
 */
export async function updateUserProfile(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    // Require Super Admin or National Admin
    await requireRole(['Super Admin', 'National Admin'])

    const validation = updateUserProfileSchema.safeParse({
      id: formData.get('id'),
      full_name: formData.get('full_name'),
      phone: formData.get('phone') || null,
      chapter_id: formData.get('chapter_id') || null,
      avatar_url: formData.get('avatar_url') || null
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.'
      }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: validation.data.full_name,
        phone: validation.data.phone,
        chapter_id: validation.data.chapter_id,
        avatar_url: validation.data.avatar_url
      })
      .eq('id', validation.data.id)

    if (error) {
      return {
        message: error.message || 'Failed to update user profile. Please try again.'
      }
    }

    // Invalidate caches
    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${validation.data.id}`)

    return {
      success: true,
      message: 'User profile updated successfully!'
    }
  } catch (error: any) {
    return {
      message: error.message || 'An unexpected error occurred.'
    }
  }
}

// ============================================================================
// Role Management Actions
// ============================================================================

/**
 * Assign role to user
 */
export async function assignRole(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const { user } = await requireRole(['Super Admin', 'National Admin'])

    const validation = assignRoleSchema.safeParse({
      user_id: formData.get('user_id'),
      role_id: formData.get('role_id'),
      notes: formData.get('notes')
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.'
      }
    }

    const supabase = await createServerSupabaseClient()

    // Check if user can manage this role
    const { data: canManage } = await supabase.rpc('can_manage_role', {
      manager_id: user.id,
      target_role_id: validation.data.role_id
    })

    if (!canManage) {
      return {
        message: 'You do not have permission to assign this role.'
      }
    }

    // Check if role is already assigned
    const { data: existing } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', validation.data.user_id)
      .eq('role_id', validation.data.role_id)
      .single()

    if (existing) {
      return {
        message: 'This role is already assigned to the user.'
      }
    }

    // Assign the role
    const { error } = await supabase.from('user_roles').insert({
      user_id: validation.data.user_id,
      role_id: validation.data.role_id
    })

    if (error) {
      return {
        message: error.message || 'Failed to assign role. Please try again.'
      }
    }

    // The trigger will automatically log the change to user_role_changes

    // Invalidate caches
    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${validation.data.user_id}`)

    return {
      success: true,
      message: 'Role assigned successfully!'
    }
  } catch (error: any) {
    return {
      message: error.message || 'An unexpected error occurred.'
    }
  }
}

/**
 * Remove role from user
 */
export async function removeRole(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const { user } = await requireRole(['Super Admin', 'National Admin'])

    const validation = removeRoleSchema.safeParse({
      user_role_id: formData.get('user_role_id'),
      notes: formData.get('notes')
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.'
      }
    }

    const supabase = await createServerSupabaseClient()

    // Get the user_role record to check permissions and get user_id
    const { data: userRole, error: fetchError } = await supabase
      .from('user_roles')
      .select('user_id, role_id, roles!inner(hierarchy_level)')
      .eq('id', validation.data.user_role_id)
      .single()

    if (fetchError || !userRole) {
      return {
        message: 'Role assignment not found.'
      }
    }

    // Prevent removing own Super Admin role
    if (userRole.user_id === user.id) {
      const { data: role } = await supabase
        .from('roles')
        .select('name')
        .eq('id', userRole.role_id)
        .single()

      if (role?.name === 'Super Admin') {
        return {
          message: 'You cannot remove your own Super Admin role.'
        }
      }
    }

    // Check if user can manage this role
    const { data: canManage } = await supabase.rpc('can_manage_role', {
      manager_id: user.id,
      target_role_id: userRole.role_id
    })

    if (!canManage) {
      return {
        message: 'You do not have permission to remove this role.'
      }
    }

    // Remove the role
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', validation.data.user_role_id)

    if (error) {
      return {
        message: error.message || 'Failed to remove role. Please try again.'
      }
    }

    // The trigger will automatically log the change to user_role_changes

    // Invalidate caches
    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${userRole.user_id}`)

    return {
      success: true,
      message: 'Role removed successfully!'
    }
  } catch (error: any) {
    return {
      message: error.message || 'An unexpected error occurred.'
    }
  }
}

/**
 * Bulk assign role to multiple users
 */
export async function bulkAssignRole(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const { user } = await requireRole(['Super Admin', 'National Admin'])

    const userIdsRaw = formData.get('user_ids')
    const userIds = userIdsRaw ? JSON.parse(userIdsRaw as string) : []

    const validation = bulkAssignRoleSchema.safeParse({
      user_ids: userIds,
      role_id: formData.get('role_id'),
      notes: formData.get('notes')
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.'
      }
    }

    const supabase = await createServerSupabaseClient()

    // Check if user can manage this role
    const { data: canManage } = await supabase.rpc('can_manage_role', {
      manager_id: user.id,
      target_role_id: validation.data.role_id
    })

    if (!canManage) {
      return {
        message: 'You do not have permission to assign this role.'
      }
    }

    const result: BulkOperationResult = {
      success_count: 0,
      failure_count: 0,
      failures: []
    }

    // Process each user
    for (const userId of validation.data.user_ids) {
      try {
        // Check if already assigned
        const { data: existing } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role_id', validation.data.role_id)
          .single()

        if (existing) {
          // Skip if already assigned
          continue
        }

        // Assign role
        const { error } = await supabase.from('user_roles').insert({
          user_id: userId,
          role_id: validation.data.role_id
        })

        if (error) {
          throw error
        }

        result.success_count++
      } catch (error: any) {
        result.failure_count++
        result.failures.push({
          user_id: userId,
          user_name: 'Unknown',
          error: error.message
        })
      }
    }

    // Invalidate main list cache
    revalidatePath('/admin/users')

    return {
      success: true,
      message: `Role assigned to ${result.success_count} user(s). ${result.failure_count} failed.`,
      data: result
    }
  } catch (error: any) {
    return {
      message: error.message || 'An unexpected error occurred.'
    }
  }
}

/**
 * Bulk remove role from multiple users
 */
export async function bulkRemoveRole(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const { user } = await requireRole(['Super Admin', 'National Admin'])

    const userIdsRaw = formData.get('user_ids')
    const userIds = userIdsRaw ? JSON.parse(userIdsRaw as string) : []

    const validation = bulkRemoveRoleSchema.safeParse({
      user_ids: userIds,
      role_id: formData.get('role_id'),
      notes: formData.get('notes')
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.'
      }
    }

    const supabase = await createServerSupabaseClient()

    // Check if user can manage this role
    const { data: canManage } = await supabase.rpc('can_manage_role', {
      manager_id: user.id,
      target_role_id: validation.data.role_id
    })

    if (!canManage) {
      return {
        message: 'You do not have permission to remove this role.'
      }
    }

    const result: BulkOperationResult = {
      success_count: 0,
      failure_count: 0,
      failures: []
    }

    // Process each user
    for (const userId of validation.data.user_ids) {
      try {
        // Prevent removing own Super Admin role
        if (userId === user.id) {
          const { data: role } = await supabase
            .from('roles')
            .select('name')
            .eq('id', validation.data.role_id)
            .single()

          if (role?.name === 'Super Admin') {
            throw new Error('Cannot remove your own Super Admin role')
          }
        }

        // Remove role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role_id', validation.data.role_id)

        if (error) {
          throw error
        }

        result.success_count++
      } catch (error: any) {
        result.failure_count++
        result.failures.push({
          user_id: userId,
          user_name: 'Unknown',
          error: error.message
        })
      }
    }

    // Invalidate main list cache
    revalidatePath('/admin/users')

    return {
      success: true,
      message: `Role removed from ${result.success_count} user(s). ${result.failure_count} failed.`,
      data: result
    }
  } catch (error: any) {
    return {
      message: error.message || 'An unexpected error occurred.'
    }
  }
}

// ============================================================================
// User Status Actions
// ============================================================================

/**
 * Change user status (activate/deactivate)
 */
export async function changeUserStatus(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await requireRole(['Super Admin', 'National Admin'])

    const validation = changeUserStatusSchema.safeParse({
      user_id: formData.get('user_id'),
      is_active: formData.get('is_active') === 'true',
      notes: formData.get('notes')
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.'
      }
    }

    const supabase = await createServerSupabaseClient()

    // Get user's email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', validation.data.user_id)
      .single()

    if (!profile) {
      return {
        message: 'User not found.'
      }
    }

    // Update approved_emails status
    const { error } = await supabase
      .from('approved_emails')
      .update({
        is_active: validation.data.is_active
      })
      .eq('email', profile.email)

    if (error) {
      return {
        message: error.message || 'Failed to update user status. Please try again.'
      }
    }

    // Invalidate caches
    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${validation.data.user_id}`)

    return {
      success: true,
      message: `User ${validation.data.is_active ? 'activated' : 'deactivated'} successfully!`
    }
  } catch (error: any) {
    return {
      message: error.message || 'An unexpected error occurred.'
    }
  }
}

// ============================================================================
// Bulk Chapter Assignment
// ============================================================================

/**
 * Bulk assign chapter to multiple users
 */
export async function bulkAssignChapter(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await requireRole(['Super Admin', 'National Admin'])

    const userIdsRaw = formData.get('user_ids')
    const userIds = userIdsRaw ? JSON.parse(userIdsRaw as string) : []

    const validation = bulkAssignChapterSchema.safeParse({
      user_ids: userIds,
      chapter_id: formData.get('chapter_id') || null,
      notes: formData.get('notes')
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.'
      }
    }

    const supabase = await createServerSupabaseClient()

    const result: BulkOperationResult = {
      success_count: 0,
      failure_count: 0,
      failures: []
    }

    // Process each user
    for (const userId of validation.data.user_ids) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            chapter_id: validation.data.chapter_id
          })
          .eq('id', userId)

        if (error) {
          throw error
        }

        result.success_count++
      } catch (error: any) {
        result.failure_count++
        result.failures.push({
          user_id: userId,
          user_name: 'Unknown',
          error: error.message
        })
      }
    }

    // Invalidate main list cache
    revalidatePath('/admin/users')

    return {
      success: true,
      message: `Chapter assigned to ${result.success_count} user(s). ${result.failure_count} failed.`,
      data: result
    }
  } catch (error: any) {
    return {
      message: error.message || 'An unexpected error occurred.'
    }
  }
}

/**
 * Delete user (Super Admin only) - Soft delete by deactivating
 */
export async function deleteUser(userId: string): Promise<FormState> {
  try {
    const { user } = await requireRole(['Super Admin'])

    // Prevent self-deletion
    if (userId === user.id) {
      return {
        message: 'You cannot delete your own account.'
      }
    }

    const supabase = await createServerSupabaseClient()

    // Get user's email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()

    if (!profile) {
      return {
        message: 'User not found.'
      }
    }

    // Deactivate user via approved_emails
    const { error } = await supabase
      .from('approved_emails')
      .update({
        is_active: false
      })
      .eq('email', profile.email)

    if (error) {
      return {
        message: error.message || 'Failed to delete user. Please try again.'
      }
    }

    // Invalidate caches
    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${userId}`)

    redirect('/admin/users')
  } catch (error: any) {
    return {
      message: error.message || 'An unexpected error occurred.'
    }
  }
}

// ============================================================================
// User Invitation
// ============================================================================

/**
 * Invite user - Add email to approved list
 */
export async function inviteUser(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const { user } = await requireRole(['Super Admin', 'National Admin'])

    // Get role_ids array from FormData
    const roleIds = formData.getAll('role_ids').filter((id) => id !== '')

    const validation = inviteUserSchema.safeParse({
      email: formData.get('email'),
      full_name: formData.get('full_name') || undefined,
      chapter_id: formData.get('chapter_id') || null,
      role_ids: roleIds.length > 0 ? roleIds : undefined,
      send_email: formData.get('send_email') === 'on',
      notes: formData.get('notes')
    })

    if (!validation.success) {
      return {
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid input. Please check the form.'
      }
    }

    const supabase = await createServerSupabaseClient()

    // Check if email already exists in approved_emails
    const { data: existing } = await supabase
      .from('approved_emails')
      .select('id')
      .eq('email', validation.data.email)
      .single()

    if (existing) {
      return {
        message: 'This email is already in the approved list.'
      }
    }

    // Prepare metadata for future use (when user signs up)
    const metadata: any = {}
    if (validation.data.full_name) metadata.full_name = validation.data.full_name
    if (validation.data.chapter_id) metadata.chapter_id = validation.data.chapter_id
    if (validation.data.role_ids && validation.data.role_ids.length > 0) {
      metadata.role_ids = validation.data.role_ids
    }

    // Combine user notes with metadata
    const combinedNotes = validation.data.notes
      ? `${validation.data.notes}\n\n[Metadata: ${JSON.stringify(metadata)}]`
      : `[Metadata: ${JSON.stringify(metadata)}]`

    // Add email to approved list
    const { error } = await supabase.from('approved_emails').insert({
      email: validation.data.email,
      approved_by: user.id,
      is_active: true,
      notes: combinedNotes
    })

    if (error) {
      return {
        message: error.message || 'Failed to invite user. Please try again.'
      }
    }

    // Send invitation email if send_email is true
    if (validation.data.send_email) {
      try {
        // Get inviter's name
        const { data: inviterProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        // Get chapter name if assigned
        let chapterName = 'Young Indians'
        if (validation.data.chapter_id) {
          const { data: chapter } = await supabase
            .from('chapters')
            .select('name')
            .eq('id', validation.data.chapter_id)
            .single()
          chapterName = chapter?.name || 'Young Indians'
        }

        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app'
        const emailTemplate = memberInvitationEmail({
          inviterName: inviterProfile?.full_name || 'Yi Admin',
          chapterName,
          inviteLink: `${APP_URL}/login`,
        })

        await sendEmail({
          to: validation.data.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        })
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError)
        // Don't fail the invitation if email fails
      }
    }

    revalidatePath('/admin/users')

    return {
      success: true,
      message: validation.data.send_email
        ? `Invitation sent to ${validation.data.email}. They can now sign up using this email.`
        : `${validation.data.email} added to approved list. They can now sign up using this email.`
    }
  } catch (error: any) {
    return {
      message: error.message || 'An unexpected error occurred.'
    }
  }
}

// ============================================================================
// User Deactivate/Reactivate/Delete Actions (for Table Row Actions)
// ============================================================================

/**
 * Deactivate a user from the table (soft disable)
 * Updates is_active in profiles, members, and approved_emails tables
 * Only Super Admin and National Admin can perform this action
 */
export async function deactivateUserFromTable(
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { user } = await requireRole(['Super Admin', 'National Admin']);

    // Prevent self-deactivation
    if (userId === user.id) {
      return {
        success: false,
        message: 'You cannot deactivate your own account.'
      };
    }

    const adminClient = createAdminSupabaseClient();

    // Get user info
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();

    if (!profile) {
      return {
        success: false,
        message: 'User not found.'
      };
    }

    const userName = profile.full_name || 'User';

    // Deactivate in profiles table
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId);

    if (profileError) {
      console.error('Failed to deactivate profile:', profileError);
    }

    // Deactivate in members table (if exists)
    await adminClient
      .from('members')
      .update({ is_active: false, membership_status: 'inactive' })
      .eq('id', userId);

    // Deactivate in approved_emails table
    if (profile.email) {
      await adminClient
        .from('approved_emails')
        .update({ is_active: false })
        .eq('email', profile.email);
    }

    // Invalidate caches
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${userId}`);
    revalidateTag('members-list', 'max');

    return {
      success: true,
      message: `${userName} has been deactivated successfully.`
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to deactivate user.'
    };
  }
}

/**
 * Reactivate a user from the table
 * Updates is_active in profiles, members, and approved_emails tables
 * Only Super Admin and National Admin can perform this action
 */
export async function reactivateUserFromTable(
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireRole(['Super Admin', 'National Admin']);

    const adminClient = createAdminSupabaseClient();

    // Get user info
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();

    if (!profile) {
      return {
        success: false,
        message: 'User not found.'
      };
    }

    const userName = profile.full_name || 'User';

    // Reactivate in profiles table
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ is_active: true })
      .eq('id', userId);

    if (profileError) {
      console.error('Failed to reactivate profile:', profileError);
    }

    // Reactivate in members table (if exists)
    await adminClient
      .from('members')
      .update({ is_active: true, membership_status: 'active' })
      .eq('id', userId);

    // Reactivate in approved_emails table
    if (profile.email) {
      await adminClient
        .from('approved_emails')
        .update({ is_active: true })
        .eq('email', profile.email);
    }

    // Invalidate caches
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${userId}`);
    revalidateTag('members-list', 'max');

    return {
      success: true,
      message: `${userName} has been reactivated successfully.`
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to reactivate user.'
    };
  }
}

/**
 * Permanently delete a user from the table
 * Removes from members, profiles, approved_emails, and auth.users
 * Only Super Admin can perform this action
 * WARNING: This action cannot be undone
 */
export async function deleteUserPermanently(
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { user } = await requireRole(['Super Admin']);

    // Prevent self-deletion
    if (userId === user.id) {
      return {
        success: false,
        message: 'You cannot delete your own account.'
      };
    }

    const adminClient = createAdminSupabaseClient();

    // Get user info
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();

    if (!profile) {
      return {
        success: false,
        message: 'User not found.'
      };
    }

    const userName = profile.full_name || 'User';
    const userEmail = profile.email;

    // 1. Delete from user_role_changes (has FK to profiles.id via user_id)
    await adminClient
      .from('user_role_changes')
      .delete()
      .eq('user_id', userId);

    // 2. Update user_role_changes where this user was the changed_by (set to null)
    await adminClient
      .from('user_role_changes')
      .update({ changed_by: null })
      .eq('changed_by', userId);

    // 3. Delete from user_roles (has FK to profiles.id)
    await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // 4. Handle approved_emails foreign key constraint
    if (userEmail) {
      await adminClient
        .from('approved_emails')
        .update({ created_member_id: null, member_created: false })
        .eq('email', userEmail);
    }

    // Also update any approved_emails where this user was the created_member_id
    await adminClient
      .from('approved_emails')
      .update({ created_member_id: null })
      .eq('created_member_id', userId);

    // 5. Delete from members table (cascades to skills, certifications, etc.)
    const { error: memberError } = await adminClient
      .from('members')
      .delete()
      .eq('id', userId);

    if (memberError) {
      console.error('Failed to delete member:', memberError);
    }

    // 6. Delete from profiles table
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Failed to delete profile:', profileError);
    }

    // 7. Delete from approved_emails table
    if (userEmail) {
      await adminClient
        .from('approved_emails')
        .delete()
        .eq('email', userEmail);
    }

    // 8. Delete auth user
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Failed to delete auth user:', authError);
    }

    // Invalidate caches
    revalidatePath('/admin/users');
    revalidateTag('members-list', 'max');
    revalidateTag('approved-emails', 'max');

    return {
      success: true,
      message: `${userName} has been permanently deleted.`
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to delete user permanently.'
    };
  }
}

// ============================================================================
// User Export Actions
// ============================================================================

export interface UserExportFilters {
  search?: string
  role_id?: string
  chapter_id?: string
  is_active?: boolean
}

/**
 * Export users to specified format
 * Only Super Admin and National Admin can export
 */
export async function exportUsers(
  format: 'csv' | 'xlsx' | 'json',
  filters?: UserExportFilters
): Promise<{ success: boolean; data?: string; filename?: string; message?: string }> {
  try {
    await requireRole(['Super Admin', 'National Admin'])

    const supabase = await createServerSupabaseClient()

    // Build query with filters
    let query = supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        avatar_url,
        is_active,
        created_at,
        updated_at,
        member:members(
          company,
          designation,
          industry,
          years_of_experience,
          membership_status,
          membership_type,
          engagement_score,
          chapter:chapters(name, location)
        ),
        roles:user_roles(
          role:roles(name)
        )
      `)
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters?.search) {
      query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
    }

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active)
    }

    if (filters?.chapter_id) {
      // Need to filter through members table
      query = query.not('member', 'is', null)
    }

    const { data: users, error } = await query

    if (error) throw error

    if (!users || users.length === 0) {
      return {
        success: false,
        message: 'No users found to export'
      }
    }

    // Filter by chapter and role if needed (post-query filtering for nested relations)
    let filteredUsers = users

    if (filters?.chapter_id) {
      filteredUsers = filteredUsers.filter((u: any) =>
        u.member?.chapter?.id === filters.chapter_id
      )
    }

    if (filters?.role_id) {
      filteredUsers = filteredUsers.filter((u: any) =>
        u.roles?.some((r: any) => r.role?.id === filters.role_id)
      )
    }

    // Transform data for export
    const exportData = filteredUsers.map((user: any) => ({
      id: user.id,
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      is_active: user.is_active ? 'Yes' : 'No',
      company: user.member?.company || '',
      designation: user.member?.designation || '',
      industry: user.member?.industry || '',
      years_of_experience: user.member?.years_of_experience || '',
      chapter: user.member?.chapter?.name || '',
      chapter_location: user.member?.chapter?.location || '',
      membership_status: user.member?.membership_status || '',
      membership_type: user.member?.membership_type || '',
      engagement_score: user.member?.engagement_score || 0,
      roles: user.roles?.map((r: any) => r.role?.name).filter(Boolean).join(', ') || '',
      created_at: user.created_at ? new Date(user.created_at).toISOString().split('T')[0] : '',
      updated_at: user.updated_at ? new Date(user.updated_at).toISOString().split('T')[0] : '',
    }))

    const timestamp = new Date().toISOString().split('T')[0]
    let filename = `yi-users-${timestamp}`
    let content: string

    if (format === 'json') {
      content = JSON.stringify(exportData, null, 2)
      filename += '.json'
    } else if (format === 'csv') {
      // Generate CSV
      const headers = Object.keys(exportData[0])
      const csvRows = [
        headers.join(','),
        ...exportData.map((row: any) =>
          headers.map(h => {
            const value = row[h]
            // Escape quotes and wrap in quotes if contains comma
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`
            }
            return value
          }).join(',')
        )
      ]
      content = csvRows.join('\n')
      filename += '.csv'
    } else {
      // For XLSX, return JSON and let client handle conversion
      // (XLSX generation typically requires client-side libraries)
      content = JSON.stringify(exportData)
      filename += '.xlsx'
    }

    return {
      success: true,
      data: content,
      filename,
      message: `Exported ${exportData.length} users`
    }
  } catch (error: any) {
    console.error('Export error:', error)
    return {
      success: false,
      message: error.message || 'Failed to export users'
    }
  }
}
