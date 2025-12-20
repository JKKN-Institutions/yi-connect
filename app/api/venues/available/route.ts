/**
 * Available Venues API Route
 *
 * GET /api/venues/available - Get available venues for a time range
 * Query params:
 *   - start: ISO date string for start time (required)
 *   - end: ISO date string for end time (required)
 *   - capacity: Minimum capacity required (optional)
 *   - amenities: Comma-separated list of required amenities (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAvailableVenues } from '@/lib/services/venue-availability';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const capacityParam = searchParams.get('capacity');
    const amenitiesParam = searchParams.get('amenities');

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

    const requiredCapacity = capacityParam ? parseInt(capacityParam) : undefined;
    const requiredAmenities = amenitiesParam
      ? amenitiesParam.split(',').map(a => a.trim()).filter(Boolean)
      : undefined;

    const suggestions = await getAvailableVenues(
      startTime,
      endTime,
      requiredCapacity,
      requiredAmenities
    );

    return NextResponse.json({
      success: true,
      query: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        requiredCapacity,
        requiredAmenities,
      },
      venues: suggestions,
      totalCount: suggestions.length,
      availableCount: suggestions.filter(v => v.isAvailable).length,
    });
  } catch (error) {
    console.error('Error fetching available venues:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch available venues',
      },
      { status: 500 }
    );
  }
}
