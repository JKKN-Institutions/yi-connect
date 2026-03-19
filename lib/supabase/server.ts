/**
 * Supabase Server Client
 *
 * This client is used in Server Components, Server Actions, and Route Handlers.
 * It handles cookie-based authentication for server-side operations.
 *
 * Usage:
 * ```typescript
 * import { createServerSupabaseClient } from '@/lib/supabase/server'
 *
 * export async function getProducts() {
 *   const supabase = await createServerSupabaseClient()
 *   const { data, error } = await supabase.from('products').select('*')
 *   return data
 * }
 * ```
 */

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Admin Supabase Client (Service Role)
 *
 * CAUTION: This client has admin privileges and bypasses RLS.
 * Only use for operations that require admin access.
 *
 * Usage:
 * ```typescript
 * const supabase = createAdminSupabaseClient()
 * // Use with caution!
 * ```
 */
export function createAdminSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    console.error('[createAdminSupabaseClient] SUPABASE_SERVICE_ROLE_KEY is not set!')
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is missing')
  }

  // Don't log the full key, just verify it exists and show metadata
  console.log('[createAdminSupabaseClient] Service role key loaded:', {
    length: serviceRoleKey.length,
    prefix: serviceRoleKey.substring(0, 20) + '...',
    isValid: serviceRoleKey.length > 0
  })

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Alias for compatibility
export { createServerSupabaseClient as createClient }
