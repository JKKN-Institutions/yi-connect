/**
 * Chapter Lead Logout Route
 *
 * Handles logout by clearing cookies and redirecting.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET() {
  const cookieStore = await cookies()

  cookieStore.delete('chapter_lead_id')
  cookieStore.delete('sub_chapter_id')

  redirect('/chapter-lead/login')
}

export async function POST() {
  const cookieStore = await cookies()

  cookieStore.delete('chapter_lead_id')
  cookieStore.delete('sub_chapter_id')

  redirect('/chapter-lead/login')
}
