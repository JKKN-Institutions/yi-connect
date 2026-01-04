/**
 * Impersonation Action Log API
 * GET - Fetch action logs for a specific impersonation session
 */

import { NextRequest, NextResponse } from 'next/server'
import { getImpersonationActionLog } from '@/lib/data/impersonation'
import { requireRole } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Require Super Admin or National Admin
    await requireRole(['Super Admin', 'National Admin'])

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
    // If requireRole throws (redirect), it won't be caught here in Next.js 16
    // But just in case there's another error
    console.error('Error fetching action log:', err)
    return NextResponse.json(
      { error: 'Failed to fetch action log' },
      { status: 500 }
    )
  }
}
