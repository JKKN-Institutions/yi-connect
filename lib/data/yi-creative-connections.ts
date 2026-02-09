/**
 * Yi Creative Studio Connections Data Layer
 *
 * Functions for managing Yi Creative Studio connections per chapter.
 * Uses Supabase with RLS for secure access.
 */

import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  YiCreativeConnection,
  YiCreativeConnectionWithDetails,
  CreateConnectionData,
  UpdateConnectionData,
  YiCreativeConnectionUIStatus,
} from '@/types/yi-creative'

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get Yi Creative connection for a specific chapter
 */
export const getChapterYiCreativeConnection = cache(
  async (chapterId: string): Promise<YiCreativeConnection | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('yi_creative_connections')
      .select('*')
      .eq('chapter_id', chapterId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - chapter not connected
        return null
      }
      console.error('[Yi Creative] Error fetching connection:', error.message)
      return null
    }

    return data as YiCreativeConnection
  }
)

/**
 * Get Yi Creative connection with related details
 */
export async function getChapterYiCreativeConnectionWithDetails(
  chapterId: string
): Promise<YiCreativeConnectionWithDetails | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('yi_creative_connections')
    .select(
      `
      *,
      chapter:chapters (
        id,
        name,
        location
      ),
      connected_by_profile:profiles!connected_by (
        id,
        full_name,
        email
      )
    `
    )
    .eq('chapter_id', chapterId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('[Yi Creative] Error fetching connection with details:', error.message)
    return null
  }

  // Handle potential array responses from Supabase joins
  const chapter = Array.isArray(data.chapter) ? data.chapter[0] : data.chapter
  const connectedByProfile = Array.isArray(data.connected_by_profile)
    ? data.connected_by_profile[0]
    : data.connected_by_profile

  return {
    ...data,
    chapter,
    connected_by_profile: connectedByProfile,
  } as YiCreativeConnectionWithDetails
}

/**
 * Get current user's chapter Yi Creative connection
 */
export async function getCurrentChapterYiCreativeConnection(): Promise<YiCreativeConnection | null> {
  const supabase = await createServerSupabaseClient()

  // First get current user's chapter
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('members')
    .select('chapter_id')
    .eq('id', user.id)
    .single()

  if (!member?.chapter_id) return null

  return getChapterYiCreativeConnection(member.chapter_id)
}

/**
 * Get UI status for Yi Creative connection
 */
export async function getYiCreativeConnectionUIStatus(
  chapterId: string,
  userHierarchyLevel: number
): Promise<YiCreativeConnectionUIStatus> {
  const connection = await getChapterYiCreativeConnectionWithDetails(chapterId)

  if (!connection) {
    return {
      isConnected: false,
      status: 'not_connected',
      organizationName: null,
      connectedBy: null,
      connectedAt: null,
      canConnect: userHierarchyLevel >= 4, // Chair+
      canDisconnect: false,
    }
  }

  return {
    isConnected: connection.status === 'active',
    status: connection.status,
    organizationName: connection.organization_name,
    connectedBy: connection.connected_by_profile?.full_name || null,
    connectedAt: connection.connected_at ? new Date(connection.connected_at) : null,
    canConnect: false, // Already connected
    canDisconnect: userHierarchyLevel >= 4, // Chair+
  }
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Create a new Yi Creative connection for a chapter
 */
export async function createYiCreativeConnection(
  data: CreateConnectionData
): Promise<YiCreativeConnection | null> {
  const supabase = await createServerSupabaseClient()

  const { data: connection, error } = await supabase
    .from('yi_creative_connections')
    .insert({
      chapter_id: data.chapter_id,
      organization_id: data.organization_id,
      organization_name: data.organization_name,
      connected_by: data.connected_by,
      status: 'active',
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: data.token_expires_at,
      webhook_secret: data.webhook_secret,
      sso_private_key: data.sso_private_key,
      sso_public_key: data.sso_public_key,
    })
    .select()
    .single()

  if (error) {
    console.error('[Yi Creative] Error creating connection:', error.message)
    return null
  }

  return connection as YiCreativeConnection
}

/**
 * Update an existing Yi Creative connection
 */
export async function updateYiCreativeConnection(
  chapterId: string,
  data: UpdateConnectionData
): Promise<YiCreativeConnection | null> {
  const supabase = await createServerSupabaseClient()

  const { data: connection, error } = await supabase
    .from('yi_creative_connections')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('chapter_id', chapterId)
    .select()
    .single()

  if (error) {
    console.error('[Yi Creative] Error updating connection:', error.message)
    return null
  }

  return connection as YiCreativeConnection
}

/**
 * Disconnect Yi Creative (soft delete - sets status to disconnected)
 */
export async function disconnectYiCreative(chapterId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('yi_creative_connections')
    .update({
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('[Yi Creative] Error disconnecting:', error.message)
    return false
  }

  return true
}

/**
 * Delete Yi Creative connection (hard delete)
 */
export async function deleteYiCreativeConnection(chapterId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('yi_creative_connections')
    .delete()
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('[Yi Creative] Error deleting connection:', error.message)
    return false
  }

  return true
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a chapter has an active Yi Creative connection
 */
export async function isChapterConnectedToYiCreative(chapterId: string): Promise<boolean> {
  const connection = await getChapterYiCreativeConnection(chapterId)
  return connection?.status === 'active'
}

/**
 * Get SSO configuration for a chapter (for SSO token generation)
 */
export async function getChapterSSOConfig(chapterId: string): Promise<{
  organizationId: string
  privateKey: string | null
  publicKey: string | null
} | null> {
  const connection = await getChapterYiCreativeConnection(chapterId)

  if (!connection || connection.status !== 'active') {
    return null
  }

  return {
    organizationId: connection.organization_id,
    privateKey: connection.sso_private_key,
    publicKey: connection.sso_public_key,
  }
}
