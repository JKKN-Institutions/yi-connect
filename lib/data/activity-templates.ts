/**
 * Activity Templates Data Layer
 * Server-side data fetching functions
 */

import { createClient } from '@/lib/supabase/server'
import type {
  ActivityTemplate,
  ActivityTemplateFilters,
} from '@/types/activity-templates'

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get activity templates with optional filters
 */
export async function getActivityTemplates(
  filters?: ActivityTemplateFilters
): Promise<ActivityTemplate[]> {
  const supabase = await createClient()

  let query = supabase
    .from('activity_templates')
    .select(`
      *,
      vertical:verticals(id, name, color)
    `)
    .eq('is_active', true)
    .order('usage_count', { ascending: false })
    .order('name', { ascending: true })

  if (filters?.vertical_id) {
    query = query.eq('vertical_id', filters.vertical_id)
  }

  if (filters?.is_national !== undefined) {
    query = query.eq('is_national', filters.is_national)
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags)
  }

  const { data, error } = await query

  if (error) {
    // Handle case where table doesn't exist yet
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('Activity templates table not found - migration may need to be run')
      return []
    }
    console.error('Error fetching activity templates:', error)
    return []
  }

  return data as ActivityTemplate[]
}

/**
 * Get all templates including inactive (for admin)
 */
export async function getAllActivityTemplates(): Promise<ActivityTemplate[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activity_templates')
    .select(`
      *,
      vertical:verticals(id, name, color)
    `)
    .order('is_active', { ascending: false })
    .order('usage_count', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn('Activity templates table not found')
      return []
    }
    console.error('Error fetching all templates:', error)
    return []
  }

  return data as ActivityTemplate[]
}

/**
 * Get a single template by ID
 */
export async function getActivityTemplateById(id: string): Promise<ActivityTemplate | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activity_templates')
    .select(`
      *,
      vertical:verticals(id, name, color)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    if (error.code === '42P01') return null
    console.error('Error fetching template:', error)
    return null
  }

  return data as ActivityTemplate
}

/**
 * Get popular templates (top N by usage)
 */
export async function getPopularTemplates(limit: number = 6): Promise<ActivityTemplate[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activity_templates')
    .select(`
      *,
      vertical:verticals(id, name, color)
    `)
    .eq('is_active', true)
    .order('usage_count', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return []
    }
    console.error('Error fetching popular templates:', error)
    return []
  }

  return data as ActivityTemplate[]
}

/**
 * Get templates by vertical
 */
export async function getTemplatesByVertical(verticalId: string): Promise<ActivityTemplate[]> {
  return getActivityTemplates({ vertical_id: verticalId })
}

/**
 * Search templates by tags
 */
export async function searchTemplatesByTags(tags: string[]): Promise<ActivityTemplate[]> {
  return getActivityTemplates({ tags })
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new template
 */
export async function createActivityTemplate(
  data: Omit<ActivityTemplate, 'id' | 'created_at' | 'updated_at' | 'vertical' | 'usage_count'>
): Promise<ActivityTemplate> {
  const supabase = await createClient()

  const { data: template, error } = await supabase
    .from('activity_templates')
    .insert(data)
    .select(`
      *,
      vertical:verticals(id, name, color)
    `)
    .single()

  if (error) {
    console.error('Error creating template:', error)
    throw new Error('Failed to create activity template')
  }

  return template as ActivityTemplate
}

/**
 * Update a template
 */
export async function updateActivityTemplate(
  id: string,
  data: Partial<ActivityTemplate>
): Promise<ActivityTemplate> {
  const supabase = await createClient()

  const { data: template, error } = await supabase
    .from('activity_templates')
    .update(data)
    .eq('id', id)
    .select(`
      *,
      vertical:verticals(id, name, color)
    `)
    .single()

  if (error) {
    console.error('Error updating template:', error)
    throw new Error('Failed to update activity template')
  }

  return template as ActivityTemplate
}

/**
 * Delete a template (soft delete by setting is_active = false)
 */
export async function deleteActivityTemplate(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('activity_templates')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error deleting template:', error)
    throw new Error('Failed to delete activity template')
  }
}

/**
 * Hard delete a template (permanent)
 */
export async function hardDeleteActivityTemplate(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('activity_templates')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error hard deleting template:', error)
    throw new Error('Failed to delete activity template')
  }
}

/**
 * Increment template usage count
 */
export async function incrementTemplateUsage(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('increment_template_usage', {
    template_id: id,
  })

  if (error) {
    console.error('Error incrementing usage:', error)
    // Don't throw - this is a non-critical operation
  }
}
