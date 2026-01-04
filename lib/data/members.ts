/**
 * Member Data Layer
 *
 * Cached data fetching functions for Member Intelligence Hub.
 * Uses React cache() for request-level deduplication.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/data/auth';
import { cache } from 'react';
import type {
  MemberListItem,
  MemberFull,
  MemberWithProfile,
  MemberWithSkills,
  MemberWithCertifications,
  MemberWithEngagement,
  PaginatedMembers,
  MemberQueryParams,
  SkillWithMembers,
  SkillGapAnalysis,
  MemberAnalytics,
  EngagementTrend
} from '@/types/member';
import type { Skill, Certification } from '@/types/member';

// ============================================================================
// Engagement Score Calculation
// ============================================================================

import {
  DEFAULT_CHAPTER_SETTINGS,
  type ChapterSettings,
} from '@/lib/data/chapter-settings';

/**
 * Default Engagement Score Weights (from SYSTEM_SPECIFICATION.md)
 * - Attendance: 50% (events attended / events eligible)
 * - Volunteer hours: 30% (normalized against max hours in period)
 * - Feedback given: 15% (feedback submissions / events attended)
 * - Skills added: 5% (profile completeness)
 *
 * These can be overridden per chapter via chapter_settings table
 */
const DEFAULT_ENGAGEMENT_WEIGHTS = DEFAULT_CHAPTER_SETTINGS.engagementWeights;
const DEFAULT_MAX_VOLUNTEER_HOURS_PER_YEAR = DEFAULT_CHAPTER_SETTINGS.maxVolunteerHoursPerYear;
const DEFAULT_MAX_SKILLS_FOR_FULL_SCORE = DEFAULT_CHAPTER_SETTINGS.maxSkillsForFullScore;

/**
 * Calculate engagement scores for multiple members (batch operation)
 * Returns a Map of member_id -> engagement_score (0-100)
 *
 * @param memberIds - Array of member IDs to calculate scores for
 * @param periodMonths - Number of months to look back (default: 12)
 * @param settings - Optional chapter settings for custom weights/maximums
 */
export async function calculateEngagementScores(
  memberIds: string[],
  periodMonths: number = 12,
  settings?: Partial<ChapterSettings>
): Promise<Map<string, number>> {
  // Use provided settings or defaults
  const weights = settings?.engagementWeights || DEFAULT_ENGAGEMENT_WEIGHTS;
  const maxVolunteerHours = settings?.maxVolunteerHoursPerYear || DEFAULT_MAX_VOLUNTEER_HOURS_PER_YEAR;
  const maxSkills = settings?.maxSkillsForFullScore || DEFAULT_MAX_SKILLS_FOR_FULL_SCORE;
  if (memberIds.length === 0) {
    return new Map();
  }

  const supabase = await createServerSupabaseClient();
  const periodStart = new Date();
  periodStart.setMonth(periodStart.getMonth() - periodMonths);
  const periodStartStr = periodStart.toISOString();

  // Batch query 1: Get attendance data (RSVPs with check-ins)
  const { data: rsvpData } = await supabase
    .from('event_rsvps')
    .select('member_id, status, checked_in_at, event_id')
    .in('member_id', memberIds)
    .gte('created_at', periodStartStr);

  // Batch query 2: Get volunteer hours
  const { data: volunteerData } = await supabase
    .from('event_volunteers')
    .select('member_id, hours_contributed, status')
    .in('member_id', memberIds)
    .eq('status', 'completed')
    .gte('created_at', periodStartStr);

  // Batch query 3: Get feedback submissions
  const { data: feedbackData } = await supabase
    .from('event_feedback')
    .select('member_id')
    .in('member_id', memberIds)
    .gte('created_at', periodStartStr);

  // Batch query 4: Get skills count
  const { data: skillsData } = await supabase
    .from('member_skills')
    .select('member_id')
    .in('member_id', memberIds);

  // Aggregate data per member
  const memberStats = new Map<string, {
    eventsRsvpd: number;
    eventsAttended: number;
    volunteerHours: number;
    feedbackCount: number;
    skillsCount: number;
  }>();

  // Initialize all members
  memberIds.forEach(id => {
    memberStats.set(id, {
      eventsRsvpd: 0,
      eventsAttended: 0,
      volunteerHours: 0,
      feedbackCount: 0,
      skillsCount: 0
    });
  });

  // Process RSVP data
  (rsvpData || []).forEach(rsvp => {
    const stats = memberStats.get(rsvp.member_id);
    if (stats) {
      if (rsvp.status === 'attending' || rsvp.status === 'attended') {
        stats.eventsRsvpd++;
        if (rsvp.checked_in_at) {
          stats.eventsAttended++;
        }
      }
    }
  });

  // Process volunteer data
  (volunteerData || []).forEach(vol => {
    const stats = memberStats.get(vol.member_id);
    if (stats && vol.hours_contributed) {
      stats.volunteerHours += vol.hours_contributed;
    }
  });

  // Process feedback data
  (feedbackData || []).forEach(fb => {
    if (fb.member_id) {
      const stats = memberStats.get(fb.member_id);
      if (stats) {
        stats.feedbackCount++;
      }
    }
  });

  // Process skills data
  (skillsData || []).forEach(skill => {
    const stats = memberStats.get(skill.member_id);
    if (stats) {
      stats.skillsCount++;
    }
  });

  // Calculate engagement scores using configurable weights
  const scores = new Map<string, number>();

  memberStats.forEach((stats, memberId) => {
    // Attendance score: attended / rsvpd (or 0 if no RSVPs)
    const attendanceScore = stats.eventsRsvpd > 0
      ? (stats.eventsAttended / stats.eventsRsvpd) * 100
      : 0;

    // Volunteer score: hours / max hours, capped at 100%
    const volunteerScore = Math.min(
      (stats.volunteerHours / maxVolunteerHours) * 100,
      100
    );

    // Feedback score: feedback / attended events (or 0 if none)
    const feedbackScore = stats.eventsAttended > 0
      ? Math.min((stats.feedbackCount / stats.eventsAttended) * 100, 100)
      : 0;

    // Skills score: skills / max skills, capped at 100%
    const skillsScore = Math.min(
      (stats.skillsCount / maxSkills) * 100,
      100
    );

    // Weighted total (using configurable weights)
    const totalScore =
      (attendanceScore * weights.attendance) +
      (volunteerScore * weights.volunteer) +
      (feedbackScore * weights.feedback) +
      (skillsScore * weights.skills);

    scores.set(memberId, Math.round(totalScore));
  });

  return scores;
}

/**
 * Calculate engagement score for a single member
 */
export const getMemberEngagementScore = cache(
  async (memberId: string): Promise<number> => {
    const scores = await calculateEngagementScores([memberId]);
    return scores.get(memberId) || 0;
  }
);

// ============================================================================
// Leadership Readiness Score Calculation
// ============================================================================

/**
 * Default Readiness Score Weights (from SYSTEM_SPECIFICATION.md)
 * - Tenure: 25% (Years of Yi membership)
 * - Positions Held: 25% (Leadership roles held)
 * - Training: 25% (Event participation in leadership-related events)
 * - Peer Input: 25% (Nominations received)
 *
 * These can be overridden per chapter via chapter_settings table
 */
const DEFAULT_READINESS_WEIGHTS = DEFAULT_CHAPTER_SETTINGS.readinessWeights;
const DEFAULT_MAX_TENURE_YEARS = DEFAULT_CHAPTER_SETTINGS.maxTenureYears;
const DEFAULT_MAX_LEADERSHIP_POSITIONS = DEFAULT_CHAPTER_SETTINGS.maxLeadershipPositions;
const DEFAULT_MAX_NOMINATIONS = DEFAULT_CHAPTER_SETTINGS.maxNominations;

/**
 * Calculate readiness scores for multiple members (batch operation)
 * Returns a Map of member_id -> readiness_score (0-100)
 *
 * @param memberIds - Array of member IDs to calculate scores for
 * @param settings - Optional chapter settings for custom weights/maximums
 */
export async function calculateReadinessScores(
  memberIds: string[],
  settings?: Partial<ChapterSettings>
): Promise<Map<string, number>> {
  // Use provided settings or defaults
  const weights = settings?.readinessWeights || DEFAULT_READINESS_WEIGHTS;
  const maxTenureYears = settings?.maxTenureYears || DEFAULT_MAX_TENURE_YEARS;
  const maxLeadershipPositions = settings?.maxLeadershipPositions || DEFAULT_MAX_LEADERSHIP_POSITIONS;
  const maxNominations = settings?.maxNominations || DEFAULT_MAX_NOMINATIONS;
  if (memberIds.length === 0) {
    return new Map();
  }

  const supabase = await createServerSupabaseClient();

  // Batch query 1: Get member tenure data (member_since)
  const { data: membersData } = await supabase
    .from('members')
    .select('id, member_since')
    .in('id', memberIds);

  // Batch query 2: Get leadership roles held (hierarchy level >= 2)
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      role:roles(hierarchy_level)
    `)
    .in('user_id', memberIds);

  // Batch query 3: Get nominations received (as nominee)
  const { data: nominationsData } = await supabase
    .from('nominations')
    .select('nominee_id')
    .in('nominee_id', memberIds)
    .eq('status', 'approved');

  // Batch query 4: Get event participation count (proxy for training)
  const { data: eventParticipation } = await supabase
    .from('event_rsvps')
    .select('member_id')
    .in('member_id', memberIds)
    .not('checked_in_at', 'is', null);

  // Calculate tenure per member
  const tenureMap = new Map<string, number>();
  const now = new Date();
  (membersData || []).forEach((m: any) => {
    if (m.member_since) {
      const memberSince = new Date(m.member_since);
      const years = (now.getTime() - memberSince.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      tenureMap.set(m.id, Math.max(0, years));
    } else {
      tenureMap.set(m.id, 0);
    }
  });

  // Count leadership positions per member (hierarchy level >= 2)
  const positionsMap = new Map<string, number>();
  memberIds.forEach(id => positionsMap.set(id, 0));
  (rolesData || []).forEach((r: any) => {
    const level = (r.role as any)?.hierarchy_level || 0;
    if (level >= 2) {
      const current = positionsMap.get(r.user_id) || 0;
      positionsMap.set(r.user_id, current + 1);
    }
  });

  // Count nominations per member
  const nominationsMap = new Map<string, number>();
  memberIds.forEach(id => nominationsMap.set(id, 0));
  (nominationsData || []).forEach((n: any) => {
    const current = nominationsMap.get(n.nominee_id) || 0;
    nominationsMap.set(n.nominee_id, current + 1);
  });

  // Count event participations (proxy for training/development)
  const trainingMap = new Map<string, number>();
  memberIds.forEach(id => trainingMap.set(id, 0));
  (eventParticipation || []).forEach((e: any) => {
    const current = trainingMap.get(e.member_id) || 0;
    trainingMap.set(e.member_id, current + 1);
  });

  // Calculate readiness scores using configurable weights
  const scores = new Map<string, number>();

  memberIds.forEach(memberId => {
    // Tenure score: years / max years, capped at 100%
    const tenure = tenureMap.get(memberId) || 0;
    const tenureScore = Math.min((tenure / maxTenureYears) * 100, 100);

    // Positions score: positions / max positions, capped at 100%
    const positions = positionsMap.get(memberId) || 0;
    const positionsScore = Math.min((positions / maxLeadershipPositions) * 100, 100);

    // Training score: events attended / 20 (baseline), capped at 100%
    const training = trainingMap.get(memberId) || 0;
    const trainingScore = Math.min((training / 20) * 100, 100);

    // Peer input score: nominations / max nominations, capped at 100%
    const nominations = nominationsMap.get(memberId) || 0;
    const peerInputScore = Math.min((nominations / maxNominations) * 100, 100);

    // Weighted total (using configurable weights)
    const totalScore =
      (tenureScore * weights.tenure) +
      (positionsScore * weights.positions) +
      (trainingScore * weights.training) +
      (peerInputScore * weights.peerInput);

    scores.set(memberId, Math.round(totalScore));
  });

  return scores;
}

/**
 * Calculate readiness score for a single member
 */
export const getMemberReadinessScore = cache(
  async (memberId: string): Promise<number> => {
    const scores = await calculateReadinessScores([memberId]);
    return scores.get(memberId) || 0;
  }
);

/**
 * Get readiness level label based on score
 */
export function getReadinessLevel(score: number): string {
  if (score >= 75) return 'highly_ready';
  if (score >= 50) return 'ready';
  if (score >= 25) return 'developing';
  return 'not_ready';
}

// ============================================================================
// Current User Member Data
// ============================================================================

/**
 * Get the current user's member record with profile data
 * Returns null if user is not authenticated or has no member record
 *
 * Note: We don't use 'use cache' directive here because it depends on getCurrentUser()
 * which accesses dynamic cookies. React's cache() provides request-level deduplication.
 */
export const getCurrentUserMember = cache(async () => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = await createServerSupabaseClient();

  // Get the member record for the current user
  // Note: member.id IS the profile/user id in the members table
  const { data: member, error } = await supabase
    .from('members')
    .select(
      `
      id,
      chapter_id,
      company,
      designation,
      industry,
      years_of_experience,
      date_of_birth,
      membership_status,
      membership_type,
      renewal_date,
      skill_will_category,
      willingness_level,
      is_active,
      created_at,
      profile:profiles(
        email,
        full_name,
        avatar_url,
        phone
      ),
      chapter:chapters(
        id,
        name,
        location,
        region
      )
    `
    )
    .eq('id', user.id)
    .single();

  if (error || !member) {
    console.error('Error fetching member:', error);
    return null;
  }

  // Get user's role from user_roles table
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id)
    .single();

  const roleName = (userRole?.roles as any)?.name || 'Member';

  return {
    ...member,
    member_id: member.id,
    role: roleName,
    status: member.membership_status,
    phone: (member.profile as any)?.phone,
  };
});

// ============================================================================
// Member Queries
// ============================================================================

/**
 * Get paginated member list with filters and sorting
 */
export const getMembers = cache(
  async (params: MemberQueryParams = {}): Promise<PaginatedMembers> => {
    const supabase = await createServerSupabaseClient();
    const { page = 1, pageSize = 10, filters = {}, sort } = params;

    // Extended query to include skill_will_category
    let query = supabase.from('members').select(
      `
      id,
      company,
      designation,
      city,
      state,
      membership_status,
      member_since,
      chapter_id,
      skill_will_category,
      profiles!inner(
        email,
        full_name,
        avatar_url,
        phone
      )
    `,
      { count: 'exact' }
    );

    // Apply filters
    if (filters.search) {
      query = query.or(
        `profiles.full_name.ilike.%${filters.search}%,profiles.email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`
      );
    }

    if (filters.membership_status && filters.membership_status.length > 0) {
      query = query.in('membership_status', filters.membership_status);
    }

    if (filters.city && filters.city.length > 0) {
      query = query.in('city', filters.city);
    }

    if (filters.company && filters.company.length > 0) {
      query = query.in('company', filters.company);
    }

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    // Apply skill_will_category filter
    if (filters.skill_will_category && filters.skill_will_category.length > 0) {
      query = query.in('skill_will_category', filters.skill_will_category);
    }

    // Apply sorting
    if (sort) {
      const { field, direction } = sort;
      if (field === 'full_name') {
        query = query.order('profiles.full_name', {
          ascending: direction === 'asc'
        });
      } else {
        query = query.order(field, { ascending: direction === 'asc' });
      }
    } else {
      query = query.order('member_since', { ascending: false });
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch members: ${error.message}`);
    }

    // Fetch roles for all members
    const memberIds = (data || []).map((m: any) => m.id);
    const rolesMap = new Map<string, Array<{ role_name: string; hierarchy_level: number }>>();

    for (const memberId of memberIds) {
      const { data: roles } = await supabase.rpc('get_user_roles_detailed', {
        p_user_id: memberId
      });
      rolesMap.set(memberId, roles || []);
    }

    // Fetch verticals for all members (batch query)
    const verticalsMap = new Map<string, Array<{ id: string; name: string; color: string | null }>>();
    if (memberIds.length > 0) {
      const { data: verticalMembers } = await supabase
        .from('vertical_members')
        .select(`
          member_id,
          vertical:verticals(id, name, color)
        `)
        .in('member_id', memberIds)
        .eq('is_active', true);

      (verticalMembers || []).forEach((vm: any) => {
        if (vm.vertical) {
          const existing = verticalsMap.get(vm.member_id) || [];
          existing.push(vm.vertical);
          verticalsMap.set(vm.member_id, existing);
        }
      });
    }

    // Fetch trainer status for all members (batch query)
    const trainersSet = new Set<string>();
    if (memberIds.length > 0) {
      const { data: trainers } = await supabase
        .from('trainer_profiles')
        .select('member_id')
        .in('member_id', memberIds)
        .eq('is_trainer_eligible', true);

      (trainers || []).forEach((t: any) => trainersSet.add(t.member_id));
    }

    // Calculate engagement scores for all members (batch operation)
    const engagementScores = memberIds.length > 0
      ? await calculateEngagementScores(memberIds)
      : new Map<string, number>();

    // Calculate readiness scores for all members (batch operation)
    const readinessScores = memberIds.length > 0
      ? await calculateReadinessScores(memberIds)
      : new Map<string, number>();

    // Fetch skills count and top skills for all members (batch query)
    type SkillInfo = { name: string; proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert' };
    const skillsMap = new Map<string, { count: number; topSkills: SkillInfo[] }>();
    if (memberIds.length > 0) {
      const { data: memberSkills } = await supabase
        .from('member_skills')
        .select(`
          member_id,
          proficiency,
          skill:skills(name)
        `)
        .in('member_id', memberIds);

      // Group by member and sort by proficiency (expert first)
      const proficiencyOrder: Record<string, number> = { expert: 0, advanced: 1, intermediate: 2, beginner: 3 };

      // First pass: collect all skills per member
      const memberSkillsCollected = new Map<string, SkillInfo[]>();
      (memberSkills || []).forEach((ms: any) => {
        if (ms.skill?.name) {
          const skills = memberSkillsCollected.get(ms.member_id) || [];
          skills.push({
            name: ms.skill.name,
            proficiency: (ms.proficiency || 'beginner') as SkillInfo['proficiency']
          });
          memberSkillsCollected.set(ms.member_id, skills);
        }
      });

      // Second pass: sort and take top 3 by proficiency
      memberSkillsCollected.forEach((skills, memberId) => {
        skills.sort((a, b) => (proficiencyOrder[a.proficiency] || 3) - (proficiencyOrder[b.proficiency] || 3));
        skillsMap.set(memberId, { count: skills.length, topSkills: skills.slice(0, 3) });
      });
    }

    // Transform data to MemberListItem format
    const members: MemberListItem[] = (data || []).map((member: any) => {
      const skillInfo = skillsMap.get(member.id) || { count: 0, topSkills: [] };
      return {
        id: member.id,
        full_name: member.profiles?.full_name || '',
        email: member.profiles?.email || '',
        phone: member.profiles?.phone || null,
        avatar_url: member.profiles?.avatar_url || null,
        company: member.company,
        designation: member.designation,
        membership_status: member.membership_status,
        member_since: member.member_since,
        engagement_score: engagementScores.get(member.id) || 0,
        readiness_score: readinessScores.get(member.id) || 0,
        skills_count: skillInfo.count,
        top_skills: skillInfo.topSkills,
        roles: rolesMap.get(member.id) || [],
        skill_will_category: member.skill_will_category || null,
        is_trainer: trainersSet.has(member.id),
        verticals: verticalsMap.get(member.id) || []
      };
    });

    // Apply category_tab filter (post-fetch for trainers since it's a separate table)
    let filteredMembers = members;
    if (filters.category_tab) {
      switch (filters.category_tab) {
        case 'trainers':
          filteredMembers = members.filter(m => m.is_trainer);
          break;
        case 'star':
        case 'enthusiast':
        case 'cynic':
        case 'dead_wood':
          filteredMembers = members.filter(m => m.skill_will_category === filters.category_tab);
          break;
        // 'all' returns everything
      }
    }

    return {
      data: filteredMembers,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    };
  }
);

/**
 * Get single member with all relationships
 */
export const getMemberById = cache(
  async (id: string): Promise<MemberFull | null> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('members')
      .select(
        `
      *,
      profile:profiles(
        email,
        full_name,
        avatar_url,
        phone
      ),
      chapter:chapters(
        id,
        name,
        location
      ),
      skills:member_skills(
        id,
        proficiency,
        years_of_experience,
        is_willing_to_mentor,
        skill:skills(*)
      ),
      certifications:member_certifications(
        id,
        certificate_number,
        issued_date,
        expiry_date,
        certification:certifications(*)
      ),
      engagement:engagement_metrics(*),
      leadership:leadership_assessments(*)
    `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch member: ${error.message}`);
    }

    // Add is_expiring_soon flag to certifications (within 30 days)
    const transformedData = {
      ...data,
      certifications: (data.certifications || []).map((cert: any) => {
        const expiryDate = cert.expiry_date ? new Date(cert.expiry_date) : null;
        const today = new Date();
        const daysUntilExpiry = expiryDate
          ? Math.ceil(
              (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            )
          : null;

        return {
          ...cert,
          is_expiring_soon:
            daysUntilExpiry !== null &&
            daysUntilExpiry <= 30 &&
            daysUntilExpiry >= 0
        };
      })
    };

    return transformedData as MemberFull;
  }
);

/**
 * Get member with profile info only
 */
export const getMemberWithProfile = cache(
  async (id: string): Promise<MemberWithProfile | null> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('members')
      .select(
        `
      *,
      profile:profiles(
        email,
        full_name,
        avatar_url,
        phone
      ),
      chapter:chapters(
        id,
        name,
        location
      )
    `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch member profile: ${error.message}`);
    }

    return data as MemberWithProfile;
  }
);

// ============================================================================
// Skills Queries
// ============================================================================

/**
 * Get all active skills
 */
export const getSkills = cache(async (): Promise<Skill[]> => {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch skills: ${error.message}`);
  }

  return data as Skill[];
});

/**
 * Get skills with member count and proficiency distribution
 */
export const getSkillsWithMembers = cache(
  async (): Promise<SkillWithMembers[]> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('skills')
      .select(
        `
      *,
      member_skills(
        proficiency,
        is_willing_to_mentor
      )
    `
      )
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch skills with members: ${error.message}`);
    }

    // Transform data to include counts
    const skillsWithMembers = (data || []).map((skill: any) => {
      const memberSkills = skill.member_skills || [];
      const proficiencyDist = {
        beginner: memberSkills.filter(
          (ms: any) => ms.proficiency === 'beginner'
        ).length,
        intermediate: memberSkills.filter(
          (ms: any) => ms.proficiency === 'intermediate'
        ).length,
        advanced: memberSkills.filter(
          (ms: any) => ms.proficiency === 'advanced'
        ).length,
        expert: memberSkills.filter((ms: any) => ms.proficiency === 'expert')
          .length
      };

      return {
        ...skill,
        member_count: memberSkills.length,
        proficiency_distribution: proficiencyDist,
        mentors_available: memberSkills.filter(
          (ms: any) => ms.is_willing_to_mentor
        ).length
      };
    });

    return skillsWithMembers as SkillWithMembers[];
  }
);

/**
 * Get skill gap analysis for a chapter
 */
export const getSkillGaps = cache(
  async (chapterId: string): Promise<SkillGapAnalysis[]> => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc('get_skill_gaps', {
      p_chapter_id: chapterId
    });

    if (error) {
      throw new Error(`Failed to fetch skill gaps: ${error.message}`);
    }

    return data as SkillGapAnalysis[];
  }
);

// ============================================================================
// Certifications Queries
// ============================================================================

/**
 * Get all active certifications
 */
export const getCertifications = cache(async (): Promise<Certification[]> => {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('certifications')
    .select('*')
    .eq('is_active', true)
    .order('issuing_organization')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch certifications: ${error.message}`);
  }

  return data as Certification[];
});

/**
 * Get expiring certifications for a member (within next 30 days)
 */
export const getExpiringCertifications = cache(async (memberId: string) => {
  const supabase = await createServerSupabaseClient();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data, error } = await supabase
    .from('member_certifications')
    .select(
      `
      *,
      certification:certifications(*)
    `
    )
    .eq('member_id', memberId)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', thirtyDaysFromNow.toISOString())
    .gte('expiry_date', new Date().toISOString());

  if (error) {
    throw new Error(
      `Failed to fetch expiring certifications: ${error.message}`
    );
  }

  return data;
});

// ============================================================================
// Analytics Queries
// ============================================================================

/**
 * Get member analytics for a chapter
 * Simplified version - will be enhanced when engagement/leadership modules are built
 */
export const getMemberAnalytics = cache(
  async (chapterId?: string): Promise<MemberAnalytics> => {
    const supabase = await createServerSupabaseClient();

    // Build query based on chapter filter
    let membersQuery = supabase.from('members').select('*');
    if (chapterId) {
      membersQuery = membersQuery.eq('chapter_id', chapterId);
    }

    const { data: members, error: membersError } = await membersQuery;

    if (membersError) {
      throw new Error(
        `Failed to fetch member analytics: ${membersError.message}`
      );
    }

    // Calculate basic analytics
    const totalMembers = members?.length || 0;
    const activeMembers = members?.filter((m) => m.is_active).length || 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newMembers =
      members?.filter((m) => new Date(m.created_at) >= thirtyDaysAgo).length ||
      0;

    // Members by status
    const membersByStatus: Record<string, number> = {};
    members?.forEach((m) => {
      membersByStatus[m.membership_status] =
        (membersByStatus[m.membership_status] || 0) + 1;
    });

    // Members by city
    const membersByCity: Record<string, number> = {};
    members?.forEach((m) => {
      if (m.city) {
        membersByCity[m.city] = (membersByCity[m.city] || 0) + 1;
      }
    });

    // Top companies
    const companyCounts: Record<string, number> = {};
    members?.forEach((m) => {
      if (m.company) {
        companyCounts[m.company] = (companyCounts[m.company] || 0) + 1;
      }
    });
    const topCompanies = Object.entries(companyCounts)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate average engagement score
    const memberIds = (members || []).map(m => m.id);
    let avgEngagementScore = 0;
    if (memberIds.length > 0) {
      const engagementScores = await calculateEngagementScores(memberIds);
      const totalScore = Array.from(engagementScores.values()).reduce((sum, score) => sum + score, 0);
      avgEngagementScore = Math.round(totalScore / memberIds.length);
    }

    // Calculate skills distribution by category
    const skillsDistribution = {
      technical: 0,
      business: 0,
      creative: 0,
      leadership: 0,
      communication: 0,
      other: 0
    };
    if (memberIds.length > 0) {
      const { data: skillsData } = await supabase
        .from('member_skills')
        .select(`
          skill:skills(category)
        `)
        .in('member_id', memberIds);

      (skillsData || []).forEach((ms: any) => {
        const category = (ms.skill?.category || 'other').toLowerCase();
        if (category in skillsDistribution) {
          skillsDistribution[category as keyof typeof skillsDistribution]++;
        } else {
          skillsDistribution.other++;
        }
      });
    }

    return {
      total_members: totalMembers,
      active_members: activeMembers,
      new_members_this_month: newMembers,
      avg_engagement_score: avgEngagementScore,
      members_by_status: membersByStatus,
      members_by_city: membersByCity,
      top_companies: topCompanies,
      skills_distribution: skillsDistribution,
      leadership_pipeline: {
        not_ready: 0,
        developing: 0,
        ready: 0,
        highly_ready: 0
      }
    };
  }
);

/**
 * Get engagement trend over time (last 12 months)
 */
export const getEngagementTrend = cache(
  async (chapterId?: string): Promise<EngagementTrend[]> => {
    // Placeholder - in a real implementation, you'd query historical data
    return [];
  }
);

// ============================================================================
// Availability Queries
// ============================================================================

/**
 * Get member availability for a date range
 */
export const getMemberAvailability = cache(
  async (memberId: string, startDate: string, endDate: string) => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('member_id', memberId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    if (error) {
      throw new Error(`Failed to fetch availability: ${error.message}`);
    }

    return data;
  }
);

/**
 * Get available members for a specific date
 */
export const getAvailableMembers = cache(
  async (date: string, chapterId?: string) => {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('availability')
      .select(
        `
      *,
      member:members(
        id,
        profile:profiles(
          full_name,
          email,
          avatar_url
        )
      )
    `
      )
      .eq('date', date)
      .eq('status', 'available');

    if (chapterId) {
      query = query.eq('member.chapter_id', chapterId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch available members: ${error.message}`);
    }

    return data;
  }
);

// ============================================================================
// Auth Helper Functions
// ============================================================================

/**
 * Get the current user's chapter
 * Used for access control and filtering data by chapter
 *
 * Note: We don't use 'use cache' directive here because it depends on getCurrentUser()
 * which accesses dynamic cookies. React's cache() provides request-level deduplication.
 */
export const getCurrentUserChapter = cache(async () => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = await createServerSupabaseClient();

  // Get the member record for the current user
  // Note: member.id IS the profile/user id in the members table
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('chapter_id')
    .eq('id', user.id)
    .single();

  if (memberError || !member) {
    return null;
  }

  // Get the chapter details
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('id, name, location, region')
    .eq('id', member.chapter_id)
    .single();

  if (chapterError || !chapter) {
    return null;
  }

  return chapter;
});
