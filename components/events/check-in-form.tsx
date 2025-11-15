'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { checkInAttendee } from '@/app/actions/events';
import { checkInSchema, type CheckInInput } from '@/lib/validations/event';

interface CheckInFormProps {
  eventId: string;
  userId?: string;
}

export function CheckInForm({ eventId, userId }: CheckInFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CheckInInput>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      event_id: eventId,
      attendee_type: userId ? 'member' : 'guest',
      attendee_id: userId || '',
      check_in_method: 'qr_code',
      notes: ''
    }
  });

  const isGuest = !userId;
  const [guestName, setGuestName] = useState('');

  const onSubmit = async (data: CheckInInput) => {
    setIsSubmitting(true);
    try {
      const result = await checkInAttendee(data);

      if (result.success) {
        toast.success('Successfully checked in!');
        router.push(`/events/${eventId}`);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to check in');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      toast.error('An error occurred during check-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        {/* Guest Identifier (only if not logged in) */}
        {isGuest && (
          <FormField
            control={form.control}
            name='attendee_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your Email or Name *</FormLabel>
                <FormControl>
                  <Input
                    placeholder='your.email@example.com or your name'
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      setGuestName(e.target.value);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Provide your email or name for check-in records
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Check-in Method */}
        <FormField
          control={form.control}
          name='check_in_method'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Check-in Method</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select check-in method' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='qr_code'>QR Code Scan</SelectItem>
                  <SelectItem value='manual'>Manual Entry</SelectItem>
                  <SelectItem value='self'>Self Check-in</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                How are you checking in to this event?
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes (Optional) */}
        <FormField
          control={form.control}
          name='notes'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Any additional information...'
                  className='resize-none'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional: Add any special requirements or notes
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <div className='flex gap-2'>
          <Button
            type='submit'
            disabled={isSubmitting}
            className='flex-1'
          >
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Checking in...
              </>
            ) : (
              'Complete Check-in'
            )}
          </Button>
        </div>

        {/* Information */}
        {isGuest && (
          <div className='text-xs text-muted-foreground p-3 bg-muted rounded-lg'>
            <strong>Note:</strong> You're checking in as a guest. To access member-only
            features and track your event history,{' '}
            <a href='/login' className='text-primary hover:underline'>
              sign in
            </a>{' '}
            or{' '}
            <a href='/apply' className='text-primary hover:underline'>
              apply for membership
            </a>
            .
          </div>
        )}
      </form>
    </Form>
  );
}
