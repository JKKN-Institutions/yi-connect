/**
 * Volunteer Matching Service
 *
 * Intelligent matching algorithm to find suitable volunteers for events
 * based on skills, availability, experience, and preferences.
 */

import { createClient } from '@/lib/supabase/server';

export interface VolunteerMatchCriteria {
  eventId: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  eventDate: Date;
  eventDuration: number; // hours
  requiredVolunteers: number;
  preferExperienced?: boolean;
  excludeMemberIds?: string[];
}

export interface VolunteerMatch {
  memberId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  matchScore: number;
  matchReasons: string[];
  skills: string[];
  previousVolunteerCount: number;
  isAvailable: boolean;
  availability: string | null;
}

export interface VolunteerMatchResult {
  matches: VolunteerMatch[];
  totalEligible: number;
  criteria: VolunteerMatchCriteria;
}

/**
 * Find matching volunteers for an event
 */
export async function findMatchingVolunteers(
  chapterId: string,
  criteria: VolunteerMatchCriteria
): Promise<VolunteerMatchResult> {
  const supabase = await createClient();

  // 1. Get all active members in the chapter
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select(`
      id,
      profiles!inner(id, full_name, email, avatar_url),
      membership_status,
      skill_will_category,
      engagement_score,
      readiness_score
    `)
    .eq('chapter_id', chapterId)
    .eq('is_active', true)
    .eq('membership_status', 'active');

  if (membersError || !members) {
    throw new Error(`Failed to fetch members: ${membersError?.message}`);
  }

  // Filter out excluded members
  const eligibleMembers = members.filter(
    m => !criteria.excludeMemberIds?.includes(m.id)
  );

  // 2. Get member skills
  const memberIds = eligibleMembers.map(m => m.id);
  const { data: memberSkills } = await supabase
    .from('member_skills')
    .select(`
      member_id,
      skill:skills(id, name, category)
    `)
    .in('member_id', memberIds);

  // Group skills by member
  const skillsByMember: Record<string, Array<{ id: string; name: string }>> = {};
  memberSkills?.forEach(ms => {
    if (!skillsByMember[ms.member_id]) {
      skillsByMember[ms.member_id] = [];
    }
    if (ms.skill) {
      skillsByMember[ms.member_id].push(ms.skill as any);
    }
  });

  // 3. Get volunteer history
  const { data: volunteerHistory } = await supabase
    .from('event_volunteers')
    .select('member_id')
    .in('member_id', memberIds);

  // Count volunteers per member
  const volunteerCounts: Record<string, number> = {};
  volunteerHistory?.forEach(v => {
    volunteerCounts[v.member_id] = (volunteerCounts[v.member_id] || 0) + 1;
  });

  // 4. Get member availability for the event date
  const eventDateStr = criteria.eventDate.toISOString().split('T')[0];
  const dayOfWeek = criteria.eventDate.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const eventDayName = dayNames[dayOfWeek];

  const { data: availabilities } = await supabase
    .from('member_availability')
    .select('member_id, day_of_week, start_time, end_time, is_available')
    .in('member_id', memberIds)
    .eq('day_of_week', eventDayName);

  // Map availability by member
  const availabilityByMember: Record<string, { isAvailable: boolean; slot: string | null }> = {};
  availabilities?.forEach(a => {
    if (a.is_available) {
      availabilityByMember[a.member_id] = {
        isAvailable: true,
        slot: `${a.start_time} - ${a.end_time}`,
      };
    }
  });

  // 5. Score and rank members
  const matches: VolunteerMatch[] = eligibleMembers.map(member => {
    const profile = member.profiles as any;
    const skills = skillsByMember[member.id] || [];
    const skillNames = skills.map(s => s.name);
    const volunteerCount = volunteerCounts[member.id] || 0;
    const availability = availabilityByMember[member.id];

    // Calculate match score (0-100)
    let score = 50; // Base score
    const reasons: string[] = [];

    // Skill matching (up to 25 points)
    const requiredSkillsMatched = criteria.requiredSkills?.filter(
      rs => skillNames.some(sn => sn.toLowerCase().includes(rs.toLowerCase()))
    ).length || 0;
    const preferredSkillsMatched = criteria.preferredSkills?.filter(
      ps => skillNames.some(sn => sn.toLowerCase().includes(ps.toLowerCase()))
    ).length || 0;

    if (criteria.requiredSkills && criteria.requiredSkills.length > 0) {
      const requiredPercent = requiredSkillsMatched / criteria.requiredSkills.length;
      score += requiredPercent * 15;
      if (requiredPercent === 1) {
        reasons.push('Has all required skills');
      } else if (requiredPercent > 0) {
        reasons.push(`Has ${requiredSkillsMatched}/${criteria.requiredSkills.length} required skills`);
      }
    }

    if (criteria.preferredSkills && preferredSkillsMatched > 0) {
      score += Math.min(preferredSkillsMatched * 3, 10);
      reasons.push(`Has ${preferredSkillsMatched} preferred skill(s)`);
    }

    // Experience bonus (up to 15 points)
    if (criteria.preferExperienced && volunteerCount > 0) {
      const expBonus = Math.min(volunteerCount * 3, 15);
      score += expBonus;
      reasons.push(`Volunteered ${volunteerCount} time(s) before`);
    }

    // Availability bonus (10 points)
    const isAvailable = availability?.isAvailable || false;
    if (isAvailable) {
      score += 10;
      reasons.push('Available on event day');
    }

    // Engagement and readiness bonus (up to 10 points)
    const engagementBonus = ((member.engagement_score || 0) / 100) * 5;
    const readinessBonus = ((member.readiness_score || 0) / 100) * 5;
    score += engagementBonus + readinessBonus;

    if ((member.engagement_score || 0) >= 70) {
      reasons.push('High engagement score');
    }

    // Category bonus
    if (member.skill_will_category === 'star') {
      score += 5;
      reasons.push('Star performer');
    } else if (member.skill_will_category === 'enthusiast') {
      score += 3;
      reasons.push('Enthusiastic member');
    }

    return {
      memberId: member.id,
      fullName: profile.full_name || 'Unknown',
      email: profile.email || '',
      avatarUrl: profile.avatar_url,
      matchScore: Math.round(Math.min(score, 100)),
      matchReasons: reasons,
      skills: skillNames,
      previousVolunteerCount: volunteerCount,
      isAvailable,
      availability: availability?.slot || null,
    };
  });

  // Sort by match score (descending)
  matches.sort((a, b) => b.matchScore - a.matchScore);

  return {
    matches: matches.slice(0, Math.min(criteria.requiredVolunteers * 3, 50)), // Return top candidates
    totalEligible: eligibleMembers.length,
    criteria,
  };
}

/**
 * Get volunteer recommendations for an event
 */
export async function getVolunteerRecommendations(
  eventId: string,
  chapterId: string
): Promise<VolunteerMatchResult> {
  const supabase = await createClient();

  // Get event details
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(`
      id,
      title,
      start_date,
      end_date,
      max_volunteers,
      requirements,
      tags
    `)
    .eq('id', eventId)
    .single();

  if (eventError || !event) {
    throw new Error(`Event not found: ${eventError?.message}`);
  }

  // Get already assigned volunteers
  const { data: assignedVolunteers } = await supabase
    .from('event_volunteers')
    .select('member_id')
    .eq('event_id', eventId);

  const excludeIds = assignedVolunteers?.map(v => v.member_id) || [];

  // Calculate duration
  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

  // Extract skills from tags or requirements
  const requiredSkills = event.tags || [];
  const preferredSkills = event.requirements
    ? event.requirements.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const criteria: VolunteerMatchCriteria = {
    eventId,
    requiredSkills,
    preferredSkills,
    eventDate: startDate,
    eventDuration: durationHours,
    requiredVolunteers: event.max_volunteers || 5,
    preferExperienced: true,
    excludeMemberIds: excludeIds,
  };

  return findMatchingVolunteers(chapterId, criteria);
}
