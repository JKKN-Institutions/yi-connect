/**
 * Event Materials Server Actions
 *
 * Server Actions for event materials with approval workflow.
 * Handles upload, versioning, review, and approval.
 */

'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import {
  uploadMaterialSchema,
  updateMaterialSchema,
  submitMaterialForReviewSchema,
  reviewMaterialSchema,
  createNewMaterialVersionSchema,
  deleteMaterialSchema,
  type UploadMaterialInput,
  type UpdateMaterialInput,
  type SubmitMaterialForReviewInput,
  type ReviewMaterialInput,
  type CreateNewMaterialVersionInput,
} from '@/lib/validations/event'

type ActionResponse<T = void> = {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Material Actions
// ============================================================================

/**
 * Upload a new material
 */
export async function uploadMaterial(
  input: UploadMaterialInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = uploadMaterialSchema.parse(input)

    // Verify event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, status')
      .eq('id', validated.event_id)
      .single()

    if (eventError || !event) {
      return { success: false, error: 'Event not found' }
    }

    // Insert material
    const { data, error } = await supabase
      .from('event_materials')
      .insert({
        event_id: validated.event_id,
        trainer_assignment_id: validated.trainer_assignment_id || null,
        title: validated.title,
        description: validated.description || null,
        material_type: validated.material_type,
        file_url: validated.file_url,
        file_name: validated.file_name,
        file_size_kb: validated.file_size_kb || null,
        mime_type: validated.mime_type || null,
        tags: validated.tags || null,
        version: 1,
        is_current_version: true,
        status: 'draft',
        uploaded_by: user.id,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error uploading material:', error)
      return { success: false, error: 'Failed to upload material' }
    }

    // Invalidate caches
    updateTag('event-materials')
    revalidatePath(`/events/${validated.event_id}`)
    revalidatePath(`/events/${validated.event_id}/materials`)

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Error in uploadMaterial:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Update an existing material
 */
export async function updateMaterial(
  materialId: string,
  input: UpdateMaterialInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updateMaterialSchema.parse(input)

    // Get material to verify ownership
    const { data: material, error: fetchError } = await supabase
      .from('event_materials')
      .select('id, event_id, uploaded_by, status')
      .eq('id', materialId)
      .single()

    if (fetchError || !material) {
      return { success: false, error: 'Material not found' }
    }

    // Check if user can edit (owner or admin)
    if (material.uploaded_by !== user.id) {
      // TODO: Check for admin role
      return { success: false, error: 'Not authorized to edit this material' }
    }

    // Can only edit draft or revision_requested materials
    if (material.status !== 'draft' && material.status !== 'revision_requested') {
      return { success: false, error: 'Cannot edit material in current status' }
    }

    // Update material
    const { error } = await supabase
      .from('event_materials')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', materialId)

    if (error) {
      console.error('Error updating material:', error)
      return { success: false, error: 'Failed to update material' }
    }

    updateTag('event-materials')
    revalidatePath(`/events/${material.event_id}`)
    revalidatePath(`/events/${material.event_id}/materials`)

    return { success: true }
  } catch (error) {
    console.error('Error in updateMaterial:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Submit material for review
 */
export async function submitMaterialForReview(
  input: SubmitMaterialForReviewInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = submitMaterialForReviewSchema.parse(input)

    // Get material
    const { data: material, error: fetchError } = await supabase
      .from('event_materials')
      .select('id, event_id, uploaded_by, status')
      .eq('id', validated.material_id)
      .single()

    if (fetchError || !material) {
      return { success: false, error: 'Material not found' }
    }

    // Verify ownership
    if (material.uploaded_by !== user.id) {
      return { success: false, error: 'Not authorized to submit this material' }
    }

    // Can only submit draft or revision_requested materials
    if (material.status !== 'draft' && material.status !== 'revision_requested') {
      return { success: false, error: 'Material already submitted for review' }
    }

    // Update status
    const { error } = await supabase
      .from('event_materials')
      .update({
        status: 'pending_review',
        submitted_at: new Date().toISOString(),
        submitted_by: user.id,
      })
      .eq('id', validated.material_id)

    if (error) {
      console.error('Error submitting material:', error)
      return { success: false, error: 'Failed to submit material' }
    }

    // TODO: Notify reviewers (Chapter Chair, Vertical Chair)

    updateTag('event-materials')
    revalidatePath(`/events/${material.event_id}`)
    revalidatePath('/materials/pending')

    return { success: true }
  } catch (error) {
    console.error('Error in submitMaterialForReview:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Review a material (approve or request revision)
 */
export async function reviewMaterial(
  input: ReviewMaterialInput
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = reviewMaterialSchema.parse(input)

    // Get material
    const { data: material, error: fetchError } = await supabase
      .from('event_materials')
      .select('id, event_id, status, uploaded_by')
      .eq('id', validated.material_id)
      .single()

    if (fetchError || !material) {
      return { success: false, error: 'Material not found' }
    }

    // TODO: Verify user has review permission (Chapter Chair or Vertical Chair)

    if (material.status !== 'pending_review') {
      return { success: false, error: 'Material not pending review' }
    }

    // Determine new status
    const newStatus = validated.action === 'approve' ? 'approved' : 'revision_requested'

    // Update material
    const { error } = await supabase
      .from('event_materials')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        review_notes: validated.review_notes || null,
        rejection_reason: validated.action === 'request_revision' ? validated.rejection_reason : null,
      })
      .eq('id', validated.material_id)

    if (error) {
      console.error('Error reviewing material:', error)
      return { success: false, error: 'Failed to review material' }
    }

    // TODO: Notify uploader of decision

    updateTag('event-materials')
    revalidatePath(`/events/${material.event_id}`)
    revalidatePath('/materials/pending')

    return { success: true }
  } catch (error) {
    console.error('Error in reviewMaterial:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Create a new version of a material
 */
export async function createMaterialVersion(
  input: CreateNewMaterialVersionInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = createNewMaterialVersionSchema.parse(input)

    // Get parent material
    const { data: parent, error: fetchError } = await supabase
      .from('event_materials')
      .select('*')
      .eq('id', validated.parent_material_id)
      .single()

    if (fetchError || !parent) {
      return { success: false, error: 'Parent material not found' }
    }

    // Mark old version as superseded
    await supabase
      .from('event_materials')
      .update({
        is_current_version: false,
        status: 'superseded',
      })
      .eq('id', validated.parent_material_id)

    // Create new version
    const { data, error } = await supabase
      .from('event_materials')
      .insert({
        event_id: parent.event_id,
        trainer_assignment_id: parent.trainer_assignment_id,
        title: parent.title,
        description: parent.description,
        material_type: parent.material_type,
        file_url: validated.file_url,
        file_name: validated.file_name,
        file_size_kb: validated.file_size_kb || null,
        mime_type: parent.mime_type,
        version: (parent.version || 1) + 1,
        is_current_version: true,
        parent_material_id: validated.parent_material_id,
        version_notes: validated.version_notes || null,
        status: 'draft',
        tags: parent.tags,
        uploaded_by: user.id,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating version:', error)
      return { success: false, error: 'Failed to create new version' }
    }

    updateTag('event-materials')
    revalidatePath(`/events/${parent.event_id}`)
    revalidatePath(`/events/${parent.event_id}/materials`)

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Error in createMaterialVersion:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Delete a material
 */
export async function deleteMaterial(
  input: { id: string }
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = deleteMaterialSchema.parse(input)

    // Get material
    const { data: material, error: fetchError } = await supabase
      .from('event_materials')
      .select('id, event_id, uploaded_by, status')
      .eq('id', validated.id)
      .single()

    if (fetchError || !material) {
      return { success: false, error: 'Material not found' }
    }

    // Check permissions
    if (material.uploaded_by !== user.id) {
      // TODO: Check for admin role
      return { success: false, error: 'Not authorized to delete this material' }
    }

    // Can only delete draft materials
    if (material.status !== 'draft') {
      return { success: false, error: 'Can only delete draft materials' }
    }

    // Delete material
    const { error } = await supabase
      .from('event_materials')
      .delete()
      .eq('id', validated.id)

    if (error) {
      console.error('Error deleting material:', error)
      return { success: false, error: 'Failed to delete material' }
    }

    updateTag('event-materials')
    revalidatePath(`/events/${material.event_id}`)
    revalidatePath(`/events/${material.event_id}/materials`)

    return { success: true }
  } catch (error) {
    console.error('Error in deleteMaterial:', error)
    return { success: false, error: 'Invalid input data' }
  }
}

/**
 * Increment download count for a material
 */
export async function trackMaterialDownload(
  materialId: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.rpc('increment_material_downloads', {
      material_id: materialId,
    })

    // Fallback if RPC doesn't exist - fetch current and increment
    if (error) {
      const { data: material } = await supabase
        .from('event_materials')
        .select('download_count')
        .eq('id', materialId)
        .single()

      if (material) {
        await supabase
          .from('event_materials')
          .update({
            download_count: (material.download_count || 0) + 1,
            last_downloaded_at: new Date().toISOString(),
          })
          .eq('id', materialId)
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error tracking download:', error)
    return { success: false, error: 'Failed to track download' }
  }
}

/**
 * Share a material (make it available for other events)
 */
export async function shareMaterial(
  materialId: string,
  isShared: boolean
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get material
    const { data: material, error: fetchError } = await supabase
      .from('event_materials')
      .select('id, event_id, status')
      .eq('id', materialId)
      .single()

    if (fetchError || !material) {
      return { success: false, error: 'Material not found' }
    }

    // Can only share approved materials
    if (material.status !== 'approved') {
      return { success: false, error: 'Can only share approved materials' }
    }

    const { error } = await supabase
      .from('event_materials')
      .update({ is_shared: isShared })
      .eq('id', materialId)

    if (error) {
      console.error('Error sharing material:', error)
      return { success: false, error: 'Failed to update sharing status' }
    }

    updateTag('event-materials')
    revalidatePath(`/events/${material.event_id}`)
    revalidatePath('/materials/shared')

    return { success: true }
  } catch (error) {
    console.error('Error in shareMaterial:', error)
    return { success: false, error: 'Failed to share material' }
  }
}

/**
 * Mark material as template
 */
export async function markAsTemplate(
  materialId: string,
  isTemplate: boolean
): Promise<ActionResponse> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // TODO: Check for admin permission

    const { data: material } = await supabase
      .from('event_materials')
      .select('event_id, status')
      .eq('id', materialId)
      .single()

    if (!material || material.status !== 'approved') {
      return { success: false, error: 'Material must be approved to mark as template' }
    }

    const { error } = await supabase
      .from('event_materials')
      .update({ is_template: isTemplate })
      .eq('id', materialId)

    if (error) {
      console.error('Error marking as template:', error)
      return { success: false, error: 'Failed to mark as template' }
    }

    updateTag('event-materials')
    revalidatePath('/materials/templates')

    return { success: true }
  } catch (error) {
    console.error('Error in markAsTemplate:', error)
    return { success: false, error: 'Failed to mark as template' }
  }
}
