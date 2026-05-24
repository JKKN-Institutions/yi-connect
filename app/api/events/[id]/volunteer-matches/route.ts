import { NextRequest, NextResponse } from 'next/server';
import { getVolunteerMatches } from '@/lib/data/events';
import type { VolunteerMatchCriteria } from '@/types/event';
import { getCurrentUser, getCurrentChapterId } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication and chapter membership — volunteer match data
    // includes member skills/availability and must not leak to anon.
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Please log in', matches: [] },
        { status: 401 }
      );
    }
    const chapterId = await getCurrentChapterId();
    if (!chapterId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: No chapter assigned', matches: [] },
        { status: 403 }
      );
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const requiredSkills = searchParams.get('required_skills')
      ? searchParams.get('required_skills')!.split(',').filter(Boolean)
      : undefined;

    const sortBy = searchParams.get('sort_by') as 'match_score' | 'volunteer_hours' | 'events_volunteered' | undefined;
    const minAvailability = searchParams.get('min_availability') as 'available' | 'busy' | undefined;

    // Build criteria
    const criteria: VolunteerMatchCriteria = {
      event_id: id,
      required_skills: requiredSkills,
      sort_by: sortBy,
      min_availability: minAvailability
    };

    // Get matches
    const matches = await getVolunteerMatches(criteria);

    return NextResponse.json({
      success: true,
      matches
    });
  } catch (error) {
    console.error('Error fetching volunteer matches:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch volunteer matches',
        matches: []
      },
      { status: 500 }
    );
  }
}
