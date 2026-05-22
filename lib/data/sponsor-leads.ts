/**
 * Sponsor Leads Data Layer (Stutzee Feature 3D)
 *
 * Cached data fetching functions for lead capture at events.
 * Uses React cache() for request-level deduplication.
 */

import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  SponsorLead,
  SponsorLeadWithRelations,
  SponsorLeadFilters,
  TicketTokenPrefill,
  InterestLevel,
} from '@/types/sponsor-lead'

/**
 * Get sponsors attached to an event via sponsorship_deals (any stage).
 * Used to populate the sponsor selector on the portal.
 */
export const getEventSponsorOptions = cache(async (eventId: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('sponsorship_deals')
    .select(
      `
      id,
      deal_stage,
      sponsor:sponsors(
        id,
        organization_name,
        contact_email,
        contact_person_name
      )
    `
    )
    .eq('event_id', eventId)

  if (error) {
    console.error('Error fetching event sponsors for portal:', error)
    return []
  }

  // Dedup sponsors (one sponsor may have multiple deals on the same event)
  const map = new Map<
    string,
    {
      id: string
      organization_name: string
      contact_email: string | null
      contact_person_name: string | null
    }
  >()

  for (const row of (data ?? []) as any[]) {
    const s = row.sponsor
    if (!s) continue
    if (!map.has(s.id)) {
      map.set(s.id, {
        id: s.id,
        organization_name: s.organization_name,
        contact_email: s.contact_email ?? null,
        contact_person_name: s.contact_person_name ?? null,
      })
    }
  }

  return Array.from(map.values())
})

/**
 * Resolve a ticket_token QR scan → prefill data.
 * Tries event_rsvps first (member via members -> profiles), then guest_rsvps.
 */
export async function resolveTicketToken(
  eventId: string,
  ticketToken: string
): Promise<TicketTokenPrefill | null> {
  const supabase = await createServerSupabaseClient()

  // Try member RSVP first
  const { data: rsvp } = await supabase
    .from('event_rsvps')
    .select(
      `
      id,
      event_id,
      member:members(
        id,
        company,
        designation,
        profile:profiles(id, full_name, email, phone)
      )
    `
    )
    .eq('ticket_token', ticketToken)
    .eq('event_id', eventId)
    .maybeSingle()

  if (rsvp) {
    const member = (rsvp as any).member
    const profile = member?.profile
    return {
      rsvp_id: rsvp.id,
      full_name: profile?.full_name ?? undefined,
      email: profile?.email ?? undefined,
      phone: profile?.phone ?? undefined,
      company: member?.company ?? undefined,
      designation: member?.designation ?? undefined,
    }
  }

  // Try guest RSVP
  const { data: guest } = await supabase
    .from('guest_rsvps')
    .select('id, event_id, full_name, email, phone, company, designation')
    .eq('ticket_token', ticketToken)
    .eq('event_id', eventId)
    .maybeSingle()

  if (guest) {
    return {
      guest_rsvp_id: guest.id,
      full_name: guest.full_name ?? undefined,
      email: guest.email ?? undefined,
      phone: guest.phone ?? undefined,
      company: guest.company ?? undefined,
      designation: guest.designation ?? undefined,
    }
  }

  return null
}

/**
 * Get leads for a specific event (optionally filtered by sponsor).
 */
export const getSponsorLeadsForEvent = cache(
  async (
    eventId: string,
    filters?: SponsorLeadFilters
  ): Promise<SponsorLeadWithRelations[]> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('sponsor_leads')
      .select(
        `
        *,
        sponsor:sponsors(id, organization_name, contact_email),
        event:events(id, title, start_date),
        captured_by:profiles!sponsor_leads_captured_by_user_id_fkey(id, full_name, email)
      `
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (filters?.sponsor_id) {
      query = query.eq('sponsor_id', filters.sponsor_id)
    }
    if (filters?.interest_level) {
      query = query.eq('interest_level', filters.interest_level)
    }
    if (typeof filters?.follow_up_requested === 'boolean') {
      query = query.eq('follow_up_requested', filters.follow_up_requested)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching sponsor leads for event:', error)
      // Fallback without explicit FK syntax in case the shortcut isn't resolvable
      const { data: fallback } = await supabase
        .from('sponsor_leads')
        .select(
          `
          *,
          sponsor:sponsors(id, organization_name, contact_email),
          event:events(id, title, start_date)
        `
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
      return ((fallback as any[]) ?? []).map(row => ({
        ...row,
        captured_by: null,
      })) as SponsorLeadWithRelations[]
    }

    return ((data as any[]) ?? []) as SponsorLeadWithRelations[]
  }
)

/**
 * Get all leads for a sponsor (across events).
 * Used by deal detail Leads tab.
 */
export const getSponsorLeadsForSponsor = cache(
  async (sponsorId: string): Promise<SponsorLeadWithRelations[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('sponsor_leads')
      .select(
        `
        *,
        sponsor:sponsors(id, organization_name, contact_email),
        event:events(id, title, start_date)
      `
      )
      .eq('sponsor_id', sponsorId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching sponsor leads for sponsor:', error)
      return []
    }

    return ((data as any[]) ?? []).map(row => ({
      ...row,
      captured_by: null,
    })) as SponsorLeadWithRelations[]
  }
)

/**
 * Get a single lead by id.
 */
export const getLeadById = cache(
  async (id: string): Promise<SponsorLeadWithRelations | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('sponsor_leads')
      .select(
        `
        *,
        sponsor:sponsors(id, organization_name, contact_email),
        event:events(id, title, start_date)
      `
      )
      .eq('id', id)
      .maybeSingle()

    if (error || !data) return null

    return {
      ...(data as any),
      captured_by: null,
    } as SponsorLeadWithRelations
  }
)

/**
 * Quick per-event summary counts (by interest level).
 */
export const getEventLeadsSummary = cache(
  async (eventId: string): Promise<Record<InterestLevel, number>> => {
    const supabase = await createServerSupabaseClient()

    const { data } = await supabase
      .from('sponsor_leads')
      .select('interest_level')
      .eq('event_id', eventId)

    const summary: Record<InterestLevel, number> = {
      hot: 0,
      warm: 0,
      medium: 0,
      cold: 0,
    }

    for (const row of (data as Array<{ interest_level: InterestLevel }>) ?? []) {
      summary[row.interest_level] = (summary[row.interest_level] ?? 0) + 1
    }

    return summary
  }
)

export type { SponsorLead, SponsorLeadWithRelations }
