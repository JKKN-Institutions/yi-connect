/**
 * Bulk Actions Bar Component
 *
 * Floating action bar for bulk operations on selected users
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Shield, Building2, UserX } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  bulkAssignRole,
  bulkRemoveRole,
  bulkAssignChapter
} from '@/app/actions/users';
import type { UserListItem } from '@/types/user';
import type { Role } from '@/types/user';

interface BulkActionsBarProps {
  selectedUsers: UserListItem[];
  roles: Role[];
  chapters: Array<{ id: string; name: string; location: string }>;
  onClearSelection: () => void;
  onSuccess: () => void;
}

export function BulkActionsBar({
  selectedUsers,
  roles,
  chapters,
  onClearSelection,
  onSuccess
}: BulkActionsBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [removeRoleOpen, setRemoveRoleOpen] = useState(false);
  const [assignChapterOpen, setAssignChapterOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  // Form states
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const selectedUserIds = selectedUsers.map((u) => u.id);
  const selectedCount = selectedUsers.length;

  // Handle bulk assign role
  const handleAssignRole = async () => {
    if (!selectedRoleId) {
      toast.error('Please select a role');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('user_ids', JSON.stringify(selectedUserIds));
      formData.append('role_id', selectedRoleId);
      if (notes) formData.append('notes', notes);

      const result = await bulkAssignRole({ message: '' }, formData);

      if (result.success) {
        toast.success(result.message);
        setAssignRoleOpen(false);
        setSelectedRoleId('');
        setNotes('');
        onSuccess();
      } else {
        toast.error(result.message);
      }
    });
  };

  // Handle bulk remove role
  const handleRemoveRole = async () => {
    if (!selectedRoleId) {
      toast.error('Please select a role');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('user_ids', JSON.stringify(selectedUserIds));
      formData.append('role_id', selectedRoleId);
      if (notes) formData.append('notes', notes);

      const result = await bulkRemoveRole({ message: '' }, formData);

      if (result.success) {
        toast.success(result.message);
        setRemoveRoleOpen(false);
        setSelectedRoleId('');
        setNotes('');
        onSuccess();
      } else {
        toast.error(result.message);
      }
    });
  };

  // Handle bulk assign chapter
  const handleAssignChapter = async () => {
    if (!selectedChapterId) {
      toast.error('Please select a chapter');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('user_ids', JSON.stringify(selectedUserIds));
      formData.append('chapter_id', selectedChapterId);
      if (notes) formData.append('notes', notes);

      const result = await bulkAssignChapter({ message: '' }, formData);

      if (result.success) {
        toast.success(result.message);
        setAssignChapterOpen(false);
        setSelectedChapterId('');
        setNotes('');
        onSuccess();
      } else {
        toast.error(result.message);
      }
    });
  };

  // Handle bulk deactivate
  const handleDeactivate = async () => {
    // For now, we'll implement this as a simple confirmation
    // In the future, this could call a bulkChangeUserStatus action
    toast.info('Bulk deactivation feature coming soon');
    setDeactivateOpen(false);
  };

  return (
    <>
      {/* Floating Action Bar */}
      <div className='fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-background p-4 shadow-lg'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-medium'>
            {selectedCount} user{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className='h-6 w-px bg-border' />

        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setAssignRoleOpen(true)}
            disabled={isPending}
          >
            <Shield className='mr-2 h-4 w-4' />
            Assign Role
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={() => setRemoveRoleOpen(true)}
            disabled={isPending}
          >
            <Shield className='mr-2 h-4 w-4' />
            Remove Role
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={() => setAssignChapterOpen(true)}
            disabled={isPending}
          >
            <Building2 className='mr-2 h-4 w-4' />
            Assign Chapter
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={() => setDeactivateOpen(true)}
            disabled={isPending}
          >
            <UserX className='mr-2 h-4 w-4' />
            Deactivate
          </Button>
        </div>

        <div className='h-6 w-px bg-border' />

        <Button
          variant='ghost'
          size='sm'
          onClick={onClearSelection}
          disabled={isPending}
        >
          <X className='mr-2 h-4 w-4' />
          Clear
        </Button>
      </div>

      {/* Assign Role Dialog */}
      <Dialog open={assignRoleOpen} onOpenChange={setAssignRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to {selectedCount} Users</DialogTitle>
            <DialogDescription>
              Select a role to assign to the selected users. Users who already
              have this role will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='assign-role'>Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger id='assign-role'>
                  <SelectValue placeholder='Select a role' />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} (Level {role.hierarchy_level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='assign-notes'>Notes (Optional)</Label>
              <Textarea
                id='assign-notes'
                placeholder='Add notes about this role assignment...'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setAssignRoleOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignRole}
              disabled={isPending || !selectedRoleId}
            >
              {isPending ? 'Assigning...' : 'Assign Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Role Dialog */}
      <Dialog open={removeRoleOpen} onOpenChange={setRemoveRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Role from {selectedCount} Users</DialogTitle>
            <DialogDescription>
              Select a role to remove from the selected users. Users who
              don&apos;t have this role will be skipped.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='remove-role'>Role</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger id='remove-role'>
                  <SelectValue placeholder='Select a role' />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} (Level {role.hierarchy_level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='remove-notes'>Notes (Optional)</Label>
              <Textarea
                id='remove-notes'
                placeholder='Add notes about this role removal...'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setRemoveRoleOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleRemoveRole}
              disabled={isPending || !selectedRoleId}
            >
              {isPending ? 'Removing...' : 'Remove Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Chapter Dialog */}
      <Dialog open={assignChapterOpen} onOpenChange={setAssignChapterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Chapter to {selectedCount} Users</DialogTitle>
            <DialogDescription>
              Select a chapter to assign to the selected users.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='assign-chapter'>Chapter</Label>
              <Select
                value={selectedChapterId}
                onValueChange={setSelectedChapterId}
              >
                <SelectTrigger id='assign-chapter'>
                  <SelectValue placeholder='Select a chapter' />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.name} - {chapter.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='chapter-notes'>Notes (Optional)</Label>
              <Textarea
                id='chapter-notes'
                placeholder='Add notes about this chapter assignment...'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setAssignChapterOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignChapter}
              disabled={isPending || !selectedChapterId}
            >
              {isPending ? 'Assigning...' : 'Assign Chapter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {selectedCount} Users</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate these users? They will no
              longer be able to access the system.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDeactivateOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleDeactivate}
              disabled={isPending}
            >
              {isPending ? 'Deactivating...' : 'Deactivate Users'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
