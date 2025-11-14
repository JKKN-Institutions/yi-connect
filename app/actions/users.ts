/**
 * User Management Server Actions
 *
 * Server actions for admin user management operations.
 * All mutations use Zod validation and cache invalidation.
 */

'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
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

    // TODO: Send invitation email if send_email is true

    revalidatePath('/admin/users')

    return {
      success: true,
      message: `Invitation sent to ${validation.data.email}. They can now sign up using this email.`
    }
  } catch (error: any) {
    return {
      message: error.message || 'An unexpected error occurred.'
    }
  }
}
