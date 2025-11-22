'use client'

/**
 * PWA Install Prompt Component
 *
 * Displays an install prompt for users to add Yi Connect to their home screen.
 * Handles both Android (beforeinstallprompt) and iOS (manual instructions).
 */

import { useState, useEffect, useCallback } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    // Check if already dismissed in this session
    const dismissed = sessionStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      setIsDismissed(true)
    }

    // Check if app is already installed (standalone mode)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    setIsStandalone(isStandaloneMode)

    // Detect iOS
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream

    setIsIOS(isIOSDevice)

    // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    }

    // Clear the deferred prompt
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
    sessionStorage.setItem('pwa-install-dismissed', 'true')
  }, [])

  // Don't show if already installed, in standalone mode, or dismissed
  if (isStandalone || isInstalled || isDismissed) {
    return null
  }

  // Show iOS-specific instructions
  if (isIOS) {
    return (
      <>
        {/* iOS Install Banner */}
        <div className='fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96'>
          <Card className='border-primary/20 bg-background/95 backdrop-blur-sm shadow-lg'>
            <CardHeader className='pb-2'>
              <div className='flex items-start justify-between'>
                <div className='flex items-center gap-2'>
                  <div className='h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center'>
                    <span className='text-lg font-bold text-primary'>Yi</span>
                  </div>
                  <div>
                    <CardTitle className='text-base'>Install Yi Connect</CardTitle>
                    <CardDescription className='text-xs'>
                      Add to your home screen
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 -mr-2 -mt-2'
                  onClick={handleDismiss}
                >
                  <X className='h-4 w-4' />
                </Button>
              </div>
            </CardHeader>
            <CardContent className='pt-0'>
              <Button
                className='w-full'
                onClick={() => setShowIOSInstructions(true)}
              >
                <Share className='mr-2 h-4 w-4' />
                How to Install
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* iOS Instructions Modal */}
        {showIOSInstructions && (
          <div className='fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm'>
            <div className='w-full max-w-lg rounded-t-2xl bg-background p-6 animate-in slide-in-from-bottom'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-lg font-semibold'>Install Yi Connect</h3>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => setShowIOSInstructions(false)}
                >
                  <X className='h-4 w-4' />
                </Button>
              </div>

              <div className='space-y-4'>
                <div className='flex items-start gap-4'>
                  <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium'>
                    1
                  </div>
                  <div>
                    <p className='font-medium'>Tap the Share button</p>
                    <p className='text-sm text-muted-foreground'>
                      Find the{' '}
                      <Share className='inline h-4 w-4 mx-1' />
                      share icon at the bottom of Safari
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-4'>
                  <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium'>
                    2
                  </div>
                  <div>
                    <p className='font-medium'>Scroll and tap &quot;Add to Home Screen&quot;</p>
                    <p className='text-sm text-muted-foreground'>
                      Look for the{' '}
                      <Plus className='inline h-4 w-4 mx-1' />
                      icon in the menu
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-4'>
                  <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium'>
                    3
                  </div>
                  <div>
                    <p className='font-medium'>Tap &quot;Add&quot;</p>
                    <p className='text-sm text-muted-foreground'>
                      Yi Connect will be added to your home screen
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className='w-full mt-6'
                onClick={() => setShowIOSInstructions(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        )}
      </>
    )
  }

  // Show install prompt for Android/Desktop
  if (deferredPrompt) {
    return (
      <div className='fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96'>
        <Card className='border-primary/20 bg-background/95 backdrop-blur-sm shadow-lg'>
          <CardHeader className='pb-2'>
            <div className='flex items-start justify-between'>
              <div className='flex items-center gap-2'>
                <div className='h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center'>
                  <span className='text-lg font-bold text-primary'>Yi</span>
                </div>
                <div>
                  <CardTitle className='text-base'>Install Yi Connect</CardTitle>
                  <CardDescription className='text-xs'>
                    Quick access from your home screen
                  </CardDescription>
                </div>
              </div>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8 -mr-2 -mt-2'
                onClick={handleDismiss}
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <div className='flex gap-2'>
              <Button variant='outline' className='flex-1' onClick={handleDismiss}>
                Not now
              </Button>
              <Button className='flex-1' onClick={handleInstallClick}>
                <Download className='mr-2 h-4 w-4' />
                Install
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
