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
    let query = supabase
      .from('events')
      .select(`
        *,
        industry:industries(id, company_name, industry_sector, city),
        organizer:profiles!events_organizer_id_fkey(id, full_name, email, avatar_url)
      `, { count: 'exact' })
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

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        industry:industries(*),
        organizer:profiles!events_organizer_id_fkey(id, full_name, email, avatar_url)
      `)
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
      .from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'confirmed');

    // Get waitlist count
    const { count: waitlistCount } = await supabase
      .from('iv_waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'waiting');

    // Get carpool stats
    const { count: driversCount } = await supabase
      .from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('carpool_status', 'offering_ride')
      .eq('status', 'confirmed');

    const { count: ridersCount } = await supabase
      .from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('carpool_status', 'need_ride')
      .eq('status', 'confirmed');

    return {
      ...data,
      industry: data.industry,
      organizer: data.organizer,
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

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        industry:industries(id, company_name, industry_sector, city)
      `)
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
          .from('event_rsvps')
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

    let query = supabase
      .from('event_rsvps')
      .select(`
        *,
        member:profiles!event_rsvps_member_id_fkey(
          id, full_name, email, phone, avatar_url
        )
      `, { count: 'exact' })
      .eq('event_id', eventId);

    // Apply filters
    if (filters?.search) {
      // Search in member name/email via join
      query = query.or(`member.full_name.ilike.%${filters.search}%,member.email.ilike.%${filters.search}%`);
    }

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
  'use server';

  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('event_rsvps')
      .select(`
        *,
        event:events!inner(
          id, title, start_date, end_date, category, status,
          industry:industries(name, city)
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
  'use server';

  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('iv_waitlist')
      .select(`
        *,
        event:events!inner(
          id, title, start_date, category,
          industry:industries(name, city)
        )
      `)
      .eq('member_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching waitlist entries:', error);
      throw new Error(`Failed to fetch waitlist entries: ${error.message}`);
    }

    return (data || []) as any;
  } catch (error) {
    console.error('Error in getMyWaitlistEntries:', error);
    throw error;
  }
});

/**
 * Get single IV booking by ID
 */
export const getIVBookingById = cache(async (id: string): Promise<IVBookingWithMember | null> => {
  'use server';

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('event_rsvps')
      .select(`
        *,
        member:profiles!event_rsvps_member_id_fkey(
          id, full_name, email, phone, avatar_url
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
 * Get waitlist for an event
 */
export const getIVWaitlist = cache(async (
  eventId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedWaitlist> => {
  'use server';

  try {
    const supabase = await createClient();

    const query = supabase
      .from('iv_waitlist')
      .select(`
        *,
        member:profiles!iv_waitlist_member_id_fkey(
          id, full_name, email, phone, avatar_url
        ),
        event:events(id, title, start_date, max_capacity, current_registrations)
      `, { count: 'exact' })
      .eq('event_id', eventId)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error('Error fetching IV waitlist:', error);
      throw new Error(`Failed to fetch waitlist: ${error.message}`);
    }

    return {
      data: (data || []) as IVWaitlistWithMember[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  } catch (error) {
    console.error('Error in getIVWaitlist:', error);
    throw error;
  }
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
      .from('iv_waitlist')
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
    const { data, error } = await supabase.rpc('check_iv_capacity', {
      p_event_id: eventId
    }).single();

    if (error || !data) {
      console.error('Error checking IV capacity:', error);
      throw new Error(`Failed to check capacity: ${error?.message || 'No data returned'}`);
    }

    // Get waitlist count
    const { count: waitlistCount } = await supabase
      .from('iv_waitlist')
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
    const { data, error } = await supabase.rpc('calculate_carpool_matches', {
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
    const { data, error } = await supabase.rpc('get_iv_analytics', {
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
      .from('industries')
      .select('id, company_name')
      .eq('id', industryId)
      .single();

    if (industryError || !industry) {
      return null;
    }

    // Get IV stats
    let query = supabase
      .from('events')
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
      .from('event_rsvps')
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
 */
export const getIndustryPortalUserByEmail = cache(async (email: string) => {
  'use server';

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('industry_portal_users')
      .select(`
        *,
        industry:industries(id, company_name, industry_sector, city)
      `)
      .eq('email', email)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching industry portal user:', error);
      throw new Error(`Failed to fetch industry portal user: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error in getIndustryPortalUserByEmail:', error);
    throw error;
  }
});

/**
 * Get industry's IVs
 */
export const getIndustryIVs = cache(async (industryId: string): Promise<IVListItem[]> => {
  'use server';

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        industry:industries(id, company_name, industry_sector)
      `)
      .eq('industry_id', industryId)
      .eq('category', 'industrial_visit')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching industry IVs:', error);
      throw new Error(`Failed to fetch industry IVs: ${error.message}`);
    }

    return (data || []).map((event: any) => ({
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
      waitlist_count: 0,
      has_capacity: event.max_capacity
        ? event.current_registrations < event.max_capacity
        : true,
    }));
  } catch (error) {
    console.error('Error in getIndustryIVs:', error);
    throw error;
  }
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
      .from('events')
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
      .from('event_rsvps')
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
      .from('events')
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
        .from('events')
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
export const getIndustrySlotAttendees = cache(
  async (eventId: string, industryId: string) => {
    'use server';

    try {
      const supabase = await createClient();

      // Verify the event belongs to this industry
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('industry_id')
        .eq('id', eventId)
        .single();

      if (eventError || !event || event.industry_id !== industryId) {
        throw new Error('Unauthorized access to event attendees');
      }

      // Get attendees
      const { data, error } = await supabase
        .from('event_rsvps')
        .select(
          `
          id,
          status,
          family_count,
          family_names,
          carpool_status,
          seats_available,
          dietary_restrictions,
          special_requirements,
          created_at,
          member:profiles!event_rsvps_member_id_fkey(
            id,
            full_name,
            email,
            phone
          )
        `
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch attendees: ${error.message}`);
      }

      return (data || []).map((rsvp: any) => ({
        id: rsvp.id,
        member_name: rsvp.member?.full_name || 'Unknown',
        member_email: rsvp.member?.email || '',
        member_phone: rsvp.member?.phone || null,
        family_count: rsvp.family_count,
        family_names: rsvp.family_names,
        carpool_status: rsvp.carpool_status,
        seats_available: rsvp.seats_available,
        dietary_restrictions: rsvp.dietary_restrictions,
        special_requirements: rsvp.special_requirements,
        status: rsvp.status,
        created_at: rsvp.created_at,
      }));
    } catch (error) {
      console.error('Error in getIndustrySlotAttendees:', error);
      throw error;
    }
  }
);

/**
 * Get All Attendees for Industry (across all slots)
 * @param industryId - ID of the industry
 */
export const getAllIndustryAttendees = cache(async (industryId: string) => {
  'use server';

  try {
    const supabase = await createClient();

    // Get all event IDs for this industry
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, start_date')
      .eq('industry_id', industryId)
      .eq('category', 'industrial_visit');

    if (eventsError) {
      throw new Error(`Failed to fetch events: ${eventsError.message}`);
    }

    if (!events || events.length === 0) {
      return [];
    }

    const eventIds = events.map((e) => e.id);

    // Get all attendees for these events
    const { data, error } = await supabase
      .from('event_rsvps')
      .select(
        `
        id,
        event_id,
        status,
        family_count,
        family_names,
        carpool_status,
        seats_available,
        dietary_restrictions,
        special_requirements,
        created_at,
        member:profiles!event_rsvps_member_id_fkey(
          id,
          full_name,
          email,
          phone
        )
      `
      )
      .in('event_id', eventIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch attendees: ${error.message}`);
    }

    return (data || []).map((rsvp: any) => {
      const event = events.find((e) => e.id === rsvp.event_id);
      return {
        id: rsvp.id,
        member_name: rsvp.member?.full_name || 'Unknown',
        member_email: rsvp.member?.email || '',
        member_phone: rsvp.member?.phone || null,
        event_title: event?.title || 'Unknown Event',
        event_date: event?.start_date || '',
        family_count: rsvp.family_count,
        family_names: rsvp.family_names,
        carpool_status: rsvp.carpool_status,
        seats_available: rsvp.seats_available,
        dietary_restrictions: rsvp.dietary_restrictions,
        special_requirements: rsvp.special_requirements,
        status: rsvp.status,
        created_at: rsvp.created_at,
      };
    });
  } catch (error) {
    console.error('Error in getAllIndustryAttendees:', error);
    throw error;
  }
});
