'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

/**
 * Fixes demo user roles by assigning the correct roles based on approved_emails table.
 * This is a one-time fix for demo users who were created before the role assignment
 * was added to the handle_new_user trigger.
 */
export async function fixDemoUserRoles(): Promise<{
  success: boolean
  message: string
  fixed: { email: string; role: string }[]
  errors: string[]
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      message: 'Missing Supabase credentials',
      fixed: [],
      errors: ['SUPABASE_SERVICE_ROLE_KEY not configured'],
    }
  }

  // Create admin client with service role
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const errors: string[] = []
  const fixed: { email: string; role: string }[] = []

  // Demo accounts to fix
  const demoAccounts = [
    { email: 'demo-chair@yi-demo.com', roleName: 'Chair' },
    { email: 'demo-cochair@yi-demo.com', roleName: 'Co-Chair' },
    { email: 'demo-ec@yi-demo.com', roleName: 'EC Member' },
  ]

  for (const account of demoAccounts) {
    try {
      // Get the user's profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', account.email)
        .single()

      if (profileError || !profile) {
        errors.push(`${account.email}: User not found`)
        continue
      }

      // Get the role ID
      const { data: role, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .eq('name', account.roleName)
        .single()

      if (roleError || !role) {
        errors.push(`${account.email}: Role '${account.roleName}' not found`)
        continue
      }

      // Check if user already has this role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.id)
        .eq('role_id', role.id)
        .single()

      if (existingRole) {
        // Already has the role, skip
        continue
      }

      // Remove any existing roles for this user (clean slate)
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', profile.id)

      // Assign the correct role
      const { error: insertError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: profile.id,
          role_id: role.id,
        })

      if (insertError) {
        errors.push(`${account.email}: Failed to assign role - ${insertError.message}`)
        continue
      }

      fixed.push({ email: account.email, role: account.roleName })
    } catch (error) {
      errors.push(
        `${account.email}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  // Revalidate paths that might be affected
  revalidatePath('/member-requests')
  revalidatePath('/admin/users')
  revalidatePath('/dashboard')

  return {
    success: errors.length === 0,
    message:
      fixed.length > 0
        ? `Fixed roles for ${fixed.length} demo users`
        : 'No roles needed fixing',
    fixed,
    errors,
  }
}

/**
 * Debug function to check current role assignments for demo users
 */
export async function checkDemoUserRoles(): Promise<{
  success: boolean
  users: { email: string; roles: string[] }[]
  errors: string[]
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      users: [],
      errors: ['SUPABASE_SERVICE_ROLE_KEY not configured'],
    }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const errors: string[] = []
  const users: { email: string; roles: string[] }[] = []

  const demoEmails = [
    'demo-chair@yi-demo.com',
    'demo-cochair@yi-demo.com',
    'demo-ec@yi-demo.com',
  ]

  for (const email of demoEmails) {
    try {
      // Get user profile
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .single()

      if (!profile) {
        users.push({ email, roles: ['USER NOT FOUND'] })
        continue
      }

      // Get user's roles via RPC
      const { data: roleData, error: roleError } = await supabaseAdmin.rpc(
        'get_user_roles_detailed',
        { p_user_id: profile.id }
      )

      if (roleError) {
        errors.push(`${email}: ${roleError.message}`)
        users.push({ email, roles: ['ERROR FETCHING ROLES'] })
        continue
      }

      const roleNames = roleData?.map((r: { role_name: string }) => r.role_name) || []
      users.push({ email, roles: roleNames.length > 0 ? roleNames : ['NO ROLES'] })
    } catch (error) {
      errors.push(`${email}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return {
    success: errors.length === 0,
    users,
    errors,
  }
}
