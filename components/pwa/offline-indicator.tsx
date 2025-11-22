'use client'

/**
 * Offline Indicator Component
 *
 * Displays a banner when the user is offline and shows
 * connection status changes.
 */

import { useState, useEffect } from 'react'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [showReconnected, setShowReconnected] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      if (wasOffline) {
        setShowReconnected(true)
        // Hide reconnected message after 3 seconds
        setTimeout(() => {
          setShowReconnected(false)
        }, 3000)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  // Show nothing if online and not showing reconnected message
  if (isOnline && !showReconnected) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300',
        isOnline
          ? 'bg-green-500 text-white animate-in slide-in-from-top'
          : 'bg-yellow-500 text-yellow-950'
      )}
    >
      {isOnline ? (
        <>
          <Wifi className='h-4 w-4' />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff className='h-4 w-4' />
          <span>You&apos;re offline. Some features may be limited.</span>
        </>
      )}
    </div>
  )
}

/**
 * Sync Status Indicator
 *
 * Shows when data is being synced in the background.
 */
export function SyncIndicator({
  isSyncing,
  pendingCount = 0
}: {
  isSyncing: boolean
  pendingCount?: number
}) {
  if (!isSyncing && pendingCount === 0) {
    return null
  }

  return (
    <div className='fixed bottom-20 right-4 z-50'>
      <div className='flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg'>
        <RefreshCw
          className={cn('h-4 w-4', isSyncing && 'animate-spin')}
        />
        <span>
          {isSyncing
            ? 'Syncing...'
            : `${pendingCount} pending ${pendingCount === 1 ? 'action' : 'actions'}`}
        </span>
      </div>
    </div>
  )
}
