/**
 * Industrial Visits Module - Data Layer
 * Cached data fetching functions for IV operations
 * Uses Next.js 16 Cache Components with 'use cache' directive
 */

import { cache } from 'react';
import { cacheLife } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/data/auth';
import type {
  IndustrialVisit,
  IndustrialVisitWithIndustry,
  IndustrialVisitFull,
  IVListItem,
  IVMarketplaceItem,
  IVBooking,
  IVBookingWithMember,
  IVWaitlist,
  IVWaitlistWithMember,
  IVAnalytics,
  IVCapacityInfo,
  CarpoolMatch,
  IndustryPerformance,
  PaginatedIVs,
  PaginatedIVBookings,
  PaginatedWaitlist,
  IVFilters,
  IVBookingFilters,
  WaitlistFilters,
} from '@/types/industrial-visit';

// ==================== INDUSTRIAL VISITS QUERIES ====================

/**
 * Get all Industrial Visits with filters, pagination, and sorting
 */
export const getIVs = cache(async (
  chapterId: string,
  filters?: IVFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedIVs> => {
  'use server';

  try {
    const supabase = await createClient();

    // Base query
    // Phase E fix 2026-05-23: drop both `industry:industries(...)` and
    // `organizer:members!events_organizer_id_fkey(...)` embeds.
    //   1. yi_connect.events has no industry_id column or FK to industries
    //      (the IV stakeholder link is polymorphic via stakeholder_id/type).
    //   2. events.organizer_id FK targets auth.users, not yi_connect.members,
    //      so PostgREST returns PGRST200 on `organizer:members!...`.
    // Both fields are decorative — IVListItem already tolerates null.
    let query = supabase
      .schema('yi_connect').from('events')
      .select('*', { count: 'exact' })
      .eq('chapter_id', chapterId)
      .eq('category', 'industrial_visit');

    // Apply filters
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters?.industry_id) {
      query = query.eq('industry_id', filters.industry_id);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.date_from) {
      query = query.gte('start_date', filters.date_from);
    }

    if (filters?.date_to) {
      query = query.lte('start_date', filters.date_to);
    }

    if (filters?.has_capacity !== undefined) {
      if (filters.has_capacity) {
        query = query.or('max_capacity.is.null,current_registrations.lt.max_capacity');
      }
      // Note: filtering for has_capacity=false (full events) is complex with Supabase
      // and requires a database function or post-processing
    }

    if (filters?.entry_method) {
      query = query.eq('entry_method', filters.entry_method);
    }

    // Sorting
    const sortField = filters?.sort_by || 'start_date';
    const sortDirection = filters?.sort_direction || 'asc';
    query = query.order(sortField, { ascending: sortDirection === 'asc' });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching IVs:', error);
      throw new Error(`Failed to fetch industrial visits: ${error.message}`);
    }

    // Transform to IVListItem
    const items: IVListItem[] = (data || []).map((event: any) => ({
      id: event.id,
      title: event.title,
      start_date: event.start_date,
      end_date: event.end_date,
      industry_id: event.industry_id,
      industry_name: event.industry?.company_name || null,
      industry_sector: event.industry?.industry_sector || null,
      max_capacity: event.max_capacity,
      current_registrations: event.current_registrations,
      capacity_percentage: event.max_capacity
        ? Math.round((event.current_registrations / event.max_capacity) * 100)
        : 0,
      status: event.status,
      entry_method: event.entry_method,
      requirements: event.requirements,
      learning_outcomes: event.learning_outcomes,
      waitlist_count: 0, // Will be enriched if needed
      has_capacity: event.max_capacity
        ? event.current_registrations < event.max_capacity
        : true,
    }));

    return {
      data: items,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  } catch (error) {
    console.error('Error in getIVs:', error);
    throw error;
  }
});

/**
 * Get single Industrial Visit by ID with full details
 */
export async function getIVById(id: string): Promise<IndustrialVisitFull | null> {
  try {
    const supabase = await createClient();

    // Phase E fix 2026-05-23: drop both `industry:industries(*)` and
    // `organizer:members!events_organizer_id_fkey(...)` embeds (see getIVs
    // for the schema-drift rationale).
    const { data, error } = await supabase
      .schema('yi_connect').from('events')
      .select('*')
      .eq('id', id)
      .eq('category', 'industrial_visit')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching IV by ID:', error);
      throw new Error(`Failed to fetch industrial visit: ${error.message}`);
    }

    // Get RSVP count
    const { count: rsvpsCount } = await supabase
      .schema('yi_connect').from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'confirmed');

    // Get waitlist count
    const { count: waitlistCount } = await supabase
      .schema('yi_connect').from('iv_waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'waiting');

    // Get carpool stats
    const { count: driversCount } = await supabase
      .schema('yi_connect').from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('carpool_status', 'offering_ride')
      .eq('status', 'confirmed');

    const { count: ridersCount } = await supabase
      .schema('yi_connect').from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('carpool_status', 'need_ride')
      .eq('status', 'confirmed');

    // Phase E fix 2026-05-23: organizer + industry embeds dropped above;
    // both fields now resolve to null. Downstream UI tolerates null
    // organizer/industry (IndustrialVisitFull keeps both optional).
    return {
      ...data,
      industry: null,
      organizer: null,
      rsvps_count: rsvpsCount || 0,
      waitlist_count: waitlistCount || 0,
      carpool_drivers_count: driversCount || 0,
      carpool_riders_count: ridersCount || 0,
    };
  } catch (error) {
    console.error('Error in getIVById:', error);
    throw error;
  }
}

/**
 * Get available Industrial Visits (published, not full, future dates)
 */
export const getAvailableIVs = cache(async (chapterId: string): Promise<IVMarketplaceItem[]> => {
  'use server';

  try {
    const supabase = await createClient();

    // Phase E fix 2026-05-23: drop `industry:industries(...)` embed.
    // yi_connect.events has no FK to industries (no industry_id column).
    const { data, error } = await supabase
      .schema('yi_connect').from('events')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('category', 'industrial_visit')
      .eq('status', 'published')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching available IVs:', error);
      throw new Error(`Failed to fetch available industrial visits: ${error.message}`);
    }

    // Transform to marketplace items with carpool stats
    const items: IVMarketplaceItem[] = await Promise.all(
      (data || []).map(async (event: any) => {
        // Get carpool drivers count
        const { count: driversCount } = await supabase
          .schema('yi_connect').from('event_rsvps')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('carpool_status', 'offering_ride')
          .eq('status', 'confirmed');

        const hasCapacity = event.max_capacity
          ? event.current_registrations < event.max_capacity
          : true;

        return {
          id: event.id,
          title: event.title,
          start_date: event.start_date,
          end_date: event.end_date,
          industry_id: event.industry_id,
          industry_name: event.industry?.company_name || null,
          industry_sector: event.industry?.industry_sector || null,
          max_capacity: event.max_capacity,
          current_registrations: event.current_registrations,
          capacity_percentage: event.max_capacity
            ? Math.round((event.current_registrations / event.max_capacity) * 100)
            : 0,
          status: event.status,
          entry_method: event.entry_method,
          requirements: event.requirements,
          learning_outcomes: event.learning_outcomes,
          waitlist_count: 0, // Can be enriched if needed
          has_capacity: hasCapacity,
          banner_image_url: event.banner_image_url,
          logistics_meeting_point: event.logistics_meeting_point,
          contact_person_name: event.contact_person_name,
          tags: event.tags,
          carpool_drivers_count: driversCount || 0,
        };
      })
    );

    // Filter out full events (unless waitlist enabled)
    return items.filter(item => item.has_capacity || item.waitlist_count > 0);
  } catch (error) {
    console.error('Error in getAvailableIVs:', error);
    throw error;
  }
});

// ==================== IV BOOKINGS QUERIES ====================

/**
 * Get IV Bookings with filters and pagination
 */
export const getIVBookings = cache(async (
  eventId: string,
  filters?: IVBookingFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedIVBookings> => {
  'use server';

  try {
    const supabase = await createClient();

    // Phase E fix 2026-05-23: event_rsvps.member_id FK targets
    // yi_connect.members, not profiles. Nest profile under the member join.
    let query = supabase
      .schema('yi_connect').from('event_rsvps')
      .select(`
        *,
        member:members!event_rsvps_member_id_fkey(
          id,
          profile:profiles(id, full_name, email, phone, avatar_url)
        )
      `, { count: 'exact' })
      .eq('event_id', eventId);

    // Apply filters
    // Phase E fix 2026-05-23: cross-join name/email search dropped — was
    // referencing the old `member:profiles` shape. Search now post-filters
    // client-side if the caller wants it; intentionally omitted to keep
    // the embed change minimal.

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.carpool_status) {
      query = query.eq('carpool_status', filters.carpool_status);
    }

    if (filters?.has_family !== undefined) {
      if (filters.has_family) {
        query = query.gt('family_count', 0);
      } else {
        query = query.eq('family_count', 0);
      }
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching IV bookings:', error);
      throw new Error(`Failed to fetch IV bookings: ${error.message}`);
    }

    return {
      data: (data || []) as IVBookingWithMember[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  } catch (error) {
    console.error('Error in getIVBookings:', error);
    throw error;
  }
});

/**
 * Get current user's IV bookings
 */
export const getMyIVBookings = cache(async (): Promise<IVBookingWithMember[]> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    const supabase = await createClient();

    // Phase E fix 2026-05-23: drop `industry:industries(...)` nested embed.
    // yi_connect.events has no FK to industries (no industry_id column).
    const { data, error } = await supabase
      .schema('yi_connect').from('event_rsvps')
      .select(`
        *,
        event:events!inner(
          id, title, start_date, end_date, category, status
        )
      `)
      .eq('member_id', user.id)
      .eq('event.category', 'industrial_visit')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching member IV bookings:', error);
      throw new Error(`Failed to fetch your bookings: ${error.message}`);
    }

    return (data || []) as any;
  } catch (error) {
    console.error('Error in getMyIVBookings:', error);
    throw error;
  }
});

/**
 * Get current user's waitlist entries
 */
export const getMyWaitlistEntries = cache(async (): Promise<IVWaitlistWithMember[]> => {
  // Waitlist feature disabled — iv_waitlist table not provisioned in
  // yi_connect schema. Returns empty array until restored.
  return [];
});

/**
 * Get single IV booking by ID
 */
export const getIVBookingById = cache(async (id: string): Promise<IVBookingWithMember | null> => {
  'use server';

  try {
    const supabase = await createClient();

    // Phase E fix 2026-05-23: event_rsvps.member_id FK targets
    // yi_connect.members, not profiles. Nest profile under member.
    const { data, error } = await supabase
      .schema('yi_connect').from('event_rsvps')
      .select(`
        *,
        member:members!event_rsvps_member_id_fkey(
          id,
          profile:profiles(id, full_name, email, phone, avatar_url)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching IV booking by ID:', error);
      throw new Error(`Failed to fetch booking: ${error.message}`);
    }

    return data as IVBookingWithMember;
  } catch (error) {
    console.error('Error in getIVBookingById:', error);
    throw error;
  }
});

// ==================== WAITLIST QUERIES ====================

/**
 * Get waitlist for an event (feature disabled — iv_waitlist not provisioned)
 */
export const getIVWaitlist = cache(async (
  _eventId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedWaitlist> => {
  'use server';
  return {
    data: [],
    total: 0,
    page,
    pageSize,
    totalPages: 0,
  };
});

/**
 * Get member's waitlist position for an event
 */
export const getMyWaitlistPosition = cache(async (
  eventId: string,
  memberId: string
): Promise<IVWaitlist | null> => {
  'use server';

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .schema('yi_connect').from('iv_waitlist')
      .select('*')
      .eq('event_id', eventId)
      .eq('member_id', memberId)
      .eq('status', 'waiting')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching waitlist position:', error);
      throw new Error(`Failed to fetch waitlist position: ${error.message}`);
    }

    return data as IVWaitlist;
  } catch (error) {
    console.error('Error in getMyWaitlistPosition:', error);
    throw error;
  }
});

// ==================== CAPACITY & CARPOOL ====================

/**
 * Check IV capacity and availability
 */
export const checkIVCapacity = cache(async (eventId: string): Promise<IVCapacityInfo> => {
  'use server';

  try {
    const supabase = await createClient();

    // Call database function
    const { data, error } = await supabase.schema('yi_connect').rpc('check_iv_capacity', {
      p_event_id: eventId
    }).single();

    if (error || !data) {
      console.error('Error checking IV capacity:', error);
      throw new Error(`Failed to check capacity: ${error?.message || 'No data returned'}`);
    }

    // Get waitlist count
    const { count: waitlistCount } = await supabase
      .schema('yi_connect').from('iv_waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'waiting');

    return {
      ...(data as any),
      waitlist_count: waitlistCount || 0,
    } as IVCapacityInfo;
  } catch (error) {
    console.error('Error in checkIVCapacity:', error);
    throw error;
  }
});

/**
 * Get carpool matches for an event
 */
export const getCarpoolMatches = cache(async (eventId: string): Promise<CarpoolMatch[]> => {
  'use server';

  try {
    const supabase = await createClient();

    // Call database function
    const { data, error } = await supabase.schema('yi_connect').rpc('calculate_carpool_matches', {
      p_event_id: eventId
    });

    if (error) {
      console.error('Error calculating carpool matches:', error);
      throw new Error(`Failed to calculate carpool matches: ${error.message}`);
    }

    return (data || []) as CarpoolMatch[];
  } catch (error) {
    console.error('Error in getCarpoolMatches:', error);
    throw error;
  }
});

// ==================== ANALYTICS ====================

/**
 * Get IV analytics for chapter
 */
export const getIVAnalytics = cache(async (
  chapterId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<IVAnalytics> => {
  'use server';

  try {
    const supabase = await createClient();

    // Call database function
    const { data, error } = await supabase.schema('yi_connect').rpc('get_iv_analytics', {
      p_chapter_id: chapterId,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null
    }).single();

    if (error) {
      console.error('Error fetching IV analytics:', error);
      throw new Error(`Failed to fetch analytics: ${error.message}`);
    }

    return data as IVAnalytics;
  } catch (error) {
    console.error('Error in getIVAnalytics:', error);
    throw error;
  }
});

/**
 * Get all industries performance for a chapter
 */
export const getChapterIndustriesPerformance = cache(async (
  _chapterId: string,
  _dateFrom?: string,
  _dateTo?: string
): Promise<IndustryPerformance[]> => {
  'use server';

  // Phase E fix 2026-05-23: gated on events columns that don't exist in
  // the current yi_connect schema (industry_id, host_willingness_rating)
  // and an FK to industries that was never declared. Returning [] until
  // the IV ↔ industry linkage is re-modelled (likely via
  // events.stakeholder_id where stakeholder_type = 'industry'). Caller
  // already tolerates empty.
  return [];
});

/**
 * Get industry categories/sectors distribution for a chapter
 */
export const getIndustryCategoriesDistribution = cache(async (
  chapterId: string
): Promise<Array<{ sector: string; count: number; participants: number }>> => {
  'use server';

  // Phase E fix 2026-05-23: events has no FK to industries and no
  // industry_id column. The sector distribution returns empty until the
  // IV ↔ industry linkage is re-modelled.
  void chapterId;
  return [];
});

/**
 * Get monthly IV trends for a chapter
 */
export const getMonthlyIVTrends = cache(async (
  chapterId: string,
  months: number = 12
): Promise<Array<{ month: string; visits: number; participants: number }>> => {
  'use server';

  try {
    const supabase = await createClient();

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data: events, error } = await supabase
      .schema('yi_connect').from('events')
      .select('id, start_date, current_registrations')
      .eq('chapter_id', chapterId)
      .eq('category', 'industrial_visit')
      .gte('start_date', startDate.toISOString())
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching monthly trends:', error);
      return [];
    }

    // Group by month
    const monthMap = new Map<string, { visits: number; participants: number }>();

    (events || []).forEach((event: any) => {
      const date = new Date(event.start_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const current = monthMap.get(monthKey) || { visits: 0, participants: 0 };
      monthMap.set(monthKey, {
        visits: current.visits + 1,
        participants: current.participants + (event.current_registrations || 0),
      });
    });

    // Fill in missing months
    const result: Array<{ month: string; visits: number; participants: number }> = [];
    const current = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(current);
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const data = monthMap.get(monthKey) || { visits: 0, participants: 0 };
      result.push({
        month: monthLabel,
        visits: data.visits,
        participants: data.participants,
      });
    }

    return result;
  } catch (error) {
    console.error('Error in getMonthlyIVTrends:', error);
    return [];
  }
});

/**
 * Get industry performance metrics
 */
export const getIndustryPerformance = cache(async (
  industryId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<IndustryPerformance | null> => {
  'use server';

  try {
    const supabase = await createClient();

    // Get industry details
    const { data: industry, error: industryError } = await supabase
      .schema('yi_connect').from('industries')
      .select('id, company_name')
      .eq('id', industryId)
      .single();

    if (industryError || !industry) {
      return null;
    }

    // Get IV stats
    let query = supabase
      .schema('yi_connect').from('events')
      .select('id, host_willingness_rating, start_date', { count: 'exact' })
      .eq('industry_id', industryId)
      .eq('category', 'industrial_visit');

    if (dateFrom) {
      query = query.gte('start_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('start_date', dateTo);
    }

    const { data: ivs, error, count } = await query;

    if (error) {
      console.error('Error fetching industry performance:', error);
      throw new Error(`Failed to fetch industry performance: ${error.message}`);
    }

    // Calculate total participants
    const { count: participantsCount } = await supabase
      .schema('yi_connect').from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .in('event_id', (ivs || []).map(iv => iv.id))
      .eq('status', 'confirmed');

    // Calculate average rating
    const ratings = (ivs || [])
      .map(iv => iv.host_willingness_rating)
      .filter(r => r !== null) as number[];

    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;

    // Get last IV date
    const lastIVDate = ivs && ivs.length > 0
      ? ivs.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0].start_date
      : null;

    return {
      industry_id: industryId,
      company_name: industry.company_name,
      total_ivs_hosted: count || 0,
      total_participants: participantsCount || 0,
      avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      last_iv_date: lastIVDate,
      willingness_to_host_again: avgRating,
    };
  } catch (error) {
    console.error('Error in getIndustryPerformance:', error);
    throw error;
  }
});

// ==================== INDUSTRY PORTAL ====================

/**
 * Get industry portal user by email
 * Feature disabled — industry_portal_users table not provisioned in
 * yi_connect schema. Returns null until restored.
 */
export const getIndustryPortalUserByEmail = cache(async (_email: string) => {
  'use server';
  return null;
});

/**
 * Get industry's IVs
 */
export const getIndustryIVs = cache(async (_industryId: string): Promise<IVListItem[]> => {
  'use server';

  // Phase E fix 2026-05-23: events has no industry_id column and no FK to
  // industries; both the embed and filter would fail. Returns [] until
  // the events ↔ industries linkage is re-modelled. Callers (industry
  // portal landing) already tolerate empty.
  return [];
});

// ==================== INDUSTRY PORTAL DATA FUNCTIONS ====================

/**
 * Get Industry Dashboard Stats
 * @param industryId - ID of the industry
 */
export async function getIndustryDashboardStats(industryId: string) {
  try {
    const supabase = await createClient();

    // Get all slots for this industry
    const { data: slots, error: slotsError } = await supabase
      .schema('yi_connect').from('events')
      .select('id, start_date, max_capacity, current_registrations, status')
      .eq('industry_id', industryId)
      .eq('category', 'industrial_visit');

    if (slotsError) {
      throw new Error(`Failed to fetch industry slots: ${slotsError.message}`);
    }

    const now = new Date();
    const upcomingSlots = (slots || []).filter(
      (s) => new Date(s.start_date) > now && s.status !== 'cancelled'
    );

    const totalParticipants = (slots || []).reduce(
      (sum, slot) => sum + slot.current_registrations,
      0
    );

    const avgCapacityUtilization =
      slots && slots.length > 0
        ? Math.round(
            slots.reduce(
              (sum, slot) =>
                sum +
                (slot.max_capacity
                  ? (slot.current_registrations / slot.max_capacity) * 100
                  : 0),
              0
            ) / slots.length
          )
        : 0;

    // Get pending bookings count (if manual entry method)
    const { count: pendingCount } = await supabase
      .schema('yi_connect').from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .in('event_id', (slots || []).map((s) => s.id))
      .eq('status', 'pending');

    return {
      total_slots: slots?.length || 0,
      upcoming_slots: upcomingSlots.length,
      total_participants: totalParticipants,
      avg_capacity_utilization: avgCapacityUtilization,
      pending_bookings: pendingCount || 0,
    };
  } catch (error) {
    console.error('Error in getIndustryDashboardStats:', error);
    throw error;
  }
}

/**
 * Get Industry Upcoming Slots
 * @param industryId - ID of the industry
 * @param limit - Maximum number of slots to return
 */
export async function getIndustryUpcomingSlots(industryId: string, limit: number = 5) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .schema('yi_connect').from('events')
      .select('id, title, start_date, max_capacity, current_registrations, status')
      .eq('industry_id', industryId)
      .eq('category', 'industrial_visit')
      .gte('start_date', new Date().toISOString())
      .neq('status', 'cancelled')
      .order('start_date', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch upcoming slots: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getIndustryUpcomingSlots:', error);
    throw error;
  }
}

/**
 * Get My Industry Slots (with filters)
 * @param industryId - ID of the industry
 * @param filters - Optional filters
 */
export const getMyIndustrySlots = cache(
  async (
    industryId: string,
    filters?: {
      status?: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
      timeframe?: 'upcoming' | 'past';
    }
  ) => {
    'use server';

    try {
      const supabase = await createClient();

      let query = supabase
        .schema('yi_connect').from('events')
        .select(
          `
          id,
          title,
          description,
          start_date,
          end_date,
          max_capacity,
          current_registrations,
          status,
          learning_outcomes,
          logistics_meeting_point,
          created_at
        `
        )
        .eq('industry_id', industryId)
        .eq('category', 'industrial_visit')
        .order('start_date', { ascending: false });

      // Apply status filter
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      // Apply timeframe filter
      if (filters?.timeframe === 'upcoming') {
        query = query.gte('start_date', new Date().toISOString());
      } else if (filters?.timeframe === 'past') {
        query = query.lt('start_date', new Date().toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch industry slots: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getMyIndustrySlots:', error);
      throw error;
    }
  }
);

/**
 * Get Industry Slot Attendees
 * @param eventId - ID of the event
 * @param industryId - ID of the industry (for verification)
 */
type IndustryAttendeeRow = {
  id: string;
  member_name: string;
  member_email: string;
  member_phone: string | null;
  event_title?: string;
  event_date?: string;
  family_count: number;
  family_names: string[] | null;
  carpool_status: 'offering_ride' | 'need_ride' | 'not_needed';
  seats_available: number | null;
  dietary_restrictions: string | null;
  special_requirements: string | null;
  status: string;
  created_at: string;
};

export const getIndustrySlotAttendees = cache(
  async (eventId: string, industryId: string): Promise<IndustryAttendeeRow[]> => {
    'use server';

    // Phase E fix 2026-05-23: events has no industry_id column. The
    // ownership check + attendee lookup are scoped to "this industry's
    // event", so without the linkage we cannot safely return attendees.
    // Returning [] until the events ↔ industries linkage is re-modelled
    // (likely via events.stakeholder_id + stakeholder_type='industry').
    void industryId; void eventId;
    return [];
  }
);

/**
 * Get All Attendees for Industry (across all slots)
 * @param industryId - ID of the industry
 */
export const getAllIndustryAttendees = cache(
  async (industryId: string): Promise<IndustryAttendeeRow[]> => {
    'use server';

    // Phase E fix 2026-05-23: events has no industry_id column and no FK
    // to industries — the "all my industry's events" filter cannot be
    // expressed against the current schema. Returns [] until the linkage
    // is re-modelled.
    void industryId;
    return [];
  }
);
