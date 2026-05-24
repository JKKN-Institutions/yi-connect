/**
 * Impersonation Action Log API
 * GET - Fetch action logs for a specific impersonation session
 */

import { NextRequest, NextResponse } from 'next/server'
import { getImpersonationActionLog } from '@/lib/data/impersonation'
import { getCurrentUser, getUserHierarchyLevel } from '@/lib/auth'

// National Admin (6) or Super Admin (7) required
const MIN_REQUIRED_LEVEL = 6

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Explicit auth check — requireRole() uses redirect() which is wrong for
    // API routes in Next.js 16 (silently returns 200 with redirect-html body).
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Please log in' },
        { status: 401 }
      )
    }
    const hierarchyLevel = await getUserHierarchyLevel()
    if (hierarchyLevel < MIN_REQUIRED_LEVEL) {
      return NextResponse.json(
        { error: 'Forbidden: National Admin or Super Admin access required' },
        { status: 403 }
      )
    }

    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Fetch action logs using the data layer function
    const actions = await getImpersonationActionLog(sessionId)

    return NextResponse.json({ actions })
  } catch (err) {
    console.error('Error fetching action log:', err)
    return NextResponse.json(
      { error: 'Failed to fetch action log' },
      { status: 500 }
    )
  }
}
