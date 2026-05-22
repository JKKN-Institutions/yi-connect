'use client'

/**
 * Impersonation Selector
 *
 * Dialog for selecting a user to impersonate.
 * Phase 2: Role-based selection flow with recent users
 */

import { useState, useCallback, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  UserCog,
  Clock,
  Loader2,
  History,
  Users,
  Filter,
  ChevronDown,
} from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { startImpersonation } from '@/app/actions/impersonation'
import {
  type ImpersonatableUser,
  type ImpersonationTimeout,
  type RecentImpersonation,
  type RoleOption,
  TIMEOUT_OPTIONS,
} from '@/types/impersonation'

interface ImpersonationSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  users: ImpersonatableUser[]
  recentUsers?: RecentImpersonation[]
  roleOptions?: RoleOption[]
  onSearch?: (query: string) => void
  onRoleFilter?: (roleName: string | null) => void
  isLoading?: boolean
}

type Step = 'select-user' | 'configure'
type Tab = 'recent' | 'all'

export function ImpersonationSelector({
  open,
  onOpenChange,
  users,
  recentUsers = [],
  roleOptions = [],
  onSearch,
  onRoleFilter,
  isLoading = false,
}: ImpersonationSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // State
  const [step, setStep] = useState<Step>('select-user')
  const [activeTab, setActiveTab] = useState<Tab>('recent')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<ImpersonatableUser | null>(null)
  const [timeout, setTimeout] = useState<ImpersonationTimeout>(30)
  const [reason, setReason] = useState('')

  // Switch to "all" tab if no recent users
  useEffect(() => {
    if (open && recentUsers.length === 0) {
      setActiveTab('all')
    }
  }, [open, recentUsers.length])

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setStep('select-user')
        setActiveTab(recentUsers.length > 0 ? 'recent' : 'all')
        setSearchQuery('')
        setSelectedRole(null)
        setSelectedUser(null)
        setTimeout(30)
        setReason('')
      }
      onOpenChange(newOpen)
    },
    [onOpenChange, recentUsers.length]
  )

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      onSearch?.(query)
    },
    [onSearch]
  )

  // Handle role filter
  const handleRoleFilter = useCallback(
    (roleName: string | null) => {
      setSelectedRole(roleName)
      onRoleFilter?.(roleName)
    },
    [onRoleFilter]
  )

  // Handle user selection from recent list
  const handleSelectRecent = useCallback((recent: RecentImpersonation) => {
    setSelectedUser({
      id: recent.target_user_id,
      full_name: recent.target_user_name,
      email: recent.target_user_email,
      avatar_url: null,
      role_name: recent.target_user_role,
      hierarchy_level: 0,
      chapter_id: null,
      chapter_name: recent.target_chapter_name,
      last_active_at: null,
    })
    setStep('configure')
  }, [])

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

  // Filter users by search query and role (client-side for immediate feedback)
  const filteredUsers = users.filter((user) => {
    const matchesSearch = !searchQuery ||
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = !selectedRole || user.role_name === selectedRole

    return matchesSearch && matchesRole
  })

  // Filter recent users by search
  const filteredRecent = recentUsers.filter(
    (recent) =>
      !searchQuery ||
      recent.target_user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recent.target_user_email.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
                Select a user to view the system from their perspective.
              </DialogDescription>
            </DialogHeader>

            {/* Tabs for Recent / All Users */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="recent" className="gap-2">
                  <History className="h-4 w-4" />
                  Recent
                  {recentUsers.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {recentUsers.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all" className="gap-2">
                  <Users className="h-4 w-4" />
                  All Users
                </TabsTrigger>
              </TabsList>

              {/* Search & Filter Row */}
              <div className="flex gap-2 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Role Filter (only on All Users tab) */}
                {activeTab === 'all' && roleOptions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2 shrink-0">
                        <Filter className="h-4 w-4" />
                        {selectedRole || 'All Roles'}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleRoleFilter(null)}>
                        All Roles
                      </DropdownMenuItem>
                      {roleOptions.map((role) => (
                        <DropdownMenuItem
                          key={role.role_name}
                          onClick={() => handleRoleFilter(role.role_name)}
                        >
                          {role.role_name}
                          <Badge variant="secondary" className="ml-2">
                            {role.user_count}
                          </Badge>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Recent Users Tab */}
              <TabsContent value="recent" className="mt-4">
                <ScrollArea className="h-[280px] pr-4 -mr-4">
                  {filteredRecent.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <History className="h-8 w-8 mb-2" />
                      <p className="text-sm">
                        {searchQuery ? 'No matching recent users' : 'No recent impersonations'}
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setActiveTab('all')}
                        className="mt-2"
                      >
                        Browse all users
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredRecent.map((recent) => (
                        <button
                          key={recent.target_user_id}
                          onClick={() => handleSelectRecent(recent)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                            'hover:bg-muted/50 hover:border-primary/50',
                            'focus:outline-none focus:ring-2 focus:ring-primary/50'
                          )}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {recent.target_user_name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {recent.target_user_name}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {recent.target_user_email}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {recent.target_user_role}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {recent.impersonation_count}x
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* All Users Tab */}
              <TabsContent value="all" className="mt-4">
                <ScrollArea className="h-[280px] pr-4 -mr-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <UserCog className="h-8 w-8 mb-2" />
                      <p className="text-sm">No users found</p>
                      {selectedRole && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleRoleFilter(null)}
                          className="mt-2"
                        >
                          Clear role filter
                        </Button>
                      )}
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
              </TabsContent>
            </Tabs>
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
