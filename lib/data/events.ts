/**
 * Event Module Data Layer
 *
 * Cached data fetching functions for Event Lifecycle Manager module.
 * Uses React cache() for request-level deduplication.
 *
 * IMPORTANT: We don't use Next.js 16's 'use cache' directive here because
 * all functions access Supabase client which uses cookies() - a dynamic data source.
 * Next.js 16 doesn't allow dynamic data sources inside 'use cache' boundaries.
 * React's cache() provides request-level deduplication which is sufficient.
 */

import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/data/auth';
import type {
  Event,
  EventWithDetails,
  EventWithRSVPs,
  EventWithVolunteers,
  EventWithMetrics,
  EventFull,
  EventListItem,
  Venue,
  VenueWithBookings,
  EventRSVP,
  GuestRSVP,
  EventVolunteer,
  VolunteerRole,
  VolunteerRoleWithMembers,
  EventFeedback,
  EventDocument,
  EventTemplate,
  EventAnalytics,
  EventImpactSummary,
  EventFilters,
  EventSortOptions,
  PaginatedEvents,
  VenueFilters,
  RSVPFilters,
  VolunteerFilters,
  VolunteerMatch,
  VolunteerMatchCriteria
} from '@/types/event';

// ============================================================================
// Event Queries
// ============================================================================

/**
 * Get paginated events with filters and sorting
 */
export const getEvents = cache(
  async (params?: {
    page?: number;
    pageSize?: number;
    filters?: EventFilters;
    sort?: EventSortOptions;
  }): Promise<PaginatedEvents> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const page = params?.page || 1;
    const pageSize = params?.pageSize || 10;
    const offset = (page - 1) * pageSize;
    const filters = params?.filters;
    const sort = params?.sort || { field: 'start_date', direction: 'desc' };

    let query = supabase.from('events').select(
      `
      id,
      title,
      description,
      category,
      status,
      start_date,
      end_date,
      is_virtual,
      venue_id,
      venue_address,
      max_capacity,
      current_registrations,
      organizer_id,
      banner_image_url,
      is_featured,
      created_at,
      venue:venues (
        id,
        name,
        city
      ),
      organizer:members!organizer_id (
        id,
        profile:profiles (
          full_name,
          email,
          avatar_url
        )
      )
    `,
      { count: 'exact' }
    );

    console.log('Fetching events for user:', user.id);
    console.log('Query filters:', filters);
    console.log('Query sort:', sort);

    // Apply filters
    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.category && filters.category.length > 0) {
      query = query.in('category', filters.category);
    }
    if (filters?.start_date_from) {
      query = query.gte('start_date', filters.start_date_from);
    }
    if (filters?.start_date_to) {
      query = query.lte('start_date', filters.start_date_to);
    }
    if (filters?.is_virtual !== undefined) {
      query = query.eq('is_virtual', filters.is_virtual);
    }
    if (filters?.is_featured !== undefined) {
      query = query.eq('is_featured', filters.is_featured);
    }
    if (filters?.organizer_id) {
      query = query.eq('organizer_id', filters.organizer_id);
    }
    if (filters?.chapter_id) {
      query = query.eq('chapter_id', filters.chapter_id);
    }
    if (filters?.has_capacity) {
      query = query.or(
        'max_capacity.is.null,current_registrations.lt.max_capacity'
      );
    }

    // Apply sorting
    query = query.order(sort.field, { ascending: sort.direction === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    // Only treat as error if error object has meaningful content
    if (error && error.message) {
      console.error('Error fetching events:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    // Handle empty results (no events in database)
    if (!data || data.length === 0) {
      console.log('No events found in database, returning empty result');
      return {
        data: [],
        total: count || 0,
        page,
        pageSize,
        totalPages: 0
      };
    }

    // Transform data to ensure venue and organizer are single objects, not arrays
    const transformedData: EventListItem[] = data.map(
      (event: any): EventListItem => ({
        id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        status: event.status,
        start_date: event.start_date,
        end_date: event.end_date,
        is_virtual: event.is_virtual,
        venue_id: event.venue_id,
        venue_address: event.venue_address,
        max_capacity: event.max_capacity,
        current_registrations: event.current_registrations,
        organizer_id: event.organizer_id,
        banner_image_url: event.banner_image_url,
        is_featured: event.is_featured,
        created_at: event.created_at,
        venue: Array.isArray(event.venue)
          ? event.venue[0]
            ? {
                id: event.venue[0].id,
                name: event.venue[0].name,
                city: event.venue[0].city
              }
            : null
          : event.venue
          ? {
              id: event.venue.id,
              name: event.venue.name,
              city: event.venue.city
            }
          : null,
        organizer: Array.isArray(event.organizer)
          ? event.organizer[0]
            ? {
                id: event.organizer[0].id,
                profile: event.organizer[0].profile
              }
            : null
          : event.organizer
          ? {
              id: event.organizer.id,
              profile: event.organizer.profile
            }
          : null
      })
    );

    return {
      data: transformedData,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    };
  }
);

/**
 * Get event by ID with basic details
 */
export const getEventById = cache(
  async (eventId: string): Promise<EventWithDetails | null> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('events')
      .select(
        `
      *,
      venue:venues (*),
      template:event_templates (*),
      organizer:members!organizer_id (
        id,
        profile:profiles (
          full_name,
          email,
          avatar_url
        )
      ),
      chapter:chapters (
        id,
        name,
        location
      )
    `
      )
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('Error fetching event:', error);
      return null;
    }

    return data as EventWithDetails;
  }
);

/**
 * Get event with RSVPs and guest RSVPs
 */
export const getEventWithRSVPs = cache(
  async (eventId: string): Promise<EventWithRSVPs | null> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('events')
      .select(
        `
      *,
      venue:venues (*),
      template:event_templates (*),
      organizer:members!organizer_id (
        id,
        profile:profiles (
          full_name,
          email,
          avatar_url
        )
      ),
      chapter:chapters (
        id,
        name,
        location
      ),
      rsvps:event_rsvps (
        *,
        member:members (
          id,
          company,
          designation,
          profile:profiles (
            full_name,
            email,
            phone,
            avatar_url
          )
        )
      ),
      guest_rsvps (*)
    `
      )
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('Error fetching event with RSVPs:', error);
      return null;
    }

    return data as EventWithRSVPs;
  }
);

/**
 * Get event with volunteers
 */
export const getEventWithVolunteers = cache(
  async (eventId: string): Promise<EventWithVolunteers | null> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('events')
      .select(
        `
      *,
      venue:venues (*),
      template:event_templates (*),
      organizer:members!organizer_id (
        id,
        profile:profiles (
          full_name,
          email,
          avatar_url
        )
      ),
      chapter:chapters (
        id,
        name,
        location
      ),
      volunteers:event_volunteers (
        *,
        member:members (
          id,
          company,
          designation,
          profile:profiles (
            full_name,
            email,
            phone,
            avatar_url
          )
        ),
        role:volunteer_roles (*)
      )
    `
      )
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('Error fetching event with volunteers:', error);
      return null;
    }

    return data as EventWithVolunteers;
  }
);

/**
 * Get event with impact metrics
 */
export const getEventWithMetrics = cache(
  async (eventId: string): Promise<EventWithMetrics | null> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('events')
      .select(
        `
      *,
      venue:venues (*),
      template:event_templates (*),
      organizer:members!organizer_id (
        id,
        profile:profiles (
          full_name,
          email,
          avatar_url
        )
      ),
      chapter:chapters (
        id,
        name,
        location
      ),
      impact_metrics:event_impact_metrics (*)
    `
      )
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('Error fetching event with metrics:', error);
      return null;
    }

    return data as EventWithMetrics;
  }
);

/**
 * Get complete event details with all relationships
 */
export const getEventFull = cache(
  async (eventId: string): Promise<EventFull | null> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('events')
      .select(
        `
      *,
      venue:venues (*),
      template:event_templates (*),
      organizer:members!organizer_id (
        id,
        profile:profiles (
          full_name,
          email,
          avatar_url
        )
      ),
      chapter:chapters (
        id,
        name,
        location
      ),
      rsvps:event_rsvps (
        *,
        member:members (
          id,
          company,
          designation,
          profile:profiles (
            full_name,
            email,
            phone,
            avatar_url
          )
        )
      ),
      guest_rsvps (*),
      volunteers:event_volunteers (
        *,
        member:members (
          id,
          company,
          designation,
          profile:profiles (
            full_name,
            email,
            phone,
            avatar_url
          )
        ),
        role:volunteer_roles (*)
      ),
      venue_booking:venue_bookings (*),
      resource_bookings (
        *,
        resource:resources (*)
      ),
      impact_metrics:event_impact_metrics (*),
      feedback:event_feedback (*),
      documents:event_documents (*)
    `
      )
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('Error fetching full event details:', error);
      return null;
    }

    // Type assertion is safe here because our query selects exactly what EventFull expects
    return data as unknown as EventFull;
  }
);

/**
 * Get upcoming events for a member (RSVPed or volunteering)
 */
export const getMemberUpcomingEvents = cache(
  async (memberId: string): Promise<EventListItem[]> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get events where member has RSVP'd or is volunteering
    const { data: rsvpEvents } = await supabase
      .from('event_rsvps')
      .select(
        `
      event:events (
        id,
        title,
        description,
        category,
        status,
        start_date,
        end_date,
        is_virtual,
        venue_id,
        venue_address,
        max_capacity,
        current_registrations,
        organizer_id,
        banner_image_url,
        is_featured,
        created_at,
        venue:venues (
          id,
          name,
          city
        ),
        organizer:members!organizer_id (
          id,
          profile:profiles (
            full_name
          )
        )
      )
    `
      )
      .eq('member_id', memberId)
      .in('status', ['confirmed', 'pending'])
      .gte('event.start_date', new Date().toISOString())
      .order('event.start_date', { ascending: true });

    const { data: volunteerEvents } = await supabase
      .from('event_volunteers')
      .select(
        `
      event:events (
        id,
        title,
        description,
        category,
        status,
        start_date,
        end_date,
        is_virtual,
        venue_id,
        venue_address,
        max_capacity,
        current_registrations,
        organizer_id,
        banner_image_url,
        is_featured,
        created_at,
        venue:venues (
          id,
          name,
          city
        ),
        organizer:members!organizer_id (
          id,
          profile:profiles (
            full_name
          )
        )
      )
    `
      )
      .eq('member_id', memberId)
      .in('status', ['accepted', 'invited'])
      .gte('event.start_date', new Date().toISOString())
      .order('event.start_date', { ascending: true });

    // Combine and deduplicate events
    const eventMap = new Map<string, EventListItem>();

    rsvpEvents?.forEach((item: any) => {
      if (item.event) {
        eventMap.set(item.event.id, item.event as any);
      }
    });

    volunteerEvents?.forEach((item: any) => {
      if (item.event) {
        eventMap.set(item.event.id, item.event as any);
      }
    });

    return Array.from(eventMap.values()).sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );
  }
);

// ============================================================================
// Venue Queries
// ============================================================================

/**
 * Get all active venues with optional filters
 */
export const getVenues = cache(
  async (filters?: VenueFilters): Promise<Venue[]> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    let query = supabase.from('venues').select('*');

    // Apply filters
    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,address.ilike.%${filters.search}%`
      );
    }
    if (filters?.city && filters.city.length > 0) {
      query = query.in('city', filters.city);
    }
    if (filters?.capacity_min) {
      query = query.gte('capacity', filters.capacity_min);
    }
    if (filters?.capacity_max) {
      query = query.lte('capacity', filters.capacity_max);
    }
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters?.amenities && filters.amenities.length > 0) {
      query = query.contains('amenities', filters.amenities);
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching venues:', error);
      throw new Error('Failed to fetch venues');
    }

    return (data || []) as Venue[];
  }
);

/**
 * Get venue by ID with upcoming bookings
 */
export const getVenueWithBookings = cache(
  async (venueId: string): Promise<VenueWithBookings | null> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('venues')
      .select(
        `
      *,
      bookings:venue_bookings (*)
    `
      )
      .eq('id', venueId)
      .single();

    if (error) {
      console.error('Error fetching venue with bookings:', error);
      return null;
    }

    // Count upcoming bookings
    const upcomingCount =
      data.bookings?.filter(
        (booking: any) => new Date(booking.start_time) > new Date()
      ).length || 0;

    return {
      ...data,
      upcoming_bookings_count: upcomingCount
    } as VenueWithBookings;
  }
);

// ============================================================================
// RSVP Queries
// ============================================================================

/**
 * Get RSVPs with optional filters
 */
export const getRSVPs = cache(
  async (filters?: RSVPFilters): Promise<EventRSVP[]> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    let query = supabase.from('event_rsvps').select(`
      *,
      member:members (
        id,
        company,
        designation,
        profile:profiles (
          full_name,
          email,
          phone,
          avatar_url
        )
      ),
      event:events (
        id,
        title,
        start_date
      )
    `);

    if (filters?.event_id) {
      query = query.eq('event_id', filters.event_id);
    }
    if (filters?.member_id) {
      query = query.eq('member_id', filters.member_id);
    }
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.has_guests !== undefined) {
      if (filters.has_guests) {
        query = query.gt('guests_count', 0);
      } else {
        query = query.eq('guests_count', 0);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching RSVPs:', error);
      throw new Error('Failed to fetch RSVPs');
    }

    return (data || []) as EventRSVP[];
  }
);

/**
 * Get member's RSVP for a specific event
 */
export const getMemberRSVP = cache(
  async (eventId: string, memberId: string): Promise<EventRSVP | null> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .eq('member_id', memberId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No RSVP found
        return null;
      }
      console.error('Error fetching member RSVP:', error);
      throw new Error('Failed to fetch RSVP');
    }

    return data;
  }
);

/**
 * Get guest RSVPs for an event
 */
export const getGuestRSVPs = cache(
  async (eventId: string): Promise<GuestRSVP[]> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('guest_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching guest RSVPs:', error);
      throw new Error('Failed to fetch guest RSVPs');
    }

    return (data || []) as GuestRSVP[];
  }
);

// ============================================================================
// Volunteer Queries
// ============================================================================

/**
 * Get volunteer roles
 */
export const getVolunteerRoles = cache(async (): Promise<VolunteerRole[]> => {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('volunteer_roles')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching volunteer roles:', error);
    throw new Error('Failed to fetch volunteer roles');
  }

  return (data || []) as VolunteerRole[];
});

/**
 * Get volunteers with optional filters
 */
export const getVolunteers = cache(
  async (filters?: VolunteerFilters): Promise<EventVolunteer[]> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    let query = supabase.from('event_volunteers').select(`
      *,
      member:members (
        id,
        company,
        designation,
        profile:profiles (
          full_name,
          email,
          phone,
          avatar_url
        )
      ),
      role:volunteer_roles (*),
      event:events (
        id,
        title,
        start_date
      )
    `);

    if (filters?.event_id) {
      query = query.eq('event_id', filters.event_id);
    }
    if (filters?.member_id) {
      query = query.eq('member_id', filters.member_id);
    }
    if (filters?.role_id) {
      query = query.eq('role_id', filters.role_id);
    }
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching volunteers:', error);
      throw new Error('Failed to fetch volunteers');
    }

    return (data || []) as EventVolunteer[];
  }
);

/**
 * Get volunteer role with members
 */
export const getVolunteerRoleWithMembers = cache(
  async (roleId: string): Promise<VolunteerRoleWithMembers | null> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('volunteer_roles')
      .select(
        `
      *,
      volunteers:event_volunteers (
        *,
        member:members (
          id,
          company,
          designation,
          profile:profiles (
            full_name,
            email,
            phone,
            avatar_url
          )
        )
      )
    `
      )
      .eq('id', roleId)
      .single();

    if (error) {
      console.error('Error fetching volunteer role with members:', error);
      return null;
    }

    return {
      ...data,
      members_count: data.volunteers?.length || 0
    } as VolunteerRoleWithMembers;
  }
);

/**
 * Get matched volunteers for an event based on criteria
 */
export const getMatchedVolunteers = cache(
  async (criteria: VolunteerMatchCriteria): Promise<VolunteerMatch[]> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get event details
    const { data: event } = await supabase
      .from('events')
      .select('start_date, end_date')
      .eq('id', criteria.event_id)
      .single();

    if (!event) {
      return [];
    }

    // Get members with volunteer history and skills
    const { data: members } = await supabase
      .from('members')
      .select(
        `
      id,
      full_name,
      skills,
      availability_status,
      volunteer_hours:event_volunteers (
        hours_contributed
      ),
      events_volunteered:event_volunteers (
        event_id
      )
    `
      )
      .eq('is_active', true);

    if (!members) {
      return [];
    }

    // Calculate match scores
    const matches: VolunteerMatch[] = members.map((member: any) => {
      let matchScore = 0;
      const matchingSkills: string[] = [];

      // Match skills
      if (criteria.required_skills && member.skills) {
        const memberSkills = member.skills.map((s: string) => s.toLowerCase());
        criteria.required_skills.forEach((skill) => {
          if (memberSkills.includes(skill.toLowerCase())) {
            matchScore += 20;
            matchingSkills.push(skill);
          }
        });
      }

      // Availability bonus
      if (member.availability_status === 'available') {
        matchScore += 30;
      } else if (
        member.availability_status === 'busy' &&
        criteria.min_availability !== 'available'
      ) {
        matchScore += 10;
      }

      // Experience bonus
      const totalVolunteerHours =
        member.volunteer_hours?.reduce(
          (sum: number, v: any) => sum + (v.hours_contributed || 0),
          0
        ) || 0;
      const eventsVolunteered = new Set(
        member.events_volunteered?.map((v: any) => v.event_id) || []
      ).size;

      if (totalVolunteerHours > 50) matchScore += 25;
      else if (totalVolunteerHours > 20) matchScore += 15;
      else if (totalVolunteerHours > 5) matchScore += 5;

      if (eventsVolunteered > 10) matchScore += 25;
      else if (eventsVolunteered > 5) matchScore += 15;
      else if (eventsVolunteered > 2) matchScore += 5;

      return {
        member_id: member.id,
        member_name: member.full_name,
        match_score: matchScore,
        matching_skills: matchingSkills,
        availability_status: member.availability_status || 'unavailable',
        volunteer_hours: totalVolunteerHours,
        events_volunteered: eventsVolunteered,
        preferred_roles: [] // TODO: Add from member preferences
      };
    });

    // Filter by minimum availability if specified
    const filteredMatches = criteria.min_availability
      ? matches.filter((m) => {
          if (criteria.min_availability === 'available') {
            return m.availability_status === 'available';
          }
          return m.availability_status !== 'unavailable';
        })
      : matches;

    // Sort by specified criteria
    const sortBy = criteria.sort_by || 'match_score';
    filteredMatches.sort((a, b) => b[sortBy] - a[sortBy]);

    return filteredMatches;
  }
);

// ============================================================================
// Event Analytics & Metrics
// ============================================================================

/**
 * Get event analytics summary
 */
export const getEventAnalytics = cache(
  async (chapterId?: string): Promise<EventAnalytics> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    let query = supabase.from('events').select('*');

    if (chapterId) {
      query = query.eq('chapter_id', chapterId);
    }

    const { data: events } = await query;

    if (!events) {
      return {
        total_events: 0,
        upcoming_events: 0,
        ongoing_events: 0,
        completed_events: 0,
        draft_events: 0,
        cancelled_events: 0,
        total_attendees: 0,
        average_attendance_rate: 0,
        total_volunteers: 0,
        total_volunteer_hours: 0,
        events_by_category: {} as any,
        events_by_month: []
      };
    }

    const now = new Date();
    const upcoming = events.filter(
      (e: any) => new Date(e.start_date) > now && e.status === 'published'
    );
    const ongoing = events.filter((e: any) => e.status === 'ongoing');
    const completed = events.filter((e: any) => e.status === 'completed');
    const draft = events.filter((e: any) => e.status === 'draft');
    const cancelled = events.filter((e: any) => e.status === 'cancelled');

    // Calculate attendees and attendance rate
    const totalAttendees = events.reduce(
      (sum: any, e: any) => sum + (e.current_registrations || 0),
      0
    );
    const eventsWithCapacity = events.filter((e: any) => e.max_capacity);
    const averageAttendanceRate =
      eventsWithCapacity.length > 0
        ? eventsWithCapacity.reduce((sum: any, e: any) => {
            const rate = e.max_capacity
              ? (e.current_registrations / e.max_capacity) * 100
              : 0;
            return sum + rate;
          }, 0) / eventsWithCapacity.length
        : 0;

    // Get volunteer stats
    const { data: volunteers } = await supabase
      .from('event_volunteers')
      .select('hours_contributed')
      .in(
        'event_id',
        events.map((e: any) => e.id)
      );

    const totalVolunteers = volunteers?.length || 0;
    const totalVolunteerHours =
      volunteers?.reduce(
        (sum: any, v: any) => sum + (v.hours_contributed || 0),
        0
      ) || 0;

    // Events by category
    const eventsByCategory = events.reduce((acc: any, e: any) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Events by month (last 12 months)
    const eventsByMonth = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toLocaleString('default', {
        month: 'short',
        year: 'numeric'
      });
      const count = events.filter((e: any) => {
        const eventDate = new Date(e.start_date);
        return (
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()
        );
      }).length;
      eventsByMonth.push({ month, count });
    }

    return {
      total_events: events.length,
      upcoming_events: upcoming.length,
      ongoing_events: ongoing.length,
      completed_events: completed.length,
      draft_events: draft.length,
      cancelled_events: cancelled.length,
      total_attendees: totalAttendees,
      average_attendance_rate: averageAttendanceRate,
      total_volunteers: totalVolunteers,
      total_volunteer_hours: totalVolunteerHours,
      events_by_category: eventsByCategory as any,
      events_by_month: eventsByMonth
    };
  }
);

/**
 * Get event feedback for an event
 */
export const getEventFeedback = cache(
  async (eventId: string): Promise<EventFeedback[]> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('event_feedback')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching event feedback:', error);
      throw new Error('Failed to fetch event feedback');
    }

    return (data || []) as EventFeedback[];
  }
);

/**
 * Get event documents
 */
export const getEventDocuments = cache(
  async (eventId: string): Promise<EventDocument[]> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabase
      .from('event_documents')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching event documents:', error);
      throw new Error('Failed to fetch event documents');
    }

    return (data || []) as EventDocument[];
  }
);

/**
 * Get event templates
 */
export const getEventTemplates = cache(async (): Promise<EventTemplate[]> => {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error} = await supabase
    .from('event_templates')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching event templates:', error);
    throw new Error('Failed to fetch event templates');
  }

  return (data || []) as EventTemplate[];
});

// ============================================================================
// Volunteer Matching
// ============================================================================

/**
 * Match volunteers for an event based on skills and availability
 * Uses smart algorithm to score and rank potential volunteers
 */
export const getVolunteerMatches = cache(
  async (criteria: VolunteerMatchCriteria): Promise<VolunteerMatch[]> => {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get the event details
    const { data: event } = await supabase
      .from('events')
      .select('start_date, end_date')
      .eq('id', criteria.event_id)
      .single();

    if (!event) {
      return [];
    }

    // Fetch all members with their skills and volunteer history
    const { data: members, error } = await supabase
      .from('members')
      .select(`
        id,
        profile:profiles (
          full_name
        ),
        skills:member_skills(
          skill_id,
          skill_name,
          proficiency_level
        ),
        volunteer_history:event_volunteers(
          id,
          event_id,
          hours_contributed,
          performance_rating
        )
      `)
      .eq('is_active', true);

    if (error || !members) {
      console.error('Error fetching members for matching:', error);
      return [];
    }

    // Calculate match score for each member
    const matches: VolunteerMatch[] = members
      .map((member: any) => {
        let matchScore = 0;
        const matchingSkills: string[] = [];

        // Skill matching (60% of score)
        if (criteria.required_skills && criteria.required_skills.length > 0) {
          const memberSkills = member.skills || [];
          const memberSkillNames = memberSkills.map((s: any) => s.skill_name.toLowerCase());

          criteria.required_skills.forEach((requiredSkill) => {
            const skillLower = requiredSkill.toLowerCase();
            const hasSkill = memberSkillNames.some((ms: string) =>
              ms.includes(skillLower) || skillLower.includes(ms)
            );

            if (hasSkill) {
              matchingSkills.push(requiredSkill);
              // Find the skill's proficiency level
              const skill = memberSkills.find((s: any) =>
                s.skill_name.toLowerCase().includes(skillLower) ||
                skillLower.includes(s.skill_name.toLowerCase())
              );
              const proficiency = skill?.proficiency_level || 'beginner';
              const proficiencyScores: Record<string, number> = {
                expert: 100,
                advanced: 80,
                intermediate: 60,
                beginner: 40
              };
              const proficiencyScore = proficiencyScores[proficiency as string] || 40;

              matchScore += proficiencyScore / (criteria.required_skills?.length || 1);
            }
          });
        } else {
          // No specific skills required, give base score
          matchScore = 50;
        }

        // Availability status (20% of score)
        // Default to available since availability_status is tracked in separate availability table
        const availabilityScore = 20;
        matchScore += availabilityScore;

        // Volunteer experience (20% of score)
        const volunteerHistory = member.volunteer_history || [];
        const eventsVolunteered = volunteerHistory.length;
        const totalHours = volunteerHistory.reduce(
          (sum: number, v: any) => sum + (v.hours_contributed || 0),
          0
        );
        const avgRating = volunteerHistory.length > 0
          ? volunteerHistory.reduce(
              (sum: number, v: any) => sum + (v.performance_rating || 0),
              0
            ) / volunteerHistory.length
          : 0;

        const experienceScore = Math.min(
          20,
          (eventsVolunteered * 2) + (avgRating * 2)
        );
        matchScore += experienceScore;

        return {
          member_id: member.id,
          member_name: (member.profile as any)?.full_name || 'Unknown',
          match_score: Math.round(matchScore),
          matching_skills: matchingSkills,
          availability_status: 'available' as 'available' | 'busy' | 'unavailable',
          volunteer_hours: totalHours,
          events_volunteered: eventsVolunteered,
          preferred_roles: [] // Could be enhanced with member preferences
        };
      })
      .filter((match) => {
        // Filter by minimum availability if specified
        if (criteria.min_availability) {
          const availabilityOrder: Record<string, number> = { available: 3, busy: 2, unavailable: 1 };
          return (
            (availabilityOrder[match.availability_status] || 0) >=
            (availabilityOrder[criteria.min_availability] || 0)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by specified criteria or default to match_score
        const sortBy = criteria.sort_by || 'match_score';
        return b[sortBy] - a[sortBy];
      });

    return matches;
  }
);
