'use client';
'use no memo';

/**
 * Volunteer Assignment Form Component
 *
 * Form for assigning volunteers to events with role selection.
 */

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Search, UserPlus, Award } from 'lucide-react';
import { assignVolunteer, updateVolunteer } from '@/app/actions/events';
import {
  assignVolunteerSchema,
  type AssignVolunteerInput
} from '@/lib/validations/event';
import type {
  EventVolunteer,
  VolunteerRole,
  VolunteerMatch
} from '@/types/event';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface VolunteerAssignmentFormProps {
  eventId: string;
  roles: VolunteerRole[];
  suggestedVolunteers?: VolunteerMatch[];
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function VolunteerAssignmentForm({
  eventId,
  roles,
  suggestedVolunteers = [],
  onSuccess,
  trigger
}: VolunteerAssignmentFormProps) {
  const [open, setOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<VolunteerMatch | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const form = useForm<AssignVolunteerInput>({
    resolver: zodResolver(assignVolunteerSchema),
    defaultValues: {
      event_id: eventId,
      member_id: '',
      role_id: '',
      role_name: '',
      notes: ''
    }
  });

  const onSubmit = (data: AssignVolunteerInput) => {
    startTransition(async () => {
      try {
        const result = await assignVolunteer(data);
        if (result.success) {
          toast.success('Volunteer assigned successfully');
          setOpen(false);
          form.reset();
          setSelectedMember(null);
          onSuccess?.();
        } else {
          toast.error(result.error || 'Failed to assign volunteer');
        }
      } catch (error) {
        toast.error('An unexpected error occurred');
      }
    });
  };

  const handleSelectMember = (volunteer: VolunteerMatch) => {
    setSelectedMember(volunteer);
    form.setValue('member_id', volunteer.member_id);
    setMemberOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <UserPlus className='mr-2 h-4 w-4' />
            Assign Volunteer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Assign Volunteer</DialogTitle>
          <DialogDescription>
            Select a member and assign them a volunteer role for this event
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            {/* Member Selection */}
            <FormField
              control={form.control}
              name='member_id'
              render={({ field }) => (
                <FormItem className='flex flex-col'>
                  <FormLabel>Select Member *</FormLabel>
                  <Popover open={memberOpen} onOpenChange={setMemberOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant='outline'
                          role='combobox'
                          className={cn(
                            'justify-between',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {selectedMember ? (
                            <div className='flex items-center gap-2'>
                              <Avatar className='h-6 w-6'>
                                <AvatarFallback>
                                  {selectedMember.member_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{selectedMember.member_name}</span>
                            </div>
                          ) : (
                            'Select member...'
                          )}
                          <Search className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className='w-[400px] p-0' align='start'>
                      <Command>
                        <CommandInput placeholder='Search members...' />
                        <CommandEmpty>No members found.</CommandEmpty>
                        <CommandGroup className='max-h-64 overflow-auto'>
                          {suggestedVolunteers.map((volunteer) => (
                            <CommandItem
                              key={volunteer.member_id}
                              value={volunteer.member_name}
                              onSelect={() => handleSelectMember(volunteer)}
                            >
                              <div className='flex items-start gap-3 w-full'>
                                <Avatar className='h-8 w-8'>
                                  <AvatarFallback>
                                    {volunteer.member_name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className='flex-1 min-w-0'>
                                  <div className='flex items-center gap-2'>
                                    <span className='font-medium'>
                                      {volunteer.member_name}
                                    </span>
                                    {volunteer.match_score >= 70 && (
                                      <Badge
                                        variant='default'
                                        className='text-xs'
                                      >
                                        Great Match
                                      </Badge>
                                    )}
                                  </div>
                                  <div className='flex items-center gap-3 text-xs text-muted-foreground mt-1'>
                                    <span>{volunteer.availability_status}</span>
                                    <span>•</span>
                                    <span>
                                      {volunteer.events_volunteered} events
                                    </span>
                                    <span>•</span>
                                    <span>{volunteer.volunteer_hours}h</span>
                                  </div>
                                  {volunteer.matching_skills.length > 0 && (
                                    <div className='flex gap-1 mt-1 flex-wrap'>
                                      {volunteer.matching_skills
                                        .slice(0, 3)
                                        .map((skill) => (
                                          <Badge
                                            key={skill}
                                            variant='outline'
                                            className='text-xs'
                                          >
                                            {skill}
                                          </Badge>
                                        ))}
                                    </div>
                                  )}
                                </div>
                                <div className='shrink-0'>
                                  <div className='text-xs font-medium text-center'>
                                    {volunteer.match_score}%
                                  </div>
                                  <div className='text-xs text-muted-foreground'>
                                    match
                                  </div>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Show Match Details */}
            {selectedMember && selectedMember.match_score > 0 && (
              <div className='rounded-lg border p-4 space-y-3'>
                <div className='flex items-center justify-between'>
                  <h4 className='text-sm font-medium'>Match Score</h4>
                  <span className='text-2xl font-bold text-primary'>
                    {selectedMember.match_score}%
                  </span>
                </div>
                <Progress value={selectedMember.match_score} className='h-2' />
                <div className='grid grid-cols-3 gap-3 text-sm'>
                  <div>
                    <div className='text-muted-foreground text-xs'>
                      Availability
                    </div>
                    <Badge
                      variant={
                        selectedMember.availability_status === 'available'
                          ? 'default'
                          : selectedMember.availability_status === 'busy'
                          ? 'secondary'
                          : 'secondary'
                      }
                      className='mt-1'
                    >
                      {selectedMember.availability_status}
                    </Badge>
                  </div>
                  <div>
                    <div className='text-muted-foreground text-xs'>
                      Experience
                    </div>
                    <div className='font-medium mt-1'>
                      {selectedMember.events_volunteered} events
                    </div>
                  </div>
                  <div>
                    <div className='text-muted-foreground text-xs'>
                      Total Hours
                    </div>
                    <div className='font-medium mt-1'>
                      {selectedMember.volunteer_hours}h
                    </div>
                  </div>
                </div>
                {selectedMember.matching_skills.length > 0 && (
                  <div>
                    <div className='text-muted-foreground text-xs mb-2'>
                      Matching Skills
                    </div>
                    <div className='flex gap-1 flex-wrap'>
                      {selectedMember.matching_skills.map((skill) => (
                        <Badge key={skill} variant='outline'>
                          <Award className='mr-1 h-3 w-3' />
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Role Selection */}
            <FormField
              control={form.control}
              name='role_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Volunteer Role</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      const role = roles.find((r) => (r as any).id === value);
                      if (role) {
                        form.setValue('role_name', (role as any).name);
                      }
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select a role' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem
                          key={(role as any).id}
                          value={(role as any).id}
                        >
                          <div>
                            <div className='font-medium'>
                              {(role as any).name}
                            </div>
                            {(role as any).description && (
                              <div className='text-xs text-muted-foreground'>
                                {(role as any).description}
                              </div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Or leave empty to assign a custom role below
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Custom Role Name */}
            <FormField
              control={form.control}
              name='role_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g., Registration Coordinator'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Will be auto-filled if you select a role above
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name='notes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Any special instructions or notes...'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex gap-3 pt-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setOpen(false)}
                className='flex-1'
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type='submit' className='flex-1' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Assign Volunteer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Volunteer Status Update Component
 */
interface VolunteerStatusUpdateProps {
  volunteer: EventVolunteer;
  canUpdate: boolean;
  onSuccess?: () => void;
}

export function VolunteerStatusUpdate({
  volunteer,
  canUpdate,
  onSuccess
}: VolunteerStatusUpdateProps) {
  const [isPending, startTransition] = useTransition();

  const handleStatusUpdate = (
    status: 'accepted' | 'declined' | 'completed'
  ) => {
    startTransition(async () => {
      try {
        const result = await updateVolunteer((volunteer as any).id, { status });
        if (result.success) {
          toast.success('Status updated successfully');
          onSuccess?.();
        } else {
          toast.error(result.error || 'Failed to update status');
        }
      } catch (error) {
        toast.error('An unexpected error occurred');
      }
    });
  };

  if (!canUpdate) {
    return (
      <Badge
        variant={
          (volunteer as any).status === 'accepted'
            ? 'default'
            : (volunteer as any).status === 'completed'
            ? 'secondary'
            : (volunteer as any).status === 'declined'
            ? 'destructive'
            : 'default'
        }
      >
        {(volunteer as any).status}
      </Badge>
    );
  }

  return (
    <Select
      value={(volunteer as any).status}
      onValueChange={handleStatusUpdate}
      disabled={isPending}
    >
      <SelectTrigger className='w-32'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='invited'>Invited</SelectItem>
        <SelectItem value='accepted'>Accepted</SelectItem>
        <SelectItem value='declined'>Declined</SelectItem>
        <SelectItem value='completed'>Completed</SelectItem>
      </SelectContent>
    </Select>
  );
}
