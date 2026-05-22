/**
 * Impersonation Selector Server Component
 *
 * Server-side wrapper that fetches recent users, role options, and
 * initial user list, then renders the client selector with all data.
 */

import { Suspense } from 'react'
import {
  getRecentImpersonations,
  getRoleOptionsForImpersonation,
  getImpersonatableUsers,
} from '@/lib/data/impersonation'
import { getUserHierarchyLevel } from '@/lib/auth'
import { ImpersonationSelectorClient } from './impersonation-selector-client'

interface ImpersonationSelectorServerProps {
  /** Initial search query */
  initialSearch?: string
  /** Initial role filter */
  initialRole?: string
}

async function ImpersonationSelectorData({
  initialSearch,
  initialRole,
}: ImpersonationSelectorServerProps) {
  // Check if user has permission to impersonate
  const hierarchyLevel = await getUserHierarchyLevel()
  if (hierarchyLevel < 6) return null

  // Fetch all required data in parallel
  const [recentUsers, roleOptions, usersResult] = await Promise.all([
    getRecentImpersonations(10),
    getRoleOptionsForImpersonation(),
    getImpersonatableUsers(
      {
        search: initialSearch,
        role_name: initialRole,
      },
      1,
      50 // Load more initially to reduce need for search
    ),
  ])

  return (
    <ImpersonationSelectorClient
      initialUsers={usersResult.users}
      recentUsers={recentUsers}
      roleOptions={roleOptions}
      totalUsers={usersResult.total}
    />
  )
}

/**
 * Wrapper with Suspense for the impersonation selector
 */
export function ImpersonationSelectorWrapper(props: ImpersonationSelectorServerProps = {}) {
  return (
    <Suspense fallback={null}>
      <ImpersonationSelectorData {...props} />
    </Suspense>
  )
}
