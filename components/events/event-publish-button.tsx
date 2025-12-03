/**
 * Event Publish Button Component
 *
 * Client component for publishing draft events.
 * Shows publish button for draft events and view button for published events.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { publishEvent } from '@/app/actions/events';
import { toast } from 'react-hot-toast';
import type { EventStatus } from '@/types/event';

interface EventPublishButtonProps {
  eventId: string;
  eventTitle: string;
  status: EventStatus;
  canPublish?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showIcon?: boolean;
  className?: string;
}

export function EventPublishButton({
  eventId,
  eventTitle,
  status,
  canPublish = true,
  variant = 'default',
  size = 'default',
  showIcon = true,
  className
}: EventPublishButtonProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [open, setOpen] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const result = await publishEvent({ id: eventId });

      if (result.success) {
        toast.success('Event published successfully!');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to publish event');
      }
    } catch (error) {
      toast.error('An error occurred while publishing');
    } finally {
      setIsPublishing(false);
    }
  };

  // If event is already published or beyond, show View button
  if (status !== 'draft') {
    return (
      <Button variant="outline" size={size} className={className} asChild>
        <a href={`/events/${eventId}`}>
          {showIcon && <Eye className="mr-2 h-4 w-4" />}
          View Event
        </a>
      </Button>
    );
  }

  // If user can't publish, don't show anything for draft
  if (!canPublish) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {showIcon && <Send className="mr-2 h-4 w-4" />}
          Publish
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish Event</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              <p>Are you sure you want to publish &quot;{eventTitle}&quot;?</p>
              <p className="mt-3 font-medium">Once published:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Members will be able to view and RSVP to the event</li>
                <li>The event will appear in the public event listings</li>
                <li>Notifications may be sent to relevant members</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPublishing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handlePublish();
            }}
            disabled={isPublishing}
            className="bg-primary"
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Publish Event
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Compact publish button for use in cards/lists
 */
export function EventPublishButtonCompact({
  eventId,
  eventTitle,
  status,
  canPublish = true
}: Omit<EventPublishButtonProps, 'variant' | 'size' | 'showIcon' | 'className'>) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsPublishing(true);
    try {
      const result = await publishEvent({ id: eventId });

      if (result.success) {
        toast.success('Event published!');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to publish');
      }
    } catch (error) {
      toast.error('Failed to publish event');
    } finally {
      setIsPublishing(false);
    }
  };

  if (status !== 'draft' || !canPublish) {
    return null;
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handlePublish}
      disabled={isPublishing}
    >
      {isPublishing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Send className="mr-1 h-3 w-3" />
          Publish
        </>
      )}
    </Button>
  );
}
