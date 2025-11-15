'use server'

/**
 * Upload Actions
 *
 * Server actions for file uploads to Supabase Storage
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface UploadResult {
  success: boolean
  data?: { url: string; path: string }
  error?: string
}

/**
 * Upload image to Supabase Storage
 * @param file - File data as base64 string or File object
 * @param bucket - Storage bucket name
 * @param folder - Optional folder path within bucket
 */
export async function uploadImage(
  fileData: string,
  bucket: string = 'event-images',
  folder?: string
): Promise<UploadResult> {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return {
        success: false,
        error: 'You must be logged in to upload images'
      }
    }

    // Parse base64 data URL
    let fileBuffer: Buffer
    let contentType: string
    let fileExtension: string

    if (fileData.startsWith('data:')) {
      // Extract content type and base64 data
      const matches = fileData.match(/^data:([^;]+);base64,(.+)$/)
      if (!matches) {
        return {
          success: false,
          error: 'Invalid base64 image format'
        }
      }

      contentType = matches[1]
      const base64Data = matches[2]
      fileBuffer = Buffer.from(base64Data, 'base64')

      // Determine file extension from content type
      const extensionMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif'
      }
      fileExtension = extensionMap[contentType] || 'jpg'
    } else {
      return {
        success: false,
        error: 'Only base64 data URLs are supported'
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 9)
    const filename = `${timestamp}-${randomStr}.${fileExtension}`

    // Build file path
    const filePath = folder ? `${folder}/${filename}` : filename

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      return {
        success: false,
        error: error.message || 'Failed to upload image'
      }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return {
      success: true,
      data: {
        url: publicUrl,
        path: filePath
      }
    }
  } catch (error) {
    console.error('Upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}

/**
 * Delete image from Supabase Storage
 * @param path - File path in storage
 * @param bucket - Storage bucket name
 */
export async function deleteImage(
  path: string,
  bucket: string = 'event-images'
): Promise<UploadResult> {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return {
        success: false,
        error: 'You must be logged in to delete images'
      }
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) {
      console.error('Delete error:', error)
      return {
        success: false,
        error: error.message || 'Failed to delete image'
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('Delete error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }
  }
}
