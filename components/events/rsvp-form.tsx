'use client';
'use no memo';

/**
 * RSVP Form Component
 *
 * Allows members to RSVP to events with guest information.
 */

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, UserPlus } from 'lucide-react';
import { createOrUpdateRSVP } from '@/app/actions/events';
import {
  createRSVPSchema,
  type CreateRSVPInput
} from '@/lib/validations/event';
import type { EventWithDetails, EventRSVP } from '@/types/event';

// Form values type - ensures required fields are non-optional
type RSVPFormValues = {
  event_id: string;
  member_id: string;
  status:
    | 'pending'
    | 'confirmed'
    | 'declined'
    | 'waitlist'
    | 'attended'
    | 'no_show';
  guests_count: number;
  dietary_restrictions?: string;
  special_requirements?: string;
  notes?: string;
};
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';

interface RSVPFormProps {
  event: EventWithDetails;
  currentRSVP?: EventRSVP | null;
  memberId: string;
  onSuccess?: () => void;
}

export function RSVPForm({
  event,
  currentRSVP,
  memberId,
  onSuccess
}: RSVPFormProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isAtCapacity =
    event.max_capacity && event.current_registrations >= event.max_capacity;
  const spotsRemaining = event.max_capacity
    ? event.max_capacity - event.current_registrations
    : null;

  const form = useForm<RSVPFormValues>({
    // @ts-expect-error - zodResolver infers input type (with optional defaults) but form needs output type
    resolver: zodResolver(createRSVPSchema),
    defaultValues: {
      event_id: event.id,
      member_id: memberId,
      status: ((currentRSVP as any)?.status ||
        (event.requires_approval
          ? 'pending'
          : 'confirmed')) as RSVPFormValues['status'],
      guests_count: (currentRSVP as any)?.guests_count ?? 0,
      dietary_restrictions: (currentRSVP as any)?.dietary_restrictions || '',
      special_requirements: (currentRSVP as any)?.special_requirements || '',
      notes: (currentRSVP as any)?.notes || ''
    }
  });

  const guestsCount = form.watch('guests_count');

  const onSubmit = (data: RSVPFormValues) => {
    startTransition(async () => {
      try {
        const result = await createOrUpdateRSVP(data as CreateRSVPInput);
        if (result.success) {
          toast.success(
            currentRSVP
              ? 'RSVP updated successfully'
              : 'RSVP submitted successfully'
          );
          setOpen(false);
          onSuccess?.();
        } else {
          toast.error(result.error || 'Failed to submit RSVP');
        }
      } catch (error) {
        toast.error('An unexpected error occurred');
      }
    });
  };

  const totalAttendees = 1 + (guestsCount || 0);
  const willBeWaitlisted =
    spotsRemaining !== null && totalAttendees > spotsRemaining;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size='lg'
          className='w-full'
          variant={currentRSVP ? 'outline' : 'default'}
        >
          {currentRSVP ? (
            <>Update RSVP</>
          ) : (
            <>
              <UserPlus className='mr-2 h-5 w-5' />
              RSVP to Event
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {currentRSVP ? 'Update Your RSVP' : 'RSVP to Event'}
          </DialogTitle>
          <DialogDescription>{event.title}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit as any)}
            className='space-y-4'
          >
            {/* Capacity Warning */}
            {isAtCapacity && !currentRSVP && (
              <Alert>
                <AlertDescription>
                  This event is at full capacity.
                  {event.waitlist_enabled ? (
                    <> Your RSVP will be added to the waitlist.</>
                  ) : (
                    <> Registration is currently closed.</>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {spotsRemaining !== null &&
              spotsRemaining > 0 &&
              spotsRemaining <= 10 && (
                <Alert>
                  <AlertDescription>
                    Only {spotsRemaining} spot{spotsRemaining !== 1 ? 's' : ''}{' '}
                    remaining!
                  </AlertDescription>
                </Alert>
              )}

            {/* Approval Notice */}
            {event.requires_approval && !currentRSVP && (
              <Alert>
                <AlertDescription>
                  This event requires approval. Your RSVP will be pending until
                  approved by the organizer.
                </AlertDescription>
              </Alert>
            )}

            {/* Current Status */}
            {currentRSVP && (
              <div className='flex items-center gap-2'>
                <span className='text-sm font-medium'>Current Status:</span>
                <Badge
                  variant={
                    (currentRSVP as any).status === 'confirmed'
                      ? 'default'
                      : (currentRSVP as any).status === 'pending'
                      ? 'secondary'
                      : (currentRSVP as any).status === 'waitlisted'
                      ? 'secondary'
                      : 'destructive'
                  }
                >
                  {(currentRSVP as any).status}
                </Badge>
              </div>
            )}

            {/* Guests */}
            {event.allow_guests && (
              <FormField
                control={form.control as any}
                name='guests_count'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Guests</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString() || '0'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select number of guests' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from(
                          { length: (event.guest_limit || 5) + 1 },
                          (_, i) => i
                        ).map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num}{' '}
                            {num === 0
                              ? 'guests (just me)'
                              : num === 1
                              ? 'guest'
                              : 'guests'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {event.guest_limit && (
                      <FormDescription>
                        Maximum {event.guest_limit} guest
                        {event.guest_limit !== 1 ? 's' : ''} allowed
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Waitlist Warning */}
            {willBeWaitlisted && event.waitlist_enabled && (
              <Alert variant='destructive'>
                <AlertDescription>
                  With {totalAttendees} attendee
                  {totalAttendees !== 1 ? 's' : ''}, you will be added to the
                  waitlist as only {spotsRemaining} spot
                  {spotsRemaining !== 1 ? 's are' : ' is'} remaining.
                </AlertDescription>
              </Alert>
            )}

            {/* Dietary Restrictions */}
            <FormField
              control={form.control as any}
              name='dietary_restrictions'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dietary Restrictions (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g., Vegetarian, Vegan, Gluten-free'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Let us know about any dietary restrictions
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Special Requirements */}
            <FormField
              control={form.control as any}
              name='special_requirements'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Requirements (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Any special accommodations needed...'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Accessibility needs, parking, etc.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control as any}
              name='notes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Any additional information...'
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
                {currentRSVP ? 'Update RSVP' : 'Submit RSVP'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Quick RSVP Buttons (for simple yes/no RSVP)
 */
interface QuickRSVPProps {
  event: EventWithDetails;
  currentRSVP?: EventRSVP | null;
  memberId: string;
  onSuccess?: () => void;
}

export function QuickRSVP({
  event,
  currentRSVP,
  memberId,
  onSuccess
}: QuickRSVPProps) {
  const [isPending, startTransition] = useTransition();

  const handleRSVP = (status: 'confirmed' | 'declined') => {
    startTransition(async () => {
      try {
        const result = await createOrUpdateRSVP({
          event_id: event.id,
          member_id: memberId,
          status: status,
          guests_count: 0
        });
        if (result.success) {
          toast.success(
            status === 'confirmed' ? 'RSVP confirmed!' : 'RSVP declined'
          );
          onSuccess?.();
        } else {
          toast.error(result.error || 'Failed to submit RSVP');
        }
      } catch (error) {
        toast.error('An unexpected error occurred');
      }
    });
  };

  if (currentRSVP) {
    return (
      <div className='flex items-center gap-2'>
        <Badge
          variant={
            (currentRSVP as any).status === 'confirmed'
              ? 'default'
              : (currentRSVP as any).status === 'declined'
              ? 'destructive'
              : 'secondary'
          }
        >
          {(currentRSVP as any).status}
        </Badge>
        <Button
          variant='ghost'
          size='sm'
          onClick={() =>
            handleRSVP(
              (currentRSVP as any).status === 'confirmed'
                ? 'declined'
                : 'confirmed'
            )
          }
          disabled={isPending}
        >
          {isPending && <Loader2 className='mr-2 h-3 w-3 animate-spin' />}
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className='flex gap-2'>
      <Button
        onClick={() => handleRSVP('confirmed')}
        disabled={isPending}
        className='flex-1'
      >
        {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
        Going
      </Button>
      <Button
        variant='outline'
        onClick={() => handleRSVP('declined')}
        disabled={isPending}
        className='flex-1'
      >
        Can&apos;t Go
      </Button>
    </div>
  );
}
