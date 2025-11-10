/**
 * Authentication Server Actions
 *
 * Server actions for authentication operations.
 */

'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { loginSchema, signupSchema, forgotPasswordSchema } from '@/lib/validations/auth'
import type { FormState } from '@/types'

/**
 * Login action
 */
export async function login(prevState: FormState, formData: FormData): Promise<FormState> {
  const validation = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check your credentials.',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: validation.data.email,
    password: validation.data.password,
  })

  if (error) {
    return {
      message: 'Invalid email or password. Please try again.',
    }
  }

  redirect('/dashboard')
}

/**
 * Signup action
 */
export async function signup(prevState: FormState, formData: FormData): Promise<FormState> {
  const validation = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid input. Please check the form.',
    }
  }

  const supabase = await createServerSupabaseClient()

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: validation.data.email,
    password: validation.data.password,
    options: {
      data: {
        full_name: validation.data.fullName,
        phone: validation.data.phone,
      },
    },
  })

  if (authError) {
    return {
      message: authError.message || 'Failed to create account. Please try again.',
    }
  }

  if (!authData.user) {
    return {
      message: 'Failed to create account. Please try again.',
    }
  }

  // Note: Profile is automatically created by the database trigger 'on_auth_user_created'
  // when a new user is inserted into auth.users. The trigger extracts user metadata
  // (full_name, phone, avatar_url) from raw_user_meta_data and creates the profile.

  // Check if email confirmation is required
  if (authData.user && !authData.session) {
    return {
      success: true,
      message: 'Account created! Please check your email to verify your account.',
    }
  }

  redirect('/dashboard')
}

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
