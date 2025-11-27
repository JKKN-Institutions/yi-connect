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
      const { data: roles } = await supabase.rpc('get_user_roles', {
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

    // Transform data to MemberListItem format
    const members: MemberListItem[] = (data || []).map((member: any) => ({
      id: member.id,
      full_name: member.profiles?.full_name || '',
      email: member.profiles?.email || '',
      avatar_url: member.profiles?.avatar_url || null,
      company: member.company,
      designation: member.designation,
      membership_status: member.membership_status,
      member_since: member.member_since,
      engagement_score: 0, // Will be populated when engagement module is built
      readiness_score: 0, // Will be populated when leadership module is built
      skills_count: 0, // Will be populated when skills module is built
      top_skills: [], // Will be populated when skills module is built
      roles: rolesMap.get(member.id) || [],
      skill_will_category: member.skill_will_category || null,
      is_trainer: trainersSet.has(member.id),
      verticals: verticalsMap.get(member.id) || []
    }));

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

    return {
      total_members: totalMembers,
      active_members: activeMembers,
      new_members_this_month: newMembers,
      avg_engagement_score: 0, // Will be calculated when engagement module is built
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
