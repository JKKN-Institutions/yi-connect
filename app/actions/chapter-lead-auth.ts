'use server'

/**
 * Chapter Lead Authentication Actions
 *
 * Server actions for sub-chapter lead authentication.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'
import { sendEmail } from '@/lib/email'
import { subChapterLeadPasswordResetEmail } from '@/lib/email/templates'

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

interface LoginInput {
  email: string
  password: string
}

/**
 * Authenticate chapter lead
 */
export async function loginChapterLead(
  input: LoginInput
): Promise<ActionResult<{ leadId: string; requiresPasswordChange: boolean }>> {
  const supabase = await createClient()

  // Find lead by email
  const { data: lead, error } = await supabase
    .from('sub_chapter_leads')
    .select('id, password_hash, status, requires_password_change, sub_chapter_id')
    .eq('email', input.email.toLowerCase())
    .single()

  if (error || !lead) {
    return { success: false, error: 'Invalid email or password' }
  }

  // Check status
  if (lead.status === 'inactive') {
    return { success: false, error: 'Your account has been deactivated' }
  }

  if (lead.status === 'pending') {
    return { success: false, error: 'Your account is pending approval' }
  }

  // Verify password
  const isValid = await bcrypt.compare(input.password, lead.password_hash)
  if (!isValid) {
    return { success: false, error: 'Invalid email or password' }
  }

  // Update last login
  await supabase
    .from('sub_chapter_leads')
    .update({
      last_login_at: new Date().toISOString(),
      login_count: supabase.rpc('increment', { row_count: 1 }),
    })
    .eq('id', lead.id)

  // Set session cookie
  const cookieStore = await cookies()
  cookieStore.set('chapter_lead_id', lead.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  })

  cookieStore.set('sub_chapter_id', lead.sub_chapter_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return {
    success: true,
    data: {
      leadId: lead.id,
      requiresPasswordChange: lead.requires_password_change,
    },
  }
}

/**
 * Logout chapter lead
 */
export async function logoutChapterLead(): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.delete('chapter_lead_id')
  cookieStore.delete('sub_chapter_id')

  redirect('/chapter-lead/login')
}

/**
 * Change password (first login or manual change)
 */
export async function changeChapterLeadPassword(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  const cookieStore = await cookies()
  const leadId = cookieStore.get('chapter_lead_id')?.value

  if (!leadId) {
    return { success: false, error: 'Not authenticated' }
  }

  const supabase = await createClient()

  // Get current password hash
  const { data: lead, error: fetchError } = await supabase
    .from('sub_chapter_leads')
    .select('password_hash')
    .eq('id', leadId)
    .single()

  if (fetchError || !lead) {
    return { success: false, error: 'Lead not found' }
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, lead.password_hash)
  if (!isValid) {
    return { success: false, error: 'Current password is incorrect' }
  }

  // Validate new password
  if (newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' }
  }

  // Hash and update new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10)

  const { error } = await supabase
    .from('sub_chapter_leads')
    .update({
      password_hash: newPasswordHash,
      requires_password_change: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (error) {
    console.error('Error changing password:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Get current chapter lead session
 */
export async function getChapterLeadSession(): Promise<{
  leadId: string
  subChapterId: string
} | null> {
  const cookieStore = await cookies()
  const leadId = cookieStore.get('chapter_lead_id')?.value
  const subChapterId = cookieStore.get('sub_chapter_id')?.value

  if (!leadId || !subChapterId) {
    return null
  }

  return { leadId, subChapterId }
}

/**
 * Reset password (admin action)
 */
export async function resetChapterLeadPassword(
  leadId: string
): Promise<ActionResult<{ temporaryPassword: string }>> {
  const supabase = await createClient()

  // Fetch lead details for email
  const { data: lead, error: fetchError } = await supabase
    .from('sub_chapter_leads')
    .select(`
      id,
      full_name,
      email,
      sub_chapter:sub_chapters(name)
    `)
    .eq('id', leadId)
    .single()

  if (fetchError || !lead) {
    console.error('Error fetching lead:', fetchError)
    return { success: false, error: 'Lead not found' }
  }

  // Generate new temporary password
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let temporaryPassword = ''
  for (let i = 0; i < 12; i++) {
    temporaryPassword += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  const passwordHash = await bcrypt.hash(temporaryPassword, 10)

  const { error } = await supabase
    .from('sub_chapter_leads')
    .update({
      password_hash: passwordHash,
      requires_password_change: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (error) {
    console.error('Error resetting password:', error)
    return { success: false, error: error.message }
  }

  // Send email with temporary password
  const subChapterData = lead.sub_chapter as unknown as { name: string } | { name: string }[] | null
  const subChapterName = Array.isArray(subChapterData)
    ? subChapterData[0]?.name || 'Sub-Chapter'
    : subChapterData?.name || 'Sub-Chapter'
  const loginLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app'}/chapter-lead/login`

  const emailTemplate = subChapterLeadPasswordResetEmail({
    leadName: lead.full_name,
    subChapterName,
    email: lead.email,
    temporaryPassword,
    loginLink,
  })

  const emailResult = await sendEmail({
    to: lead.email,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
  })

  if (!emailResult.success) {
    console.warn('[ChapterLeadAuth] Failed to send password reset email:', emailResult.error)
    // Still return success since password was reset - email is secondary
  }

  return { success: true, data: { temporaryPassword } }
}
