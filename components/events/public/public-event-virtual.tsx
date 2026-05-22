/**
 * PublicEventVirtual
 *
 * Virtual-event banner — shows a join link if the organiser has shared
 * one publicly. Intended to sit near the hero / registration block.
 * Renders nothing for in-person events.
 */

import { Video, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PublicEventVirtualProps {
  isVirtual: boolean;
  virtualMeetingLink: string | null;
}

export function PublicEventVirtual({
  isVirtual,
  virtualMeetingLink,
}: PublicEventVirtualProps) {
  if (!isVirtual) return null;

  return (
    <Card className='overflow-hidden border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50/60 dark:from-blue-950/30 dark:to-indigo-950/20'>
      <CardContent className='p-5 sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-start gap-3'>
            <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40'>
              <Video className='h-5 w-5 text-blue-600 dark:text-blue-300' />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <h3 className='font-semibold text-foreground'>Virtual event</h3>
                <Badge variant='outline' className='text-xs'>Online</Badge>
              </div>
              <p className='mt-0.5 text-sm text-muted-foreground'>
                {virtualMeetingLink
                  ? 'Join the livestream from anywhere.'
                  : 'The join link will be shared with registered attendees.'}
              </p>
            </div>
          </div>

          {virtualMeetingLink && (
            <Button asChild size='sm' className='shrink-0'>
              <a
                href={virtualMeetingLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1.5'
              >
                Join meeting
                <ExternalLink className='h-3.5 w-3.5' />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
