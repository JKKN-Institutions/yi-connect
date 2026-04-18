'use client'

/**
 * SessionInterestButton
 *
 * Lightweight "I'm interested" toggle for a session. Does not affect
 * event RSVP status — it's a signal for the organizer to size the room.
 */

import { useState, useTransition } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { toggleSessionInterest } from '@/app/actions/events'
import { cn } from '@/lib/utils'

interface SessionInterestButtonProps {
  sessionId: string
  initialInterested: boolean
  initialCount: number
  disabled?: boolean
  size?: 'sm' | 'default'
  className?: string
}

export function SessionInterestButton({
  sessionId,
  initialInterested,
  initialCount,
  disabled,
  size = 'sm',
  className,
}: SessionInterestButtonProps) {
  const [isInterested, setIsInterested] = useState(initialInterested)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    // Optimistic update
    const prevInterested = isInterested
    const prevCount = count
    setIsInterested(!prevInterested)
    setCount(prevInterested ? prevCount - 1 : prevCount + 1)

    startTransition(async () => {
      const result = await toggleSessionInterest({ session_id: sessionId })
      if (!result.success) {
        // revert
        setIsInterested(prevInterested)
        setCount(prevCount)
        toast.error(result.error || 'Failed to update interest')
      } else if (result.data) {
        setIsInterested(result.data.is_interested)
      }
    })
  }

  return (
    <Button
      type='button'
      variant={isInterested ? 'default' : 'outline'}
      size={size}
      disabled={disabled || isPending}
      onClick={handleClick}
      className={cn('gap-2', className)}
    >
      {isPending ? (
        <Loader2 className='h-3.5 w-3.5 animate-spin' />
      ) : (
        <Heart
          className={cn(
            'h-3.5 w-3.5',
            isInterested ? 'fill-current' : ''
          )}
        />
      )}
      <span>{isInterested ? 'Interested' : "I'm interested"}</span>
      <span className='text-xs opacity-80'>({count})</span>
    </Button>
  )
}
