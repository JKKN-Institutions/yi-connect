/**
 * Email Service for Yi Connect
 *
 * Centralized email sending using Resend
 * All notification emails should go through this service
 */

import { Resend } from 'resend'

// Lazy-initialize Resend client to avoid build-time errors
let resend: Resend | null = null

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'Yi Connect <noreply@yi-connect.org>'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send a single email
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const client = getResendClient()
  if (!client) {
    console.warn('[Email] RESEND_API_KEY not configured, skipping email')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    })

    if (error) {
      console.error('[Email] Send failed:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('[Email] Exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send batch emails (up to 100)
 */
export async function sendBatchEmails(
  emails: EmailOptions[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const email of emails) {
    const result = await sendEmail(email)
    if (result.success) {
      sent++
    } else {
      failed++
    }
  }

  return { sent, failed }
}
