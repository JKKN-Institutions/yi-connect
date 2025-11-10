/**
 * Supabase Client-Side Client
 *
 * This client is used in Client Components for browser-side operations.
 * It handles browser cookie-based authentication.
 *
 * Usage:
 * ```typescript
 * 'use client'
 *
 * import { createBrowserSupabaseClient } from '@/lib/supabase/client'
 *
 * export function MyComponent() {
 *   const supabase = createBrowserSupabaseClient()
 *   // Use in client components
 * }
 * ```
 */

import { createBrowserClient } from '@supabase/ssr'

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
