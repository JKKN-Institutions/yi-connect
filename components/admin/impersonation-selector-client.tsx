'use client'

/**
 * Impersonation Selector Client Component
 *
 * Client wrapper that manages dialog state and search/filter callbacks.
 * Receives server-fetched data and renders the ImpersonationSelector.
 */

import { useState, useCallback, useTransition } from 'react'
import { UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImpersonationSelector } from './impersonation-selector'
import type {
  ImpersonatableUser,
  RecentImpersonation,
  RoleOption,
} from '@/types/impersonation'

interface ImpersonationSelectorClientProps {
  /** Initial list of users available for impersonation */
  initialUsers: ImpersonatableUser[]
  /** Recent impersonation history */
  recentUsers: RecentImpersonation[]
  /** Available roles for filtering */
  roleOptions: RoleOption[]
  /** Total count of impersonatable users */
  totalUsers: number
  /** Custom trigger button (optional) */
  trigger?: React.ReactNode
  /** Variant for the default trigger button */
  variant?: 'default' | 'outline' | 'ghost'
  /** Size for the default trigger button */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Additional className for trigger button */
  className?: string
}

export function ImpersonationSelectorClient({
  initialUsers,
  recentUsers,
  roleOptions,
  totalUsers,
  trigger,
  variant = 'outline',
  size = 'default',
  className,
}: ImpersonationSelectorClientProps) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState(initialUsers)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Handle search - for now, filter client-side
  // In a future iteration, this could trigger a server action
  const handleSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setUsers(initialUsers)
        return
      }

      const lowerQuery = query.toLowerCase()
      const filtered = initialUsers.filter(
        (user) =>
          user.full_name.toLowerCase().includes(lowerQuery) ||
          user.email.toLowerCase().includes(lowerQuery) ||
          user.role_name.toLowerCase().includes(lowerQuery)
      )
      setUsers(filtered)
    },
    [initialUsers]
  )

  // Handle role filter - filter client-side
  const handleRoleFilter = useCallback(
    (roleName: string | null) => {
      if (!roleName) {
        setUsers(initialUsers)
        return
      }

      const filtered = initialUsers.filter((user) => user.role_name === roleName)
      setUsers(filtered)
    },
    [initialUsers]
  )

  // Default trigger button
  const defaultTrigger = (
    <Button
      variant={variant}
      size={size}
      onClick={() => setOpen(true)}
      className={className}
    >
      <UserCog className="mr-2 h-4 w-4" />
      Impersonate User
    </Button>
  )

  return (
    <>
      {/* Trigger button */}
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        defaultTrigger
      )}

      {/* Selector dialog */}
      <ImpersonationSelector
        open={open}
        onOpenChange={setOpen}
        users={users}
        recentUsers={recentUsers}
        roleOptions={roleOptions}
        onSearch={handleSearch}
        onRoleFilter={handleRoleFilter}
        isLoading={isLoading || isPending}
      />
    </>
  )
}
