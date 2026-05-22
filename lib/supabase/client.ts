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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Phase B rewire 2026-05-22: yi-connect now lives in the shared Supabase
      // project (bkmpbcoxbjyafieabxao) under the `yi_connect` schema. Setting
      // db.schema makes all .from('X') calls auto-route to yi_connect.X without
      // touching 8,777 existing call sites. For cross-schema queries (e.g.
      // shared chapter list), use .schema('yi').from('chapters') explicitly.
      db: { schema: 'yi_connect' },
    }
  )
}
