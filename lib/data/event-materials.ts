/**
 * Event Materials Data Layer
 *
 * Cached data fetching functions for event materials with approval workflow.
 */

import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import type {
  EventMaterial,
  EventMaterialWithUploader,
  MaterialApprovalStatus,
  MaterialType,
  MaterialVersionHistory,
} from '@/types/event'

// ============================================================================
// Types
// ============================================================================

export interface MaterialFilters {
  event_id?: string
  trainer_assignment_id?: string
  material_type?: MaterialType[]
  status?: MaterialApprovalStatus[]
  is_current_version?: boolean
  uploaded_by?: string
  search?: string
}

export interface PaginatedMaterials {
  data: EventMaterialWithUploader[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============================================================================
// Material Queries
// ============================================================================

/**
 * Get paginated materials with filters
 */
export const getMaterials = cache(
  async (params?: {
    page?: number
    pageSize?: number
    filters?: MaterialFilters
    sortField?: string
    sortDirection?: 'asc' | 'desc'
  }): Promise<PaginatedMaterials> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const page = params?.page || 1
    const pageSize = params?.pageSize || 10
    const offset = (page - 1) * pageSize
    const filters = params?.filters
    const sortField = params?.sortField || 'created_at'
    const sortDirection = params?.sortDirection || 'desc'

    let query = supabase
      .from('event_materials')
      .select(
        `
        *,
        uploader:profiles!uploaded_by(
          id,
          full_name,
          avatar_url
        ),
        reviewer:profiles!reviewed_by(
          id,
          full_name
        )
      `,
        { count: 'exact' }
      )

    // Apply filters
    if (filters?.event_id) {
      query = query.eq('event_id', filters.event_id)
    }
    if (filters?.trainer_assignment_id) {
      query = query.eq('trainer_assignment_id', filters.trainer_assignment_id)
    }
    if (filters?.material_type && filters.material_type.length > 0) {
      query = query.in('material_type', filters.material_type)
    }
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }
    if (filters?.is_current_version !== undefined) {
      query = query.eq('is_current_version', filters.is_current_version)
    }
    if (filters?.uploaded_by) {
      query = query.eq('uploaded_by', filters.uploaded_by)
    }
    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      )
    }

    // Apply sorting and pagination
    query = query
      .order(sortField, { ascending: sortDirection === 'asc' })
      .range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching materials:', error)
      throw new Error(`Failed to fetch materials: ${error.message}`)
    }

    return {
      data: (data || []) as EventMaterialWithUploader[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }
  }
)

/**
 * Get material by ID
 */
export const getMaterialById = cache(
  async (materialId: string): Promise<EventMaterialWithUploader | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('event_materials')
      .select(
        `
        *,
        uploader:profiles!uploaded_by(
          id,
          full_name,
          avatar_url
        ),
        reviewer:profiles!reviewed_by(
          id,
          full_name
        ),
        event:events(
          id,
          title,
          status
        )
      `
      )
      .eq('id', materialId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch material: ${error.message}`)
    }

    return data as EventMaterialWithUploader
  }
)

/**
 * Get materials for an event
 */
export const getEventMaterials = cache(
  async (eventId: string): Promise<EventMaterialWithUploader[]> => {
    const result = await getMaterials({
      filters: {
        event_id: eventId,
        is_current_version: true,
      },
      sortField: 'material_type',
      sortDirection: 'asc',
    })

    return result.data
  }
)

/**
 * Get version history for a material
 */
export const getMaterialVersionHistory = cache(
  async (materialId: string): Promise<MaterialVersionHistory | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get the current material
    const { data: current, error: currentError } = await supabase
      .from('event_materials')
      .select('*')
      .eq('id', materialId)
      .single()

    if (currentError) {
      if (currentError.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch material: ${currentError.message}`)
    }

    // Find the root material (first version)
    let rootId = materialId
    let parentId = current.parent_material_id

    while (parentId) {
      const { data: parent } = await supabase
        .from('event_materials')
        .select('id, parent_material_id')
        .eq('id', parentId)
        .single()

      if (parent) {
        rootId = parent.id
        parentId = parent.parent_material_id
      } else {
        break
      }
    }

    // Get all versions (materials with same root or parent chain)
    const { data: allVersions, error: versionsError } = await supabase
      .from('event_materials')
      .select('*')
      .or(`id.eq.${rootId},parent_material_id.eq.${rootId}`)
      .order('version', { ascending: false })

    if (versionsError) {
      throw new Error(`Failed to fetch versions: ${versionsError.message}`)
    }

    // Find current version
    const currentVersion = allVersions?.find((m: any) => m.is_current_version) || current

    return {
      current: currentVersion as EventMaterial,
      versions: (allVersions || []) as EventMaterial[],
    }
  }
)

/**
 * Get materials pending approval
 */
export const getPendingApprovalMaterials = cache(
  async (): Promise<EventMaterialWithUploader[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('event_materials')
      .select(
        `
        *,
        uploader:profiles!uploaded_by(
          id,
          full_name,
          avatar_url
        ),
        event:events(
          id,
          title,
          start_date,
          status
        )
      `
      )
      .eq('status', 'pending_review')
      .eq('is_current_version', true)
      .order('submitted_at', { ascending: true })

    if (error) {
      console.error('Error fetching pending materials:', error)
      throw new Error(`Failed to fetch pending materials: ${error.message}`)
    }

    return (data || []) as EventMaterialWithUploader[]
  }
)

/**
 * Get materials for a trainer's assignments
 */
export const getTrainerMaterials = cache(
  async (trainerProfileId: string): Promise<EventMaterialWithUploader[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // First get assignments for this trainer
    const { data: assignments } = await supabase
      .from('event_trainer_assignments')
      .select('id')
      .eq('trainer_profile_id', trainerProfileId)

    if (!assignments || assignments.length === 0) {
      return []
    }

    const assignmentIds = assignments.map((a: any) => a.id)

    const { data, error } = await supabase
      .from('event_materials')
      .select(
        `
        *,
        uploader:profiles!uploaded_by(
          id,
          full_name,
          avatar_url
        ),
        event:events(
          id,
          title,
          start_date
        )
      `
      )
      .in('trainer_assignment_id', assignmentIds)
      .eq('is_current_version', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching trainer materials:', error)
      throw new Error(`Failed to fetch trainer materials: ${error.message}`)
    }

    return (data || []) as EventMaterialWithUploader[]
  }
)

/**
 * Get shared/template materials
 */
export const getSharedMaterials = cache(
  async (materialType?: MaterialType): Promise<EventMaterial[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    let query = supabase
      .from('event_materials')
      .select('*')
      .eq('is_shared', true)
      .eq('status', 'approved')
      .eq('is_current_version', true)
      .order('download_count', { ascending: false })

    if (materialType) {
      query = query.eq('material_type', materialType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching shared materials:', error)
      throw new Error(`Failed to fetch shared materials: ${error.message}`)
    }

    return (data || []) as EventMaterial[]
  }
)

/**
 * Get material templates
 */
export const getMaterialTemplates = cache(
  async (): Promise<EventMaterial[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('event_materials')
      .select('*')
      .eq('is_template', true)
      .eq('status', 'approved')
      .order('material_type', { ascending: true })
      .order('title', { ascending: true })

    if (error) {
      console.error('Error fetching templates:', error)
      throw new Error(`Failed to fetch templates: ${error.message}`)
    }

    return (data || []) as EventMaterial[]
  }
)

// ============================================================================
// Analytics
// ============================================================================

/**
 * Get material analytics for an event
 */
export const getEventMaterialAnalytics = cache(
  async (eventId: string): Promise<{
    total_materials: number
    by_status: Record<MaterialApprovalStatus, number>
    by_type: Record<MaterialType, number>
    total_downloads: number
  }> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data, error } = await supabase
      .from('event_materials')
      .select('status, material_type, download_count')
      .eq('event_id', eventId)
      .eq('is_current_version', true)

    if (error) {
      console.error('Error fetching material analytics:', error)
      throw new Error(`Failed to fetch analytics: ${error.message}`)
    }

    const materials = data || []

    const byStatus = materials.reduce((acc: any, m: any) => {
      acc[m.status] = (acc[m.status] || 0) + 1
      return acc
    }, {})

    const byType = materials.reduce((acc: any, m: any) => {
      acc[m.material_type] = (acc[m.material_type] || 0) + 1
      return acc
    }, {})

    const totalDownloads = materials.reduce(
      (sum: number, m: any) => sum + (m.download_count || 0),
      0
    )

    return {
      total_materials: materials.length,
      by_status: byStatus,
      by_type: byType,
      total_downloads: totalDownloads,
    }
  }
)
