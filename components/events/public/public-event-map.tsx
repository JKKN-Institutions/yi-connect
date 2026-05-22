/**
 * PublicEventMap
 *
 * Embeds a Google Maps iframe (no API key required) centred on the
 * event's `venue_address`. Renders nothing for virtual events or
 * events without an address.
 */

import { MapPin, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PublicEventMapProps {
  isVirtual: boolean;
  venueAddress: string | null;
}

export function PublicEventMap({ isVirtual, venueAddress }: PublicEventMapProps) {
  if (isVirtual || !venueAddress) return null;

  const encoded = encodeURIComponent(venueAddress);
  const embedUrl = `https://www.google.com/maps?q=${encoded}&output=embed`;
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  return (
    <Card className='overflow-hidden border-0 shadow-sm'>
      <CardContent className='p-0'>
        <div className='flex items-center justify-between p-4 sm:p-5'>
          <div className='flex items-center gap-2'>
            <MapPin className='h-4 w-4 text-orange-500' />
            <h3 className='text-sm font-semibold text-foreground sm:text-base'>
              Getting there
            </h3>
          </div>
          <a
            href={openUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'
          >
            Open in Maps
            <ExternalLink className='h-3 w-3' />
          </a>
        </div>

        <div className='px-4 pb-2 sm:px-5'>
          <p className='text-sm text-muted-foreground'>{venueAddress}</p>
        </div>

        <div className='relative aspect-[16/9] w-full bg-muted'>
          <iframe
            title='Event venue map'
            src={embedUrl}
            loading='lazy'
            referrerPolicy='no-referrer-when-downgrade'
            className='absolute inset-0 h-full w-full border-0'
            allowFullScreen
          />
        </div>
      </CardContent>
    </Card>
  );
}
