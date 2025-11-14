/**
 * Invite User Form Component
 *
 * Form for inviting new users by adding them to approved emails
 */

'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { inviteUser } from '@/app/actions/users'
import type { Role } from '@/types/user'

interface InviteUserFormProps {
  roles: Role[]
  chapters: Array<{ id: string; name: string; location: string }>
}

export function InviteUserForm({ roles, chapters }: InviteUserFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(inviteUser, {
    message: ''
  })

  // Show toast on success/error
  useEffect(() => {
    if (state.success) {
      toast.success(state.message)
      router.push('/admin/users')
    } else if (state.message && !state.success) {
      toast.error(state.message)
    }
  }, [state, router])

  return (
    <form action={formAction} className='space-y-6'>
      {/* Email */}
      <div className='space-y-2'>
        <Label htmlFor='email'>
          Email Address <span className='text-destructive'>*</span>
        </Label>
        <Input
          id='email'
          name='email'
          type='email'
          placeholder='user@example.com'
          required
          disabled={isPending}
        />
        {state.errors?.email && (
          <p className='text-sm text-destructive'>{state.errors.email[0]}</p>
        )}
      </div>

      {/* Full Name */}
      <div className='space-y-2'>
        <Label htmlFor='full_name'>Full Name</Label>
        <Input
          id='full_name'
          name='full_name'
          placeholder='John Doe'
          disabled={isPending}
        />
        {state.errors?.full_name && (
          <p className='text-sm text-destructive'>{state.errors.full_name[0]}</p>
        )}
        <p className='text-xs text-muted-foreground'>
          Optional: Pre-fill the user&apos;s name in their profile
        </p>
      </div>

      {/* Chapter */}
      <div className='space-y-2'>
        <Label htmlFor='chapter_id'>Chapter</Label>
        <Select name='chapter_id' disabled={isPending}>
          <SelectTrigger id='chapter_id'>
            <SelectValue placeholder='No chapter (optional)' />
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
          <p className='text-sm text-destructive'>{state.errors.chapter_id[0]}</p>
        )}
        <p className='text-xs text-muted-foreground'>
          Leave empty if user has no chapter assignment
        </p>
      </div>

      {/* Roles */}
      <div className='space-y-2'>
        <Label>Initial Roles (Optional)</Label>
        <div className='space-y-2 rounded-md border p-4'>
          {roles.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No roles available</p>
          ) : (
            roles.map((role) => (
              <div key={role.id} className='flex items-center space-x-2'>
                <Checkbox
                  id={`role-${role.id}`}
                  name='role_ids'
                  value={role.id}
                  disabled={isPending}
                />
                <Label
                  htmlFor={`role-${role.id}`}
                  className='font-normal cursor-pointer'
                >
                  {role.name} (Level {role.hierarchy_level})
                </Label>
              </div>
            ))
          )}
        </div>
        {state.errors?.role_ids && (
          <p className='text-sm text-destructive'>{state.errors.role_ids[0]}</p>
        )}
        <p className='text-xs text-muted-foreground'>
          Roles will be assigned after the user signs up
        </p>
      </div>

      {/* Notes */}
      <div className='space-y-2'>
        <Label htmlFor='notes'>Notes</Label>
        <Textarea
          id='notes'
          name='notes'
          placeholder='Add any notes about this invitation...'
          rows={3}
          disabled={isPending}
        />
        {state.errors?.notes && (
          <p className='text-sm text-destructive'>{state.errors.notes[0]}</p>
        )}
      </div>

      {/* Send Email Checkbox */}
      <div className='flex items-center space-x-2'>
        <Checkbox id='send_email' name='send_email' defaultChecked disabled />
        <Label htmlFor='send_email' className='font-normal cursor-pointer'>
          Send invitation email (Coming soon)
        </Label>
      </div>

      {/* Form Actions */}
      <div className='flex items-center gap-4'>
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Inviting...' : 'Send Invitation'}
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
  )
}
