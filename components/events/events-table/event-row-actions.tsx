'use client';

/**
 * Event Row Actions Component
 *
 * Provides action buttons for event table rows with delete confirmation.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { deleteEvent } from '@/app/actions/events';
import type { EventListItem } from '@/types/event';

interface EventRowActionsProps {
  event: EventListItem;
}

export function EventRowActions({ event }: EventRowActionsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDeleting(true);

    try {
      const result = await deleteEvent(event.id);

      if (result.success) {
        toast.success('Event deleted successfully');
        setShowDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to delete event');
        setIsDeleting(false);
      }
    } catch {
      toast.error('Failed to delete event');
      setIsDeleting(false);
    }
  };

  const isDraft = event.status === 'draft';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0'>
            <span className='sr-only'>Open menu</span>
            <MoreHorizontal className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/events/${event.id}`}>
              <Eye className='mr-2 h-4 w-4' />
              View Details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/events/${event.id}/edit`}>
              <Edit className='mr-2 h-4 w-4' />
              Edit Event
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className='text-destructive focus:text-destructive'
            onClick={() => setShowDeleteDialog(true)}
            disabled={!isDraft}
          >
            <Trash2 className='mr-2 h-4 w-4' />
            {isDraft ? 'Delete' : 'Cancel Event Instead'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{event.title}&quot;?
              {isDraft
                ? ' This action cannot be undone.'
                : ' Note: Only draft events can be deleted. Published events should be cancelled instead.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || !isDraft}
              className='bg-destructive text-white hover:bg-destructive/90'
            >
              {isDeleting ? 'Deleting...' : 'Delete Event'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
