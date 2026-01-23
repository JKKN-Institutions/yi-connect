import { NextResponse } from 'next/server'
import { fixDemoUserRoles, checkDemoUserRoles } from '@/app/actions/fix-demo-roles'

/**
 * GET: Check current role assignments for demo users
 */
export async function GET() {
  try {
    const result = await checkDemoUserRoles()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * POST: Fix demo user roles
 */
export async function POST() {
  try {
    const result = await fixDemoUserRoles()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
