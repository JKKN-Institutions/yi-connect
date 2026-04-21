import Link from 'next/link'
import { Mic2, Building2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Speaker } from '@/types/stakeholder'

interface SpeakerProfileCardProps {
  speaker: Pick<
    Speaker,
    | 'id'
    | 'speaker_name'
    | 'professional_title'
    | 'expertise_areas'
    | 'availability_status'
  > & {
    photo_url?: string | null
    current_organization?: string | null
  }
  href?: string
  className?: string
  compact?: boolean
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function SpeakerProfileCard({
  speaker,
  href,
  className,
  compact = false,
}: SpeakerProfileCardProps) {
  const expertise = speaker.expertise_areas ?? []
  const visibleExpertise = compact ? expertise.slice(0, 2) : expertise.slice(0, 4)
  const hiddenCount = expertise.length - visibleExpertise.length

  const content = (
    <Card className={className}>
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start gap-3">
          <Avatar className={compact ? 'h-10 w-10' : 'h-12 w-12'}>
            {speaker.photo_url ? (
              <AvatarImage src={speaker.photo_url} alt={speaker.speaker_name} />
            ) : null}
            <AvatarFallback>
              {getInitials(speaker.speaker_name) || <Mic2 className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="truncate text-sm font-semibold">
                {speaker.speaker_name}
              </h4>
              {speaker.availability_status && (
                <Badge
                  variant={
                    speaker.availability_status === 'available'
                      ? 'default'
                      : 'secondary'
                  }
                  className="shrink-0 text-xs capitalize"
                >
                  {speaker.availability_status.replace('_', ' ')}
                </Badge>
              )}
            </div>

            {speaker.professional_title && (
              <p className="truncate text-xs text-muted-foreground">
                {speaker.professional_title}
              </p>
            )}

            {speaker.current_organization && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{speaker.current_organization}</span>
              </div>
            )}

            {expertise.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {visibleExpertise.map((area) => (
                  <Badge
                    key={area}
                    variant="outline"
                    className="text-[10px] font-normal"
                  >
                    {area}
                  </Badge>
                ))}
                {hiddenCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal text-muted-foreground"
                  >
                    +{hiddenCount} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {content}
      </Link>
    )
  }
  return content
}
