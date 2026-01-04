'use client'

/**
 * Impersonation Selector
 *
 * Dialog for selecting a user to impersonate.
 * Phase 1: Simple search-based selector
 * Phase 2: Role-based selection flow
 */

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserCog, Clock, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { startImpersonation } from '@/app/actions/impersonation'
import {
  type ImpersonatableUser,
  type ImpersonationTimeout,
  TIMEOUT_OPTIONS,
} from '@/types/impersonation'

interface ImpersonationSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: ImpersonatableUser[]
  onSearch?: (query: string) => void
  isLoading?: boolean
}

type Step = 'select-user' | 'configure'

export function ImpersonationSelector({
  open,
  onOpenChange,
  users,
  onSearch,
  isLoading = false,
}: ImpersonationSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // State
  const [step, setStep] = useState<Step>('select-user')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<ImpersonatableUser | null>(null)
  const [timeout, setTimeout] = useState<ImpersonationTimeout>(30)
  const [reason, setReason] = useState('')

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setStep('select-user')
        setSearchQuery('')
        setSelectedUser(null)
        setTimeout(30)
        setReason('')
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      onSearch?.(query)
    },
    [onSearch]
  )

  // Handle user selection
  const handleSelectUser = useCallback((user: ImpersonatableUser) => {
    setSelectedUser(user)
    setStep('configure')
  }, [])

  // Handle back
  const handleBack = useCallback(() => {
    setStep('select-user')
  }, [])

  // Handle start impersonation
  const handleStartImpersonation = useCallback(() => {
    if (!selectedUser) return

    startTransition(async () => {
      const result = await startImpersonation(
        selectedUser.id,
        reason || undefined,
        timeout
      )

      if (result.success) {
        handleOpenChange(false)
        router.refresh()
      } else {
        // Show error (could use toast here)
        console.error('Failed to start impersonation:', result.error)
      }
    })
  }, [selectedUser, reason, timeout, handleOpenChange, router])

  // Filter users by search query (client-side for immediate feedback)
  const filteredUsers = searchQuery
    ? users.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.role_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {step === 'select-user' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Impersonate User
              </DialogTitle>
              <DialogDescription>
                Select a user to view the system from their perspective. You can perform any action they could.
              </DialogDescription>
            </DialogHeader>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* User List */}
            <ScrollArea className="h-[300px] pr-4 -mr-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <UserCog className="h-8 w-8 mb-2" />
                  <p className="text-sm">No users found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                        'hover:bg-muted/50 hover:border-primary/50',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50'
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {user.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {user.role_name}
                        </Badge>
                        {user.chapter_name && (
                          <span className="text-xs text-muted-foreground">
                            {user.chapter_name}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Session Settings
              </DialogTitle>
              <DialogDescription>
                Configure the impersonation session for {selectedUser?.full_name}
              </DialogDescription>
            </DialogHeader>

            {/* Selected User Info */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedUser?.avatar_url || undefined} />
                <AvatarFallback>
                  {selectedUser?.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">{selectedUser?.full_name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedUser?.role_name}
                  {selectedUser?.chapter_name && ` • ${selectedUser.chapter_name}`}
                </div>
              </div>
            </div>

            {/* Session Duration */}
            <div className="space-y-3">
              <Label>Session Duration</Label>
              <RadioGroup
                value={timeout.toString()}
                onValueChange={(v) => setTimeout(parseInt(v) as ImpersonationTimeout)}
                className="grid grid-cols-2 gap-2"
              >
                {TIMEOUT_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center">
                    <RadioGroupItem
                      value={option.value.toString()}
                      id={`timeout-${option.value}`}
                      className="sr-only"
                    />
                    <Label
                      htmlFor={`timeout-${option.value}`}
                      className={cn(
                        'flex-1 cursor-pointer rounded-lg border-2 p-3 text-sm transition-colors',
                        timeout === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      )}
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Reason (optional) */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Investigating reported issue with event creation"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                This will be logged for audit purposes.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleBack} disabled={isPending}>
                Back
              </Button>
              <Button onClick={handleStartImpersonation} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  'Start Impersonation'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Button to trigger impersonation selector
 * Can be placed on user detail pages or admin toolbar
 */
interface ImpersonateButtonProps {
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

export function ImpersonateButton({
  userId,
  userName,
  userRole,
  userChapter,
  userEmail = '',
  userAvatar,
  variant = 'outline',
  size = 'sm',
  className,
}: ImpersonateButtonProps) {
  const [open, setOpen] = useState(false)

  // Create a single-user array for the selector
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
      />
    </>
  )
}
