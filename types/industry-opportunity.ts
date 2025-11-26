/**
 * Industry Opportunity Type Definitions
 *
 * Type definitions for Industry Opportunities bidirectional system.
 * Includes opportunities, applications, visit requests, and impact metrics.
 */

// ============================================================================
// ENUMS
// ============================================================================

export const OPPORTUNITY_TYPES = [
  'industrial_visit',
  'internship',
  'mentorship',
  'guest_lecture',
  'job_opening',
  'project_collaboration',
  'training_program',
  'sponsorship',
  'csr_partnership',
  'other'
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const OPPORTUNITY_STATUSES = [
  'draft',
  'published',
  'accepting_applications',
  'closed',
  'completed',
  'cancelled',
  'expired'
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const APPLICATION_STATUSES = [
  'draft',
  'pending_review',
  'under_review',
  'shortlisted',
  'accepted',
  'waitlisted',
  'declined',
  'withdrawn'
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const VISIT_REQUEST_STATUSES = [
  'pending_yi_review',
  'yi_approved',
  'forwarded_to_industry',
  'industry_accepted',
  'industry_declined',
  'scheduled',
  'completed',
  'cancelled'
] as const;
export type VisitRequestStatus = (typeof VISIT_REQUEST_STATUSES)[number];

export const VISIT_TYPES = ['solo', 'group'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const PARTNERSHIP_STAGES = [
  'initial_contact',
  'negotiation',
  'active_collaboration',
  'renewal_phase',
  'dormant'
] as const;
export type PartnershipStage = (typeof PARTNERSHIP_STAGES)[number];

export const ENGAGEMENT_TIERS = [
  'platinum',
  'gold',
  'silver',
  'bronze',
  'new'
] as const;
export type EngagementTier = (typeof ENGAGEMENT_TIERS)[number];

// ============================================================================
// ELIGIBILITY CRITERIA
// ============================================================================

export interface EligibilityCriteria {
  industries?: string[];
  skills?: string[];
  experience_levels?: ('entry' | 'mid' | 'senior')[];
  min_experience_years?: number;
  min_engagement_score?: number;
  membership_types?: string[];
  custom_requirements?: string[];
}

// ============================================================================
// MATCH SCORE TYPES
// ============================================================================

export interface MatchScoreBreakdown {
  overall_score: number;
  industry_score: number;
  skills_score: number;
  experience_score: number;
  engagement_score: number;
}

export interface MatchScoreWeights {
  industry: number;
  skills: number;
  experience: number;
  engagement: number;
}

// ============================================================================
// OPPORTUNITY TYPES
// ============================================================================

export interface IndustryOpportunity {
  id: string;
  chapter_id: string;
  industry_id: string;
  title: string;
  description: string;
  opportunity_type: OpportunityType;
  status: OpportunityStatus;
  start_date: string | null;
  end_date: string | null;
  duration_description: string | null;
  application_deadline: string;
  max_participants: number | null;
  current_applications: number;
  accepted_count: number;
  positions_filled: number;
  eligibility_criteria: EligibilityCriteria;
  location: string | null;
  is_remote: boolean;
  meeting_link: string | null;
  is_paid: boolean;
  compensation_type: string | null;
  compensation_details: string | null;
  benefits: string[] | null;
  learning_outcomes: string[] | null;
  requirements: string[] | null;
  what_to_bring: string[] | null;
  contact_person_name: string | null;
  contact_person_email: string | null;
  contact_person_phone: string | null;
  banner_image_url: string | null;
  attachment_urls: string[] | null;
  is_featured: boolean;
  visibility: 'chapter' | 'national' | 'public';
  tags: string[] | null;
  view_count: number;
  bookmark_count: number;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  target_member_profiles: string[] | null;
  relevance_tags: string[] | null;
  created_by: string | null;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityListItem extends IndustryOpportunity {
  industry_name: string;
  industry_sector: string;
  industry_logo_url?: string | null;
  match_score?: number;
  has_applied?: boolean;
  is_bookmarked?: boolean;
  days_until_deadline: number;
  spots_remaining: number | null;
}

export interface OpportunityWithDetails extends IndustryOpportunity {
  industry: {
    id: string;
    company_name: string;
    industry_sector: string;
    city: string | null;
    logo_url: string | null;
    website: string | null;
  };
  applications_summary: {
    total: number;
    pending: number;
    shortlisted: number;
    accepted: number;
    declined: number;
  };
  // UI-friendly aliases
  type?: string; // Maps to internship, project, mentorship, job, training, visit
  deadline?: string;
  stakeholder?: {
    id: string;
    name: string;
    industry_type?: string | null;
    city?: string | null;
    state?: string | null;
    logo_url?: string | null;
    website?: string | null;
  } | null;
  match_score?: number;
  match_breakdown?: {
    industry: number;
    skills: number;
    experience: number;
    engagement: number;
  };
  applications_count?: number;
  skills_required?: string[] | null;
  duration?: string | null;
  positions_available?: number | null;
  compensation_amount?: string | null;
  // Note: compensation_type and start_date are inherited from IndustryOpportunity
}

// ============================================================================
// APPLICATION TYPES
// ============================================================================

export interface OpportunityApplication {
  id: string;
  opportunity_id: string;
  member_id: string;
  match_score: number | null;
  match_breakdown: MatchScoreBreakdown | null;
  motivation_statement: string;
  learning_goals: string | null;
  relevant_experience: string | null;
  transportation_preference: string | null;
  dietary_preference: string | null;
  special_requirements: string | null;
  resume_url: string | null;
  portfolio_url: string | null;
  additional_documents: string[] | null;
  member_snapshot: MemberSnapshot | null;
  status: ApplicationStatus;
  status_changed_at: string | null;
  status_changed_by: string | null;
  reviewer_notes: string | null;
  priority_rank: number | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  interview_scheduled_at: string | null;
  interview_location: string | null;
  interview_notes: string | null;
  interview_rating: number | null;
  outcome_at: string | null;
  outcome_notes: string | null;
  notification_sent_at: string | null;
  applied_at: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationListItem extends OpportunityApplication {
  member: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    company: string | null;
    designation: string | null;
    engagement_score: number | null;
  };
  opportunity?: {
    id: string;
    title: string;
    opportunity_type: OpportunityType;
    industry_name: string;
    application_deadline: string;
  };
}

export interface ApplicationWithDetails extends OpportunityApplication {
  member: MemberSnapshot;
  opportunity: OpportunityWithDetails;
}

export interface MemberSnapshot {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  company: string | null;
  designation: string | null;
  industry: string | null;
  business_type: string | null;
  years_of_experience: number | null;
  skills: Array<{ name: string; proficiency: string }>;
  engagement_score: number | null;
  yi_activity_score: number | null;
}

// ============================================================================
// VISIT REQUEST TYPES
// ============================================================================

export interface PreferredDate {
  date: string;
  time_slot: 'morning' | 'afternoon' | 'full_day';
}

export interface MemberVisitRequest {
  id: string;
  chapter_id: string;
  requested_by: string;
  industry_id: string;
  mou_id: string | null;
  request_title: string;
  visit_purpose: string;
  visit_type: VisitType;
  preferred_dates: PreferredDate[];
  preferred_time_slot: string | null;
  expected_participants: number;
  participant_profile: string | null;
  group_details: string | null;
  additional_notes: string | null;
  status: VisitRequestStatus;
  yi_reviewer_id: string | null;
  yi_reviewed_at: string | null;
  yi_approval_notes: string | null;
  rejection_reason: string | null;
  industry_contact_id: string | null;
  industry_contacted_at: string | null;
  industry_contacted_by: string | null;
  industry_responded_at: string | null;
  industry_response_notes: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_duration: string | null;
  visit_location: string | null;
  converted_event_id: string | null;
  converted_at: string | null;
  completed_at: string | null;
  feedback: string | null;
  feedback_rating: number | null;
  interest_count: number;
  created_at: string;
  updated_at: string;
}

export interface VisitRequestWithDetails extends MemberVisitRequest {
  member: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    company: string | null;
  };
  industry: {
    id: string;
    company_name: string;
    city: string | null;
    industry_sector: string | null;
  };
  mou?: {
    id: string;
    mou_title: string | null;
    expiry_date: string | null;
    partnership_stage: PartnershipStage | null;
  } | null;
  yi_reviewer?: {
    id: string;
    full_name: string;
  } | null;
  interested_members?: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
  }>;
}

// ============================================================================
// VISIT REQUEST INTEREST
// ============================================================================

export interface VisitRequestInterest {
  id: string;
  visit_request_id: string;
  member_id: string;
  interest_reason: string | null;
  created_at: string;
}

// ============================================================================
// BOOKMARK TYPES
// ============================================================================

export interface OpportunityBookmark {
  id: string;
  opportunity_id: string;
  member_id: string;
  notes: string | null;
  created_at: string;
}

// ============================================================================
// INDUSTRY IMPACT METRICS
// ============================================================================

export interface IndustryImpactMetrics {
  id: string;
  industry_id: string;
  chapter_id: string;
  total_opportunities_posted: number;
  active_opportunities: number;
  total_applications_received: number;
  total_positions_filled: number;
  average_applications_per_opportunity: number | null;
  total_visits_hosted: number;
  total_visitors: number;
  visit_satisfaction_avg: number | null;
  total_sessions_hosted: number;
  total_beneficiaries: number;
  session_satisfaction_avg: number | null;
  total_csr_contribution: number;
  total_sponsorship_value: number;
  engagement_score: number;
  engagement_tier: EngagementTier | null;
  top_learning_outcomes: string[] | null;
  average_rating: number | null;
  last_opportunity_posted_at: string | null;
  last_visit_hosted_at: string | null;
  last_interaction_at: string | null;
  calculated_at: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PARTNERSHIP LIFECYCLE
// ============================================================================

export interface PartnershipLifecycle {
  mou_id: string;
  industry_id: string;
  industry_name: string;
  partnership_stage: PartnershipStage;
  mou_signed_date: string | null;
  mou_expiry_date: string | null;
  first_opportunity_date: string | null;
  last_opportunity_date: string | null;
  opportunities_provided: number;
  members_benefited: number;
  days_until_expiry: number | null;
  renewal_reminder_sent: boolean;
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

export interface CreateOpportunityInput {
  industry_id: string;
  title: string;
  description: string;
  opportunity_type: OpportunityType;
  start_date?: string;
  end_date?: string;
  duration_description?: string;
  application_deadline: string;
  max_participants?: number;
  eligibility_criteria: EligibilityCriteria;
  location?: string;
  is_remote?: boolean;
  meeting_link?: string;
  is_paid?: boolean;
  compensation_type?: string;
  compensation_details?: string;
  benefits?: string[];
  learning_outcomes?: string[];
  requirements?: string[];
  what_to_bring?: string[];
  contact_person_name?: string;
  contact_person_email?: string;
  contact_person_phone?: string;
  tags?: string[];
}

export interface UpdateOpportunityInput extends Partial<CreateOpportunityInput> {
  status?: OpportunityStatus;
}

export interface SubmitApplicationInput {
  opportunity_id: string;
  motivation_statement: string;
  learning_goals?: string;
  relevant_experience?: string;
  transportation_preference?: string;
  dietary_preference?: string;
  special_requirements?: string;
  resume_url?: string;
  portfolio_url?: string;
  additional_documents?: string[];
}

export interface ReviewApplicationInput {
  application_id: string;
  status: 'shortlisted' | 'accepted' | 'waitlisted' | 'declined';
  reviewer_notes?: string;
  outcome_notes?: string;
}

export interface BulkReviewInput {
  application_ids: string[];
  status: 'accepted' | 'waitlisted' | 'declined';
  reviewer_notes?: string;
}

export interface CreateVisitRequestInput {
  industry_id: string;
  request_title: string;
  visit_purpose: string;
  visit_type: VisitType;
  preferred_dates: PreferredDate[];
  expected_participants?: number;
  participant_profile?: string;
  group_details?: string;
  additional_notes?: string;
}

export interface ReviewVisitRequestInput {
  request_id: string;
  action: 'approve' | 'decline' | 'forward_to_industry';
  notes?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  scheduled_duration?: string;
  visit_location?: string;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface OpportunityFilters {
  search?: string;
  opportunity_type?: OpportunityType[];
  status?: OpportunityStatus[];
  industry_id?: string;
  industry_sector?: string[];
  is_remote?: boolean;
  is_paid?: boolean;
  min_match_score?: number;
  deadline_within_days?: number;
  has_spots_available?: boolean;
  is_featured?: boolean;
}

export interface ApplicationFilters {
  opportunity_id?: string;
  member_id?: string;
  status?: ApplicationStatus[];
  min_match_score?: number;
  max_match_score?: number;
  search?: string;
  sort_by?: 'match_score' | 'applied_at' | 'priority_rank';
  sort_direction?: 'asc' | 'desc';
}

export interface VisitRequestFilters {
  status?: VisitRequestStatus[];
  visit_type?: VisitType[];
  industry_id?: string;
  member_id?: string;
  chapter_id?: string;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginatedOpportunities {
  data: OpportunityListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedApplications {
  data: ApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedVisitRequests {
  data: VisitRequestWithDetails[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  industrial_visit: 'Industrial Visit',
  internship: 'Internship',
  mentorship: 'Mentorship Program',
  guest_lecture: 'Guest Lecture',
  job_opening: 'Job Opening',
  project_collaboration: 'Project Collaboration',
  training_program: 'Training Program',
  sponsorship: 'Sponsorship',
  csr_partnership: 'CSR Partnership',
  other: 'Other'
};

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  accepting_applications: 'Accepting Applications',
  closed: 'Closed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired'
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  accepted: 'Accepted',
  waitlisted: 'Waitlisted',
  declined: 'Declined',
  withdrawn: 'Withdrawn'
};

export const VISIT_REQUEST_STATUS_LABELS: Record<VisitRequestStatus, string> = {
  pending_yi_review: 'Pending Yi Review',
  yi_approved: 'Yi Approved',
  forwarded_to_industry: 'Forwarded to Industry',
  industry_accepted: 'Industry Accepted',
  industry_declined: 'Industry Declined',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  solo: 'Solo Visit',
  group: 'Group Visit'
};

export const PARTNERSHIP_STAGE_LABELS: Record<PartnershipStage, string> = {
  initial_contact: 'Initial Contact',
  negotiation: 'Negotiation',
  active_collaboration: 'Active Collaboration',
  renewal_phase: 'Renewal Phase',
  dormant: 'Dormant'
};

export const ENGAGEMENT_TIER_LABELS: Record<EngagementTier, string> = {
  platinum: 'Platinum Partner',
  gold: 'Gold Partner',
  silver: 'Silver Partner',
  bronze: 'Bronze Partner',
  new: 'New Partner'
};

// ============================================================================
// BADGE VARIANTS
// ============================================================================

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'destructive';

export function getOpportunityStatusVariant(
  status: OpportunityStatus
): BadgeVariant {
  const variants: Record<OpportunityStatus, BadgeVariant> = {
    draft: 'default',
    published: 'secondary',
    accepting_applications: 'success',
    closed: 'warning',
    completed: 'success',
    cancelled: 'destructive',
    expired: 'destructive'
  };
  return variants[status];
}

export function getApplicationStatusVariant(
  status: ApplicationStatus
): BadgeVariant {
  const variants: Record<ApplicationStatus, BadgeVariant> = {
    draft: 'default',
    pending_review: 'warning',
    under_review: 'secondary',
    shortlisted: 'success',
    accepted: 'success',
    waitlisted: 'warning',
    declined: 'destructive',
    withdrawn: 'default'
  };
  return variants[status];
}

export function getVisitRequestStatusVariant(
  status: VisitRequestStatus
): BadgeVariant {
  const variants: Record<VisitRequestStatus, BadgeVariant> = {
    pending_yi_review: 'warning',
    yi_approved: 'secondary',
    forwarded_to_industry: 'secondary',
    industry_accepted: 'success',
    industry_declined: 'destructive',
    scheduled: 'success',
    completed: 'success',
    cancelled: 'destructive'
  };
  return variants[status];
}

export function getEngagementTierVariant(tier: EngagementTier): BadgeVariant {
  const variants: Record<EngagementTier, BadgeVariant> = {
    platinum: 'success',
    gold: 'warning',
    silver: 'secondary',
    bronze: 'default',
    new: 'default'
  };
  return variants[tier];
}

// ============================================================================
// MATCH SCORE HELPERS
// ============================================================================

export type MatchLevel = 'high' | 'medium' | 'low';

export function getMatchLevel(score: number): MatchLevel {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export function getMatchLevelLabel(level: MatchLevel): string {
  const labels: Record<MatchLevel, string> = {
    high: 'High Match',
    medium: 'Medium Match',
    low: 'Low Match'
  };
  return labels[level];
}

export function getMatchLevelVariant(level: MatchLevel): BadgeVariant {
  const variants: Record<MatchLevel, BadgeVariant> = {
    high: 'success',
    medium: 'warning',
    low: 'default'
  };
  return variants[level];
}
