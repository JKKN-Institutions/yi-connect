/**
 * Edit User Form Component
 *
 * Form for editing user profile information using Server Actions
 */

'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { updateUserProfile } from '@/app/actions/users';
import type { UserFull } from '@/types/user';
import { useEffect } from 'react';

interface EditUserFormProps {
  user: UserFull;
  chapters: Array<{ id: string; name: string; location: string }>;
}

export function EditUserForm({ user, chapters }: EditUserFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateUserProfile, {
    message: ''
  });

  // Show toast on success/error
  useEffect(() => {
    if (state.success) {
      toast.success(state.message);
      router.push(`/admin/users/${user.id}`);
    } else if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state, router, user.id]);

  return (
    <form action={formAction} className='space-y-6'>
      {/* Hidden ID field */}
      <input type='hidden' name='id' value={user.id} />

      {/* Full Name */}
      <div className='space-y-2'>
        <Label htmlFor='full_name'>
          Full Name <span className='text-destructive'>*</span>
        </Label>
        <Input
          id='full_name'
          name='full_name'
          defaultValue={user.full_name}
          placeholder='Enter full name'
          required
          disabled={isPending}
        />
        {state.errors?.full_name && (
          <p className='text-sm text-destructive'>
            {state.errors.full_name[0]}
          </p>
        )}
      </div>

      {/* Email (Read-only) */}
      <div className='space-y-2'>
        <Label htmlFor='email'>Email</Label>
        <Input id='email' value={user.email} disabled className='bg-muted' />
        <p className='text-xs text-muted-foreground'>Email cannot be changed</p>
      </div>

      {/* Phone */}
      <div className='space-y-2'>
        <Label htmlFor='phone'>Phone</Label>
        <Input
          id='phone'
          name='phone'
          type='tel'
          defaultValue={user.phone || ''}
          placeholder='+1234567890'
          disabled={isPending}
        />
        {state.errors?.phone && (
          <p className='text-sm text-destructive'>{state.errors.phone[0]}</p>
        )}
      </div>

      {/* Chapter */}
      <div className='space-y-2'>
        <Label htmlFor='chapter_id'>Chapter</Label>
        <Select name='chapter_id' defaultValue={user.chapter_id || undefined}>
          <SelectTrigger id='chapter_id' disabled={isPending}>
            <SelectValue placeholder='No chapter assigned' />
          </SelectTrigger>
          <SelectContent>
            {chapters.map((chapter) => (
              <SelectItem key={chapter.id} value={chapter.id}>
                {chapter.name} - {chapter.location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.chapter_id && (
          <p className='text-sm text-destructive'>
            {state.errors.chapter_id[0]}
          </p>
        )}
        <p className='text-xs text-muted-foreground'>
          Leave empty to remove chapter assignment
        </p>
      </div>

      {/* Avatar URL */}
      <div className='space-y-2'>
        <Label htmlFor='avatar_url'>Avatar URL</Label>
        <Input
          id='avatar_url'
          name='avatar_url'
          type='url'
          defaultValue={user.avatar_url || ''}
          placeholder='https://example.com/avatar.jpg'
          disabled={isPending}
        />
        {state.errors?.avatar_url && (
          <p className='text-sm text-destructive'>
            {state.errors.avatar_url[0]}
          </p>
        )}
        <p className='text-xs text-muted-foreground'>
          Provide a URL to an image for the user&apos;s avatar
        </p>
      </div>

      {/* Form Actions */}
      <div className='flex items-center gap-4'>
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>

      {/* Error Message */}
      {state.message && !state.success && !state.errors && (
        <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4'>
          <p className='text-sm text-destructive'>{state.message}</p>
        </div>
      )}
    </form>
  );
}
