'use server'

/**
 * Yi Creative Studio Connection Actions
 *
 * Server actions for managing Yi Creative Studio connections.
 * Handles OAuth flow, connection management, and key generation.
 */

import * as crypto from 'crypto'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  createYiCreativeConnection,
  disconnectYiCreative,
  getChapterYiCreativeConnection,
  deleteYiCreativeConnection,
} from '@/lib/data/yi-creative-connections'
import type {
  InitiateConnectResult,
  ManualConnectResult,
  OAuthCallbackResult,
  DisconnectResult,
  YiCreativeOAuthState,
} from '@/types/yi-creative'

// ============================================================================
// Configuration
// ============================================================================

const YI_CREATIVE_BASE_URL =
  process.env.YI_CREATIVE_BASE_URL || 'https://yi-creative-studio.vercel.app'
const YI_CONNECT_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app'
const YI_CREATIVE_CLIENT_ID = process.env.YI_CREATIVE_CLIENT_ID || 'yi-connect'

// ============================================================================
// OAuth State Management (using encrypted cookies or DB)
// ============================================================================

// In-memory store for OAuth state (in production, use Redis or DB)
const oauthStateStore = new Map<string, YiCreativeOAuthState>()

/**
 * Generate and store OAuth state
 */
function generateOAuthState(chapterId: string, userId: string): string {
  const nonce = crypto.randomBytes(32).toString('hex')
  const state: YiCreativeOAuthState = {
    chapter_id: chapterId,
    user_id: userId,
    nonce,
    redirect_uri: `${YI_CONNECT_BASE_URL}/api/yi-creative/callback`,
    created_at: Date.now(),
  }

  // Encode state as base64 JSON
  const stateString = Buffer.from(JSON.stringify(state)).toString('base64url')

  // Store for verification (expires in 10 minutes)
  oauthStateStore.set(nonce, state)
  setTimeout(() => oauthStateStore.delete(nonce), 10 * 60 * 1000)

  return stateString
}

/**
 * Verify and decode OAuth state
 * Note: This is a private helper function, not a server action
 */
function verifyOAuthState(stateString: string): YiCreativeOAuthState | null {
  try {
    const state = JSON.parse(
      Buffer.from(stateString, 'base64url').toString('utf-8')
    ) as YiCreativeOAuthState

    // Verify state exists and hasn't expired (10 minutes)
    const storedState = oauthStateStore.get(state.nonce)
    if (!storedState) {
      console.error('[Yi Creative OAuth] State not found or expired')
      return null
    }

    if (Date.now() - storedState.created_at > 10 * 60 * 1000) {
      console.error('[Yi Creative OAuth] State expired')
      oauthStateStore.delete(state.nonce)
      return null
    }

    // Clean up used state
    oauthStateStore.delete(state.nonce)

    return state
  } catch (error) {
    console.error('[Yi Creative OAuth] Invalid state:', error)
    return null
  }
}

// ============================================================================
// RSA Key Generation
// ============================================================================

/**
 * Generate RSA key pair for SSO signing
 */
function generateRSAKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })

  // Base64 encode for storage
  return {
    privateKey: Buffer.from(privateKey).toString('base64'),
    publicKey: Buffer.from(publicKey).toString('base64'),
  }
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Initiate OAuth connection to Yi Creative Studio
 * @param chapterId - Optional chapter ID (required for National Admin who select chapter from dropdown)
 */
export async function initiateYiCreativeConnect(chapterId?: string): Promise<InitiateConnectResult> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if National Admin
    const [{ data: isNationalAdmin }, { data: hierarchyLevel }] = await Promise.all([
      supabase.rpc('is_national_admin'),
      supabase.rpc('get_user_hierarchy_level', { p_user_id: user.id }),
    ])

    // Determine the chapter to connect
    let targetChapterId: string

    if (isNationalAdmin && chapterId) {
      // National Admin using the chapter from dropdown
      targetChapterId = chapterId
    } else {
      // Regular user - get from members table
      const { data: member } = await supabase
        .from('members')
        .select('chapter_id')
        .eq('id', user.id)
        .single()

      if (!member?.chapter_id) {
        return { success: false, error: 'No chapter assigned' }
      }
      targetChapterId = member.chapter_id

      // For non-National Admin, verify they can only connect their own chapter
      if (chapterId && chapterId !== member.chapter_id) {
        return { success: false, error: 'Cannot connect a different chapter' }
      }
    }

    // Check permission (National Admin or Chair+ required)
    if (!isNationalAdmin && (hierarchyLevel as number) < 4) {
      return { success: false, error: 'Insufficient permissions. Chapter Chair or higher required.' }
    }

    // Check if already connected
    const existingConnection = await getChapterYiCreativeConnection(targetChapterId)
    if (existingConnection?.status === 'active') {
      return { success: false, error: 'Chapter is already connected to Yi Creative Studio' }
    }

    // Generate OAuth state
    const state = generateOAuthState(targetChapterId, user.id)

    // Build OAuth authorization URL
    const authUrl = new URL(`${YI_CREATIVE_BASE_URL}/oauth/authorize`)
    authUrl.searchParams.set('client_id', YI_CREATIVE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', `${YI_CONNECT_BASE_URL}/api/yi-creative/callback`)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'organization:read')
    authUrl.searchParams.set('state', state)

    return {
      success: true,
      redirect_url: authUrl.toString(),
    }
  } catch (error) {
    console.error('[Yi Creative] Error initiating connect:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Manual connection to Yi Creative Studio (Simple API Key Exchange)
 * Used when Yi Creative Studio doesn't have OAuth implemented
 * @param chapterId - Chapter ID to connect
 * @param organizationId - Yi Creative Organization ID
 * @param organizationName - Optional organization name
 */
export async function connectYiCreativeManual(
  chapterId: string,
  organizationId: string,
  organizationName?: string
): Promise<ManualConnectResult> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if National Admin
    const [{ data: isNationalAdmin }, { data: hierarchyLevel }] = await Promise.all([
      supabase.rpc('is_national_admin'),
      supabase.rpc('get_user_hierarchy_level', { p_user_id: user.id }),
    ])

    // Determine the chapter to connect
    let targetChapterId = chapterId

    if (!isNationalAdmin) {
      // Regular user - verify they own this chapter
      const { data: member } = await supabase
        .from('members')
        .select('chapter_id')
        .eq('id', user.id)
        .single()

      if (!member?.chapter_id) {
        return { success: false, error: 'No chapter assigned' }
      }

      if (chapterId !== member.chapter_id) {
        return { success: false, error: 'Cannot connect a different chapter' }
      }
      targetChapterId = member.chapter_id
    }

    // Check permission (National Admin or Chair+ required)
    if (!isNationalAdmin && (hierarchyLevel as number) < 4) {
      return { success: false, error: 'Insufficient permissions. Chapter Chair or higher required.' }
    }

    // Check if already connected
    const existingConnection = await getChapterYiCreativeConnection(targetChapterId)
    if (existingConnection?.status === 'active') {
      return { success: false, error: 'Chapter is already connected to Yi Creative Studio' }
    }

    // If there's a disconnected connection, delete it first
    if (existingConnection) {
      await deleteYiCreativeConnection(targetChapterId)
    }

    // Generate RSA key pair for SSO
    const { privateKey, publicKey } = generateRSAKeyPair()

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex')

    // Create connection in database
    const connection = await createYiCreativeConnection({
      chapter_id: targetChapterId,
      organization_id: organizationId,
      organization_name: organizationName || undefined,
      connected_by: user.id,
      webhook_secret: webhookSecret,
      sso_private_key: privateKey,
      sso_public_key: publicKey,
    })

    if (!connection) {
      return { success: false, error: 'Failed to save connection' }
    }

    // Invalidate cache
    updateTag('yi-creative-connection')

    console.log('[Yi Creative] Manual connection successful:', {
      chapterId: targetChapterId,
      organizationId,
      userId: user.id,
    })

    return {
      success: true,
      connection,
    }
  } catch (error) {
    console.error('[Yi Creative] Manual connect error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Handle OAuth callback and create connection
 */
export async function handleYiCreativeOAuthCallback(
  code: string,
  stateString: string
): Promise<OAuthCallbackResult> {
  try {
    // Verify state
    const state = verifyOAuthState(stateString)
    if (!state) {
      return { success: false, error: 'Invalid or expired OAuth state' }
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(`${YI_CREATIVE_BASE_URL}/api/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: YI_CREATIVE_CLIENT_ID,
        redirect_uri: state.redirect_uri,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('[Yi Creative OAuth] Token exchange failed:', error)
      return { success: false, error: 'Failed to exchange authorization code' }
    }

    const tokens = await tokenResponse.json()

    // Get organization info
    const orgResponse = await fetch(`${YI_CREATIVE_BASE_URL}/api/organizations/me`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    if (!orgResponse.ok) {
      console.error('[Yi Creative OAuth] Failed to get organization info')
      return { success: false, error: 'Failed to get organization info' }
    }

    const organization = await orgResponse.json()

    // Generate RSA key pair for SSO
    const { privateKey, publicKey } = generateRSAKeyPair()

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex')

    // Get chapter name for registration
    const supabase = await createServerSupabaseClient()
    const { data: chapter } = await supabase
      .from('chapters')
      .select('name')
      .eq('id', state.chapter_id)
      .single()

    // Register public key with Yi Creative Studio
    const registerResponse = await fetch(`${YI_CREATIVE_BASE_URL}/api/oauth/register-keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chapter_id: state.chapter_id,
        chapter_name: chapter?.name || 'Unknown Chapter',
        public_key: publicKey,
        webhook_secret: webhookSecret,
      }),
    })

    if (!registerResponse.ok) {
      const error = await registerResponse.text()
      console.error('[Yi Creative OAuth] Failed to register keys:', error)
      // Continue anyway - keys can be shared manually
    } else {
      console.log('[Yi Creative OAuth] Public key registered successfully')
    }

    // Create connection in database
    const connection = await createYiCreativeConnection({
      chapter_id: state.chapter_id,
      organization_id: organization.id,
      organization_name: organization.name,
      connected_by: state.user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : undefined,
      webhook_secret: webhookSecret,
      sso_private_key: privateKey,
      sso_public_key: publicKey,
    })

    if (!connection) {
      return { success: false, error: 'Failed to save connection' }
    }

    // Invalidate cache
    updateTag('yi-creative-connection')

    return {
      success: true,
      connection,
    }
  } catch (error) {
    console.error('[Yi Creative OAuth] Callback error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Disconnect from Yi Creative Studio
 * @param chapterId - Optional chapter ID (required for National Admin who select chapter from dropdown)
 */
export async function disconnectYiCreativeAction(chapterId?: string): Promise<DisconnectResult> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if National Admin
    const [{ data: isNationalAdmin }, { data: hierarchyLevel }] = await Promise.all([
      supabase.rpc('is_national_admin'),
      supabase.rpc('get_user_hierarchy_level', { p_user_id: user.id }),
    ])

    // Determine the chapter to disconnect
    let targetChapterId: string

    if (isNationalAdmin && chapterId) {
      // National Admin using the chapter from dropdown
      targetChapterId = chapterId
    } else {
      // Regular user - get from members table
      const { data: member } = await supabase
        .from('members')
        .select('chapter_id')
        .eq('id', user.id)
        .single()

      if (!member?.chapter_id) {
        return { success: false, error: 'No chapter assigned' }
      }
      targetChapterId = member.chapter_id

      // For non-National Admin, verify they can only disconnect their own chapter
      if (chapterId && chapterId !== member.chapter_id) {
        return { success: false, error: 'Cannot disconnect a different chapter' }
      }
    }

    // Check permission (National Admin or Chair+ required)
    if (!isNationalAdmin && (hierarchyLevel as number) < 4) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Disconnect
    const success = await disconnectYiCreative(targetChapterId)

    if (success) {
      updateTag('yi-creative-connection')
    }

    return { success }
  } catch (error) {
    console.error('[Yi Creative] Disconnect error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Reconnect to Yi Creative (for expired connections)
 * @param chapterId - Optional chapter ID (required for National Admin who select chapter from dropdown)
 */
export async function reconnectYiCreativeAction(chapterId?: string): Promise<InitiateConnectResult> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if National Admin
    const { data: isNationalAdmin } = await supabase.rpc('is_national_admin')

    // Determine the chapter
    let targetChapterId: string

    if (isNationalAdmin && chapterId) {
      targetChapterId = chapterId
    } else {
      const { data: member } = await supabase
        .from('members')
        .select('chapter_id')
        .eq('id', user.id)
        .single()

      if (!member?.chapter_id) {
        return { success: false, error: 'No chapter assigned' }
      }
      targetChapterId = member.chapter_id
    }

    // Delete existing connection
    await deleteYiCreativeConnection(targetChapterId)

    // Initiate new connection
    return initiateYiCreativeConnect(targetChapterId)
  } catch (error) {
    console.error('[Yi Creative] Reconnect error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get public key for sharing with Yi Creative team
 * @param chapterId - Optional chapter ID (required for National Admin who select chapter from dropdown)
 */
export async function getYiCreativePublicKey(chapterId?: string): Promise<{ success: boolean; publicKey?: string; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if National Admin
    const { data: isNationalAdmin } = await supabase.rpc('is_national_admin')

    // Determine the chapter
    let targetChapterId: string

    if (isNationalAdmin && chapterId) {
      targetChapterId = chapterId
    } else {
      const { data: member } = await supabase
        .from('members')
        .select('chapter_id')
        .eq('id', user.id)
        .single()

      if (!member?.chapter_id) {
        return { success: false, error: 'No chapter assigned' }
      }
      targetChapterId = member.chapter_id
    }

    const connection = await getChapterYiCreativeConnection(targetChapterId)

    if (!connection?.sso_public_key) {
      return { success: false, error: 'Not connected to Yi Creative Studio' }
    }

    return {
      success: true,
      publicKey: connection.sso_public_key,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
