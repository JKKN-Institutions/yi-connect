import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Debug endpoint to check RPC function names and test both variants
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const email = url.searchParams.get('email') || 'demo-ec@yi-demo.com'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 500 })
  }

  // Create both clients
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Get user profile
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({
      error: `User not found: ${email}`,
      profileError: profileError?.message
    }, { status: 404 })
  }

  const results: Record<string, unknown> = {
    user: { id: profile.id, email: profile.email }
  }

  // Test get_user_roles_detailed with admin client
  const { data: detailedAdmin, error: detailedAdminError } = await adminClient.rpc(
    'get_user_roles_detailed',
    { p_user_id: profile.id }
  )
  results.get_user_roles_detailed_admin = detailedAdmin || { error: detailedAdminError?.message }

  // Test get_user_roles with admin client
  const { data: rolesAdmin, error: rolesAdminError } = await adminClient.rpc(
    'get_user_roles',
    { p_user_id: profile.id }
  )
  results.get_user_roles_admin = rolesAdmin || { error: rolesAdminError?.message }

  // Test get_user_roles_detailed with anon client (simulating what requireRole does)
  const { data: detailedAnon, error: detailedAnonError } = await anonClient.rpc(
    'get_user_roles_detailed',
    { p_user_id: profile.id }
  )
  results.get_user_roles_detailed_anon = detailedAnon || { error: detailedAnonError?.message }

  // Test get_user_roles with anon client
  const { data: rolesAnon, error: rolesAnonError } = await anonClient.rpc(
    'get_user_roles',
    { p_user_id: profile.id }
  )
  results.get_user_roles_anon = rolesAnon || { error: rolesAnonError?.message }

  // Also check user_roles table directly
  const { data: userRolesData, error: userRolesError } = await adminClient
    .from('user_roles')
    .select('*, roles(*)')
    .eq('user_id', profile.id)

  results.user_roles_table = userRolesData || { error: userRolesError?.message }

  return NextResponse.json(results)
}
