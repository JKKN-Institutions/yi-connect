'use client'

/**
 * Impersonation Banner
 *
 * Persistent banner shown at the top of the screen during impersonation.
 * Phase 2: Includes session extension and role cycling.
 */

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Clock,
  X,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  endImpersonation,
  extendImpersonationSession,
  startImpersonation,
} from '@/app/actions/impersonation'
import type {
  ActiveImpersonationSession,
  ImpersonationTimeout,
} from '@/types/impersonation'

// Extension time options
const EXTENSION_OPTIONS: { value: ImpersonationTimeout; label: string }[] = [
  { value: 15, label: '+15 min' },
  { value: 30, label: '+30 min' },
  { value: 60, label: '+1 hour' },
]

interface RoleCycleUser {
  id: string
  name: string
}

interface ImpersonationBannerProps {
  session: ActiveImpersonationSession
  /** Users with same role for role cycling */
  roleCycleUsers?: RoleCycleUser[]
  /** Current index in roleCycleUsers */
  currentIndex?: number
}

export function ImpersonationBanner({
  session,
  roleCycleUsers = [],
  currentIndex = 0,
}: ImpersonationBannerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [remainingMinutes, setRemainingMinutes] = useState(session.remaining_minutes)
  const [isEnding, setIsEnding] = useState(false)

  // Calculate if role cycling is available
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < roleCycleUsers.length - 1
  const canCycle = roleCycleUsers.length > 1

  // End impersonation handler
  const handleEndImpersonation = useCallback(async () => {
    if (isEnding) return

    setIsEnding(true)
    try {
      const result = await endImpersonation()
      if (result.success) {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to end impersonation:', error)
    } finally {
      setIsEnding(false)
    }
  }, [isEnding, router])

  // Extend session handler
  const handleExtendSession = useCallback(
    (minutes: ImpersonationTimeout) => {
      startTransition(async () => {
        const result = await extendImpersonationSession(minutes)
        if (result.success) {
          setRemainingMinutes((prev) => prev + minutes)
          router.refresh()
        } else {
          console.error('Failed to extend session:', result.message)
        }
      })
    },
    [router]
  )

  // Cycle to next/prev user handler
  const handleCycleUser = useCallback(
    (direction: 'prev' | 'next') => {
      const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
      const targetUser = roleCycleUsers[newIndex]
      if (!targetUser) return

      startTransition(async () => {
        // End current session and start new one
        await endImpersonation()
        const result = await startImpersonation(
          targetUser.id,
          'Role cycling from impersonation banner'
        )
        if (result.success) {
          router.refresh()
        }
      })
    },
    [currentIndex, roleCycleUsers, router]
  )

  // Update remaining time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMinutes((prev) => {
        const newValue = prev - 1
        if (newValue <= 0) {
          // Session expired, end impersonation
          handleEndImpersonation()
          return 0
        }
        return newValue
      })
    }, 60000) // Every minute

    return () => clearInterval(interval)
  }, [handleEndImpersonation])

  // Format remaining time
  const formatTime = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${minutes}m`
  }

  // Determine urgency color based on remaining time
  const getTimeColor = () => {
    if (remainingMinutes <= 5) return 'text-red-600 animate-pulse'
    if (remainingMinutes <= 15) return 'text-amber-600'
    return 'text-amber-700'
  }

  return (
    <TooltipProvider>
      <div className="sticky top-0 z-50 w-full bg-amber-100 border-b-2 border-amber-400 shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 max-w-screen-2xl mx-auto">
          {/* Left: Warning icon and user info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium text-sm hidden sm:inline">Viewing as:</span>
            </div>

            {/* Role Cycling Navigation */}
            <div className="flex items-center gap-1">
              {canCycle && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-amber-700 hover:bg-amber-200"
                      onClick={() => handleCycleUser('prev')}
                      disabled={!hasPrev || isPending}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {hasPrev
                      ? `Previous: ${roleCycleUsers[currentIndex - 1]?.name}`
                      : 'No previous user'}
                  </TooltipContent>
                </Tooltip>
              )}

              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-amber-600" />
                <span className="font-semibold text-amber-900">
                  {session.target_user_name}
                </span>
                <Badge
                  variant="outline"
                  className="bg-amber-200/50 border-amber-400 text-amber-800 text-xs"
                >
                  {session.target_user_role}
                </Badge>
                {canCycle && (
                  <span className="text-xs text-amber-600">
                    ({currentIndex + 1}/{roleCycleUsers.length})
                  </span>
                )}
              </div>

              {canCycle && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-amber-700 hover:bg-amber-200"
                      onClick={() => handleCycleUser('next')}
                      disabled={!hasNext || isPending}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {hasNext
                      ? `Next: ${roleCycleUsers[currentIndex + 1]?.name}`
                      : 'No next user'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Center: Timer with Extension */}
          <div className="flex items-center gap-2">
            <div className={cn('flex items-center gap-2', getTimeColor())}>
              <Clock className="h-4 w-4" />
              <span className="font-medium text-sm tabular-nums">
                {formatTime(remainingMinutes)}
              </span>
            </div>

            {/* Extension Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-amber-700 hover:bg-amber-200 gap-1"
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  <span className="text-xs hidden sm:inline">Extend</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {EXTENSION_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleExtendSession(option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right: End button */}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndImpersonation}
            disabled={isEnding || isPending}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isEnding ? 'Ending...' : 'End Impersonation'}
            </span>
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
