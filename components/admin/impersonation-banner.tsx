'use client'

/**
 * Impersonation Banner
 *
 * Persistent banner shown at the top of the screen during impersonation.
 * Displays impersonated user info, remaining time, and end button.
 */

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Clock, X, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { endImpersonation } from '@/app/actions/impersonation'
import { useRouter } from 'next/navigation'
import type { ActiveImpersonationSession } from '@/types/impersonation'

interface ImpersonationBannerProps {
  session: ActiveImpersonationSession
}

export function ImpersonationBanner({ session }: ImpersonationBannerProps) {
  const router = useRouter()
  const [remainingMinutes, setRemainingMinutes] = useState(session.remaining_minutes)
  const [isEnding, setIsEnding] = useState(false)

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
    <div className="sticky top-0 z-50 w-full bg-amber-100 border-b-2 border-amber-400 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 max-w-screen-2xl mx-auto">
        {/* Left: Warning icon and user info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium text-sm">Viewing as:</span>
          </div>

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
          </div>
        </div>

        {/* Center: Timer */}
        <div className={cn('flex items-center gap-2', getTimeColor())}>
          <Clock className="h-4 w-4" />
          <span className="font-medium text-sm tabular-nums">
            {formatTime(remainingMinutes)} remaining
          </span>
        </div>

        {/* Right: End button */}
        <Button
          variant="destructive"
          size="sm"
          onClick={handleEndImpersonation}
          disabled={isEnding}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          {isEnding ? 'Ending...' : 'End Impersonation'}
        </Button>
      </div>
    </div>
  )
}
