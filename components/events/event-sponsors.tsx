// Server Component — renders a per-event sponsor section grouped by tier.
// Returns null (renders nothing) when there are no committed sponsors.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSponsorsByEvent } from '@/lib/data/finance';
import { SPONSORSHIP_TIER_LEVELS } from '@/types/finance';
import type { SponsorshipTierLevel } from '@/types/finance';

const TIER_LABELS: Record<SponsorshipTierLevel, string> = {
  platinum: 'Platinum Partners',
  gold: 'Gold Partners',
  silver: 'Silver Partners',
  bronze: 'Bronze Partners',
  supporter: 'Supporters',
};

const TIER_LOGO_SIZES: Record<SponsorshipTierLevel, string> = {
  platinum: 'h-20 md:h-24',
  gold: 'h-16 md:h-20',
  silver: 'h-12 md:h-16',
  bronze: 'h-12 md:h-14',
  supporter: 'h-10 md:h-12',
};

interface EventSponsorsProps {
  eventId: string;
}

export async function EventSponsors({ eventId }: EventSponsorsProps) {
  const groups = await getSponsorsByEvent(eventId);

  // Empty state: render nothing per spec
  if (!groups || groups.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Our Sponsors</CardTitle>
      </CardHeader>
      <CardContent className='space-y-8'>
        {groups.map((group) => {
          const badge = SPONSORSHIP_TIER_LEVELS[group.tier_level];
          const logoHeight = TIER_LOGO_SIZES[group.tier_level];
          const title = TIER_LABELS[group.tier_level];

          return (
            <section key={group.tier_level} aria-labelledby={`tier-${group.tier_level}`}>
              <div className='mb-4 flex items-center gap-2'>
                {group.tier_color ? (
                  <span
                    className='inline-block h-3 w-3 rounded-full'
                    style={{ backgroundColor: group.tier_color }}
                    aria-hidden
                  />
                ) : null}
                <h3
                  id={`tier-${group.tier_level}`}
                  className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'
                >
                  {title}
                </h3>
                {badge && (
                  <Badge variant='secondary' className='text-xs'>
                    {badge.label}
                  </Badge>
                )}
              </div>

              <div className='flex flex-wrap items-center gap-6'>
                {group.sponsors.map((sponsor) => {
                  const name = sponsor.display_name;
                  const content = sponsor.logo_url ? (
                    <div
                      className={`relative flex items-center justify-center ${logoHeight} w-auto`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sponsor.logo_url}
                        alt={name}
                        className={`max-h-full w-auto object-contain ${logoHeight}`}
                        loading='lazy'
                      />
                    </div>
                  ) : (
                    <div
                      className={`flex items-center justify-center rounded-md border bg-muted/40 px-4 ${logoHeight}`}
                    >
                      <span className='text-sm font-medium'>{name}</span>
                    </div>
                  );

                  return (
                    <div
                      key={sponsor.id}
                      className='flex flex-col items-center gap-1'
                    >
                      {sponsor.website ? (
                        <a
                          href={sponsor.website}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='transition-opacity hover:opacity-80'
                          aria-label={`${name} (opens in a new tab)`}
                        >
                          {content}
                        </a>
                      ) : (
                        content
                      )}
                      <span className='text-xs text-muted-foreground'>{name}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
