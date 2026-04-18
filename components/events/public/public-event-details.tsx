/**
 * PublicEventDetails
 *
 * About / description section of the public landing page. Also surfaces
 * free-form tags (if any) and the hosting chapter.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';
import type { PublicEventBySlug } from '@/lib/data/public-events';

interface PublicEventDetailsProps {
  event: PublicEventBySlug;
}

export function PublicEventDetails({ event }: PublicEventDetailsProps) {
  const hasDescription = !!event.description && event.description.trim().length > 0;
  const hasTags = !!event.tags && event.tags.length > 0;

  if (!hasDescription && !hasTags && !event.chapter?.name) {
    return null;
  }

  return (
    <Card className='overflow-hidden border-0 shadow-sm'>
      <CardContent className='p-5 sm:p-6 space-y-5'>
        <h2 className='text-lg font-semibold text-foreground'>About this event</h2>

        {hasDescription && (
          <div className='prose prose-sm dark:prose-invert max-w-none'>
            <p className='whitespace-pre-wrap leading-relaxed text-muted-foreground'>
              {event.description}
            </p>
          </div>
        )}

        {hasTags && (
          <div className='flex flex-wrap gap-2'>
            {event.tags!.map((tag) => (
              <Badge key={tag} variant='outline' className='text-xs'>
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {event.chapter?.name && (
          <div className='flex items-center gap-2 pt-2 text-sm text-muted-foreground'>
            <Building2 className='h-4 w-4 text-orange-500' />
            <span>
              Organized by{' '}
              <span className='font-medium text-foreground'>
                {event.chapter.name}
              </span>
              {event.chapter.location ? (
                <span> · {event.chapter.location}</span>
              ) : null}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
