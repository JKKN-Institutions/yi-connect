/**
 * Coordinator Authentication Actions
 *
 * Server actions for coordinator login/logout.
 */

'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

interface LoginInput {
  email: string
  password: string
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function loginCoordinator(
  input: LoginInput
): Promise<ActionResult<{ coordinatorId: string }>> {
  try {
    const supabase = await createClient()

    // Find coordinator by email
    const { data: coordinator, error } = await supabase
      .from('stakeholder_coordinators')
      .select('id, password_hash, status, requires_password_change')
      .eq('email', input.email.toLowerCase())
      .single()

    if (error || !coordinator) {
      return { success: false, error: 'Invalid credentials' }
    }

    if (coordinator.status !== 'active') {
      return { success: false, error: 'Account is not active' }
    }

    // Verify password
    const hashedPassword = hashPassword(input.password)
    if (hashedPassword !== coordinator.password_hash) {
      return { success: false, error: 'Invalid credentials' }
    }

    // Update last login
    await supabase
      .from('stakeholder_coordinators')
      .update({ last_login: new Date().toISOString() })
      .eq('id', coordinator.id)

    // Set session cookies
    const cookieStore = await cookies()

    cookieStore.set('coordinator_id', coordinator.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    cookieStore.set('coordinator_email', input.email.toLowerCase(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return {
      success: true,
      data: {
        coordinatorId: coordinator.id,
      },
    }
  } catch (error) {
    console.error('Coordinator login error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    }
  }
}

export async function logoutCoordinator(): Promise<ActionResult> {
  try {
    const cookieStore = await cookies()

    cookieStore.delete('coordinator_id')
    cookieStore.delete('coordinator_email')

    return { success: true }
  } catch (error) {
    console.error('Coordinator logout error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Logout failed',
    }
  }
}

export async function getCoordinatorSession() {
  const cookieStore = await cookies()
  const coordinatorId = cookieStore.get('coordinator_id')?.value
  const coordinatorEmail = cookieStore.get('coordinator_email')?.value

  if (!coordinatorId || !coordinatorEmail) {
    return null
  }

  return {
    id: coordinatorId,
    email: coordinatorEmail,
  }
}

export async function changeCoordinatorPassword(
  input: { currentPassword: string; newPassword: string }
): Promise<ActionResult> {
  try {
    const session = await getCoordinatorSession()
    if (!session) {
      return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    // Get current password hash
    const { data: coordinator, error: fetchError } = await supabase
      .from('stakeholder_coordinators')
      .select('password_hash')
      .eq('id', session.id)
      .single()

    if (fetchError || !coordinator) {
      return { success: false, error: 'Failed to verify account' }
    }

    // Verify current password
    const currentHash = hashPassword(input.currentPassword)
    if (currentHash !== coordinator.password_hash) {
      return { success: false, error: 'Current password is incorrect' }
    }

    // Update password
    const newHash = hashPassword(input.newPassword)
    const { error: updateError } = await supabase
      .from('stakeholder_coordinators')
      .update({
        password_hash: newHash,
        requires_password_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    if (updateError) {
      throw new Error(`Failed to update password: ${updateError.message}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Change password error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change password',
    }
  }
}
