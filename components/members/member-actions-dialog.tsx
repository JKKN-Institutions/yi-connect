/**
 * Member Actions Dialog Components
 *
 * Confirmation dialogs for deactivating and deleting members.
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
  deactivateMemberFromTable,
  reactivateMemberFromTable,
  deleteMemberPermanently,
  bulkDeleteMembers,
  bulkDeactivateMembers
} from '@/app/actions/members';
import toast from 'react-hot-toast';

interface MemberActionDialogProps {
  memberId: string;
  memberName: string;
  trigger?: 'button' | 'dropdown';
}

/**
 * Deactivate Member Dialog
 * Soft disables the member - they can't login but data is preserved
 */
export function MemberDeactivateDialog({
  memberId,
  memberName,
  trigger = 'dropdown'
}: MemberActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDeactivate = () => {
    startTransition(async () => {
      const result = await deactivateMemberFromTable(memberId);

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        // Refresh the page to reflect changes
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
            Deactivate Member
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              Are you sure you want to deactivate <strong>{memberName}</strong>?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Prevent them from logging into the system</li>
                <li>Mark their membership status as inactive</li>
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
                Deactivate Member
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Reactivate Member Dialog
 * Re-enables a previously deactivated member
 */
export function MemberReactivateDialog({
  memberId,
  memberName,
  trigger = 'dropdown'
}: MemberActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleReactivate = () => {
    startTransition(async () => {
      const result = await reactivateMemberFromTable(memberId);

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        // Refresh the page to reflect changes
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
            Reactivate Member
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              Are you sure you want to reactivate <strong>{memberName}</strong>?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Allow them to log into the system again</li>
                <li>Mark their membership status as active</li>
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
                Reactivate Member
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Delete Member Dialog
 * Permanently removes the member from the system
 */
export function MemberDeleteDialog({
  memberId,
  memberName,
  trigger = 'dropdown'
}: MemberActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteMemberPermanently(memberId);

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        // Refresh the page to reflect changes
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
            Permanently Delete Member
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              <span className="text-destructive font-semibold">Warning: This action cannot be undone!</span>
              <br />
              <br />
              Are you sure you want to permanently delete <strong>{memberName}</strong>?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove their member profile completely</li>
                <li>Delete their user account</li>
                <li>Remove all associated data (skills, certifications, etc.)</li>
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

// ============================================================================
// Bulk Action Dialogs
// ============================================================================

interface BulkActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberIds: string[];
  onSuccess?: () => void;
}

/**
 * Bulk Deactivate Members Dialog
 * Soft disables multiple members at once
 */
export function BulkMemberDeactivateDialog({
  open,
  onOpenChange,
  memberIds,
  onSuccess
}: BulkActionDialogProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleBulkDeactivate = () => {
    startTransition(async () => {
      const result = await bulkDeactivateMembers(memberIds);

      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-yellow-600" />
            Deactivate {memberIds.length} Member{memberIds.length > 1 ? 's' : ''}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              Are you sure you want to deactivate <strong>{memberIds.length}</strong> member{memberIds.length > 1 ? 's' : ''}?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Prevent them from logging into the system</li>
                <li>Mark their membership status as inactive</li>
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
              handleBulkDeactivate();
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
                Deactivate {memberIds.length} Member{memberIds.length > 1 ? 's' : ''}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Bulk Delete Members Dialog
 * Permanently removes multiple members from the system
 */
export function BulkMemberDeleteDialog({
  open,
  onOpenChange,
  memberIds,
  onSuccess
}: BulkActionDialogProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleBulkDelete = () => {
    startTransition(async () => {
      const result = await bulkDeleteMembers(memberIds);

      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        onSuccess?.();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Permanently Delete {memberIds.length} Member{memberIds.length > 1 ? 's' : ''}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              <span className="text-destructive font-semibold">Warning: This action cannot be undone!</span>
              <br />
              <br />
              Are you sure you want to permanently delete <strong>{memberIds.length}</strong> member{memberIds.length > 1 ? 's' : ''}?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove all member profiles completely</li>
                <li>Delete all user accounts</li>
                <li>Remove all associated data (skills, certifications, etc.)</li>
                <li>Remove approved emails from the whitelist</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleBulkDelete();
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
                Delete {memberIds.length} Member{memberIds.length > 1 ? 's' : ''}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
