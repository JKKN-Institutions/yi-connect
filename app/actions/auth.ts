/**
 * Authentication Server Actions
 *
 * Server actions for authentication operations.
 *
 * Note: Login is handled via Google OAuth only.
 * See components/auth/oauth-buttons.tsx for OAuth implementation.
 */

'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { forgotPasswordSchema } from '@/lib/validations/auth'
import type { FormState } from '@/types'

/**
 * Forgot password action
 */
export async function forgotPassword(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid email address.',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  })

  if (error) {
    return {
      message: 'Failed to send reset email. Please try again.',
    }
  }

  return {
    success: true,
    message: 'Password reset email sent! Please check your inbox.',
  }
}

/**
 * Sign out action
 */
export async function signOut() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Demo account emails (allowed for one-click login)
 */
const DEMO_ACCOUNTS = [
  'demo-chair@yi-demo.com',
  'demo-cochair@yi-demo.com',
  'demo-ec@yi-demo.com',
] as const

/**
 * Demo login action - allows one-click login for demo accounts
 *
 * This action is restricted to demo accounts only for security.
 * It uses the service role to sign in the user directly.
 */
export async function loginAsDemoUser(email: string): Promise<{
  success: boolean
  error?: string
}> {
  // Validate this is a demo account
  if (!DEMO_ACCOUNTS.includes(email as typeof DEMO_ACCOUNTS[number])) {
    return {
      success: false,
      error: 'Only demo accounts can use one-click login',
    }
  }

  const supabase = await createServerSupabaseClient()

  // Sign in with the demo account password
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: 'DemoMember2024!',
  })

  if (error) {
    console.error('Demo login error:', error)

    // If user doesn't exist, try to create them first
    if (error.message === 'Invalid login credentials') {
      const created = await ensureDemoUserExists(email)
      if (created) {
        // Retry login after creating user
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password: 'DemoMember2024!',
        })
        if (!retryError) {
          return { success: true }
        }
        return {
          success: false,
          error: retryError.message,
        }
      }
    }

    return {
      success: false,
      error: error.message,
    }
  }

  return { success: true }
}

/**
 * Ensure demo user exists in Supabase Auth
 * Creates the user if they don't exist using admin API
 */
async function ensureDemoUserExists(email: string): Promise<boolean> {
  const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
  const adminClient = createAdminSupabaseClient()

  try {
    // Try to create the demo user - will fail if already exists
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password: 'DemoMember2024!',
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: getDemoUserName(email),
        is_demo: true,
      },
    })

    if (error) {
      // User might already exist
      if (error.message.includes('already been registered') || error.message.includes('already exists')) {
        console.log('Demo user already exists:', email)
        return true
      }
      console.error('Failed to create demo user:', error)
      return false
    }

    console.log('Created demo user:', data.user?.email)
    return true
  } catch (err) {
    console.error('Error in ensureDemoUserExists:', err)
    return false
  }
}

/**
 * Get display name for demo user based on email
 */
function getDemoUserName(email: string): string {
  const names: Record<string, string> = {
    'demo-chair@yi-demo.com': 'Demo Chair',
    'demo-cochair@yi-demo.com': 'Demo Co-Chair',
    'demo-ec@yi-demo.com': 'Demo EC Member',
  }
  return names[email] || 'Demo User'
}
