'use client'

/**
 * Impersonate Button Client Component
 *
 * Enhanced version of ImpersonateButton that receives server-fetched
 * recent users and role options for a better impersonation experience.
 */

import { useState } from 'react'
import { UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ImpersonationSelector } from './impersonation-selector'
import type {
  ImpersonatableUser,
  RecentImpersonation,
  RoleOption,
} from '@/types/impersonation'

interface ImpersonateButtonClientProps {
  userId: string
  userName: string
  userRole: string
  userChapter?: string | null
  userEmail?: string
  userAvatar?: string | null
  recentUsers: RecentImpersonation[]
  roleOptions: RoleOption[]
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function ImpersonateButtonClient({
  userId,
  userName,
  userRole,
  userChapter,
  userEmail = '',
  userAvatar,
  recentUsers,
  roleOptions,
  variant = 'outline',
  size = 'sm',
  className,
}: ImpersonateButtonClientProps) {
  const [open, setOpen] = useState(false)

  // Create a single-user array for the selector
  // The user being viewed is pre-selected
  const users: ImpersonatableUser[] = [
    {
      id: userId,
      full_name: userName,
      email: userEmail,
      avatar_url: userAvatar || null,
      role_name: userRole,
      hierarchy_level: 0, // Not needed for single user
      chapter_id: null,
      chapter_name: userChapter || null,
      last_active_at: null,
    },
  ]

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={cn('gap-2', className)}
      >
        <UserCog className="h-4 w-4" />
        Impersonate
      </Button>

      <ImpersonationSelector
        open={open}
        onOpenChange={setOpen}
        users={users}
        recentUsers={recentUsers}
        roleOptions={roleOptions}
      />
    </>
  )
}
