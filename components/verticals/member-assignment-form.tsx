'use client';

/**
 * Member Assignment Form Component
 *
 * Form for assigning members to a vertical and managing roles.
 * Module 9: Vertical Performance Tracker
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  UserPlus,
  Users,
  Search,
  Check,
  X,
  Crown
} from 'lucide-react';
import { addVerticalMember, assignVerticalChair } from '@/app/actions/vertical';
import {
  addVerticalMemberSchema,
  assignVerticalChairSchema,
  type AddVerticalMemberInput,
  type AssignVerticalChairInput
} from '@/lib/validations/vertical';
import type { VerticalMemberWithDetails } from '@/types/vertical';

// Simplified member type for selection
interface SimpleMember {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
}
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
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface MemberAssignmentFormProps {
  verticalId: string;
  verticalName: string;
  availableMembers: SimpleMember[];
  existingMembers?: VerticalMemberWithDetails[];
  onSuccess?: () => void;
}

export function MemberAssignmentForm({
  verticalId,
  verticalName,
  availableMembers,
  existingMembers = [],
  onSuccess
}: MemberAssignmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedMember, setSelectedMember] = useState<SimpleMember | null>(
    null
  );
  const [memberOpen, setMemberOpen] = useState(false);
  const [isChairAssignment, setIsChairAssignment] = useState(false);

  // Filter out already assigned members
  const existingMemberIds = existingMembers.map((m) => m.member_id);
  const unassignedMembers = availableMembers.filter(
    (m) => !existingMemberIds.includes(m.id)
  );

  const memberForm = useForm<AddVerticalMemberInput>({
    resolver: zodResolver(
      addVerticalMemberSchema
    ) as Resolver<AddVerticalMemberInput>,
    mode: 'onChange',
    defaultValues: {
      vertical_id: verticalId,
      member_id: '',
      role: '',
      joined_date: new Date().toISOString().split('T')[0],
      contribution_notes: ''
    }
  });

  const chairForm = useForm<AssignVerticalChairInput>({
    resolver: zodResolver(
      assignVerticalChairSchema
    ) as Resolver<AssignVerticalChairInput>,
    mode: 'onChange',
    defaultValues: {
      vertical_id: verticalId,
      member_id: '',
      role: 'chair',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      notes: ''
    }
  });

  const handleMemberSelect = (member: SimpleMember) => {
    setSelectedMember(member);
    memberForm.setValue('member_id', member.id);
    chairForm.setValue('member_id', member.id);
    setMemberOpen(false);
  };

  const onSubmitMember = (data: AddVerticalMemberInput) => {
    startTransition(async () => {
      try {
        const result = await addVerticalMember(data);
        if (result.success) {
          toast.success('Member assigned successfully');
          setSelectedMember(null);
          memberForm.reset({
            vertical_id: verticalId,
            member_id: '',
            role: '',
            joined_date: new Date().toISOString().split('T')[0],
            contribution_notes: ''
          });
          if (onSuccess) {
            onSuccess();
          } else {
            router.refresh();
          }
        } else {
          toast.error(result.error || 'Failed to assign member');
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        toast.error('An unexpected error occurred');
      }
    });
  };

  const onSubmitChair = (data: AssignVerticalChairInput) => {
    startTransition(async () => {
      try {
        const result = await assignVerticalChair(data);
        if (result.success) {
          toast.success('Chair assigned successfully');
          setSelectedMember(null);
          chairForm.reset({
            vertical_id: verticalId,
            member_id: '',
            role: 'chair',
            start_date: new Date().toISOString().split('T')[0],
            end_date: '',
            notes: ''
          });
          if (onSuccess) {
            onSuccess();
          } else {
            router.push(`/verticals/${verticalId}`);
            router.refresh();
          }
        } else {
          toast.error(result.error || 'Failed to assign chair');
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        toast.error('An unexpected error occurred');
      }
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className='space-y-6'>
      {/* Assignment Type Toggle */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <UserPlus className='h-5 w-5' />
                Assign Member to {verticalName}
              </CardTitle>
              <CardDescription>
                Add a new member or assign a chair to this vertical
              </CardDescription>
            </div>
            <div className='flex items-center gap-2'>
              <span
                className={cn('text-sm', !isChairAssignment && 'font-medium')}
              >
                Member
              </span>
              <Switch
                checked={isChairAssignment}
                onCheckedChange={setIsChairAssignment}
              />
              <span
                className={cn('text-sm', isChairAssignment && 'font-medium')}
              >
                Chair
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Member Selector */}
          <div className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                Select Member *
              </label>
              <Popover open={memberOpen} onOpenChange={setMemberOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    role='combobox'
                    aria-expanded={memberOpen}
                    className='w-full justify-between'
                  >
                    {selectedMember ? (
                      <div className='flex items-center gap-2'>
                        <Avatar className='h-6 w-6'>
                          <AvatarImage src={selectedMember.avatar_url || ''} />
                          <AvatarFallback className='text-xs'>
                            {getInitials(selectedMember.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{selectedMember.full_name}</span>
                      </div>
                    ) : (
                      <span className='text-muted-foreground'>
                        Search members...
                      </span>
                    )}
                    <Search className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-full p-0' align='start'>
                  <Command>
                    <CommandInput placeholder='Search members...' />
                    <CommandList>
                      <CommandEmpty>No members found.</CommandEmpty>
                      <CommandGroup>
                        {unassignedMembers.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={member.full_name}
                            onSelect={() => handleMemberSelect(member)}
                          >
                            <div className='flex items-center gap-2'>
                              <Avatar className='h-8 w-8'>
                                <AvatarImage src={member.avatar_url || ''} />
                                <AvatarFallback>
                                  {getInitials(member.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className='font-medium'>
                                  {member.full_name}
                                </p>
                                <p className='text-xs text-muted-foreground'>
                                  {member.email}
                                </p>
                              </div>
                            </div>
                            {selectedMember?.id === member.id && (
                              <Check className='ml-auto h-4 w-4' />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {unassignedMembers.length === 0 && (
                <p className='text-sm text-muted-foreground mt-2'>
                  All chapter members are already assigned to this vertical.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Assignment Form */}
      {!isChairAssignment && selectedMember && (
        <Form {...memberForm}>
          <form
            onSubmit={memberForm.handleSubmit(onSubmitMember)}
            className='space-y-6'
          >
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Users className='h-5 w-5' />
                  Member Details
                </CardTitle>
                <CardDescription>
                  Assigning {selectedMember.full_name}
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  {/* Role */}
                  <FormField
                    control={memberForm.control}
                    name='role'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='e.g., Volunteer, Coordinator'
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Joined Date */}
                  <FormField
                    control={memberForm.control}
                    name='joined_date'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Joined Date</FormLabel>
                        <FormControl>
                          <Input type='date' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Contribution Notes */}
                <FormField
                  control={memberForm.control}
                  name='contribution_notes'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contribution Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='Notes about expected contributions...'
                          className='min-h-[80px]'
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Hidden fields */}
            <input type='hidden' {...memberForm.register('vertical_id')} />
            <input type='hidden' {...memberForm.register('member_id')} />

            {/* Form Actions */}
            <div className='flex justify-end gap-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setSelectedMember(null);
                  memberForm.reset();
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Assign Member
              </Button>
            </div>
          </form>
        </Form>
      )}

      {/* Chair Assignment Form */}
      {isChairAssignment && selectedMember && (
        <Form {...chairForm}>
          <form
            onSubmit={chairForm.handleSubmit(onSubmitChair)}
            className='space-y-6'
          >
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Crown className='h-5 w-5 text-yellow-500' />
                  Chair Assignment
                </CardTitle>
                <CardDescription>
                  Assigning {selectedMember.full_name} as Chair
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  {/* Role */}
                  <FormField
                    control={chairForm.control}
                    name='role'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role *</FormLabel>
                        <FormControl>
                          <select
                            className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                            {...field}
                          >
                            <option value='chair'>Chair</option>
                            <option value='co_chair'>Co-Chair</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Start Date */}
                  <FormField
                    control={chairForm.control}
                    name='start_date'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date *</FormLabel>
                        <FormControl>
                          <Input type='date' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* End Date */}
                <FormField
                  control={chairForm.control}
                  name='end_date'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input
                          type='date'
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Leave empty for ongoing term
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notes */}
                <FormField
                  control={chairForm.control}
                  name='notes'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='Key responsibilities and notes for this chair position...'
                          className='min-h-[100px]'
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Hidden fields */}
            <input type='hidden' {...chairForm.register('vertical_id')} />
            <input type='hidden' {...chairForm.register('member_id')} />

            {/* Form Actions */}
            <div className='flex justify-end gap-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setSelectedMember(null);
                  chairForm.reset();
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Assign Chair
              </Button>
            </div>
          </form>
        </Form>
      )}

      {/* Existing Members List */}
      {existingMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Members ({existingMembers.length})</CardTitle>
            <CardDescription>
              Members currently assigned to this vertical
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {existingMembers.map((member) => {
                // Get member details from nested data (member.member.profile structure from Supabase join)
                const memberData = member.member as any;
                const profileData = memberData?.profile;
                const displayName =
                  profileData?.full_name ||
                  memberData?.full_name ||
                  member.member_id;
                const avatarUrl = memberData?.avatar_url || '';

                return (
                  <div
                    key={member.id}
                    className='flex items-center justify-between p-3 rounded-lg border'
                  >
                    <div className='flex items-center gap-3'>
                      <Avatar className='h-10 w-10'>
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback>
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className='font-medium'>{displayName}</p>
                        {member.role_in_vertical && (
                          <Badge variant='secondary' className='mt-1'>
                            {member.role_in_vertical}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant={member.is_active ? 'default' : 'secondary'}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
