/**
 * Auth Data Layer
 *
 * Functions for getting current user and authentication state.
 */

import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Get the current authenticated user
 * Cached for the duration of the request using React cache()
 *
 * Note: We don't use 'use cache' directive here because auth data is dynamic
 * and relies on cookies(). React's cache() provides request-level deduplication.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
})

/**
 * Get the current user's session
 * Cached for the duration of the request using React cache()
 *
 * Note: We don't use 'use cache' directive here because session data is dynamic
 * and relies on cookies(). React's cache() provides request-level deduplication.
 */
export const getCurrentSession = cache(async () => {
  const supabase = await createClient()

  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !session) {
    return null
  }

  return session
})

/**
 * Check if user is authenticated
 * Cached for the duration of the request using React cache()
 *
 * Note: We don't use 'use cache' directive here because it depends on getCurrentUser()
 * which accesses dynamic cookies. React's cache() provides request-level deduplication.
 */
export const isAuthenticated = cache(async () => {
  const user = await getCurrentUser()
  return !!user
})
