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
