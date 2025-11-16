/**
 * Stakeholder Relationship CRM Types
 *
 * Type definitions for Module 2: Stakeholder Relationship CRM
 * Covers 7 stakeholder entity types and shared relationship management tables
 */

import { Database } from './database'

// ============================================================================
// ENUM TYPES (matching database ENUMs)
// ============================================================================

export type StakeholderStatus = 'active' | 'inactive' | 'prospective' | 'dormant' | 'archived'
export type InteractionType = 'call' | 'meeting' | 'email' | 'session' | 'event' | 'mou_signing' | 'follow_up' | 'visit' | 'other'
export type InteractionOutcome = 'positive' | 'neutral' | 'negative' | 'pending' | 'no_response'
export type MouStatus = 'none' | 'in_discussion' | 'draft' | 'signed' | 'expired' | 'renewed'
export type SchoolType = 'primary' | 'secondary' | 'high_school' | 'cbse' | 'state_board' | 'matric' | 'icse' | 'international'
export type CollegeType = 'engineering' | 'arts_science' | 'medical' | 'management' | 'polytechnic' | 'other'
export type IndustrySector = 'manufacturing' | 'it_services' | 'healthcare' | 'education' | 'retail' | 'hospitality' | 'construction' | 'agriculture' | 'finance' | 'other'
export type PartnershipType = 'joint_projects' | 'resource_sharing' | 'funding' | 'implementation' | 'advocacy' | 'knowledge_exchange'
export type VendorCategory = 'catering' | 'printing' | 'venue' | 'av_equipment' | 'decoration' | 'photography' | 'transportation' | 'merchandise' | 'other'
export type ConnectionType = 'direct' | 'through_member' | 'through_ngo' | 'cold' | 'referral'
export type HealthTier = 'healthy' | 'needs_attention' | 'at_risk'

// ============================================================================
// SHARED TYPES (Polymorphic tables)
// ============================================================================

export interface StakeholderContact {
  id: string
  chapter_id: string
  stakeholder_type: string
  stakeholder_id: string
  contact_name: string
  designation?: string
  email?: string
  phone_primary?: string
  phone_secondary?: string
  is_primary_contact: boolean
  is_decision_maker: boolean
  preferred_contact_method?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface StakeholderInteraction {
  id: string
  chapter_id: string
  stakeholder_type: string
  stakeholder_id: string
  interaction_type: InteractionType
  interaction_date: string
  outcome: InteractionOutcome
  summary: string
  next_steps?: string
  requires_follow_up: boolean
  follow_up_date?: string
  follow_up_assigned_to?: string
  attended_by_members?: string[]
  tags?: string[]
  created_by: string
  created_at: string
  led_by_member_id?: string

  // Relationships (for detail views)
  led_by?: {
    id: string
    profiles: {
      id: string
      full_name: string
      email?: string
    }
  }
}

export interface StakeholderMou {
  id: string
  chapter_id: string
  stakeholder_type: string
  stakeholder_id: string
  mou_title: string
  mou_status: MouStatus
  signed_date?: string
  valid_from?: string
  valid_to?: string
  renewal_date?: string
  scope_of_collaboration?: string
  key_deliverables?: string[]
  compliance_requirements?: string[]
  last_review_date?: string
  document_url?: string
  created_at: string
  updated_at: string
}

export interface StakeholderDocument {
  id: string
  chapter_id: string
  stakeholder_type: string
  stakeholder_id: string
  document_type: string
  document_name: string
  description?: string
  file_url: string
  file_size?: number
  uploaded_by: string
  uploaded_at: string
  tags?: string[]

  // Relationships
  uploader?: {
    id: string
    full_name: string
  }
}

export interface RelationshipHealthScore {
  id: string
  chapter_id: string
  stakeholder_type: string
  stakeholder_id: string
  overall_score: number
  interaction_frequency_score: number
  responsiveness_score: number
  collaboration_quality_score: number
  mou_status_score: number
  health_tier: HealthTier
  last_interaction_date?: string
  days_since_last_interaction?: number
  total_interactions: number
  positive_interactions: number
  last_calculated_at: string
}

// ============================================================================
// SCHOOL TYPES
// ============================================================================

export interface School {
  id: string
  chapter_id: string

  // Basic Information
  school_name: string
  school_type: SchoolType
  status: StakeholderStatus

  // Address
  address_line1?: string
  address_line2?: string
  city: string
  state: string
  pincode?: string
  latitude?: number
  longitude?: number

  // Connection
  connection_type: ConnectionType
  connected_through_member_id?: string

  // School Profile
  total_students?: number
  grade_range?: string
  medium?: string[]
  suitable_programs?: string[]
  previous_yi_programs?: string[]

  // Facilities
  has_auditorium: boolean
  has_smart_class: boolean
  has_ground: boolean
  has_library: boolean

  // Operational
  best_time_to_approach?: string
  decision_maker?: string
  lead_time_required?: string
  restrictions?: string[]

  // Engagement
  last_program_date?: string
  last_contact_date?: string
  engagement_level?: string
  notes?: string

  // System
  created_at: string
  updated_at: string

  // Relationships (for detail views)
  connected_member?: {
    id: string
    full_name: string
  }
}

export interface SchoolListItem extends School {
  contact_count: number
  interaction_count: number
  mou_status: MouStatus
  health_score?: number
  health_tier?: HealthTier
  days_since_last_contact?: number
}

export interface SchoolDetail extends School {
  contacts: StakeholderContact[]
  interactions: StakeholderInteraction[]
  mous: StakeholderMou[]
  documents: StakeholderDocument[]
  health_score?: RelationshipHealthScore
}

export interface SchoolFormInput {
  school_name: string
  school_type: SchoolType
  status?: StakeholderStatus
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  pincode?: string
  connection_type?: ConnectionType
  connected_through_member_id?: string
  total_students?: number
  grade_range?: string
  medium?: string[]
  suitable_programs?: string[]
  has_auditorium?: boolean
  has_smart_class?: boolean
  has_ground?: boolean
  has_library?: boolean
  best_time_to_approach?: string
  decision_maker?: string
  lead_time_required?: string
  restrictions?: string[]
  notes?: string
}

// ============================================================================
// COLLEGE TYPES
// ============================================================================

export interface College {
  id: string
  chapter_id: string

  // Basic Information
  college_name: string
  college_type: CollegeType
  status: StakeholderStatus

  // Address
  address_line1?: string
  address_line2?: string
  city: string
  state: string
  pincode?: string
  latitude?: number
  longitude?: number

  // Connection
  connection_type: ConnectionType
  connected_through_member_id?: string

  // College Profile
  total_students?: number
  total_staff?: number
  departments?: string[]
  accreditation?: string[]
  university_affiliation?: string

  // Yuva Chapter
  has_yuva_chapter: boolean
  yuva_chapter_strength?: number
  yuva_chapter_status?: string
  yuva_president_name?: string
  yuva_president_contact?: string

  // Collaboration
  suitable_activities?: string[]
  available_resources?: string[]
  collaboration_history?: any

  // Operational
  decision_maker?: string
  decision_making_process?: string
  lead_time_required?: string

  // Engagement
  last_collaboration_date?: string
  last_contact_date?: string
  engagement_level?: string
  notes?: string

  // System
  created_at: string
  updated_at: string

  // Relationships
  connected_member?: {
    id: string
    full_name: string
  }
}

export interface CollegeListItem extends College {
  contact_count: number
  interaction_count: number
  mou_status: MouStatus
  health_score?: number
  health_tier?: HealthTier
  days_since_last_contact?: number
}

export interface CollegeDetail extends College {
  contacts: StakeholderContact[]
  interactions: StakeholderInteraction[]
  mous: StakeholderMou[]
  documents: StakeholderDocument[]
  health_score?: RelationshipHealthScore
}

export interface CollegeFormInput {
  college_name: string
  college_type: CollegeType
  status?: StakeholderStatus
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  pincode?: string
  connection_type?: ConnectionType
  connected_through_member_id?: string
  total_students?: number
  total_staff?: number
  departments?: string[]
  accreditation?: string[]
  university_affiliation?: string
  has_yuva_chapter?: boolean
  yuva_chapter_strength?: number
  yuva_chapter_status?: string
  yuva_president_name?: string
  yuva_president_contact?: string
  suitable_activities?: string[]
  available_resources?: string[]
  decision_maker?: string
  decision_making_process?: string
  lead_time_required?: string
  notes?: string
}

// ============================================================================
// INDUSTRY TYPES
// ============================================================================

export interface Industry {
  id: string
  chapter_id: string

  // Basic Information
  organization_name: string
  industry_sector: IndustrySector
  status: StakeholderStatus

  // Address
  address_line1?: string
  address_line2?: string
  city: string
  state: string
  pincode?: string
  website?: string

  // Connection
  connection_type: ConnectionType
  connected_through_member_id?: string

  // Organization Profile
  organization_size?: string
  employee_count?: number
  annual_turnover?: string

  // CSR & Sponsorship
  has_csr_program: boolean
  csr_budget_range?: string
  csr_focus_areas?: string[]
  sponsorship_potential?: string
  past_sponsorships?: string[]

  // Collaboration
  collaboration_interests?: string[]
  available_resources?: string[]
  can_provide_internships: boolean
  can_provide_mentorship: boolean

  // Operational
  decision_maker?: string
  procurement_process?: string
  lead_time_required?: string

  // Engagement
  last_sponsorship_date?: string
  last_contact_date?: string
  engagement_level?: string
  notes?: string

  // System
  created_at: string
  updated_at: string

  // Relationships
  connected_member?: {
    id: string
    full_name: string
  }
}

export interface IndustryListItem extends Industry {
  contact_count: number
  interaction_count: number
  mou_status: MouStatus
  health_score?: number
  health_tier?: HealthTier
  days_since_last_contact?: number
}

export interface IndustryDetail extends Industry {
  contacts: StakeholderContact[]
  interactions: StakeholderInteraction[]
  mous: StakeholderMou[]
  documents: StakeholderDocument[]
  health_score?: RelationshipHealthScore
}

export interface IndustryFormInput {
  organization_name: string
  industry_sector: IndustrySector
  status?: StakeholderStatus
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  pincode?: string
  website?: string
  connection_type?: ConnectionType
  connected_through_member_id?: string
  organization_size?: string
  employee_count?: number
  annual_turnover?: string
  has_csr_program?: boolean
  csr_budget_range?: string
  csr_focus_areas?: string[]
  sponsorship_potential?: string
  collaboration_interests?: string[]
  available_resources?: string[]
  can_provide_internships?: boolean
  can_provide_mentorship?: boolean
  decision_maker?: string
  procurement_process?: string
  lead_time_required?: string
  notes?: string
}

// ============================================================================
// GOVERNMENT STAKEHOLDER TYPES
// ============================================================================

export interface GovernmentStakeholder {
  id: string
  chapter_id: string

  // Basic Information
  official_name: string
  department: string
  designation: string
  status: StakeholderStatus

  // Contact
  office_address?: string
  city: string
  state: string
  email?: string
  phone?: string

  // Connection
  connection_type: ConnectionType
  connected_through_member_id?: string

  // Official Profile
  jurisdiction?: string
  key_responsibilities?: string[]
  decision_making_authority?: string[]

  // Tenure
  appointment_date?: string
  tenure_end_date?: string
  is_elected: boolean
  term_duration?: string

  // Collaboration
  areas_of_support?: string[]
  past_collaborations?: string[]
  can_provide_permissions: boolean
  can_provide_funding: boolean
  can_provide_venue: boolean

  // Operational
  best_time_to_meet?: string
  protocol_requirements?: string[]
  lead_time_required?: string

  // Engagement
  last_meeting_date?: string
  last_contact_date?: string
  engagement_level?: string
  notes?: string

  // System
  created_at: string
  updated_at: string

  // Relationships
  connected_member?: {
    id: string
    full_name: string
  }
}

export interface GovernmentStakeholderListItem extends GovernmentStakeholder {
  contact_count: number
  interaction_count: number
  mou_status: MouStatus
  health_score?: number
  health_tier?: HealthTier
  days_since_last_contact?: number
  tenure_status?: 'active' | 'expiring_soon' | 'expired'
}

export interface GovernmentStakeholderDetail extends GovernmentStakeholder {
  contacts: StakeholderContact[]
  interactions: StakeholderInteraction[]
  mous: StakeholderMou[]
  documents: StakeholderDocument[]
  health_score?: RelationshipHealthScore
}

export interface GovernmentStakeholderFormInput {
  official_name: string
  department: string
  designation: string
  status?: StakeholderStatus
  office_address?: string
  city?: string
  state?: string
  email?: string
  phone?: string
  connection_type?: ConnectionType
  connected_through_member_id?: string
  jurisdiction?: string
  key_responsibilities?: string[]
  decision_making_authority?: string[]
  appointment_date?: string
  tenure_end_date?: string
  is_elected?: boolean
  term_duration?: string
  areas_of_support?: string[]
  can_provide_permissions?: boolean
  can_provide_funding?: boolean
  can_provide_venue?: boolean
  best_time_to_meet?: string
  protocol_requirements?: string[]
  lead_time_required?: string
  notes?: string
}

// ============================================================================
// NGO TYPES
// ============================================================================

export interface NGO {
  id: string
  chapter_id: string

  // Basic Information
  ngo_name: string
  registration_number?: string
  status: StakeholderStatus

  // Address
  address_line1?: string
  address_line2?: string
  city: string
  state: string
  pincode?: string
  website?: string

  // Connection
  connection_type: ConnectionType
  connected_through_member_id?: string

  // NGO Profile
  focus_areas?: string[]
  target_beneficiaries?: string[]
  geographic_reach?: string
  team_size?: number

  // Registration
  is_registered: boolean
  registration_type?: string
  tax_exemption_status?: string

  // Partnership
  partnership_type?: PartnershipType[]
  collaboration_areas?: string[]
  resources_they_can_provide?: string[]
  resources_they_need?: string[]

  // Track Record
  past_collaborations?: string[]
  successful_projects?: string[]
  beneficiaries_reached?: number

  // Operational
  decision_maker?: string
  decision_making_process?: string
  lead_time_required?: string

  // Engagement
  last_collaboration_date?: string
  last_contact_date?: string
  engagement_level?: string
  notes?: string

  // System
  created_at: string
  updated_at: string

  // Relationships
  connected_member?: {
    id: string
    full_name: string
  }
}

export interface NGOListItem extends NGO {
  contact_count: number
  interaction_count: number
  mou_status: MouStatus
  health_score?: number
  health_tier?: HealthTier
  days_since_last_contact?: number
}

export interface NGODetail extends NGO {
  contacts: StakeholderContact[]
  interactions: StakeholderInteraction[]
  mous: StakeholderMou[]
  documents: StakeholderDocument[]
  health_score?: RelationshipHealthScore
}

export interface NGOFormInput {
  ngo_name: string
  registration_number?: string
  status?: StakeholderStatus
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  pincode?: string
  website?: string
  connection_type?: ConnectionType
  connected_through_member_id?: string
  focus_areas?: string[]
  target_beneficiaries?: string[]
  geographic_reach?: string
  team_size?: number
  is_registered?: boolean
  registration_type?: string
  tax_exemption_status?: string
  partnership_type?: PartnershipType[]
  collaboration_areas?: string[]
  resources_they_can_provide?: string[]
  resources_they_need?: string[]
  decision_maker?: string
  decision_making_process?: string
  lead_time_required?: string
  notes?: string
}

// ============================================================================
// VENDOR TYPES
// ============================================================================

export interface Vendor {
  id: string
  chapter_id: string

  // Basic Information
  vendor_name: string
  vendor_category: VendorCategory
  status: StakeholderStatus

  // Contact
  contact_person?: string
  email?: string
  phone_primary?: string
  phone_secondary?: string

  // Address
  address_line1?: string
  city: string
  state: string
  pincode?: string

  // Connection
  connection_type: ConnectionType
  connected_through_member_id?: string

  // Service Details
  services_offered?: string[]
  capacity?: string
  quality_rating?: number

  // Pricing
  pricing_model?: string
  pricing_details?: any
  accepts_negotiation: boolean

  // Business Terms
  payment_terms?: string
  advance_percentage?: number
  cancellation_policy?: string

  // Track Record
  first_engaged_date?: string
  total_orders?: number
  total_amount_paid?: number
  last_order_date?: string
  performance_rating?: number

  // Reliability
  on_time_delivery_rate?: number
  quality_consistency_rating?: number
  responsiveness_rating?: number

  // Operational
  lead_time_required?: string
  minimum_order_value?: number
  serves_locations?: string[]

  // Documents
  has_gst_certificate: boolean
  gst_number?: string
  has_service_agreement: boolean

  // Engagement
  last_contact_date?: string
  engagement_level?: string
  notes?: string

  // System
  created_at: string
  updated_at: string

  // Relationships
  connected_member?: {
    id: string
    full_name: string
  }
}

export interface VendorListItem extends Vendor {
  contact_count: number
  interaction_count: number
  health_score?: number
  health_tier?: HealthTier
  days_since_last_contact?: number
}

export interface VendorDetail extends Vendor {
  contacts: StakeholderContact[]
  interactions: StakeholderInteraction[]
  documents: StakeholderDocument[]
  health_score?: RelationshipHealthScore
}

export interface VendorFormInput {
  vendor_name: string
  vendor_category: VendorCategory
  status?: StakeholderStatus
  contact_person?: string
  email?: string
  phone_primary?: string
  phone_secondary?: string
  address_line1?: string
  city?: string
  state?: string
  pincode?: string
  connection_type?: ConnectionType
  connected_through_member_id?: string
  services_offered?: string[]
  capacity?: string
  quality_rating?: number
  pricing_model?: string
  pricing_details?: any
  accepts_negotiation?: boolean
  payment_terms?: string
  advance_percentage?: number
  cancellation_policy?: string
  performance_rating?: number
  lead_time_required?: string
  minimum_order_value?: number
  serves_locations?: string[]
  has_gst_certificate?: boolean
  gst_number?: string
  has_service_agreement?: boolean
  notes?: string
}

// ============================================================================
// SPEAKER TYPES
// ============================================================================

export interface Speaker {
  id: string
  chapter_id: string

  // Basic Information
  speaker_name: string
  professional_title?: string
  status: StakeholderStatus

  // Contact
  email?: string
  phone?: string
  city: string
  state: string

  // Connection
  connection_type: ConnectionType
  connected_through_member_id?: string

  // Expertise
  expertise_areas?: string[]
  suitable_topics?: string[]
  target_audience?: string[]
  session_formats?: string[]

  // Experience
  years_of_experience?: number
  organizations_associated?: string[]
  notable_achievements?: string[]
  social_media_links?: any

  // Session Details
  typical_session_duration?: string
  max_audience_size?: number
  requires_av_equipment?: string[]
  language_proficiency?: string[]

  // Commercial
  charges_fee: boolean
  fee_range?: string
  travel_charges?: string
  accommodation_required: boolean

  // Availability
  availability_status?: string
  blackout_dates?: string[]
  preferred_days?: string[]
  preferred_time_slots?: string[]

  // Track Record
  sessions_delivered_count?: number
  last_session_date?: string
  average_feedback_rating?: number

  // Operational
  lead_time_required?: string
  special_requirements?: string[]

  // Engagement
  last_contact_date?: string
  engagement_level?: string
  notes?: string

  // System
  created_at: string
  updated_at: string

  // Relationships
  connected_member?: {
    id: string
    full_name: string
  }
}

export interface SpeakerListItem extends Speaker {
  contact_count: number
  interaction_count: number
  health_score?: number
  health_tier?: HealthTier
  days_since_last_contact?: number
  availability_indicator?: 'available' | 'busy' | 'unknown'
}

export interface SpeakerDetail extends Speaker {
  contacts: StakeholderContact[]
  interactions: StakeholderInteraction[]
  documents: StakeholderDocument[]
  health_score?: RelationshipHealthScore
}

export interface SpeakerFormInput {
  speaker_name: string
  professional_title?: string
  status?: StakeholderStatus
  email?: string
  phone?: string
  city?: string
  state?: string
  connection_type?: ConnectionType
  connected_through_member_id?: string
  expertise_areas?: string[]
  suitable_topics?: string[]
  target_audience?: string[]
  session_formats?: string[]
  years_of_experience?: number
  organizations_associated?: string[]
  notable_achievements?: string[]
  typical_session_duration?: string
  max_audience_size?: number
  requires_av_equipment?: string[]
  language_proficiency?: string[]
  charges_fee?: boolean
  fee_range?: string
  travel_charges?: string
  accommodation_required?: boolean
  availability_status?: string
  preferred_days?: string[]
  preferred_time_slots?: string[]
  lead_time_required?: string
  special_requirements?: string[]
  notes?: string
}

// ============================================================================
// UNIFIED STAKEHOLDER TYPES
// ============================================================================

export type StakeholderEntity = School | College | Industry | GovernmentStakeholder | NGO | Vendor | Speaker
export type StakeholderListItem = SchoolListItem | CollegeListItem | IndustryListItem | GovernmentStakeholderListItem | NGOListItem | VendorListItem | SpeakerListItem
export type StakeholderDetail = SchoolDetail | CollegeDetail | IndustryDetail | GovernmentStakeholderDetail | NGODetail | VendorDetail | SpeakerDetail
export type StakeholderFormInput = SchoolFormInput | CollegeFormInput | IndustryFormInput | GovernmentStakeholderFormInput | NGOFormInput | VendorFormInput | SpeakerFormInput

export interface UnifiedStakeholderSearchResult {
  id: string
  type: 'school' | 'college' | 'industry' | 'government' | 'ngo' | 'vendor' | 'speaker'
  name: string
  status: StakeholderStatus
  health_score?: number
  health_tier?: HealthTier
  last_contact_date?: string
  city: string
  state: string
}

// ============================================================================
// INTERACTION & ENGAGEMENT TYPES
// ============================================================================

export interface InteractionFormInput {
  stakeholder_type: string
  stakeholder_id: string
  interaction_type: InteractionType
  interaction_date: string
  outcome: InteractionOutcome
  summary: string
  next_steps?: string
  requires_follow_up?: boolean
  follow_up_date?: string
  follow_up_assigned_to?: string
  attended_by_members?: string[]
  tags?: string[]
}

export interface ContactFormInput {
  stakeholder_type: string
  stakeholder_id: string
  contact_name: string
  designation?: string
  email?: string
  phone_primary?: string
  phone_secondary?: string
  is_primary_contact?: boolean
  is_decision_maker?: boolean
  preferred_contact_method?: string
  notes?: string
}

export interface MouFormInput {
  stakeholder_type: string
  stakeholder_id: string
  mou_title: string
  mou_status: MouStatus
  signed_date?: string
  valid_from?: string
  valid_to?: string
  renewal_date?: string
  scope_of_collaboration?: string
  key_deliverables?: string[]
  compliance_requirements?: string[]
  document_url?: string
}

export interface DocumentFormInput {
  stakeholder_type: string
  stakeholder_id: string
  document_type: string
  document_name: string
  description?: string
  file_url: string
  file_size?: number
  tags?: string[]
}

// ============================================================================
// DASHBOARD & ANALYTICS TYPES
// ============================================================================

export interface StakeholderOverviewStats {
  total_stakeholders: number
  by_type: {
    schools: number
    colleges: number
    industries: number
    government: number
    ngos: number
    vendors: number
    speakers: number
  }
  by_status: {
    active: number
    prospective: number
    inactive: number
    dormant: number
  }
  health_distribution: {
    healthy: number
    needs_attention: number
    at_risk: number
  }
  active_mous: number
  expiring_soon_mous: number
  interactions_this_month: number
  follow_ups_pending: number
}

export interface RelationshipHealthTrend {
  month: string
  average_health_score: number
  stakeholder_count: number
  interactions_count: number
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatStakeholderType(type: string): string {
  const typeMap: Record<string, string> = {
    school: 'School',
    college: 'College',
    industry: 'Industry',
    government: 'Government',
    ngo: 'NGO',
    vendor: 'Vendor',
    speaker: 'Speaker',
  }
  return typeMap[type] || type
}

export function formatHealthTier(tier: HealthTier): {
  label: string
  color: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  const tierMap = {
    healthy: {
      label: 'Healthy',
      color: 'text-green-600',
      variant: 'default' as const,
    },
    needs_attention: {
      label: 'Needs Attention',
      color: 'text-yellow-600',
      variant: 'secondary' as const,
    },
    at_risk: {
      label: 'At Risk',
      color: 'text-red-600',
      variant: 'destructive' as const,
    },
  }
  return tierMap[tier]
}

export function formatInteractionOutcome(outcome: InteractionOutcome): {
  label: string
  color: string
} {
  const outcomeMap = {
    positive: { label: 'Positive', color: 'text-green-600' },
    neutral: { label: 'Neutral', color: 'text-gray-600' },
    negative: { label: 'Negative', color: 'text-red-600' },
    pending: { label: 'Pending', color: 'text-yellow-600' },
    no_response: { label: 'No Response', color: 'text-gray-400' },
  }
  return outcomeMap[outcome]
}

export function formatMouStatus(status: MouStatus): {
  label: string
  color: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  const statusMap = {
    none: {
      label: 'No MoU',
      color: 'text-gray-400',
      variant: 'outline' as const,
    },
    in_discussion: {
      label: 'In Discussion',
      color: 'text-blue-600',
      variant: 'secondary' as const,
    },
    draft: {
      label: 'Draft',
      color: 'text-yellow-600',
      variant: 'secondary' as const,
    },
    signed: {
      label: 'Signed',
      color: 'text-green-600',
      variant: 'default' as const,
    },
    expired: {
      label: 'Expired',
      color: 'text-red-600',
      variant: 'destructive' as const,
    },
    renewed: {
      label: 'Renewed',
      color: 'text-green-600',
      variant: 'default' as const,
    },
  }
  return statusMap[status]
}

export function formatStakeholderStatus(status: StakeholderStatus): {
  label: string
  color: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  const statusMap = {
    active: {
      label: 'Active',
      color: 'text-green-600',
      variant: 'default' as const,
    },
    inactive: {
      label: 'Inactive',
      color: 'text-gray-400',
      variant: 'secondary' as const,
    },
    prospective: {
      label: 'Prospective',
      color: 'text-blue-600',
      variant: 'secondary' as const,
    },
    dormant: {
      label: 'Dormant',
      color: 'text-yellow-600',
      variant: 'outline' as const,
    },
    archived: {
      label: 'Archived',
      color: 'text-gray-400',
      variant: 'outline' as const,
    },
  }
  return statusMap[status]
}

export function getDaysSinceLastContact(lastContactDate: string | undefined): number | undefined {
  if (!lastContactDate) return undefined
  const lastContact = new Date(lastContactDate)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - lastContact.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

export function getHealthScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

export function getMouExpiryStatus(validTo: string | undefined): 'active' | 'expiring_soon' | 'expired' | 'none' {
  if (!validTo) return 'none'

  const expiryDate = new Date(validTo)
  const now = new Date()
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= 30) return 'expiring_soon'
  return 'active'
}
