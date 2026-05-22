/**
 * Sponsor Leads Server Actions (Stutzee Feature 3D)
 *
 * Server Actions for lead capture on behalf of sponsors at events.
 * Role gate: EC Member+ (hierarchy_level >= 2).
 * Notifies sponsor contact_email via Resend on capture.
 */

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import { sendEmail } from '@/lib/email'
import { resolveTicketToken } from '@/lib/data/sponsor-leads'
import {
  createSponsorLeadSchema,
  updateSponsorLeadSchema,
  type CreateSponsorLeadSchema,
  type UpdateSponsorLeadSchema,
} from '@/lib/validations/sponsor-lead'
import type { InterestLevel } from '@/types/sponsor-lead'

type ActionResponse<T = void> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * EC Member+ role gate. Returns the user if permitted, otherwise error response.
 */
async function ensureEcMemberOrAbove(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const supabase = await createClient()
  const { data: level } = await supabase.rpc('get_user_hierarchy_level', {
    p_user_id: user.id,
  })

  if (!level || Number(level) < 2) {
    return {
      ok: false,
      error: 'EC Member or higher is required to capture sponsor leads',
    }
  }
  return { ok: true, userId: user.id }
}

function clean<T extends Record<string, any>>(obj: T): T {
  const out = { ...obj } as Record<string, any>
  for (const key of Object.keys(out)) {
    if (out[key] === '' || out[key] === undefined) {
      out[key] = null
    }
  }
  return out as T
}

const INTEREST_LABELS: Record<InterestLevel, string> = {
  hot: 'Hot (high intent)',
  warm: 'Warm',
  medium: 'Medium',
  cold: 'Cold',
}

function leadCapturedEmail(args: {
  sponsorName: string
  eventTitle: string
  fullName: string
  email?: string | null
  phone?: string | null
  company?: string | null
  designation?: string | null
  interestLevel: InterestLevel
  interestAreas?: string[] | null
  notes?: string | null
  followUpBy?: string | null
}) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app'

  const rows: string[] = []
  const add = (label: string, value?: string | null) => {
    if (!value) return
    rows.push(
      `<tr><td style="padding:6px 10px;color:#64748b;font-size:13px;">${label}</td><td style="padding:6px 10px;color:#0f172a;font-size:14px;"><strong>${value}</strong></td></tr>`
    )
  }
  add('Name', args.fullName)
  add('Company', args.company)
  add('Designation', args.designation)
  add('Email', args.email)
  add('Phone', args.phone)
  add('Interest', INTEREST_LABELS[args.interestLevel])
  add(
    'Interest areas',
    args.interestAreas && args.interestAreas.length > 0
      ? args.interestAreas.join(', ')
      : null
  )
  add('Follow-up by', args.followUpBy)

  const html = `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f4f4f5; padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:20px 24px;">
      <h1 style="margin:0;font-size:20px;">New lead captured</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#dbeafe;">${args.eventTitle}</p>
    </div>
    <div style="padding:20px 24px;">
      <p style="color:#334155;margin:0 0 12px;font-size:14px;">
        A Yi Connect team member just logged a new lead for <strong>${args.sponsorName}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;">
        ${rows.join('')}
      </table>
      ${
        args.notes
          ? `<div style="background:#f1f5f9;border-radius:8px;padding:12px 14px;color:#334155;font-size:13px;"><strong>Notes:</strong><br/>${args.notes}</div>`
          : ''
      }
      <p style="margin:18px 0 0;color:#64748b;font-size:12px;">
        View all leads at <a href="${appUrl}" style="color:#2563eb;">Yi Connect</a>.
      </p>
    </div>
  </div>
</body></html>
`

  return {
    subject: `New lead for ${args.sponsorName} — ${args.fullName}`,
    html,
  }
}

/**
 * Capture a sponsor lead.
 *
 * If a `ticket_token` is provided, prefill (rsvp_id / guest_rsvp_id and any
 * un-supplied attendee fields) is resolved server-side.
 */
export async function captureSponsorsLead(
  input: CreateSponsorLeadSchema
): Promise<ActionResponse<{ id: string }>> {
  try {
    const gate = await ensureEcMemberOrAbove()
    if (!gate.ok) return { success: false, error: gate.error }

    const validated = createSponsorLeadSchema.parse(input)
    const supabase = await createClient()

    // Optional prefill from QR ticket token
    let rsvpId: string | null = validated.rsvp_id ?? null
    let guestRsvpId: string | null = validated.guest_rsvp_id ?? null
    let fullName = validated.full_name
    let email = (validated.email as string | null) ?? null
    let phone = (validated.phone as string | null) ?? null
    let company = (validated.company as string | null) ?? null
    let designation = (validated.designation as string | null) ?? null

    if (validated.ticket_token) {
      const prefill = await resolveTicketToken(
        validated.event_id,
        validated.ticket_token
      )
      if (prefill) {
        rsvpId = rsvpId ?? prefill.rsvp_id ?? null
        guestRsvpId = guestRsvpId ?? prefill.guest_rsvp_id ?? null
        if (!fullName || fullName.trim().length === 0) {
          fullName = prefill.full_name ?? fullName
        }
        email = email || prefill.email || null
        phone = phone || prefill.phone || null
        company = company || prefill.company || null
        designation = designation || prefill.designation || null
      }
    }

    const payload = clean({
      event_id: validated.event_id,
      sponsor_id: validated.sponsor_id,
      captured_by_user_id: gate.userId,
      rsvp_id: rsvpId,
      guest_rsvp_id: guestRsvpId,
      full_name: fullName,
      email,
      phone,
      company,
      designation,
      interest_level: validated.interest_level,
      interest_areas:
        validated.interest_areas && validated.interest_areas.length > 0
          ? validated.interest_areas
          : null,
      notes: validated.notes,
      follow_up_requested: validated.follow_up_requested,
      follow_up_by: validated.follow_up_by || null,
    })

    const { data: inserted, error } = await supabase
      .from('sponsor_leads')
      .insert(payload)
      .select('id, event_id, sponsor_id')
      .single()

    if (error || !inserted) {
      console.error('Error inserting sponsor lead:', error)
      return {
        success: false,
        error: error?.message || 'Failed to capture lead',
      }
    }

    // Fetch sponsor + event for email + revalidation
    const [{ data: sponsor }, { data: event }] = await Promise.all([
      supabase
        .from('sponsors')
        .select('id, organization_name, contact_email')
        .eq('id', validated.sponsor_id)
        .maybeSingle(),
      supabase
        .from('events')
        .select('id, title')
        .eq('id', validated.event_id)
        .maybeSingle(),
    ])

    // Email sponsor contact on capture (non-blocking — capture shouldn't fail if email fails)
    if (sponsor?.contact_email && event?.title) {
      try {
        const { subject, html } = leadCapturedEmail({
          sponsorName: sponsor.organization_name,
          eventTitle: event.title,
          fullName,
          email,
          phone,
          company,
          designation,
          interestLevel: validated.interest_level,
          interestAreas: validated.interest_areas ?? null,
          notes: validated.notes ?? null,
          followUpBy: validated.follow_up_by || null,
        })
        await sendEmail({ to: sponsor.contact_email, subject, html })
      } catch (emailError) {
        console.warn('[sponsor-leads] email failed:', emailError)
      }
    }

    revalidatePath(`/events/${validated.event_id}/sponsor-portal`)
    revalidatePath(`/events/${validated.event_id}/sponsor-portal/leads`)
    // Also refresh the sponsor's deal detail page if present
    revalidatePath('/finance/sponsorships/[id]', 'page')

    return { success: true, data: { id: inserted.id } }
  } catch (err) {
    console.error('captureSponsorsLead error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Update an existing lead (e.g. add notes, change interest, toggle follow-up).
 */
export async function updateSponsorLead(
  input: UpdateSponsorLeadSchema
): Promise<ActionResponse<{ id: string }>> {
  try {
    const gate = await ensureEcMemberOrAbove()
    if (!gate.ok) return { success: false, error: gate.error }

    const validated = updateSponsorLeadSchema.parse(input)
    const supabase = await createClient()

    const updateData = clean({
      full_name: validated.full_name,
      email: validated.email,
      phone: validated.phone,
      company: validated.company,
      designation: validated.designation,
      interest_level: validated.interest_level,
      interest_areas:
        validated.interest_areas && validated.interest_areas.length > 0
          ? validated.interest_areas
          : validated.interest_areas === null
          ? null
          : undefined,
      notes: validated.notes,
      follow_up_requested: validated.follow_up_requested,
      follow_up_by: validated.follow_up_by || null,
    })

    // Strip undefined so we don't overwrite with nulls unintentionally
    Object.keys(updateData).forEach(k => {
      if ((updateData as any)[k] === undefined) delete (updateData as any)[k]
    })

    const { data, error } = await supabase
      .from('sponsor_leads')
      .update(updateData)
      .eq('id', validated.id)
      .select('id, event_id')
      .single()

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Failed to update lead',
      }
    }

    revalidatePath(`/events/${data.event_id}/sponsor-portal/leads`)
    revalidatePath('/finance/sponsorships/[id]', 'page')

    return { success: true, data: { id: data.id } }
  } catch (err) {
    console.error('updateSponsorLead error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
