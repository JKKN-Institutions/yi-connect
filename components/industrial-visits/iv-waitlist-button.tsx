/**
 * Industrial Visit Waitlist Button
 * Join or leave waitlist for a full IV
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';

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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { joinWaitlist, leaveWaitlist } from '@/app/actions/industrial-visits';

interface IVWaitlistButtonProps {
  eventId: string;
  waitlistId?: string | null;
  variant?: 'default' | 'outline' | 'ghost';
}

export function IVWaitlistButton({
  eventId,
  waitlistId = null,
  variant = 'default',
}: IVWaitlistButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isOnWaitlist = !!waitlistId;

  async function handleJoinWaitlist() {
    try {
      setIsLoading(true);

      const result = await joinWaitlist(eventId);

      if (result.success) {
        toast.success(
          result.message || 'Successfully joined waitlist! We\'ll notify you if a spot opens up.'
        );
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to join waitlist');
      }
    } catch (error: any) {
      toast.error(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLeaveWaitlist() {
    if (!waitlistId) return;

    try {
      setIsLoading(true);

      const result = await leaveWaitlist(waitlistId);

      if (result.success) {
        toast.success(result.message || 'You have left the waitlist');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to leave waitlist');
      }
    } catch (error: any) {
      toast.error(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  if (isOnWaitlist) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={variant} className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <X className="mr-2 h-4 w-4" />
            )}
            Leave Waitlist
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Waitlist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave the waitlist? You will need to rejoin
              if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveWaitlist}>
              Leave Waitlist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button
      variant={variant}
      className="w-full"
      onClick={handleJoinWaitlist}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Clock className="mr-2 h-4 w-4" />
      )}
      {isLoading ? 'Joining...' : 'Join Waitlist'}
    </Button>
  );
}
