import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Diagnostic endpoint to debug the exact requireRole flow
 * This mimics what requireRole does but returns debug info instead of redirecting
 */
export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    // Step 1: Get cookies (to see if auth cookies exist)
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    results.cookies = allCookies.map(c => ({ name: c.name, hasValue: !!c.value }))

    // Step 2: Create supabase client (same as requireRole)
    const supabase = await createServerSupabaseClient()

    // Step 3: Get user (same as getCurrentUser)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      results.authError = userError.message
    }

    if (!user) {
      results.user = null
      results.diagnosis = 'No authenticated user - would redirect to /login'
      return NextResponse.json(results)
    }

    results.user = {
      id: user.id,
      email: user.email
    }

    // Step 4: Call RPC function (same as requireRole)
    const { data: userRoles, error: rolesError } = await supabase.rpc('get_user_roles_detailed', {
      p_user_id: user.id
    })

    if (rolesError) {
      results.rolesError = rolesError.message
      results.diagnosis = 'RPC error - would redirect to /unauthorized'
      return NextResponse.json(results)
    }

    results.userRoles = userRoles
    results.userRoleNames = userRoles?.map((ur: { role_name: string }) => ur.role_name) || []

    // Step 5: Check against member-requests allowed roles
    const allowedRoles = ['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']
    const userRoleNames = userRoles?.map((ur: { role_name: string }) => ur.role_name) || []
    const hasRequiredRole = allowedRoles.some((role: string) => userRoleNames.includes(role))

    results.allowedRoles = allowedRoles
    results.hasRequiredRole = hasRequiredRole

    if (!hasRequiredRole) {
      results.diagnosis = `No matching role found - would redirect to /unauthorized. User roles: [${userRoleNames.join(', ')}]`
    } else {
      results.diagnosis = `Access GRANTED - user has role: ${userRoleNames.find((r: string) => allowedRoles.includes(r))}`
    }

  } catch (error) {
    results.error = error instanceof Error ? error.message : 'Unknown error'
    results.stack = error instanceof Error ? error.stack : undefined
  }

  return NextResponse.json(results)
}
