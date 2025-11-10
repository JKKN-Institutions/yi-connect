/**
 * Member Data Layer
 *
 * Cached data fetching functions for Member Intelligence Hub.
 * Uses React cache() for request-level deduplication.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
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
// Member Queries
// ============================================================================

/**
 * Get paginated member list with filters and sorting
 */
export const getMembers = cache(
  async (params: MemberQueryParams = {}): Promise<PaginatedMembers> => {
    const supabase = await createServerSupabaseClient();
    const { page = 1, pageSize = 10, filters = {}, sort } = params;

    let query = supabase.from('members').select(
      `
      id,
      profile:profiles!inner(
        email,
        full_name,
        avatar_url,
        phone
      ),
      company,
      designation,
      membership_status,
      member_since,
      engagement:engagement_metrics(
        engagement_score
      ),
      leadership:leadership_assessments(
        readiness_score
      ),
      skills:member_skills(
        skill:skills(name),
        proficiency
      )
    `,
      { count: 'exact' }
    );

    // Apply filters
    if (filters.search) {
      query = query.or(
        `profile.full_name.ilike.%${filters.search}%,profile.email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`
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

    if (filters.min_engagement_score !== undefined) {
      query = query.gte(
        'engagement.engagement_score',
        filters.min_engagement_score
      );
    }

    if (filters.max_engagement_score !== undefined) {
      query = query.lte(
        'engagement.engagement_score',
        filters.max_engagement_score
      );
    }

    if (filters.min_readiness_score !== undefined) {
      query = query.gte(
        'leadership.readiness_score',
        filters.min_readiness_score
      );
    }

    if (filters.max_readiness_score !== undefined) {
      query = query.lte(
        'leadership.readiness_score',
        filters.max_readiness_score
      );
    }

    // Apply sorting
    if (sort) {
      const { field, direction } = sort;
      if (field === 'full_name') {
        query = query.order('profile.full_name', {
          ascending: direction === 'asc'
        });
      } else if (field === 'engagement_score') {
        query = query.order('engagement.engagement_score', {
          ascending: direction === 'asc'
        });
      } else if (field === 'readiness_score') {
        query = query.order('leadership.readiness_score', {
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

    // Transform data to MemberListItem format
    const members: MemberListItem[] = (data || []).map((member: any) => ({
      id: member.id,
      full_name: member.profile?.full_name || '',
      email: member.profile?.email || '',
      avatar_url: member.profile?.avatar_url || null,
      company: member.company,
      designation: member.designation,
      membership_status: member.membership_status,
      member_since: member.member_since,
      engagement_score: member.engagement?.engagement_score || 0,
      readiness_score: member.leadership?.readiness_score || 0,
      skills_count: member.skills?.length || 0,
      top_skills: (member.skills || []).slice(0, 3).map((ms: any) => ({
        name: ms.skill?.name || '',
        proficiency: ms.proficiency
      }))
    }));

    return {
      data: members,
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

    // Get engagement metrics
    let metricsQuery = supabase
      .from('engagement_metrics')
      .select('engagement_score');
    if (chapterId) {
      const memberIds = members?.map((m) => m.id) || [];
      metricsQuery = metricsQuery.in('member_id', memberIds);
    }

    const { data: metrics } = await metricsQuery;

    // Get leadership assessments
    let assessmentsQuery = supabase
      .from('leadership_assessments')
      .select('readiness_level');
    if (chapterId) {
      const memberIds = members?.map((m) => m.id) || [];
      assessmentsQuery = assessmentsQuery.in('member_id', memberIds);
    }

    const { data: assessments } = await assessmentsQuery;

    // Calculate analytics
    const totalMembers = members?.length || 0;
    const activeMembers = members?.filter((m) => m.is_active).length || 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newMembers =
      members?.filter((m) => new Date(m.created_at) >= thirtyDaysAgo).length ||
      0;

    const avgEngagementScore =
      metrics && metrics.length > 0
        ? metrics.reduce((sum, m) => sum + (m.engagement_score || 0), 0) /
          metrics.length
        : 0;

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

    // Leadership pipeline
    const leadershipPipeline = {
      not_ready:
        assessments?.filter((a) => a.readiness_level === 'not_ready').length ||
        0,
      developing:
        assessments?.filter((a) => a.readiness_level === 'developing').length ||
        0,
      ready:
        assessments?.filter((a) => a.readiness_level === 'ready').length || 0,
      highly_ready:
        assessments?.filter((a) => a.readiness_level === 'highly_ready')
          .length || 0
    };

    return {
      total_members: totalMembers,
      active_members: activeMembers,
      new_members_this_month: newMembers,
      avg_engagement_score: Math.round(avgEngagementScore),
      members_by_status: membersByStatus,
      members_by_city: membersByCity,
      top_companies: topCompanies,
      skills_distribution: {
        technical: 0,
        business: 0,
        creative: 0,
        leadership: 0,
        communication: 0,
        other: 0
      },
      leadership_pipeline: leadershipPipeline
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
