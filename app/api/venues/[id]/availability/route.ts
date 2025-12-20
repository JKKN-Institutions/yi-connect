/**
 * Venue Availability API Route
 *
 * GET /api/venues/[id]/availability - Check venue availability
 * Query params:
 *   - start: ISO date string for start time
 *   - end: ISO date string for end time
 *   - exclude_event: Optional event ID to exclude (for updates)
 *   - week: Optional - if 'true', returns weekly availability calendar
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkVenueAvailability,
  getVenueWeeklyAvailability,
  findNextAvailableSlots,
} from '@/lib/services/venue-availability';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const excludeEventId = searchParams.get('exclude_event') || undefined;
    const weekView = searchParams.get('week') === 'true';
    const findSlots = searchParams.get('find_slots') === 'true';
    const duration = searchParams.get('duration') ? parseInt(searchParams.get('duration')!) : 2;

    // Weekly availability view
    if (weekView && startParam) {
      const weekStart = new Date(startParam);
      const availability = await getVenueWeeklyAvailability(venueId, weekStart);

      return NextResponse.json({
        success: true,
        weekStart: weekStart.toISOString(),
        availability,
      });
    }

    // Find next available slots
    if (findSlots) {
      const fromDate = startParam ? new Date(startParam) : new Date();
      const slots = await findNextAvailableSlots(venueId, duration, fromDate, 10);

      return NextResponse.json({
        success: true,
        duration,
        slots: slots.map(slot => ({
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          isAvailable: slot.isAvailable,
        })),
      });
    }

    // Standard availability check
    if (!startParam || !endParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: start and end',
        },
        { status: 400 }
      );
    }

    const startTime = new Date(startParam);
    const endTime = new Date(endParam);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid date format',
        },
        { status: 400 }
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        {
          success: false,
          error: 'Start time must be before end time',
        },
        { status: 400 }
      );
    }

    const result = await checkVenueAvailability({
      venueId,
      startTime,
      endTime,
      excludeEventId,
    });

    return NextResponse.json({
      success: true,
      ...result,
      conflicts: result.conflicts.map(c => ({
        ...c,
        startTime: c.startTime.toISOString(),
        endTime: c.endTime.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error checking venue availability:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check venue availability',
      },
      { status: 500 }
    );
  }
}
