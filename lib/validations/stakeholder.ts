/**
 * Stakeholder Relationship CRM Validation Schemas
 *
 * Zod validation schemas for Module 2: Stakeholder Relationship CRM
 * Covers all 7 stakeholder types and shared relationship operations
 */

import { z } from 'zod'

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const stakeholderStatusSchema = z.enum(['active', 'inactive', 'prospective', 'dormant', 'archived'])
export const interactionTypeSchema = z.enum(['call', 'meeting', 'email', 'session', 'event', 'mou_signing', 'follow_up', 'visit', 'other'])
export const interactionOutcomeSchema = z.enum(['positive', 'neutral', 'negative', 'pending', 'no_response'])
export const mouStatusSchema = z.enum(['none', 'in_discussion', 'draft', 'signed', 'expired', 'renewed'])
export const schoolTypeSchema = z.enum(['primary', 'secondary', 'high_school', 'cbse', 'state_board', 'matric', 'icse', 'international'])
export const collegeTypeSchema = z.enum(['engineering', 'arts_science', 'medical', 'management', 'polytechnic', 'other'])
export const industrySectorSchema = z.enum(['manufacturing', 'it_services', 'healthcare', 'education', 'retail', 'hospitality', 'construction', 'agriculture', 'finance', 'other'])
export const partnershipTypeSchema = z.enum(['joint_projects', 'resource_sharing', 'funding', 'implementation', 'advocacy', 'knowledge_exchange'])
export const vendorCategorySchema = z.enum(['catering', 'printing', 'venue', 'av_equipment', 'decoration', 'photography', 'transportation', 'merchandise', 'other'])
export const connectionTypeSchema = z.enum(['direct', 'through_member', 'through_ngo', 'cold', 'referral'])
export const healthTierSchema = z.enum(['healthy', 'needs_attention', 'at_risk'])

// ============================================================================
// COMMON VALIDATION PATTERNS
// ============================================================================

const emailSchema = z.string().email('Invalid email address').optional().or(z.literal(''))
const phoneSchema = z.string().regex(/^[0-9]{10}$/, 'Phone number must be 10 digits').optional().or(z.literal(''))
const pincodeSchema = z.string().regex(/^[0-9]{6}$/, 'Pincode must be 6 digits').optional().or(z.literal(''))
const urlSchema = z.string().url('Invalid URL').optional().or(z.literal(''))
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().or(z.literal(''))
const uuidSchema = z.preprocess(
  (val) => val === '' || val === null || val === undefined ? null : val,
  z.string().uuid('Invalid UUID').nullable().optional()
)

// ============================================================================
// SCHOOL VALIDATION SCHEMAS
// ============================================================================

export const schoolFormSchema = z.object({
  // Required fields
  school_name: z.string().min(1, 'School name is required').max(255),
  school_type: schoolTypeSchema,

  // Optional basic info
  status: stakeholderStatusSchema.optional(),

  // Address
  address_line1: z.string().max(255).optional().or(z.literal('')),
  address_line2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: pincodeSchema,

  // Contact
  phone: phoneSchema,
  email: emailSchema,
  website: urlSchema,

  // Connection
  connection_type: connectionTypeSchema.optional(),
  connected_through_member_id: uuidSchema,
  connection_notes: z.string().max(1000).optional().or(z.literal('')),

  // School profile
  total_students: z.coerce.number().int().min(1).max(100000).optional(),
  grade_range: z.string().max(50).optional().or(z.literal('')),
  medium: z.array(z.string()).optional(),
  school_category: z.string().max(100).optional().or(z.literal('')),
  management_type: z.string().max(100).optional().or(z.literal('')),
  suitable_programs: z.array(z.string()).optional(),

  // Facilities (booleans)
  has_auditorium: z.boolean().optional(),
  has_smart_class: z.boolean().optional(),
  has_ground: z.boolean().optional(),
  has_parking: z.boolean().optional(),
  has_library: z.boolean().optional(),
  facility_notes: z.string().max(1000).optional().or(z.literal('')),

  // Operational
  best_time_to_approach: z.string().max(255).optional().or(z.literal('')),
  decision_maker: z.string().max(255).optional().or(z.literal('')),
  lead_time_required: z.string().max(100).optional().or(z.literal('')),

  // Notes
  notes: z.string().max(2000).optional().or(z.literal('')),
}).refine(
  (data) => {
    // If connected through member, require member ID
    if (data.connection_type === 'through_member') {
      return !!data.connected_through_member_id && data.connected_through_member_id !== null
    }
    return true
  },
  {
    message: 'Member ID is required when connection type is "through member"',
    path: ['connected_through_member_id'],
  }
)

// ============================================================================
// COLLEGE VALIDATION SCHEMAS
// ============================================================================

export const collegeFormSchema = z.object({
  // Required fields
  college_name: z.string().min(1, 'College name is required').max(255),
  college_type: collegeTypeSchema,

  // Optional basic info
  status: stakeholderStatusSchema.optional(),

  // Address
  address_line1: z.string().max(255).optional().or(z.literal('')),
  address_line2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: pincodeSchema,

  // Connection
  connection_type: connectionTypeSchema.optional(),
  connected_through_member_id: uuidSchema,

  // College profile
  total_students: z.coerce.number().int().min(1).max(100000).optional(),
  total_staff: z.coerce.number().int().min(1).max(10000).optional(),
  departments: z.array(z.string()).optional(),
  accreditation: z.array(z.string()).optional(),
  university_affiliation: z.string().max(255).optional().or(z.literal('')),

  // Yuva chapter
  has_yuva_chapter: z.boolean().optional(),
  yuva_chapter_strength: z.coerce.number().int().min(1).max(1000).optional(),
  yuva_chapter_status: z.string().max(50).optional().or(z.literal('')),
  yuva_president_name: z.string().max(255).optional().or(z.literal('')),
  yuva_president_contact: phoneSchema,

  // Collaboration
  suitable_activities: z.array(z.string()).optional(),
  available_resources: z.array(z.string()).optional(),

  // Operational
  decision_maker: z.string().max(255).optional().or(z.literal('')),
  decision_making_process: z.string().max(500).optional().or(z.literal('')),
  lead_time_required: z.string().max(100).optional().or(z.literal('')),

  // Notes
  notes: z.string().max(2000).optional().or(z.literal('')),
}).refine(
  (data) => {
    // If has Yuva chapter, might want to track president info
    if (data.has_yuva_chapter && data.yuva_chapter_strength && data.yuva_chapter_strength < 1) {
      return false
    }
    return true
  },
  {
    message: 'Yuva chapter strength must be at least 1 if chapter exists',
    path: ['yuva_chapter_strength'],
  }
)

// ============================================================================
// INDUSTRY VALIDATION SCHEMAS
// ============================================================================

export const industryFormSchema = z.object({
  // Required fields
  organization_name: z.string().min(1, 'Organization name is required').max(255),
  industry_sector: industrySectorSchema,

  // Optional basic info
  status: stakeholderStatusSchema.optional(),

  // Address
  address_line1: z.string().max(255).optional().or(z.literal('')),
  address_line2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: pincodeSchema,
  website: urlSchema,

  // Connection
  connection_type: connectionTypeSchema.optional(),
  connected_through_member_id: uuidSchema,

  // Organization profile
  organization_size: z.string().max(50).optional().or(z.literal('')),
  employee_count: z.coerce.number().int().min(1).max(1000000).optional(),
  annual_turnover: z.string().max(100).optional().or(z.literal('')),

  // CSR & Sponsorship
  has_csr_program: z.boolean().optional(),
  csr_budget_range: z.string().max(100).optional().or(z.literal('')),
  csr_focus_areas: z.array(z.string()).optional(),
  sponsorship_potential: z.string().max(50).optional().or(z.literal('')),

  // Collaboration
  collaboration_interests: z.array(z.string()).optional(),
  available_resources: z.array(z.string()).optional(),
  can_provide_internships: z.boolean().optional(),
  can_provide_mentorship: z.boolean().optional(),

  // Operational
  decision_maker: z.string().max(255).optional().or(z.literal('')),
  procurement_process: z.string().max(500).optional().or(z.literal('')),
  lead_time_required: z.string().max(100).optional().or(z.literal('')),

  // Notes
  notes: z.string().max(2000).optional().or(z.literal('')),
})

// ============================================================================
// GOVERNMENT STAKEHOLDER VALIDATION SCHEMAS
// ============================================================================

export const governmentStakeholderFormSchema = z.object({
  // Required fields
  official_name: z.string().min(1, 'Official name is required').max(255),
  department: z.string().min(1, 'Department is required').max(255),
  designation: z.string().min(1, 'Designation is required').max(255),

  // Optional basic info
  status: stakeholderStatusSchema.optional(),

  // Contact
  office_address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  email: emailSchema,
  phone: phoneSchema,

  // Connection
  connection_type: connectionTypeSchema.optional(),
  connected_through_member_id: uuidSchema,

  // Official profile
  jurisdiction: z.string().max(255).optional().or(z.literal('')),
  key_responsibilities: z.array(z.string()).optional(),
  decision_making_authority: z.array(z.string()).optional(),

  // Tenure
  appointment_date: dateSchema,
  tenure_end_date: dateSchema,
  is_elected: z.boolean().optional(),
  term_duration: z.string().max(50).optional().or(z.literal('')),

  // Collaboration
  areas_of_support: z.array(z.string()).optional(),
  can_provide_permissions: z.boolean().optional(),
  can_provide_funding: z.boolean().optional(),
  can_provide_venue: z.boolean().optional(),

  // Operational
  best_time_to_meet: z.string().max(255).optional().or(z.literal('')),
  protocol_requirements: z.array(z.string()).optional(),
  lead_time_required: z.string().max(100).optional().or(z.literal('')),

  // Notes
  notes: z.string().max(2000).optional().or(z.literal('')),
}).refine(
  (data) => {
    // If tenure end date is provided, it should be after appointment date
    if (data.appointment_date && data.tenure_end_date) {
      const appointment = new Date(data.appointment_date)
      const tenureEnd = new Date(data.tenure_end_date)
      return tenureEnd > appointment
    }
    return true
  },
  {
    message: 'Tenure end date must be after appointment date',
    path: ['tenure_end_date'],
  }
)

// ============================================================================
// NGO VALIDATION SCHEMAS
// ============================================================================

export const ngoFormSchema = z.object({
  // Required fields
  ngo_name: z.string().min(1, 'NGO name is required').max(255),

  // Optional basic info
  registration_number: z.string().max(100).optional().or(z.literal('')),
  status: stakeholderStatusSchema.optional(),

  // Address
  address_line1: z.string().max(255).optional().or(z.literal('')),
  address_line2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: pincodeSchema,
  website: urlSchema,

  // Connection
  connection_type: connectionTypeSchema.optional(),
  connected_through_member_id: uuidSchema,

  // NGO profile
  focus_areas: z.array(z.string()).optional(),
  target_beneficiaries: z.array(z.string()).optional(),
  geographic_reach: z.string().max(255).optional().or(z.literal('')),
  team_size: z.coerce.number().int().min(1).max(10000).optional(),

  // Registration
  is_registered: z.boolean().optional(),
  registration_type: z.string().max(100).optional().or(z.literal('')),
  tax_exemption_status: z.string().max(100).optional().or(z.literal('')),

  // Partnership
  partnership_type: z.array(partnershipTypeSchema).optional(),
  collaboration_areas: z.array(z.string()).optional(),
  resources_they_can_provide: z.array(z.string()).optional(),
  resources_they_need: z.array(z.string()).optional(),

  // Operational
  decision_maker: z.string().max(255).optional().or(z.literal('')),
  decision_making_process: z.string().max(500).optional().or(z.literal('')),
  lead_time_required: z.string().max(100).optional().or(z.literal('')),

  // Notes
  notes: z.string().max(2000).optional().or(z.literal('')),
})

// ============================================================================
// VENDOR VALIDATION SCHEMAS
// ============================================================================

export const vendorFormSchema = z.object({
  // Required fields
  vendor_name: z.string().min(1, 'Vendor name is required').max(255),
  vendor_category: vendorCategorySchema,

  // Optional basic info
  status: stakeholderStatusSchema.optional(),

  // Contact
  contact_person: z.string().max(255).optional().or(z.literal('')),
  email: emailSchema,
  phone_primary: phoneSchema,
  phone_secondary: phoneSchema,

  // Address
  address_line1: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: pincodeSchema,

  // Connection
  connection_type: connectionTypeSchema.optional(),
  connected_through_member_id: uuidSchema,

  // Service details
  services_offered: z.array(z.string()).optional(),
  capacity: z.string().max(255).optional().or(z.literal('')),
  quality_rating: z.coerce.number().min(0).max(5).optional(),

  // Pricing
  pricing_model: z.string().max(100).optional().or(z.literal('')),
  pricing_details: z.any().optional(),
  accepts_negotiation: z.boolean().optional(),

  // Business terms
  payment_terms: z.string().max(255).optional().or(z.literal('')),
  advance_percentage: z.coerce.number().min(0).max(100).optional(),
  cancellation_policy: z.string().max(500).optional().or(z.literal('')),

  // Ratings
  performance_rating: z.coerce.number().min(0).max(5).optional(),

  // Operational
  lead_time_required: z.string().max(100).optional().or(z.literal('')),
  minimum_order_value: z.coerce.number().min(0).optional(),
  serves_locations: z.array(z.string()).optional(),

  // Documents
  has_gst_certificate: z.boolean().optional(),
  gst_number: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format').optional().or(z.literal('')),
  has_service_agreement: z.boolean().optional(),

  // Notes
  notes: z.string().max(2000).optional().or(z.literal('')),
}).refine(
  (data) => {
    // If has GST certificate, GST number should be provided
    if (data.has_gst_certificate && !data.gst_number) {
      return false
    }
    return true
  },
  {
    message: 'GST number is required when GST certificate is marked as available',
    path: ['gst_number'],
  }
)

// ============================================================================
// SPEAKER VALIDATION SCHEMAS
// ============================================================================

export const speakerFormSchema = z.object({
  // Required fields
  speaker_name: z.string().min(1, 'Speaker name is required').max(255),

  // Optional basic info
  professional_title: z.string().max(255).optional().or(z.literal('')),
  status: stakeholderStatusSchema.optional(),

  // Contact
  email: emailSchema,
  phone: phoneSchema,
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),

  // Connection
  connection_type: connectionTypeSchema.optional(),
  connected_through_member_id: uuidSchema,

  // Expertise
  expertise_areas: z.array(z.string()).optional(),
  suitable_topics: z.array(z.string()).optional(),
  target_audience: z.array(z.string()).optional(),
  session_formats: z.array(z.string()).optional(),

  // Experience
  years_of_experience: z.coerce.number().int().min(0).max(70).optional(),
  organizations_associated: z.array(z.string()).optional(),
  notable_achievements: z.array(z.string()).optional(),

  // Session details
  typical_session_duration: z.string().max(100).optional().or(z.literal('')),
  max_audience_size: z.coerce.number().int().min(1).max(100000).optional(),
  requires_av_equipment: z.array(z.string()).optional(),
  language_proficiency: z.array(z.string()).optional(),

  // Commercial
  charges_fee: z.boolean().optional(),
  fee_range: z.string().max(100).optional().or(z.literal('')),
  travel_charges: z.string().max(255).optional().or(z.literal('')),
  accommodation_required: z.boolean().optional(),

  // Availability
  availability_status: z.string().max(50).optional().or(z.literal('')),
  preferred_days: z.array(z.string()).optional(),
  preferred_time_slots: z.array(z.string()).optional(),

  // Operational
  lead_time_required: z.string().max(100).optional().or(z.literal('')),
  special_requirements: z.array(z.string()).optional(),

  // Notes
  notes: z.string().max(2000).optional().or(z.literal('')),
}).refine(
  (data) => {
    // If charges fee, fee range should be provided
    if (data.charges_fee && !data.fee_range) {
      return false
    }
    return true
  },
  {
    message: 'Fee range is required when speaker charges a fee',
    path: ['fee_range'],
  }
)

// ============================================================================
// SHARED OPERATION VALIDATION SCHEMAS
// ============================================================================

export const contactFormSchema = z.object({
  stakeholder_type: z.string().min(1, 'Stakeholder type is required'),
  stakeholder_id: z.string().uuid('Invalid stakeholder ID'),

  // Contact details
  contact_name: z.string().min(1, 'Contact name is required').max(255),
  designation: z.string().max(255).optional().or(z.literal('')),
  email: emailSchema,
  phone_primary: phoneSchema,
  phone_secondary: phoneSchema,

  // Flags
  is_primary_contact: z.boolean().optional(),
  is_decision_maker: z.boolean().optional(),

  // Preferences
  preferred_contact_method: z.string().max(50).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
})

export const interactionFormSchema = z.object({
  stakeholder_type: z.string().min(1, 'Stakeholder type is required'),
  stakeholder_id: z.string().uuid('Invalid stakeholder ID'),

  // Interaction details
  interaction_type: interactionTypeSchema,
  interaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  outcome: interactionOutcomeSchema,
  summary: z.string().min(10, 'Summary must be at least 10 characters').max(2000),

  // Next steps
  next_steps: z.string().max(1000).optional().or(z.literal('')),

  // Follow-up
  requires_follow_up: z.boolean().optional(),
  follow_up_date: dateSchema,
  follow_up_assigned_to: uuidSchema,

  // Metadata
  attended_by_members: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
}).refine(
  (data) => {
    // If requires follow-up, follow-up date should be provided
    if (data.requires_follow_up && !data.follow_up_date) {
      return false
    }
    // Follow-up date should be in the future
    if (data.follow_up_date) {
      const followUpDate = new Date(data.follow_up_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return followUpDate >= today
    }
    return true
  },
  {
    message: 'Follow-up date is required and must be today or in the future when follow-up is required',
    path: ['follow_up_date'],
  }
)

export const mouFormSchema = z.object({
  stakeholder_type: z.string().min(1, 'Stakeholder type is required'),
  stakeholder_id: z.string().uuid('Invalid stakeholder ID'),

  // MoU details
  mou_title: z.string().min(1, 'MoU title is required').max(255),
  mou_status: mouStatusSchema,

  // Dates
  signed_date: dateSchema,
  valid_from: dateSchema,
  valid_to: dateSchema,
  renewal_date: dateSchema,

  // Content
  scope_of_collaboration: z.string().max(2000).optional().or(z.literal('')),
  key_deliverables: z.array(z.string()).optional(),
  compliance_requirements: z.array(z.string()).optional(),

  // Document
  document_url: urlSchema,
}).refine(
  (data) => {
    // If valid_to is provided, it should be after valid_from
    if (data.valid_from && data.valid_to) {
      const validFrom = new Date(data.valid_from)
      const validTo = new Date(data.valid_to)
      return validTo > validFrom
    }
    return true
  },
  {
    message: 'Valid to date must be after valid from date',
    path: ['valid_to'],
  }
).refine(
  (data) => {
    // If status is signed, signed_date should be provided
    if (data.mou_status === 'signed' && !data.signed_date) {
      return false
    }
    return true
  },
  {
    message: 'Signed date is required when MoU status is signed',
    path: ['signed_date'],
  }
)

export const documentFormSchema = z.object({
  stakeholder_type: z.string().min(1, 'Stakeholder type is required'),
  stakeholder_id: z.string().uuid('Invalid stakeholder ID'),

  // Document details
  document_type: z.string().min(1, 'Document type is required').max(100),
  document_name: z.string().min(1, 'Document name is required').max(255),
  description: z.string().max(1000).optional().or(z.literal('')),

  // File
  file_url: z.string().url('Invalid file URL'),
  file_size: z.coerce.number().int().min(1).max(100000000).optional(), // Max 100MB

  // Metadata
  tags: z.array(z.string()).optional(),
})

// ============================================================================
// FILTER SCHEMAS (for data tables)
// ============================================================================

export const stakeholderFilterSchema = z.object({
  status: z.array(stakeholderStatusSchema).optional(),
  health_tier: z.array(healthTierSchema).optional(),
  mou_status: z.array(mouStatusSchema).optional(),
  connection_type: z.array(connectionTypeSchema).optional(),
  city: z.array(z.string()).optional(),
  search: z.string().optional(),
})

export const schoolFilterSchema = stakeholderFilterSchema.extend({
  school_type: z.array(schoolTypeSchema).optional(),
  has_auditorium: z.boolean().optional(),
  has_smart_class: z.boolean().optional(),
})

export const collegeFilterSchema = stakeholderFilterSchema.extend({
  college_type: z.array(collegeTypeSchema).optional(),
  has_yuva_chapter: z.boolean().optional(),
})

export const industryFilterSchema = stakeholderFilterSchema.extend({
  industry_sector: z.array(industrySectorSchema).optional(),
  has_csr_program: z.boolean().optional(),
  can_provide_internships: z.boolean().optional(),
})

export const vendorFilterSchema = stakeholderFilterSchema.extend({
  vendor_category: z.array(vendorCategorySchema).optional(),
  has_gst_certificate: z.boolean().optional(),
})

export const interactionFilterSchema = z.object({
  interaction_type: z.array(interactionTypeSchema).optional(),
  outcome: z.array(interactionOutcomeSchema).optional(),
  requires_follow_up: z.boolean().optional(),
  date_from: dateSchema,
  date_to: dateSchema,
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SchoolFormInput = z.infer<typeof schoolFormSchema>
export type CollegeFormInput = z.infer<typeof collegeFormSchema>
export type IndustryFormInput = z.infer<typeof industryFormSchema>
export type GovernmentStakeholderFormInput = z.infer<typeof governmentStakeholderFormSchema>
export type NGOFormInput = z.infer<typeof ngoFormSchema>
export type VendorFormInput = z.infer<typeof vendorFormSchema>
export type SpeakerFormInput = z.infer<typeof speakerFormSchema>

export type ContactFormInput = z.infer<typeof contactFormSchema>
export type InteractionFormInput = z.infer<typeof interactionFormSchema>
export type MouFormInput = z.infer<typeof mouFormSchema>
export type DocumentFormInput = z.infer<typeof documentFormSchema>

export type StakeholderFilter = z.infer<typeof stakeholderFilterSchema>
export type SchoolFilter = z.infer<typeof schoolFilterSchema>
export type CollegeFilter = z.infer<typeof collegeFilterSchema>
export type IndustryFilter = z.infer<typeof industryFilterSchema>
export type VendorFilter = z.infer<typeof vendorFilterSchema>
export type InteractionFilter = z.infer<typeof interactionFilterSchema>
