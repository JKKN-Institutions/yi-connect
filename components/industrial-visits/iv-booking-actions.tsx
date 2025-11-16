/**
 * Industrial Visit Booking Actions
 * Dropdown menu for managing bookings (cancel, update carpool, etc.)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, X, Car, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cancelIVBooking } from '@/app/actions/industrial-visits';

interface IVBookingActionsProps {
  bookingId: string;
  eventTitle: string;
}

export function IVBookingActions({ bookingId, eventTitle }: IVBookingActionsProps) {
  const router = useRouter();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleCancelBooking() {
    try {
      setIsLoading(true);

      const result = await cancelIVBooking(bookingId, cancellationReason.trim() || undefined);

      if (result.success) {
        toast.success(result.message || 'Booking cancelled successfully');
        setShowCancelDialog(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to cancel booking');
      }
    } catch (error: any) {
      toast.error(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCancelDialog(true)}>
            <X className="mr-2 h-4 w-4" />
            Cancel Booking
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your booking for "{eventTitle}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Reason for cancellation (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Let us know why you're cancelling..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelBooking}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Cancelling...' : 'Confirm Cancellation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
