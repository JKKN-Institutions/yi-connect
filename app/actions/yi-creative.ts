/**
 * Yi Creative Studio Server Actions
 *
 * Server actions for integrating with Yi Creative Studio.
 */

'use server'

import { requireAuth } from '@/lib/auth'
import { createYiCreativeSSOSession, isYiCreativeSSOEnabled, isYiCreativeSSOEnabledForChapter } from '@/lib/sso/yi-creative'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// ============================================================================
// Types
// ============================================================================

export interface CreatePosterResult {
  success: boolean
  redirect_url?: string
  error?: string
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Generate SSO token and redirect to Yi Creative for poster creation
 *
 * @param eventId - Optional event ID for context
 * @param redirectTo - Optional path to redirect to after SSO
 */
export async function redirectToYiCreative(
  eventId?: string,
  redirectTo?: string
): Promise<CreatePosterResult> {
  try {
    // Require authentication
    const user = await requireAuth()

    // Get event's chapter_id if eventId is provided
    let chapterId: string | undefined
    if (eventId) {
      const supabase = await createServerSupabaseClient()
      const { data: event } = await supabase
        .from('events')
        .select('chapter_id')
        .eq('id', eventId)
        .single()

      chapterId = event?.chapter_id || undefined
      console.log('[Yi Creative] Event chapter_id:', chapterId)
    }

    // Check if SSO is enabled (either via env var or chapter-specific config)
    const ssoEnabled = chapterId
      ? await isYiCreativeSSOEnabledForChapter(chapterId)
      : isYiCreativeSSOEnabled()

    if (!ssoEnabled) {
      return {
        success: false,
        error: 'Yi Creative SSO is not configured. Please connect Yi Creative Studio in Settings > Integrations.',
      }
    }

    // Generate SSO session with the event's chapter_id
    const result = await createYiCreativeSSOSession(user.id, {
      event_id: eventId,
      redirect_to: redirectTo,
      chapter_id: chapterId,  // Pass the event's chapter for SSO config lookup
    })

    if (!result.success || !result.redirect_url) {
      return {
        success: false,
        error: result.error || 'Failed to generate SSO token',
      }
    }

    return {
      success: true,
      redirect_url: result.redirect_url,
    }
  } catch (error) {
    console.error('[Yi Creative] SSO redirect error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    }
  }
}

/**
 * Server action that directly redirects to Yi Creative
 *
 * Use this in forms or server components that need immediate redirect.
 *
 * @param eventId - Optional event ID for context
 */
export async function goToYiCreative(eventId?: string): Promise<void> {
  const result = await redirectToYiCreative(eventId)

  if (result.success && result.redirect_url) {
    redirect(result.redirect_url)
  } else {
    // Redirect to error page with message
    const errorMessage = encodeURIComponent(result.error || 'Failed to connect to Yi Creative')
    redirect(`/error?message=${errorMessage}`)
  }
}

/**
 * Check if Yi Creative integration is available for a specific chapter
 *
 * @param chapterId - Optional chapter ID to check for chapter-specific config
 */
export async function isYiCreativeAvailable(chapterId?: string): Promise<boolean> {
  if (chapterId) {
    return isYiCreativeSSOEnabledForChapter(chapterId)
  }
  return isYiCreativeSSOEnabled()
}
