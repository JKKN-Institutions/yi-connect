'use client'

import { ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
 * The button is only rendered if NEXT_PUBLIC_YI_STUDIO_URL is configured.
 * Opens Yi Studio in a new tab with the event ID pre-selected.
 */
export function CreatePosterButton({
  eventId,
  eventName,
  variant = 'outline',
  size = 'default',
  className,
}: CreatePosterButtonProps) {
  const yiStudioUrl = process.env.NEXT_PUBLIC_YI_STUDIO_URL

  // Don't render if Yi Studio URL is not configured
  if (!yiStudioUrl) {
    return null
  }

  // Build the deep link URL
  const posterUrl = `${yiStudioUrl}/dashboard/create?eventId=${encodeURIComponent(eventId)}&source=yi-connect`

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      asChild
    >
      <a
        href={posterUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={eventName ? `Create poster for ${eventName}` : 'Create poster'}
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        Create Poster
      </a>
    </Button>
  )
}
