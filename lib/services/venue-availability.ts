/**
 * Venue Availability Service
 *
 * Service for checking venue availability and managing bookings.
 * Handles conflict detection, time slot recommendations, and booking operations.
 */

import { createClient } from '@/lib/supabase/server';

export interface VenueAvailabilityQuery {
  venueId: string;
  startTime: Date;
  endTime: Date;
  excludeEventId?: string; // Exclude this event when checking (for updates)
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  conflictingEvent?: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
  };
}

export interface VenueAvailabilityResult {
  isAvailable: boolean;
  conflicts: Array<{
    eventId: string;
    eventTitle: string;
    startTime: Date;
    endTime: Date;
    status: string;
  }>;
  venue: {
    id: string;
    name: string;
    capacity: number | null;
    amenities: string[];
  } | null;
}

export interface VenueSuggestion {
  venue: {
    id: string;
    name: string;
    address: string;
    capacity: number | null;
    amenities: string[];
  };
  isAvailable: boolean;
  conflicts: number;
  matchScore: number;
}

export interface DayAvailability {
  date: string;
  timeSlots: TimeSlot[];
  totalAvailable: number;
  totalBooked: number;
}

/**
 * Check if a specific venue is available for a given time range
 */
export async function checkVenueAvailability(
  query: VenueAvailabilityQuery
): Promise<VenueAvailabilityResult> {
  const supabase = await createClient();

  // Get venue details
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('id, name, capacity, amenities')
    .eq('id', query.venueId)
    .eq('is_active', true)
    .single();

  if (venueError || !venue) {
    return {
      isAvailable: false,
      conflicts: [],
      venue: null,
    };
  }

  // Check for conflicting bookings
  let bookingsQuery = supabase
    .from('venue_bookings')
    .select(`
      id,
      event_id,
      start_time,
      end_time,
      status,
      events!inner(id, title)
    `)
    .eq('venue_id', query.venueId)
    .neq('status', 'cancelled')
    .or(`and(start_time.lt.${query.endTime.toISOString()},end_time.gt.${query.startTime.toISOString()})`);

  // Exclude specific event if provided (for update scenarios)
  if (query.excludeEventId) {
    bookingsQuery = bookingsQuery.neq('event_id', query.excludeEventId);
  }

  const { data: conflictingBookings, error: bookingsError } = await bookingsQuery;

  if (bookingsError) {
    console.error('Error checking venue availability:', bookingsError);
    throw new Error('Failed to check venue availability');
  }

  const conflicts = (conflictingBookings || []).map((booking: any) => ({
    eventId: booking.event_id,
    eventTitle: booking.events?.title || 'Unknown Event',
    startTime: new Date(booking.start_time),
    endTime: new Date(booking.end_time),
    status: booking.status,
  }));

  return {
    isAvailable: conflicts.length === 0,
    conflicts,
    venue: {
      id: venue.id,
      name: venue.name,
      capacity: venue.capacity,
      amenities: venue.amenities || [],
    },
  };
}

/**
 * Get available venues for a specific time range
 */
export async function getAvailableVenues(
  startTime: Date,
  endTime: Date,
  requiredCapacity?: number,
  requiredAmenities?: string[]
): Promise<VenueSuggestion[]> {
  const supabase = await createClient();

  // Get all active venues
  let venuesQuery = supabase
    .from('venues')
    .select('id, name, address, capacity, amenities')
    .eq('is_active', true);

  if (requiredCapacity) {
    venuesQuery = venuesQuery.gte('capacity', requiredCapacity);
  }

  const { data: venues, error: venuesError } = await venuesQuery;

  if (venuesError || !venues) {
    console.error('Error fetching venues:', venuesError);
    return [];
  }

  // Get all bookings for the time range
  const { data: bookings } = await supabase
    .from('venue_bookings')
    .select('venue_id, start_time, end_time, status')
    .neq('status', 'cancelled')
    .or(`and(start_time.lt.${endTime.toISOString()},end_time.gt.${startTime.toISOString()})`);

  const bookingsByVenue: Record<string, number> = {};
  bookings?.forEach((booking: any) => {
    bookingsByVenue[booking.venue_id] = (bookingsByVenue[booking.venue_id] || 0) + 1;
  });

  // Score and rank venues
  const suggestions: VenueSuggestion[] = venues.map((venue: any) => {
    const conflicts = bookingsByVenue[venue.id] || 0;
    const isAvailable = conflicts === 0;

    // Calculate match score
    let matchScore = 100;

    // Deduct for conflicts
    matchScore -= conflicts * 20;

    // Add for amenities match
    if (requiredAmenities && requiredAmenities.length > 0) {
      const venueAmenities = venue.amenities || [];
      const matchedAmenities = requiredAmenities.filter(ra =>
        venueAmenities.some((va: string) => va.toLowerCase().includes(ra.toLowerCase()))
      );
      const amenityScore = (matchedAmenities.length / requiredAmenities.length) * 20;
      matchScore += amenityScore;
    }

    // Add for capacity fit
    if (requiredCapacity && venue.capacity) {
      // Prefer venues that are a good fit (not too big, not too small)
      const capacityRatio = requiredCapacity / venue.capacity;
      if (capacityRatio >= 0.5 && capacityRatio <= 0.9) {
        matchScore += 10; // Good fit
      } else if (capacityRatio < 0.5) {
        matchScore -= 5; // Too big
      }
    }

    return {
      venue: {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        capacity: venue.capacity,
        amenities: venue.amenities || [],
      },
      isAvailable,
      conflicts,
      matchScore: Math.max(0, Math.min(100, Math.round(matchScore))),
    };
  });

  // Sort by availability first, then by match score
  suggestions.sort((a, b) => {
    if (a.isAvailable !== b.isAvailable) {
      return a.isAvailable ? -1 : 1;
    }
    return b.matchScore - a.matchScore;
  });

  return suggestions;
}

/**
 * Get venue availability calendar for a specific week
 */
export async function getVenueWeeklyAvailability(
  venueId: string,
  weekStart: Date
): Promise<DayAvailability[]> {
  const supabase = await createClient();

  // Calculate week end (7 days from start)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Get all bookings for the week
  const { data: bookings } = await supabase
    .from('venue_bookings')
    .select(`
      id,
      start_time,
      end_time,
      status,
      events!inner(id, title)
    `)
    .eq('venue_id', venueId)
    .neq('status', 'cancelled')
    .gte('start_time', weekStart.toISOString())
    .lt('end_time', weekEnd.toISOString());

  // Generate availability for each day
  const availability: DayAvailability[] = [];
  const businessHourStart = 9; // 9 AM
  const businessHourEnd = 18; // 6 PM
  const slotDuration = 1; // 1 hour slots

  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];

    const dayBookings = (bookings || []).filter((booking: any) => {
      const bookingDate = new Date(booking.start_time).toISOString().split('T')[0];
      return bookingDate === dateStr;
    });

    // Generate time slots
    const timeSlots: TimeSlot[] = [];
    let totalAvailable = 0;
    let totalBooked = 0;

    for (let hour = businessHourStart; hour < businessHourEnd; hour++) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setHours(hour + slotDuration);

      // Check if this slot overlaps with any booking
      const conflictingBooking = dayBookings.find((booking: any) => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        return slotStart < bookingEnd && slotEnd > bookingStart;
      });

      const isAvailable = !conflictingBooking;

      timeSlots.push({
        startTime: slotStart,
        endTime: slotEnd,
        isAvailable,
        conflictingEvent: conflictingBooking ? {
          id: conflictingBooking.events?.id,
          title: conflictingBooking.events?.title || 'Unknown Event',
          startTime: new Date(conflictingBooking.start_time),
          endTime: new Date(conflictingBooking.end_time),
        } : undefined,
      });

      if (isAvailable) {
        totalAvailable++;
      } else {
        totalBooked++;
      }
    }

    availability.push({
      date: dateStr,
      timeSlots,
      totalAvailable,
      totalBooked,
    });
  }

  return availability;
}

/**
 * Find next available time slots for a venue
 */
export async function findNextAvailableSlots(
  venueId: string,
  durationHours: number,
  fromDate: Date = new Date(),
  maxResults: number = 5
): Promise<TimeSlot[]> {
  const supabase = await createClient();

  // Look ahead 30 days
  const searchEnd = new Date(fromDate);
  searchEnd.setDate(searchEnd.getDate() + 30);

  // Get all bookings in the search range
  const { data: bookings } = await supabase
    .from('venue_bookings')
    .select('start_time, end_time, status')
    .eq('venue_id', venueId)
    .neq('status', 'cancelled')
    .gte('start_time', fromDate.toISOString())
    .lt('end_time', searchEnd.toISOString())
    .order('start_time', { ascending: true });

  const availableSlots: TimeSlot[] = [];
  const businessHourStart = 9;
  const businessHourEnd = 18;

  // Iterate through each day
  for (let d = 0; d < 30 && availableSlots.length < maxResults; d++) {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + d);

    // Skip weekends (optional, can be configured)
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Check each possible start time
    for (let hour = businessHourStart; hour <= businessHourEnd - durationHours; hour++) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setHours(hour + durationHours);

      // Skip if slot is in the past
      if (slotStart < fromDate) continue;

      // Check for conflicts
      const hasConflict = (bookings || []).some((booking: any) => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        return slotStart < bookingEnd && slotEnd > bookingStart;
      });

      if (!hasConflict) {
        availableSlots.push({
          startTime: slotStart,
          endTime: slotEnd,
          isAvailable: true,
        });

        if (availableSlots.length >= maxResults) break;
      }
    }
  }

  return availableSlots;
}

/**
 * Get venue utilization statistics
 */
export async function getVenueUtilization(
  venueId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalHours: number;
  bookedHours: number;
  utilizationRate: number;
  bookingsCount: number;
  averageBookingDuration: number;
}> {
  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from('venue_bookings')
    .select('start_time, end_time, status')
    .eq('venue_id', venueId)
    .neq('status', 'cancelled')
    .gte('start_time', startDate.toISOString())
    .lt('end_time', endDate.toISOString());

  // Calculate total available hours (business hours only)
  const businessHoursPerDay = 9; // 9 AM to 6 PM
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Count weekdays only
  let weekdays = 0;
  for (let d = 0; d < totalDays; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      weekdays++;
    }
  }

  const totalHours = weekdays * businessHoursPerDay;

  // Calculate booked hours
  let bookedHours = 0;
  (bookings || []).forEach((booking: any) => {
    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    bookedHours += durationHours;
  });

  const bookingsCount = bookings?.length || 0;
  const averageBookingDuration = bookingsCount > 0 ? bookedHours / bookingsCount : 0;
  const utilizationRate = totalHours > 0 ? (bookedHours / totalHours) * 100 : 0;

  return {
    totalHours,
    bookedHours: Math.round(bookedHours * 10) / 10,
    utilizationRate: Math.round(utilizationRate * 10) / 10,
    bookingsCount,
    averageBookingDuration: Math.round(averageBookingDuration * 10) / 10,
  };
}
