'use client'

import { useState } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { redirectToYiCreative } from '@/app/actions/yi-creative'
import { toast } from 'react-hot-toast'

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
        const fallbackUrl = `${yiStudioUrl}/dashboard/create?eventId=${encodeURIComponent(eventId)}&source=yi-connect`
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
        setIsLoading(false)
      } else {
        // No fallback available
        toast.error(result.error || 'Failed to connect to Yi Creative')
        setIsLoading(false)
      }
    } catch (error) {
      console.error('[Create Poster] Error:', error)
      toast.error('Failed to open Yi Creative')
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
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Opening...
        </>
      ) : (
        <>
          <ImageIcon className="mr-2 h-4 w-4" />
          Create Poster
        </>
      )}
    </Button>
  )
}
