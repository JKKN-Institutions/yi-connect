/**
 * User Actions Dialog Components
 *
 * Confirmation dialogs for deactivating, reactivating, and deleting users.
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Trash, Loader2, UserX, UserCheck, AlertTriangle } from 'lucide-react';
import {
  deactivateUserFromTable,
  reactivateUserFromTable,
  deleteUserPermanently
} from '@/app/actions/users';
import toast from 'react-hot-toast';

interface UserActionDialogProps {
  userId: string;
  userName: string;
  trigger?: 'button' | 'dropdown';
}

/**
 * Deactivate User Dialog
 * Soft disables the user - they can't login but data is preserved
 */
export function UserDeactivateDialog({
  userId,
  userName,
  trigger = 'dropdown'
}: UserActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDeactivate = () => {
    startTransition(async () => {
      const result = await deactivateUserFromTable(userId);

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger === 'dropdown' ? (
          <DropdownMenuItem
            className="text-yellow-600 focus:text-yellow-600"
            onSelect={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
          >
            <UserX className="mr-2 h-4 w-4" />
            Deactivate
          </DropdownMenuItem>
        ) : (
          <Button variant="outline" size="sm" className="text-yellow-600">
            <UserX className="mr-2 h-4 w-4" />
            Deactivate
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-yellow-600" />
            Deactivate User
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              Are you sure you want to deactivate <strong>{userName}</strong>?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Prevent them from logging into the system</li>
                <li>Mark their account as inactive</li>
                <li>Preserve all their data for records</li>
              </ul>
              <p className="mt-3">You can reactivate them later if needed.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDeactivate();
            }}
            disabled={isPending}
            className="bg-yellow-600 text-white hover:bg-yellow-700"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deactivating...
              </>
            ) : (
              <>
                <UserX className="mr-2 h-4 w-4" />
                Deactivate User
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Reactivate User Dialog
 * Re-enables a previously deactivated user
 */
export function UserReactivateDialog({
  userId,
  userName,
  trigger = 'dropdown'
}: UserActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleReactivate = () => {
    startTransition(async () => {
      const result = await reactivateUserFromTable(userId);

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger === 'dropdown' ? (
          <DropdownMenuItem
            className="text-green-600 focus:text-green-600"
            onSelect={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Reactivate
          </DropdownMenuItem>
        ) : (
          <Button variant="outline" size="sm" className="text-green-600">
            <UserCheck className="mr-2 h-4 w-4" />
            Reactivate
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-600" />
            Reactivate User
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              Are you sure you want to reactivate <strong>{userName}</strong>?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Allow them to log into the system again</li>
                <li>Mark their account as active</li>
                <li>Restore their access to all features</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleReactivate();
            }}
            disabled={isPending}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reactivating...
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                Reactivate User
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Delete User Dialog
 * Permanently removes the user from the system
 */
export function UserDeleteDialog({
  userId,
  userName,
  trigger = 'dropdown'
}: UserActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteUserPermanently(userId);

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger === 'dropdown' ? (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete Permanently
          </DropdownMenuItem>
        ) : (
          <Button variant="destructive" size="sm">
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Permanently Delete User
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              <span className="text-destructive font-semibold">Warning: This action cannot be undone!</span>
              <br />
              <br />
              Are you sure you want to permanently delete <strong>{userName}</strong>?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove their user profile completely</li>
                <li>Delete their authentication account</li>
                <li>Remove all associated member data</li>
                <li>Remove their approved email from the whitelist</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash className="mr-2 h-4 w-4" />
                Delete Permanently
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
