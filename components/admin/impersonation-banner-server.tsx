/**
 * Impersonation Banner Server Component
 *
 * Server-side wrapper that fetches session and role cycle users,
 * then renders the client banner with all necessary data.
 * Separated from client component to avoid 'use cache' in client context.
 */

import { Suspense } from 'react'
import {
  getActiveImpersonationSession,
  getUsersForRoleCycling,
} from '@/lib/data/impersonation'
import { ImpersonationBanner } from './impersonation-banner'

async function ImpersonationBannerServer() {
  const session = await getActiveImpersonationSession()

  if (!session) return null

  // Fetch users with the same role for role cycling
  const { users: roleCycleUsers, currentIndex } = await getUsersForRoleCycling(
    session.target_user_role,
    session.target_user_id
  )

  return (
    <ImpersonationBanner
      session={session}
      roleCycleUsers={roleCycleUsers}
      currentIndex={currentIndex}
    />
  )
}

export function ImpersonationBannerWrapper() {
  return (
    <Suspense fallback={null}>
      <ImpersonationBannerServer />
    </Suspense>
  )
}
