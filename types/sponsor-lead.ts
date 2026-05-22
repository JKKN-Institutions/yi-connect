/**
 * Sponsor Lead Types (Stutzee Feature 3D)
 *
 * Lead capture at events on behalf of sponsors. EC Member+ operate the sponsor
 * portal — no sponsor-rep login required.
 */

export type InterestLevel = 'hot' | 'warm' | 'medium' | 'cold'

export type InterestArea =
  | 'hiring'
  | 'csr'
  | 'partnership'
  | 'investment'
  | 'mentoring'

export const INTEREST_LEVEL_LABELS: Record<InterestLevel, string> = {
  hot: 'Hot',
  warm: 'Warm',
  medium: 'Medium',
  cold: 'Cold',
}

export const INTEREST_LEVEL_COLORS: Record<InterestLevel, string> = {
  hot: 'bg-red-100 text-red-800 border-red-300',
  warm: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  cold: 'bg-blue-100 text-blue-800 border-blue-300',
}

export const INTEREST_AREA_OPTIONS: { value: InterestArea; label: string }[] = [
  { value: 'hiring', label: 'Hiring / Recruitment' },
  { value: 'csr', label: 'CSR Engagement' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'investment', label: 'Investment' },
  { value: 'mentoring', label: 'Mentoring' },
]

export interface SponsorLead {
  id: string
  event_id: string
  sponsor_id: string
  captured_by_user_id: string
  rsvp_id: string | null
  guest_rsvp_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  company: string | null
  designation: string | null
  interest_level: InterestLevel
  interest_areas: string[] | null
  notes: string | null
  follow_up_requested: boolean
  follow_up_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Lead with joined sponsor + event info for list views.
 */
export interface SponsorLeadWithRelations extends SponsorLead {
  sponsor: {
    id: string
    organization_name: string
    contact_email: string | null
  }
  event: {
    id: string
    title: string
    start_date: string | null
  }
  captured_by: {
    id: string
    full_name: string | null
    email: string | null
  } | null
}

export interface CreateSponsorLeadInput {
  event_id: string
  sponsor_id: string
  rsvp_id?: string | null
  guest_rsvp_id?: string | null
  ticket_token?: string | null
  full_name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  designation?: string | null
  interest_level: InterestLevel
  interest_areas?: string[] | null
  notes?: string | null
  follow_up_requested: boolean
  follow_up_by?: string | null
}

export interface UpdateSponsorLeadInput {
  id: string
  full_name?: string
  email?: string | null
  phone?: string | null
  company?: string | null
  designation?: string | null
  interest_level?: InterestLevel
  interest_areas?: string[] | null
  notes?: string | null
  follow_up_requested?: boolean
  follow_up_by?: string | null
}

export interface SponsorLeadFilters {
  sponsor_id?: string
  interest_level?: InterestLevel
  follow_up_requested?: boolean
}

/**
 * Prefill data resolved from a ticket_token QR scan.
 */
export interface TicketTokenPrefill {
  rsvp_id?: string
  guest_rsvp_id?: string
  full_name?: string
  email?: string
  phone?: string
  company?: string
  designation?: string
}
