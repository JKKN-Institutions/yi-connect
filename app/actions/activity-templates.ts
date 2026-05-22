'use server'

/**
 * Activity Templates Server Actions
 */

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import {
  createActivityTemplate,
  updateActivityTemplate,
  deleteActivityTemplate,
  incrementTemplateUsage,
} from '@/lib/data/activity-templates'
import type {
  CreateActivityTemplateInput,
  UpdateActivityTemplateInput,
} from '@/types/activity-templates'

// ============================================================================
// CREATE
// ============================================================================

export async function createActivityTemplateAction(
  input: CreateActivityTemplateInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

    await createActivityTemplate({
      name: input.name,
      description: input.description ?? null,
      vertical_id: input.vertical_id ?? null,
      default_title: input.default_title ?? null,
      default_activity_type: input.default_activity_type ?? null,
      default_aaa_classification: input.default_aaa_classification ?? null,
      default_target_audience: input.default_target_audience ?? null,
      default_duration_hours: input.default_duration_hours ?? null,
      expected_participants: input.expected_participants ?? null,
      expected_ec_count: input.expected_ec_count ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      tags: input.tags ?? [],
      is_national: input.is_national ?? true,
      chapter_id: input.chapter_id ?? null,
      is_active: true,
      created_by: null,
    })

    revalidatePath('/pathfinder/templates')
    revalidatePath('/pathfinder/health-card/new')
    return { success: true }
  } catch (error) {
    console.error('Create template error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create template',
    }
  }
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateActivityTemplateAction(
  input: UpdateActivityTemplateInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

    await updateActivityTemplate(input.id, {
      name: input.name,
      description: input.description,
      vertical_id: input.vertical_id,
      default_title: input.default_title,
      default_activity_type: input.default_activity_type,
      default_aaa_classification: input.default_aaa_classification,
      default_target_audience: input.default_target_audience,
      default_duration_hours: input.default_duration_hours,
      expected_participants: input.expected_participants,
      expected_ec_count: input.expected_ec_count,
      icon: input.icon,
      color: input.color,
      tags: input.tags,
      is_active: input.is_active,
    })

    revalidatePath('/pathfinder/templates')
    revalidatePath('/pathfinder/health-card/new')
    return { success: true }
  } catch (error) {
    console.error('Update template error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update template',
    }
  }
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteActivityTemplateAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['Super Admin', 'National Admin', 'Chair'])

    await deleteActivityTemplate(id)

    revalidatePath('/pathfinder/templates')
    revalidatePath('/pathfinder/health-card/new')
    return { success: true }
  } catch (error) {
    console.error('Delete template error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete template',
    }
  }
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

export async function trackTemplateUsageAction(
  templateId: string
): Promise<{ success: boolean }> {
  try {
    await incrementTemplateUsage(templateId)
    return { success: true }
  } catch (error) {
    console.error('Track usage error:', error)
    return { success: false }
  }
}
