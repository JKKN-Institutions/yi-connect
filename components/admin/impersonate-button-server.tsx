/**
 * Impersonate Button Server Component
 *
 * Server-side wrapper that fetches recent impersonations and role options,
 * then passes them to the client ImpersonateButton component.
 * Used on user detail pages for enhanced impersonation experience.
 */

import { Suspense } from 'react'
import {
  getRecentImpersonations,
  getRoleOptionsForImpersonation,
} from '@/lib/data/impersonation'
import { ImpersonateButtonClient } from './impersonate-button-client'
import { Button } from '@/components/ui/button'
import { UserCog, Loader2 } from 'lucide-react'

interface ImpersonateButtonServerProps {
  userId: string
  userName: string
  userRole: string
  userChapter?: string | null
  userEmail?: string
  userAvatar?: string | null
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

async function ImpersonateButtonData(props: ImpersonateButtonServerProps) {
  // Fetch recent impersonations and role options in parallel
  const [recentUsers, roleOptions] = await Promise.all([
    getRecentImpersonations(10),
    getRoleOptionsForImpersonation(),
  ])

  return (
    <ImpersonateButtonClient
      {...props}
      recentUsers={recentUsers}
      roleOptions={roleOptions}
    />
  )
}

function ImpersonateButtonFallback({
  variant = 'outline',
  size = 'sm',
  className,
}: Pick<ImpersonateButtonServerProps, 'variant' | 'size' | 'className'>) {
  return (
    <Button
      variant={variant}
      size={size}
      disabled
      className={className}
    >
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading...
    </Button>
  )
}

/**
 * Wrapper with Suspense for the impersonate button
 */
export function ImpersonateButtonWrapper(props: ImpersonateButtonServerProps) {
  return (
    <Suspense
      fallback={
        <ImpersonateButtonFallback
          variant={props.variant}
          size={props.size}
          className={props.className}
        />
      }
    >
      <ImpersonateButtonData {...props} />
    </Suspense>
  )
}
