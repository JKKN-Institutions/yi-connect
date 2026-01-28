/**
 * Public Event Data Layer
 *
 * Data fetching for public RSVP pages. Uses anon Supabase client.
 * No authentication required - access controlled by rsvp_token.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cache } from 'react';

// Types for the public RSVP page
export interface PublicEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  venue_address: string | null;
  banner_image_url: string | null;
  max_capacity: number | null;
  current_registrations: number;
  status: string;
  chapter_id: string | null;
  allow_guests: boolean;
  guest_limit: number;
  rsvp_token: string;
  chapter?: {
    id: string;
    name: string;
    location: string;
  } | null;
}

export interface PublicMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  company: string | null;
  designation: string | null;
}

export interface PublicRSVP {
  id: string;
  member_id: string;
  status: string;
  guests_count: number;
}

export interface PublicGuestRSVP {
  id: string;
  full_name: string;
  status: string;
}

/**
 * Fetch event by RSVP token (public, no auth required)
 */
export const getEventByRsvpToken = cache(async (token: string): Promise<PublicEvent | null> => {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('events')
    .select(`
      id,
      title,
      description,
      start_date,
      end_date,
      venue_address,
      banner_image_url,
      max_capacity,
      current_registrations,
      status,
      chapter_id,
      allow_guests,
      guest_limit,
      rsvp_token,
      chapter:chapters(id, name, location)
    `)
    .eq('rsvp_token', token)
    .in('status', ['published', 'ongoing', 'completed'])
    .single();

  if (error || !data) return null;

  return data as unknown as PublicEvent;
});

/**
 * Fetch all active chapter members for RSVP display
 * Returns: id, full_name, avatar_url, company, designation
 */
export const getChapterMembersForRSVP = cache(async (chapterId: string): Promise<PublicMember[]> => {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('members')
    .select(`
      id,
      company,
      designation,
      profile:profiles(full_name, avatar_url)
    `)
    .eq('chapter_id', chapterId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  // Flatten the profile join
  return data.map((m: any) => ({
    id: m.id,
    full_name: m.profile?.full_name || 'Unknown Member',
    avatar_url: m.profile?.avatar_url || null,
    company: m.company || null,
    designation: m.designation || null,
  }));
});

/**
 * Fetch existing RSVPs for an event
 */
export const getEventRSVPsByToken = cache(async (eventId: string): Promise<PublicRSVP[]> => {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('event_rsvps')
    .select('id, member_id, status, guests_count')
    .eq('event_id', eventId)
    .in('status', ['confirmed', 'pending', 'attended']);

  if (error || !data) return [];

  return data;
});

/**
 * Fetch guest RSVPs for an event
 */
export const getGuestRSVPs = cache(async (eventId: string): Promise<PublicGuestRSVP[]> => {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('guest_rsvps')
    .select('id, full_name, status')
    .eq('event_id', eventId)
    .in('status', ['confirmed', 'pending', 'attended']);

  if (error || !data) return [];

  return data;
});
