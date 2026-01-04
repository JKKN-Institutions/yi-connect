/**
 * Impersonation Banner Server Component
 *
 * Server-side wrapper that fetches session and renders the client banner.
 * Separated from client component to avoid 'use cache' in client context.
 */

import { Suspense } from 'react'
import { getActiveImpersonationSession } from '@/lib/data/impersonation'
import { ImpersonationBanner } from './impersonation-banner'

async function ImpersonationBannerServer() {
  const session = await getActiveImpersonationSession()

  if (!session) return null

  return <ImpersonationBanner session={session} />
}

export function ImpersonationBannerWrapper() {
  return (
    <Suspense fallback={null}>
      <ImpersonationBannerServer />
    </Suspense>
  )
}
