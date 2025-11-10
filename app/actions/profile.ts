/**
 * Profile Server Actions
 *
 * Server actions for user profile management
 */

'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { updateProfileSchema } from '@/lib/validations/profile'
import type { UpdateProfileInput } from '@/lib/validations/profile'

export interface ActionResponse {
  success: boolean
  message?: string
  errors?: Record<string, string[]>
}

/**
 * Update user profile
 *
 * Allows users to update their own profile information
 */
export async function updateProfile(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: 'You must be logged in to update your profile',
      }
    }

    // Extract form data
    const data: UpdateProfileInput = {
      full_name: formData.get('full_name') as string,
      phone: (formData.get('phone') as string) || undefined,
    }

    // Validate input
    const validation = updateProfileSchema.safeParse(data)
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      }
    }

    // Update profile in database
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: validation.data.full_name,
        phone: validation.data.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      console.error('Error updating profile:', error)
      return {
        success: false,
        message: 'Failed to update profile. Please try again.',
      }
    }

    // Revalidate paths to update UI
    revalidatePath('/settings/profile')
    revalidatePath('/dashboard')

    return {
      success: true,
      message: 'Profile updated successfully',
    }
  } catch (error) {
    console.error('Unexpected error in updateProfile:', error)
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Upload profile avatar
 *
 * Upload avatar image to Supabase Storage
 */
export async function uploadAvatar(
  formData: FormData
): Promise<ActionResponse & { url?: string }> {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: 'You must be logged in to upload an avatar',
      }
    }

    const file = formData.get('avatar') as File
    if (!file || file.size === 0) {
      return {
        success: false,
        message: 'No file provided',
      }
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        message: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
      }
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        message: 'File size too large. Maximum size is 5MB.',
      }
    }

    const supabase = await createServerSupabaseClient()

    // Create unique filename with user ID folder
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    // Upload to Supabase Storage (avatars bucket)
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError)
      return {
        success: false,
        message: 'Failed to upload avatar. Please try again.',
      }
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(filePath)

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating profile with avatar URL:', updateError)
      return {
        success: false,
        message: 'Avatar uploaded but failed to update profile.',
      }
    }

    // Revalidate paths
    revalidatePath('/settings/profile')
    revalidatePath('/dashboard')

    return {
      success: true,
      message: 'Avatar uploaded successfully',
      url: publicUrl,
    }
  } catch (error) {
    console.error('Unexpected error in uploadAvatar:', error)
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    }
  }
}
