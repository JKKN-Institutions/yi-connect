/**
 * Chapter Settings Data Layer
 *
 * Fetches chapter-configurable business rules.
 * Uses React cache() for request-level deduplication.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cache } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ChapterSettings {
  // Session Booking Rules
  sessionBookingAdvanceDays: number;

  // Trainer Workload Rules
  trainerMaxSessionsPerMonth: number;
  trainerWarningThreshold: number;

  // Materials Approval Rules
  materialsApprovalDaysBefore: number;
  materialsRequireChairApproval: boolean;

  // MoU Rules
  mouRequiredForOpportunities: boolean;
  mouAutoCloseOnExpiry: boolean;

  // Privacy Rules
  membersCanSeeOtherAssessments: boolean;
  membersCanSeeOtherApplications: boolean;
  coordinatorsSeeOwnInstitutionOnly: boolean;

  // Engagement Score Weights
  engagementWeights: {
    attendance: number;
    volunteer: number;
    feedback: number;
    skills: number;
  };

  // Readiness Score Weights
  readinessWeights: {
    tenure: number;
    positions: number;
    training: number;
    peerInput: number;
  };

  // Financial Rules
  largeExpenseThreshold: number;
  expenseApprovalRequired: boolean;

  // Normalization Maximums
  maxVolunteerHoursPerYear: number;
  maxSkillsForFullScore: number;
  maxTenureYears: number;
  maxLeadershipPositions: number;
  maxNominations: number;
}

// ============================================================================
// Default Settings (fallback when no chapter or settings found)
// ============================================================================

export const DEFAULT_CHAPTER_SETTINGS: ChapterSettings = {
  sessionBookingAdvanceDays: 7,
  trainerMaxSessionsPerMonth: 6,
  trainerWarningThreshold: 4,
  materialsApprovalDaysBefore: 3,
  materialsRequireChairApproval: true,
  mouRequiredForOpportunities: true,
  mouAutoCloseOnExpiry: true,
  membersCanSeeOtherAssessments: false,
  membersCanSeeOtherApplications: false,
  coordinatorsSeeOwnInstitutionOnly: true,
  engagementWeights: {
    attendance: 0.50,
    volunteer: 0.30,
    feedback: 0.15,
    skills: 0.05,
  },
  readinessWeights: {
    tenure: 0.25,
    positions: 0.25,
    training: 0.25,
    peerInput: 0.25,
  },
  largeExpenseThreshold: 10000,
  expenseApprovalRequired: true,
  maxVolunteerHoursPerYear: 100,
  maxSkillsForFullScore: 10,
  maxTenureYears: 10,
  maxLeadershipPositions: 5,
  maxNominations: 10,
};

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Get chapter settings by chapter ID
 * Returns defaults if no settings found
 */
export const getChapterSettings = cache(
  async (chapterId: string): Promise<ChapterSettings> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('get_chapter_settings', {
      p_chapter_id: chapterId,
    });

    if (error || !data || data.length === 0) {
      console.warn(`No settings found for chapter ${chapterId}, using defaults`);
      return DEFAULT_CHAPTER_SETTINGS;
    }

    const row = data[0];

    return {
      sessionBookingAdvanceDays: row.session_booking_advance_days,
      trainerMaxSessionsPerMonth: row.trainer_max_sessions_per_month,
      trainerWarningThreshold: row.trainer_warning_threshold,
      materialsApprovalDaysBefore: row.materials_approval_days_before,
      materialsRequireChairApproval: row.materials_require_chair_approval,
      mouRequiredForOpportunities: row.mou_required_for_opportunities,
      mouAutoCloseOnExpiry: row.mou_auto_close_on_expiry,
      membersCanSeeOtherAssessments: row.members_can_see_other_assessments,
      membersCanSeeOtherApplications: row.members_can_see_other_applications,
      coordinatorsSeeOwnInstitutionOnly: row.coordinators_see_own_institution_only,
      engagementWeights: {
        attendance: Number(row.engagement_weight_attendance),
        volunteer: Number(row.engagement_weight_volunteer),
        feedback: Number(row.engagement_weight_feedback),
        skills: Number(row.engagement_weight_skills),
      },
      readinessWeights: {
        tenure: Number(row.readiness_weight_tenure),
        positions: Number(row.readiness_weight_positions),
        training: Number(row.readiness_weight_training),
        peerInput: Number(row.readiness_weight_peer_input),
      },
      largeExpenseThreshold: Number(row.large_expense_threshold),
      expenseApprovalRequired: row.expense_approval_required,
      maxVolunteerHoursPerYear: row.max_volunteer_hours_per_year,
      maxSkillsForFullScore: row.max_skills_for_full_score,
      maxTenureYears: row.max_tenure_years,
      maxLeadershipPositions: row.max_leadership_positions,
      maxNominations: row.max_nominations,
    };
  }
);

/**
 * Get settings for the current user's chapter
 */
export const getCurrentChapterSettings = cache(
  async (): Promise<ChapterSettings> => {
    const supabase = await createServerSupabaseClient();

    // Get current user's chapter
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return DEFAULT_CHAPTER_SETTINGS;
    }

    const { data: member } = await supabase
      .from('members')
      .select('chapter_id')
      .eq('id', user.id)
      .single();

    if (!member?.chapter_id) {
      return DEFAULT_CHAPTER_SETTINGS;
    }

    return getChapterSettings(member.chapter_id);
  }
);

/**
 * Update chapter settings (requires Chair+ permissions)
 */
export async function updateChapterSettings(
  chapterId: string,
  updates: Partial<{
    sessionBookingAdvanceDays: number;
    trainerMaxSessionsPerMonth: number;
    trainerWarningThreshold: number;
    materialsApprovalDaysBefore: number;
    materialsRequireChairApproval: boolean;
    mouRequiredForOpportunities: boolean;
    mouAutoCloseOnExpiry: boolean;
    membersCanSeeOtherAssessments: boolean;
    membersCanSeeOtherApplications: boolean;
    coordinatorsSeeOwnInstitutionOnly: boolean;
    engagementWeightAttendance: number;
    engagementWeightVolunteer: number;
    engagementWeightFeedback: number;
    engagementWeightSkills: number;
    readinessWeightTenure: number;
    readinessWeightPositions: number;
    readinessWeightTraining: number;
    readinessWeightPeerInput: number;
    largeExpenseThreshold: number;
    expenseApprovalRequired: boolean;
    maxVolunteerHoursPerYear: number;
    maxSkillsForFullScore: number;
    maxTenureYears: number;
    maxLeadershipPositions: number;
    maxNominations: number;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  // Convert camelCase to snake_case for database
  const dbUpdates: Record<string, unknown> = {};

  if (updates.sessionBookingAdvanceDays !== undefined) {
    dbUpdates.session_booking_advance_days = updates.sessionBookingAdvanceDays;
  }
  if (updates.trainerMaxSessionsPerMonth !== undefined) {
    dbUpdates.trainer_max_sessions_per_month = updates.trainerMaxSessionsPerMonth;
  }
  if (updates.trainerWarningThreshold !== undefined) {
    dbUpdates.trainer_warning_threshold = updates.trainerWarningThreshold;
  }
  if (updates.materialsApprovalDaysBefore !== undefined) {
    dbUpdates.materials_approval_days_before = updates.materialsApprovalDaysBefore;
  }
  if (updates.materialsRequireChairApproval !== undefined) {
    dbUpdates.materials_require_chair_approval = updates.materialsRequireChairApproval;
  }
  if (updates.mouRequiredForOpportunities !== undefined) {
    dbUpdates.mou_required_for_opportunities = updates.mouRequiredForOpportunities;
  }
  if (updates.mouAutoCloseOnExpiry !== undefined) {
    dbUpdates.mou_auto_close_on_expiry = updates.mouAutoCloseOnExpiry;
  }
  if (updates.membersCanSeeOtherAssessments !== undefined) {
    dbUpdates.members_can_see_other_assessments = updates.membersCanSeeOtherAssessments;
  }
  if (updates.membersCanSeeOtherApplications !== undefined) {
    dbUpdates.members_can_see_other_applications = updates.membersCanSeeOtherApplications;
  }
  if (updates.coordinatorsSeeOwnInstitutionOnly !== undefined) {
    dbUpdates.coordinators_see_own_institution_only = updates.coordinatorsSeeOwnInstitutionOnly;
  }
  if (updates.engagementWeightAttendance !== undefined) {
    dbUpdates.engagement_weight_attendance = updates.engagementWeightAttendance;
  }
  if (updates.engagementWeightVolunteer !== undefined) {
    dbUpdates.engagement_weight_volunteer = updates.engagementWeightVolunteer;
  }
  if (updates.engagementWeightFeedback !== undefined) {
    dbUpdates.engagement_weight_feedback = updates.engagementWeightFeedback;
  }
  if (updates.engagementWeightSkills !== undefined) {
    dbUpdates.engagement_weight_skills = updates.engagementWeightSkills;
  }
  if (updates.readinessWeightTenure !== undefined) {
    dbUpdates.readiness_weight_tenure = updates.readinessWeightTenure;
  }
  if (updates.readinessWeightPositions !== undefined) {
    dbUpdates.readiness_weight_positions = updates.readinessWeightPositions;
  }
  if (updates.readinessWeightTraining !== undefined) {
    dbUpdates.readiness_weight_training = updates.readinessWeightTraining;
  }
  if (updates.readinessWeightPeerInput !== undefined) {
    dbUpdates.readiness_weight_peer_input = updates.readinessWeightPeerInput;
  }
  if (updates.largeExpenseThreshold !== undefined) {
    dbUpdates.large_expense_threshold = updates.largeExpenseThreshold;
  }
  if (updates.expenseApprovalRequired !== undefined) {
    dbUpdates.expense_approval_required = updates.expenseApprovalRequired;
  }
  if (updates.maxVolunteerHoursPerYear !== undefined) {
    dbUpdates.max_volunteer_hours_per_year = updates.maxVolunteerHoursPerYear;
  }
  if (updates.maxSkillsForFullScore !== undefined) {
    dbUpdates.max_skills_for_full_score = updates.maxSkillsForFullScore;
  }
  if (updates.maxTenureYears !== undefined) {
    dbUpdates.max_tenure_years = updates.maxTenureYears;
  }
  if (updates.maxLeadershipPositions !== undefined) {
    dbUpdates.max_leadership_positions = updates.maxLeadershipPositions;
  }
  if (updates.maxNominations !== undefined) {
    dbUpdates.max_nominations = updates.maxNominations;
  }

  // Ensure settings exist
  await supabase.rpc('ensure_chapter_settings', { p_chapter_id: chapterId });

  const { error } = await supabase
    .from('chapter_settings')
    .update(dbUpdates)
    .eq('chapter_id', chapterId);

  if (error) {
    console.error('Error updating chapter settings:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
