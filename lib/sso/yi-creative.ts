/**
 * Yi Creative Studio SSO Integration
 *
 * Generates signed JWT tokens for Single Sign-On to Yi Creative Studio.
 * Yi Connect acts as the Identity Provider (IdP), Yi Creative as Service Provider (SP).
 *
 * Token Flow:
 * 1. User clicks "Create Poster" in Yi Connect
 * 2. Yi Connect generates signed JWT with user/chapter/role info
 * 3. User is redirected to Yi Creative with token
 * 4. Yi Creative validates token and creates session
 */

import * as jose from 'jose'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ============================================================================
// Types
// ============================================================================

type PrivateKey = Awaited<ReturnType<typeof jose.importPKCS8>>

/**
 * Event data to include in SSO token for poster creation
 * Aligned with ExternalEvent schema from Yi Creative Studio
 */
export interface YiCreativeEventData {
  /** Event ID */
  id: string
  /** Event title/name */
  name: string
  /** ISO date only: "2026-02-15" */
  date: string
  /** 24h format: "10:00" */
  startTime: string
  /** 24h format: "17:00" */
  endTime: string
  /** Venue name only */
  venue: string | null
  /** Venue address (camelCase to match ExternalEvent) */
  venueAddress: string | null
  /** City */
  city: string | null
  /** Event description */
  description: string | null
  /** Banner image URL (camelCase) */
  bannerImageUrl: string | null
  /** Event type/category (camelCase) */
  eventType: string
  /** Chapter ID (camelCase) */
  chapterId: string
  /** Chapter name (camelCase) */
  chapterName: string
  /** Chapter location (camelCase) */
  chapterLocation: string
  /** Virtual event flag (camelCase) */
  isVirtual: boolean
  /** Virtual meeting link (camelCase) */
  virtualMeetingLink?: string | null
}

export interface YiCreativeSSOPayload {
  /** Yi Connect user UUID */
  sub: string
  /** User's email */
  email: string
  /** User's full name */
  name: string
  /** User's avatar URL */
  avatar_url?: string
  /** User's chapter memberships with roles */
  chapters: Array<{
    chapter_id: string
    chapter_name: string
    chapter_location: string
    role: string
    hierarchy_level: number
  }>
  /** Optional: Event ID if coming from "Create Poster" button */
  event_id?: string
  /** Optional: Full event data for poster creation */
  event_data?: YiCreativeEventData
  /** Optional: Where to redirect after SSO */
  redirect_to?: string
}

export interface SSOTokenResult {
  success: boolean
  token?: string
  redirect_url?: string
  error?: string
}

// ============================================================================
// Configuration
// ============================================================================

const YI_CREATIVE_SSO_URL = process.env.YI_CREATIVE_SSO_URL || 'https://yi-creative-studio.vercel.app/api/auth/sso'
const YI_CREATIVE_SSO_PRIVATE_KEY = process.env.YI_CREATIVE_SSO_PRIVATE_KEY

// Token expiry (5 minutes)
const TOKEN_EXPIRY = '5m'

// ============================================================================
// Private Key Handling
// ============================================================================

let cachedPrivateKey: PrivateKey | null = null

/**
 * Get the RSA private key for signing tokens
 */
async function getPrivateKey(): Promise<PrivateKey> {
  if (cachedPrivateKey) {
    return cachedPrivateKey
  }

  if (!YI_CREATIVE_SSO_PRIVATE_KEY) {
    throw new Error('YI_CREATIVE_SSO_PRIVATE_KEY environment variable is not set')
  }

  // Decode base64 to PEM
  const pemKey = Buffer.from(YI_CREATIVE_SSO_PRIVATE_KEY, 'base64').toString('utf-8')

  // Import the private key
  cachedPrivateKey = await jose.importPKCS8(pemKey, 'RS256')

  return cachedPrivateKey
}

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate a signed SSO token for Yi Creative
 *
 * @param payload - User and chapter information
 * @returns Signed JWT token
 */
export async function generateSSOToken(payload: YiCreativeSSOPayload): Promise<string> {
  const privateKey = await getPrivateKey()

  const jwt = await new jose.SignJWT({
    ...payload,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('yi-connect')
    .setAudience('yi-creative')
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(privateKey)

  return jwt
}

/**
 * Generate SSO redirect URL with token
 *
 * @param payload - User and chapter information
 * @returns Full redirect URL with token
 */
export async function generateSSORedirectUrl(payload: YiCreativeSSOPayload): Promise<string> {
  const token = await generateSSOToken(payload)
  const url = new URL(YI_CREATIVE_SSO_URL)
  url.searchParams.set('token', token)
  return url.toString()
}

// ============================================================================
// Event Data Fetching
// ============================================================================

/**
 * Fetch event data for SSO token
 *
 * @param supabase - Supabase client instance
 * @param eventId - Event ID to fetch
 * @returns Event data or null if not found
 */
async function getEventDataForSSO(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  eventId: string
): Promise<YiCreativeEventData | null> {
  const { data: event, error } = await supabase
    .from('events')
    .select(`
      id,
      title,
      description,
      category,
      start_date,
      end_date,
      venue_id,
      venue_address,
      banner_image_url,
      is_virtual,
      virtual_meeting_link,
      chapter_id,
      venue:venues (
        id,
        name,
        city,
        address
      ),
      chapter:chapters (
        id,
        name,
        location
      )
    `)
    .eq('id', eventId)
    .single()

  if (error || !event) {
    console.error('[Yi Creative SSO] Failed to fetch event:', error?.message)
    return null
  }

  // Handle potential array responses from Supabase joins
  const venue = Array.isArray(event.venue) ? event.venue[0] : event.venue
  const chapter = Array.isArray(event.chapter) ? event.chapter[0] : event.chapter

  // Format date as ISO date only (YYYY-MM-DD)
  const startDate = new Date(event.start_date)
  const endDate = new Date(event.end_date)

  // Format time in 24h format (HH:MM)
  const formatTime24h = (date: Date): string => {
    const hours = date.getUTCHours().toString().padStart(2, '0')
    const minutes = date.getUTCMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  return {
    id: event.id,
    name: event.title,
    // Extract date only from ISO timestamp
    date: event.start_date.split('T')[0],
    // Format times in 24h format
    startTime: formatTime24h(startDate),
    endTime: formatTime24h(endDate),
    // Venue name only (not concatenated with address)
    venue: venue?.name || null,
    // Venue address as separate field
    venueAddress: event.venue_address || venue?.address || null,
    city: venue?.city || null,
    description: event.description,
    bannerImageUrl: event.banner_image_url,
    eventType: event.category,
    chapterId: event.chapter_id,
    chapterName: chapter?.name || '',
    chapterLocation: chapter?.location || '',
    isVirtual: event.is_virtual,
    virtualMeetingLink: event.virtual_meeting_link,
  }
}

// ============================================================================
// User Data Fetching
// ============================================================================

/**
 * Fetch user's SSO payload from database
 *
 * Gathers all necessary user information for SSO token generation.
 *
 * @param userId - Yi Connect user ID
 * @param options - Optional event_id or redirect_to
 * @returns SSO payload or null if user not found
 */
export async function getUserSSOPayload(
  userId: string,
  options?: {
    event_id?: string
    redirect_to?: string
  }
): Promise<YiCreativeSSOPayload | null> {
  const supabase = await createServerSupabaseClient()

  // Fetch user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    console.error('[Yi Creative SSO] Failed to fetch profile:', profileError?.message)
    return null
  }

  // Fetch user's chapter memberships with roles
  const { data: memberships, error: membershipError } = await supabase
    .from('members')
    .select(`
      chapter_id,
      chapter:chapters (
        id,
        name,
        location
      )
    `)
    .eq('id', userId)

  if (membershipError) {
    console.error('[Yi Creative SSO] Failed to fetch memberships:', membershipError.message)
  }

  // Fetch user's roles
  const { data: userRoles, error: rolesError } = await supabase.rpc('get_user_roles_detailed', {
    p_user_id: userId
  })

  if (rolesError) {
    console.error('[Yi Creative SSO] Failed to fetch roles:', rolesError.message)
  }

  // Get the highest role (for users with multiple roles)
  const highestRole = userRoles?.reduce((highest: { hierarchy_level: number; role_name: string } | null, role: { hierarchy_level: number; role_name: string }) => {
    if (!highest || role.hierarchy_level > highest.hierarchy_level) {
      return role
    }
    return highest
  }, null)

  // Build chapters array
  const chapters: YiCreativeSSOPayload['chapters'] = []

  if (memberships && memberships.length > 0) {
    for (const membership of memberships) {
      const chapter = Array.isArray(membership.chapter)
        ? membership.chapter[0]
        : membership.chapter

      if (chapter) {
        chapters.push({
          chapter_id: chapter.id,
          chapter_name: chapter.name,
          chapter_location: chapter.location || '',
          role: highestRole?.role_name?.toLowerCase().replace(/\s+/g, '_') || 'member',
          hierarchy_level: highestRole?.hierarchy_level || 1,
        })
      }
    }
  }

  // If no chapter memberships, use a default structure
  if (chapters.length === 0) {
    // Try to get chapter from the member record itself
    const { data: member } = await supabase
      .from('members')
      .select('chapter_id, chapter:chapters(id, name, location)')
      .eq('id', userId)
      .single()

    if (member?.chapter) {
      const chapter = Array.isArray(member.chapter) ? member.chapter[0] : member.chapter
      if (chapter) {
        chapters.push({
          chapter_id: chapter.id,
          chapter_name: chapter.name,
          chapter_location: chapter.location || '',
          role: highestRole?.role_name?.toLowerCase().replace(/\s+/g, '_') || 'member',
          hierarchy_level: highestRole?.hierarchy_level || 1,
        })
      }
    }
  }

  // Fetch event data if event_id is provided
  let eventData: YiCreativeEventData | null = null
  if (options?.event_id) {
    eventData = await getEventDataForSSO(supabase, options.event_id)
    if (eventData) {
      console.log('[Yi Creative SSO] Event data fetched:', eventData.name)
    }
  }

  return {
    sub: profile.id,
    email: profile.email,
    name: profile.full_name || profile.email.split('@')[0],
    avatar_url: profile.avatar_url || undefined,
    chapters,
    event_id: options?.event_id,
    event_data: eventData || undefined,
    redirect_to: options?.redirect_to,
  }
}

// ============================================================================
// Main SSO Function
// ============================================================================

/**
 * Generate SSO token and redirect URL for a user
 *
 * This is the main function to use for SSO. It:
 * 1. Fetches user data from database
 * 2. Generates signed JWT token
 * 3. Returns redirect URL with token
 *
 * @param userId - Yi Connect user ID
 * @param options - Optional event_id or redirect_to
 * @returns SSOTokenResult with redirect_url or error
 */
export async function createYiCreativeSSOSession(
  userId: string,
  options?: {
    event_id?: string
    redirect_to?: string
  }
): Promise<SSOTokenResult> {
  try {
    // Check if SSO is configured
    if (!YI_CREATIVE_SSO_PRIVATE_KEY) {
      return {
        success: false,
        error: 'Yi Creative SSO is not configured',
      }
    }

    // Get user's SSO payload
    const payload = await getUserSSOPayload(userId, options)
    if (!payload) {
      return {
        success: false,
        error: 'User not found or missing required data',
      }
    }

    // Generate token and redirect URL
    const token = await generateSSOToken(payload)
    const redirect_url = `${YI_CREATIVE_SSO_URL}?token=${encodeURIComponent(token)}`

    console.log('[Yi Creative SSO] Token generated for user:', userId)

    return {
      success: true,
      token,
      redirect_url,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Yi Creative SSO] Error:', message)
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Check if Yi Creative SSO is enabled
 */
export function isYiCreativeSSOEnabled(): boolean {
  return Boolean(YI_CREATIVE_SSO_PRIVATE_KEY)
}
