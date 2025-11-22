'use client'

/**
 * PWA Update Prompt Component
 *
 * Displays a prompt when a new version of the app is available
 * and handles the update process.
 */

import { useState, useEffect } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

export function UpdatePrompt() {
  const [showReload, setShowReload] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Get the current registration
      navigator.serviceWorker.ready.then((registration) => {
        // Check for updates periodically
        const checkForUpdates = () => {
          registration.update().catch(console.error)
        }

        // Check every 5 minutes
        const intervalId = setInterval(checkForUpdates, 5 * 60 * 1000)

        // Listen for new service worker installation
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New content is available
                setWaitingWorker(newWorker)
                setShowReload(true)
              }
            })
          }
        })

        return () => clearInterval(intervalId)
      })

      // Handle controller change (when new SW activates)
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          window.location.reload()
        }
      })
    }
  }, [])

  const handleUpdate = () => {
    if (waitingWorker) {
      setIsUpdating(true)
      // Tell the waiting service worker to skip waiting
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    }
  }

  const handleDismiss = () => {
    setShowReload(false)
  }

  if (!showReload) {
    return null
  }

  return (
    <div className='fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96'>
      <Card className='border-blue-500/20 bg-background/95 backdrop-blur-sm shadow-lg'>
        <CardHeader className='pb-2'>
          <div className='flex items-start justify-between'>
            <div className='flex items-center gap-2'>
              <div className='h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center'>
                <RefreshCw className='h-5 w-5 text-blue-500' />
              </div>
              <div>
                <CardTitle className='text-base'>Update Available</CardTitle>
                <CardDescription className='text-xs'>
                  A new version of Yi Connect is ready
                </CardDescription>
              </div>
            </div>
            <Button
              variant='ghost'
              size='icon'
              className='h-8 w-8 -mr-2 -mt-2'
              onClick={handleDismiss}
              disabled={isUpdating}
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              className='flex-1'
              onClick={handleDismiss}
              disabled={isUpdating}
            >
              Later
            </Button>
            <Button
              className='flex-1'
              onClick={handleUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw className='mr-2 h-4 w-4' />
                  Update Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
