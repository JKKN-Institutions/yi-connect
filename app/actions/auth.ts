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
