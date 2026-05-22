'use client'

import { useState } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { redirectToYiCreative } from '@/app/actions/yi-creative'
import { toast } from 'sonner'

interface CreatePosterButtonProps {
  eventId: string
  eventName?: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

/**
 * Button that opens Yi Creative Studio to create a poster for an event.
 *
 * Uses SSO authentication to seamlessly authenticate the user in Yi Creative.
 * Falls back to direct URL if NEXT_PUBLIC_YI_STUDIO_URL is configured but SSO is not.
 */
export function CreatePosterButton({
  eventId,
  eventName,
  variant = 'outline',
  size = 'default',
  className,
}: CreatePosterButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  // Fallback URL for direct access (if SSO is not configured)
  const yiStudioUrl = process.env.NEXT_PUBLIC_YI_STUDIO_URL

  const handleClick = async () => {
    setIsLoading(true)

    try {
      // Try SSO authentication first
      const result = await redirectToYiCreative(eventId, `/dashboard/create?eventId=${eventId}`)

      if (result.success && result.redirect_url) {
        // Redirect to Yi Creative with SSO token
        window.location.href = result.redirect_url
      } else if (yiStudioUrl) {
        // Fallback to direct URL if SSO failed but Yi Studio URL is configured
        console.warn('[Create Poster] SSO failed, using direct URL:', result.error)
        toast.info('Opening Yi Creative Studio', {
          description: 'You may need to sign in separately.',
        })
        const fallbackUrl = `${yiStudioUrl}/dashboard/create?eventId=${encodeURIComponent(eventId)}&source=yi-connect`
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
        setIsLoading(false)
      } else {
        // Provide actionable error message based on the error type
        const isNotConfigured = result.error?.includes('not configured')

        if (isNotConfigured) {
          toast.error('Yi Creative Studio not connected', {
            description: 'Ask your Chapter Chair to connect Yi Creative in Settings > Integrations.',
            duration: 6000,
          })
        } else {
          toast.error('Unable to open Yi Creative', {
            description: result.error || 'Please try again or contact support.',
          })
        }
        setIsLoading(false)
      }
    } catch (error) {
      console.error('[Create Poster] Error:', error)
      toast.error('Connection error', {
        description: 'Please check your internet connection and try again.',
      })
      setIsLoading(false)
    }
  }

  // Don't render if neither SSO nor direct URL is configured
  // We always render now since SSO should be available
  // The button will show an error if clicked when not configured

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isLoading}
      title={eventName ? `Create poster for ${eventName}` : 'Create poster'}
      aria-label={
        isLoading
          ? 'Opening Yi Creative Studio...'
          : eventName
            ? `Create poster for ${eventName}`
            : 'Create event poster'
      }
      aria-busy={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Opening...</span>
        </>
      ) : (
        <>
          <ImageIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          <span>Create Poster</span>
        </>
      )}
    </Button>
  )
}
