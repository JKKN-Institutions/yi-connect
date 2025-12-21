/**
 * Skill Form Components
 *
 * Forms for adding and managing member skills.
 */

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addMemberSkill, updateMemberSkill } from '@/app/actions/members';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Skill } from '@/types/member';

interface AddSkillFormProps {
  memberId: string;
  skills: Skill[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UpdateSkillFormProps {
  skillId: string;
  currentProficiency: string;
  currentExperience?: number | null;
  currentMentor: boolean;
  currentNotes?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type='submit' disabled={pending}>
      {pending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
      {label}
    </Button>
  );
}

export function AddSkillDialog({
  memberId,
  skills,
  open,
  onOpenChange
}: AddSkillFormProps) {
  const [state, formAction] = useActionState(addMemberSkill, {
    message: '',
    errors: {}
  });

  // Close dialog on success
  if (state.success && open) {
    setTimeout(() => onOpenChange(false), 1000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Skill</DialogTitle>
          <DialogDescription>
            Add a new skill to this member&apos;s profile
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className='space-y-4'>
          <input type='hidden' name='member_id' value={memberId} />

          {state.message && (
            <Alert variant={state.success ? 'default' : 'destructive'}>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className='space-y-2'>
            <Label htmlFor='skill_id'>Skill *</Label>
            <Select name='skill_id' required>
              <SelectTrigger id='skill_id' className='w-full'>
                <SelectValue placeholder='Select a skill' />
              </SelectTrigger>
              <SelectContent className='h-[300px]'>
                {skills.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.name} ({skill.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors?.skill_id && (
              <p className='text-sm text-destructive'>
                {state.errors.skill_id[0]}
              </p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='proficiency'>Proficiency Level *</Label>
            <Select name='proficiency' required defaultValue='intermediate'>
              <SelectTrigger id='proficiency' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='beginner'>Beginner</SelectItem>
                <SelectItem value='intermediate'>Intermediate</SelectItem>
                <SelectItem value='advanced'>Advanced</SelectItem>
                <SelectItem value='expert'>Expert</SelectItem>
              </SelectContent>
            </Select>
            {state.errors?.proficiency && (
              <p className='text-sm text-destructive'>
                {state.errors.proficiency[0]}
              </p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='years_of_experience'>Years of Experience</Label>
            <Input
              id='years_of_experience'
              name='years_of_experience'
              type='number'
              min='0'
              max='50'
              placeholder='0'
            />
            {state.errors?.years_of_experience && (
              <p className='text-sm text-destructive'>
                {state.errors.years_of_experience[0]}
              </p>
            )}
          </div>

          <div className='flex items-center justify-between space-x-2'>
            <Label
              htmlFor='is_willing_to_mentor'
              className='flex flex-col space-y-1'
            >
              <span>Willing to mentor others?</span>
              <span className='font-normal text-sm text-muted-foreground'>
                Help other members learn this skill
              </span>
            </Label>
            <Switch id='is_willing_to_mentor' name='is_willing_to_mentor' />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='notes'>Notes</Label>
            <Textarea
              id='notes'
              name='notes'
              placeholder='Any additional information about this skill...'
              rows={3}
            />
            {state.errors?.notes && (
              <p className='text-sm text-destructive'>
                {state.errors.notes[0]}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton label='Add Skill' />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UpdateSkillDialog({
  skillId,
  currentProficiency,
  currentExperience,
  currentMentor,
  currentNotes,
  open,
  onOpenChange
}: UpdateSkillFormProps) {
  const [state, formAction] = useActionState(updateMemberSkill, {
    message: '',
    errors: {}
  });

  // Close dialog on success
  if (state.success && open) {
    setTimeout(() => onOpenChange(false), 1000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Skill</DialogTitle>
          <DialogDescription>
            Update skill proficiency and details
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className='space-y-4'>
          <input type='hidden' name='id' value={skillId} />

          {state.message && (
            <Alert variant={state.success ? 'default' : 'destructive'}>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className='space-y-2'>
            <Label htmlFor='proficiency'>Proficiency Level</Label>
            <Select name='proficiency' defaultValue={currentProficiency}>
              <SelectTrigger id='proficiency' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='beginner'>Beginner</SelectItem>
                <SelectItem value='intermediate'>Intermediate</SelectItem>
                <SelectItem value='advanced'>Advanced</SelectItem>
                <SelectItem value='expert'>Expert</SelectItem>
              </SelectContent>
            </Select>
            {state.errors?.proficiency && (
              <p className='text-sm text-destructive'>
                {state.errors.proficiency[0]}
              </p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='years_of_experience'>Years of Experience</Label>
            <Input
              id='years_of_experience'
              name='years_of_experience'
              type='number'
              min='0'
              max='50'
              defaultValue={currentExperience || ''}
            />
            {state.errors?.years_of_experience && (
              <p className='text-sm text-destructive'>
                {state.errors.years_of_experience[0]}
              </p>
            )}
          </div>

          <div className='flex items-center justify-between space-x-2'>
            <Label
              htmlFor='is_willing_to_mentor'
              className='flex flex-col space-y-1'
            >
              <span>Willing to mentor others?</span>
              <span className='font-normal text-sm text-muted-foreground'>
                Help other members learn this skill
              </span>
            </Label>
            <Switch
              id='is_willing_to_mentor'
              name='is_willing_to_mentor'
              defaultChecked={currentMentor}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='notes'>Notes</Label>
            <Textarea
              id='notes'
              name='notes'
              placeholder='Any additional information about this skill...'
              rows={3}
              defaultValue={currentNotes || ''}
            />
            {state.errors?.notes && (
              <p className='text-sm text-destructive'>
                {state.errors.notes[0]}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton label='Update Skill' />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
