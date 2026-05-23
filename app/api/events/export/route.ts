/**
 * Events Export API Route
 *
 * Fetches all events matching current filters for export.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/data/auth';
import type { EventFilters } from '@/types/event';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    // Parse filters from query params
    const filters: EventFilters = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status')
        ? [searchParams.get('status') as any]
        : undefined,
      category: searchParams.get('category')
        ? [searchParams.get('category') as any]
        : undefined,
      start_date_from: searchParams.get('start_date_from') || undefined,
      start_date_to: searchParams.get('start_date_to') || undefined
    };

    // Phase E fix 2026-05-23 (Agent O): drop `organizer:members!organizer_id`
    // embed — events.organizer_id FK targets auth.users, not members, so
    // PostgREST returns PGRST200. Two-step resolution below mirrors getEvents.
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
      created_at,
      venue:venues (
        id,
        name,
        city
      )
    `,
      { count: 'exact' }
    );

    // Apply filters
    if (filters.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    if (filters.status && filters.status.length > 0) {
      if (filters.status.length === 1) {
        query = query.eq('status', filters.status[0]);
      } else {
        query = query.in('status', filters.status);
      }
    }

    if (filters.category && filters.category.length > 0) {
      if (filters.category.length === 1) {
        query = query.eq('category', filters.category[0]);
      } else {
        query = query.in('category', filters.category);
      }
    }

    if (filters.start_date_from) {
      query = query.gte('start_date', filters.start_date_from);
    }

    if (filters.start_date_to) {
      query = query.lte('start_date', filters.start_date_to);
    }

    // Sort by start date
    query = query.order('start_date', { ascending: false });

    // Fetch all results (with a reasonable limit)
    query = query.limit(10000);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching events for export:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    // Phase E fix 2026-05-23 (Agent O): batch-resolve organizers via admin
    // client since the embed was dropped above. Decorative — failure here
    // just yields organizer:null per row, never blocks the export.
    const organizerIds = Array.from(
      new Set(
        (data || [])
          .map((e: any) => e.organizer_id)
          .filter((id: string | null): id is string => !!id)
      )
    );
    const organizersById = new Map<
      string,
      { id: string; profile: { full_name: string; email: string } | null }
    >();
    if (organizerIds.length > 0) {
      try {
        const admin = createAdminSupabaseClient();
        const { data: orgRows } = await admin
          .from('members')
          .select('id, profile:profiles(full_name, email)')
          .in('id', organizerIds);
        (orgRows || []).forEach((row: any) => {
          const profile = Array.isArray(row.profile)
            ? row.profile[0]
            : row.profile;
          organizersById.set(row.id, {
            id: row.id,
            profile: profile
              ? { full_name: profile.full_name, email: profile.email }
              : null
          });
        });
      } catch (orgErr) {
        console.error('[events export] failed to resolve organizers:', orgErr);
      }
    }

    // Transform data
    const transformedData = (data || []).map((event: any) => ({
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
      organizer: event.organizer_id
        ? organizersById.get(event.organizer_id) || null
        : null
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      count: transformedData.length
    });
  } catch (error) {
    console.error('Error in events export API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
