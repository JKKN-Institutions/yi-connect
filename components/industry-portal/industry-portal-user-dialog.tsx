/**
 * Industry Portal User Dialog Component
 * Dialog for adding/editing portal users
 */

'use client';

import { useState, useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { upsertIndustryPortalUser } from '@/app/actions/industry-portal';

interface IndustryPortalUserDialogProps {
  industryId: string;
  existingUser?: {
    id: string;
    email: string;
    full_name: string | null;
    role: string | null;
    status: string;
    permissions: {
      add_slot: boolean;
      edit_slot: boolean;
      cancel_slot: boolean;
      view_bookings: boolean;
      export_attendees: boolean;
    };
  };
  trigger: React.ReactNode;
}

const PERMISSION_OPTIONS = [
  { key: 'add_slot', label: 'Create new IV slots' },
  { key: 'edit_slot', label: 'Edit existing slots' },
  { key: 'cancel_slot', label: 'Cancel slots' },
  { key: 'view_bookings', label: 'View member bookings' },
  { key: 'export_attendees', label: 'Export attendee lists' },
];

export function IndustryPortalUserDialog({
  industryId,
  existingUser,
  trigger,
}: IndustryPortalUserDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(upsertIndustryPortalUser, {
    message: '',
  });

  useEffect(() => {
    if (state.success) {
      toast.success(state.message);
      setOpen(false);
      router.refresh();
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, router]);

  const isEditing = !!existingUser;
  const defaultPermissions = existingUser?.permissions || {
    add_slot: false,
    edit_slot: false,
    cancel_slot: false,
    view_bookings: true,
    export_attendees: false,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Portal User' : 'Add Portal User'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update user information and permissions.'
              : 'Invite a new user to manage your industry portal.'}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="industry_id" value={industryId} />
          {existingUser && <input type="hidden" name="user_id" value={existingUser.id} />}

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={existingUser?.email || ''}
              placeholder="user@company.com"
              required
              disabled={isPending || isEditing}
            />
            {state.errors?.email && (
              <p className="text-sm text-destructive">{state.errors.email[0]}</p>
            )}
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={existingUser?.full_name || ''}
              placeholder="John Doe"
              disabled={isPending}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select name="role" defaultValue={existingUser?.role || 'user'}>
              <SelectTrigger id="role" disabled={isPending}>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status (only for editing) */}
          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={existingUser?.status || 'active'}>
                <SelectTrigger id="status" disabled={isPending}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Permissions */}
          <div className="space-y-3">
            <Label>Permissions</Label>
            <div className="space-y-2 rounded-md border p-4">
              {PERMISSION_OPTIONS.map((permission) => (
                <div key={permission.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={permission.key}
                    name={`permission_${permission.key}`}
                    defaultChecked={defaultPermissions[permission.key as keyof typeof defaultPermissions]}
                    disabled={isPending}
                  />
                  <Label htmlFor={permission.key} className="font-normal cursor-pointer">
                    {permission.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : isEditing ? 'Update User' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
