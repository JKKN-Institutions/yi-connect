/**
 * Health Card Activity Reporting Module
 * TypeScript Type Definitions
 *
 * Activity reporting system where EC Chairs/Vertical Heads log
 * completed activities with participation counts.
 * Note: Form may have vertical-specific fields based on selected vertical.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type SubmitterRole = 'chapter_em' | 'chair' | 'co_chair' | 'vertical_head' | 'member'

/**
 * AAA Framework classification
 * Every activity must be categorized as one of these
 */
export type AAAType = 'awareness' | 'action' | 'advocacy'

export type YiRegion =
  | 'east_region'
  | 'jksn'
  | 'north_region'
  | 'south_region'
  | 'srtn'
  | 'west_region'

// ============================================================================
// HEALTH CARD ENTRY TYPES
// ============================================================================

/**
 * Base Health Card entry (database row)
 */
export interface HealthCardEntry {
  id: string

  // Submitter Info
  submitter_name: string
  submitter_role: SubmitterRole
  email: string
  member_id: string | null // If logged in

  // Activity Info
  activity_date: string // ISO date
  activity_name: string
  activity_description: string | null
  aaa_type: AAAType | null // Optional: Awareness, Action, or Advocacy

  // Chapter/Region
  chapter_id: string
  region: YiRegion

  // Participation Counts
  ec_members_count: number
  non_ec_members_count: number

  // Vertical Link
  vertical_id: string

  // Vertical-specific data (JSONB for flexibility)
  vertical_specific_data: Record<string, unknown> | null

  // Metadata
  fiscal_year: number
  created_at: string
  updated_at: string
}

/**
 * Health Card entry with related data
 */
export interface HealthCardEntryWithDetails extends HealthCardEntry {
  chapter?: {
    id: string
    name: string
    short_name: string | null
  }
  vertical?: {
    id: string
    name: string
    slug: string
    color: string | null
    icon: string | null
  }
  member?: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

// ============================================================================
// DASHBOARD / AGGREGATION TYPES
// ============================================================================

/**
 * Health Card summary by vertical
 */
export interface VerticalHealthSummary {
  vertical_id: string
  vertical_name: string
  vertical_slug: string
  vertical_color: string | null
  vertical_icon: string | null

  // Activity counts
  total_activities: number
  activities_this_month: number
  activities_this_quarter: number

  // Participation totals
  total_ec_participants: number
  total_non_ec_participants: number
  total_participants: number

  // Averages
  avg_participants_per_activity: number
}

/**
 * Health Card summary by region
 */
export interface RegionHealthSummary {
  region: YiRegion
  region_name: string

  total_activities: number
  total_ec_participants: number
  total_non_ec_participants: number
  total_participants: number
}

/**
 * Health Card dashboard overview
 */
export interface HealthCardDashboard {
  fiscal_year: number
  chapter_id: string
  chapter_name: string

  // Summary stats
  total_activities: number
  total_ec_participants: number
  total_non_ec_participants: number
  total_participants: number

  // Activity counts by time period
  activities_this_week: number
  activities_this_month: number
  activities_this_quarter: number

  // Breakdowns
  verticals: VerticalHealthSummary[]
  regions: RegionHealthSummary[]

  // Recent entries
  recent_entries: HealthCardEntryWithDetails[]
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

/**
 * Form data for submitting a health card entry
 */
export interface CreateHealthCardInput {
  // Submitter Info
  submitter_name: string
  submitter_role: SubmitterRole
  email: string

  // Activity Info
  activity_date: string
  activity_name: string
  activity_description?: string
  aaa_type?: AAAType // Optional: Awareness, Action, or Advocacy

  // Chapter/Region
  chapter_id: string
  region: YiRegion

  // Participation
  ec_members_count: number
  non_ec_members_count: number

  // Vertical
  vertical_id: string

  // Vertical-specific (optional)
  vertical_specific_data?: Record<string, unknown>
}

/**
 * Update health card entry
 */
export interface UpdateHealthCardInput extends Partial<CreateHealthCardInput> {
  id: string
}

// ============================================================================
// FILTER TYPES
// ============================================================================

/**
 * Filters for health card listing
 */
export interface HealthCardFilters {
  chapter_id?: string
  vertical_id?: string
  region?: YiRegion
  fiscal_year?: number
  date_from?: string
  date_to?: string
  submitter_role?: SubmitterRole
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Submitter role options for UI
 */
export const SUBMITTER_ROLES: { value: SubmitterRole; label: string }[] = [
  { value: 'chapter_em', label: 'Chapter EM' },
  { value: 'chair', label: 'Chair' },
  { value: 'co_chair', label: 'Co-Chair' },
  { value: 'vertical_head', label: 'Vertical Head' },
  { value: 'member', label: 'Member' },
]

/**
 * Yi Region options for UI
 */
export const YI_REGIONS: { value: YiRegion; label: string }[] = [
  { value: 'east_region', label: 'East Region' },
  { value: 'jksn', label: 'JKSN' },
  { value: 'north_region', label: 'North Region' },
  { value: 'south_region', label: 'South Region' },
  { value: 'srtn', label: 'SRTN' },
  { value: 'west_region', label: 'West Region' },
]

/**
 * Region name lookup
 */
export const REGION_NAMES: Record<YiRegion, string> = {
  east_region: 'East Region',
  jksn: 'JKSN',
  north_region: 'North Region',
  south_region: 'South Region',
  srtn: 'SRTN',
  west_region: 'West Region',
}

/**
 * AAA Type options for UI (Optional classification)
 */
export const AAA_TYPES: { value: AAAType; label: string; description: string }[] = [
  { value: 'awareness', label: 'Awareness', description: 'Sessions, workshops, campaigns to educate' },
  { value: 'action', label: 'Action', description: 'Events, drives, activities with measurable output' },
  { value: 'advocacy', label: 'Advocacy', description: 'Government meetings, policy influence, MOUs' },
]

/**
 * AAA Type name lookup
 */
export const AAA_TYPE_NAMES: Record<AAAType, string> = {
  awareness: 'Awareness',
  action: 'Action',
  advocacy: 'Advocacy',
}

// ============================================================================
// VERTICAL-SPECIFIC FIELD CONFIGURATIONS
// ============================================================================

/**
 * Field definition for vertical-specific fields
 */
export interface VerticalSpecificField {
  key: string
  label: string
  type: 'number' | 'text' | 'select' | 'textarea'
  placeholder?: string
  options?: { value: string; label: string }[]
  required?: boolean
}

/**
 * Vertical-specific field definitions
 * When a vertical is selected, these additional fields appear
 */
export const VERTICAL_SPECIFIC_FIELDS: Record<string, VerticalSpecificField[]> = {
  masoom: [
    {
      key: 'session_type',
      label: 'Session Type',
      type: 'select',
      required: true,
      options: [
        { value: 'sense', label: 'S.E.N.S.E Module' },
        { value: 'digilante', label: 'Digilante (Cyber Safety)' },
        { value: 'parent_workshop', label: 'Parent Workshop' },
        { value: 'teacher_training', label: 'Teacher Training' },
        { value: 'street_play', label: 'Street Play/Skit' },
      ],
    },
    { key: 'schools_covered', label: 'Schools Covered', type: 'number', placeholder: 'Number of schools' },
    { key: 'students_impacted', label: 'Students Impacted', type: 'number', placeholder: 'Total students reached' },
  ],
  'climate-change': [
    {
      key: 'activity_type',
      label: 'Activity Type',
      type: 'select',
      required: true,
      options: [
        { value: 'plantation', label: 'Tree Plantation' },
        { value: 'water_cleanup', label: 'Water Body Cleanup' },
        { value: 'awareness', label: 'Sustainability Awareness' },
        { value: 'seed_ball', label: 'Seed Ball Making' },
        { value: 'ewaste', label: 'E-Waste Collection' },
      ],
    },
    { key: 'trees_planted', label: 'Trees Planted', type: 'number', placeholder: 'Number of trees' },
    { key: 'water_bodies_cleaned', label: 'Water Bodies Cleaned', type: 'number', placeholder: 'Number of water bodies' },
  ],
  'road-safety': [
    {
      key: 'program_type',
      label: 'Program Type',
      type: 'select',
      required: true,
      options: [
        { value: 'chota_cop', label: 'Chota Cop Training' },
        { value: 'farishtey', label: 'Farishtey Certification' },
        { value: 'helmet_campaign', label: 'Helmet/Seatbelt Campaign' },
        { value: 'good_samaritan', label: 'Good Samaritan Awareness' },
        { value: 'road_safety_week', label: 'Road Safety Week Event' },
      ],
    },
    { key: 'students_trained', label: 'Students Trained', type: 'number', placeholder: 'Chota Cop students' },
    { key: 'schools_visited', label: 'Schools Visited', type: 'number', placeholder: 'Number of schools' },
    { key: 'certifications_issued', label: 'Certifications Issued', type: 'number', placeholder: 'Farishtey certifications' },
  ],
  health: [
    {
      key: 'session_type',
      label: 'Session Type',
      type: 'select',
      required: true,
      options: [
        { value: 'mental_wellness', label: 'Mental Wellness' },
        { value: 'life_skills', label: 'Life Skills Training' },
        { value: 'nimhans_tot', label: 'NIMHANS ToT' },
        { value: 'rural_health', label: 'Rural Health Session' },
        { value: 'run_for_health', label: 'Run for Mental Health' },
      ],
    },
    { key: 'beneficiaries_count', label: 'Beneficiaries', type: 'number', placeholder: 'People benefited' },
    { key: 'certified_trainers', label: 'Certified Trainers', type: 'number', placeholder: 'ToT certifications' },
  ],
  membership: [
    {
      key: 'activity_type',
      label: 'Activity Type',
      type: 'select',
      required: true,
      options: [
        { value: 'prospect_event', label: 'Prospect Networking Event' },
        { value: 'renewal_drive', label: 'Renewal Drive' },
        { value: 'induction', label: 'Member Induction' },
        { value: 'spotlight', label: 'Member Spotlight' },
        { value: 'female_founder', label: 'Female Founder Outreach' },
      ],
    },
    { key: 'new_members', label: 'New Members Inducted', type: 'number', placeholder: 'New inductees' },
    { key: 'renewals', label: 'Renewals Processed', type: 'number', placeholder: 'Renewal count' },
    { key: 'prospects_engaged', label: 'Prospects Engaged', type: 'number', placeholder: 'Potential members contacted' },
  ],
  yuva: [
    {
      key: 'activity_type',
      label: 'Activity Type',
      type: 'select',
      required: true,
      options: [
        { value: 'campus_ambassador', label: 'Campus Ambassador Program' },
        { value: 'mou_signing', label: 'College MOU Signing' },
        { value: 'career_session', label: 'Career Catalyst Session' },
        { value: 'street_play', label: 'MASOOM Street Play' },
        { value: 'dean_connect', label: 'Dean Connect Meeting' },
      ],
    },
    { key: 'colleges_engaged', label: 'Colleges Engaged', type: 'number', placeholder: 'Number of colleges' },
    { key: 'students_enrolled', label: 'Students Enrolled', type: 'number', placeholder: 'New Yuva registrations' },
    { key: 'internships_facilitated', label: 'Internships Facilitated', type: 'number', placeholder: 'Internship placements' },
  ],
  thalir: [
    {
      key: 'activity_type',
      label: 'Activity Type',
      type: 'select',
      required: true,
      options: [
        { value: 'yip', label: 'Young Indians Parliament (YIP)' },
        { value: 'booklet_distribution', label: 'Yi Young Champions Booklet' },
        { value: 'democracy_101', label: 'Democracy 101 Module' },
        { value: 'parent_sabha', label: 'Parent Sabha' },
        { value: 'school_mou', label: 'School MOU Signing' },
      ],
    },
    { key: 'schools_engaged', label: 'Schools Engaged', type: 'number', placeholder: 'Number of schools' },
    { key: 'yip_participants', label: 'YIP Participants', type: 'number', placeholder: 'Students in YIP' },
    { key: 'booklets_distributed', label: 'Booklets Distributed', type: 'number', placeholder: 'Yi Young Champions booklets' },
  ],
  'rural-initiative': [
    {
      key: 'activity_type',
      label: 'Activity Type',
      type: 'select',
      required: true,
      options: [
        { value: 'village_sabha', label: 'Village Sabha' },
        { value: 'shg_connect', label: 'SHG Connect Session' },
        { value: 'range_de', label: 'Range De Campaign' },
        { value: 'rural_bazaar', label: 'Rural Bazaar' },
        { value: 'artisan_feature', label: 'Artisan Feature/Story' },
      ],
    },
    { key: 'villages_covered', label: 'Villages Covered', type: 'number', placeholder: 'Number of villages' },
    { key: 'shgs_engaged', label: 'SHGs Engaged', type: 'number', placeholder: 'Self-Help Groups reached' },
    { key: 'artisans_connected', label: 'Artisans Connected', type: 'number', placeholder: 'Artisans supported' },
  ],
  entrepreneurship: [
    {
      key: 'activity_type',
      label: 'Activity Type',
      type: 'select',
      required: true,
      options: [
        { value: 'bew_event', label: 'BEW Event' },
        { value: 'kidpreneur', label: 'Kidpreneur Program' },
        { value: 'bbic', label: 'BBIC Campus Roadshow' },
        { value: 'startup_showcase', label: 'Startup Showcase' },
        { value: 'pitch_session', label: 'Pitch Session' },
      ],
    },
    { key: 'kidpreneurs_trained', label: 'Kidpreneurs Trained', type: 'number', placeholder: 'Kids in Kidpreneur program' },
    { key: 'startups_showcased', label: 'Startups Showcased', type: 'number', placeholder: 'Startups featured' },
    { key: 'seed_capital_distributed', label: 'Seed Capital (₹)', type: 'number', placeholder: 'Total seed money' },
  ],
  innovation: [
    {
      key: 'activity_type',
      label: 'Activity Type',
      type: 'select',
      required: true,
      options: [
        { value: 'ids', label: 'IDS Hackathon' },
        { value: 'ai_labs', label: 'Yi AI Innovation Labs' },
        { value: 'ai_literacy', label: 'AI for Yi Session' },
        { value: 'innovx', label: 'Thalir InnovX' },
        { value: 'problem_statement', label: 'Problem Statement Reveal' },
      ],
    },
    { key: 'ids_teams', label: 'IDS Teams Formed', type: 'number', placeholder: 'Teams participating' },
    { key: 'ai_labs_schools', label: 'AI Labs Schools', type: 'number', placeholder: 'Schools with AI Labs' },
    { key: 'innovations_submitted', label: 'Innovations Submitted', type: 'number', placeholder: 'Ideas/prototypes' },
  ],
  learning: [
    {
      key: 'activity_type',
      label: 'Activity Type',
      type: 'select',
      required: true,
      options: [
        { value: 'yi_talks', label: 'Yi Talks Session' },
        { value: 'inner_circle', label: 'Inner Circle Meeting' },
        { value: 'ceo_mission', label: 'CEO Mission' },
        { value: 'internship_matching', label: 'Internship Matching' },
        { value: 'industry_visit', label: 'Industry Visit' },
      ],
    },
    { key: 'attendees', label: 'Session Attendees', type: 'number', placeholder: 'People attended' },
    { key: 'internships_matched', label: 'Internships Matched', type: 'number', placeholder: 'Students placed' },
    { key: 'inner_circles_active', label: 'Inner Circles Active', type: 'number', placeholder: 'Active peer groups' },
  ],
}

/**
 * Get vertical-specific fields for a given vertical slug
 */
export function getVerticalSpecificFields(verticalSlug: string): VerticalSpecificField[] {
  return VERTICAL_SPECIFIC_FIELDS[verticalSlug] || []
}
