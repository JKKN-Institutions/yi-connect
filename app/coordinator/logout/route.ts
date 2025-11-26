/**
 * Coordinator Logout Route
 *
 * Handles coordinator logout via form POST.
 */

import { NextResponse } from 'next/server'
import { logoutCoordinator } from '@/app/actions/coordinator-auth'

export async function POST() {
  await logoutCoordinator()
  return NextResponse.redirect(new URL('/coordinator/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
}
