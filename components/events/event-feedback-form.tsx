'use client';

/**
 * Event Feedback Form Component
 *
 * Form for submitting event feedback and ratings.
 */

import { useState, useTransition } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Star, MessageSquare } from 'lucide-react';
import { submitEventFeedback } from '@/app/actions/events';
import {
  createEventFeedbackSchema,
  type CreateEventFeedbackInput
} from '@/lib/validations/event';

// Form values type - ensures required fields match parsed schema output
type EventFeedbackFormValues = {
  event_id: string;
  member_id?: string;
  overall_rating?: number;
  content_rating?: number;
  venue_rating?: number;
  organization_rating?: number;
  what_went_well?: string;
  what_could_improve?: string;
  suggestions?: string;
  would_attend_again?: boolean;
  is_anonymous: boolean;
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface EventFeedbackFormProps {
  eventId: string;
  eventTitle: string;
  memberId?: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function EventFeedbackForm({
  eventId,
  eventTitle,
  memberId,
  onSuccess,
  trigger
}: EventFeedbackFormProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<EventFeedbackFormValues>({
    resolver: zodResolver(createEventFeedbackSchema) as Resolver<EventFeedbackFormValues>,
    defaultValues: {
      event_id: eventId,
      member_id: memberId,
      overall_rating: undefined,
      content_rating: undefined,
      venue_rating: undefined,
      organization_rating: undefined,
      what_went_well: '',
      what_could_improve: '',
      suggestions: '',
      would_attend_again: undefined,
      is_anonymous: false
    }
  });

  const onSubmit = (data: EventFeedbackFormValues) => {
    startTransition(async () => {
      try {
        const result = await submitEventFeedback(
          data as CreateEventFeedbackInput
        );
        if (result.success) {
          toast.success('Feedback submitted successfully');
          setOpen(false);
          form.reset();
          onSuccess?.();
        } else {
          toast.error(result.error || 'Failed to submit feedback');
        }
      } catch (error) {
        toast.error('An unexpected error occurred');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <MessageSquare className='mr-2 h-4 w-4' />
            Share Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Event Feedback</DialogTitle>
          <DialogDescription>{eventTitle}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit as any)}
            className='space-y-6'
          >
            {/* Ratings Section */}
            <div className='space-y-4'>
              <h3 className='text-sm font-medium'>Rate Your Experience</h3>

              <FormField
                control={form.control as any}
                name='overall_rating'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overall Experience</FormLabel>
                    <FormControl>
                      <StarRating
                        value={field.value ?? 0}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name='content_rating'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content Quality</FormLabel>
                    <FormControl>
                      <StarRating
                        value={field.value ?? 0}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name='venue_rating'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venue & Logistics</FormLabel>
                    <FormControl>
                      <StarRating
                        value={field.value ?? 0}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name='organization_rating'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization & Planning</FormLabel>
                    <FormControl>
                      <StarRating
                        value={field.value ?? 0}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Text Feedback */}
            <div className='space-y-4'>
              <h3 className='text-sm font-medium'>Share Your Thoughts</h3>

              <FormField
                control={form.control as any}
                name='what_went_well'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What went well?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Share what you enjoyed about the event...'
                        className='min-h-24'
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name='what_could_improve'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What could be improved?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Let us know what could be better...'
                        className='min-h-24'
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name='suggestions'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suggestions for Future Events</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Any suggestions or ideas...'
                        className='min-h-24'
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Would Attend Again */}
            <FormField
              control={form.control as any}
              name='would_attend_again'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Would you attend a similar event again?
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Anonymous Feedback */}
            <FormField
              control={form.control as any}
              name='is_anonymous'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Submit Anonymously
                    </FormLabel>
                    <FormDescription>
                      Your name will not be associated with this feedback
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
                Submit Feedback
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Star Rating Component
 */
interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

function StarRating({ value, onChange, max = 5 }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);

  return (
    <div className='flex items-center gap-1'>
      {Array.from({ length: max }, (_, i) => i + 1).map((rating) => (
        <button
          key={rating}
          type='button'
          onClick={() => onChange(rating)}
          onMouseEnter={() => setHoverValue(rating)}
          onMouseLeave={() => setHoverValue(0)}
          className='transition-transform hover:scale-110'
        >
          <Star
            className={cn(
              'h-8 w-8 transition-colors',
              (hoverValue || value) >= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            )}
          />
        </button>
      ))}
      <span className='ml-2 text-sm font-medium'>
        {value > 0 ? `${value} / ${max}` : 'Not rated'}
      </span>
    </div>
  );
}

/**
 * Feedback Display Component
 */
interface FeedbackDisplayProps {
  feedback: {
    overall_rating?: number | null;
    content_rating?: number | null;
    venue_rating?: number | null;
    organization_rating?: number | null;
    what_went_well?: string | null;
    what_could_improve?: string | null;
    suggestions?: string | null;
    would_attend_again?: boolean | null;
    is_anonymous: boolean;
    member?: {
      full_name: string;
      avatar_url?: string | null;
    } | null;
    created_at: string;
  };
}

export function FeedbackDisplay({ feedback }: FeedbackDisplayProps) {
  const ratings = [
    feedback.overall_rating,
    feedback.content_rating,
    feedback.venue_rating,
    feedback.organization_rating
  ].filter((r): r is number => r !== null && r !== undefined);

  const avgRating =
    ratings.length > 0
      ? ratings.reduce((sum, val) => sum + val, 0) / ratings.length
      : 0;

  return (
    <div className='rounded-lg border p-4 space-y-4'>
      {/* Header */}
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          {!feedback.is_anonymous && feedback.member && (
            <>
              <div className='h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center'>
                <span className='font-medium text-primary'>
                  {feedback.member.full_name.charAt(0)}
                </span>
              </div>
              <div>
                <div className='font-medium'>{feedback.member.full_name}</div>
                <div className='text-sm text-muted-foreground'>
                  {new Date(feedback.created_at).toLocaleDateString()}
                </div>
              </div>
            </>
          )}
          {feedback.is_anonymous && (
            <div>
              <div className='font-medium'>Anonymous</div>
              <div className='text-sm text-muted-foreground'>
                {new Date(feedback.created_at).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
        {avgRating > 0 && (
          <div className='flex items-center gap-1'>
            <Star className='h-5 w-5 fill-yellow-400 text-yellow-400' />
            <span className='text-lg font-bold'>{avgRating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Ratings */}
      {(feedback.overall_rating ||
        feedback.content_rating ||
        feedback.venue_rating ||
        feedback.organization_rating) && (
        <div className='grid grid-cols-2 gap-3 text-sm'>
          {feedback.overall_rating && (
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Overall:</span>
              <div className='flex items-center gap-1'>
                <Star className='h-3 w-3 fill-yellow-400 text-yellow-400' />
                <span className='font-medium'>{feedback.overall_rating}</span>
              </div>
            </div>
          )}
          {feedback.content_rating && (
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Content:</span>
              <div className='flex items-center gap-1'>
                <Star className='h-3 w-3 fill-yellow-400 text-yellow-400' />
                <span className='font-medium'>{feedback.content_rating}</span>
              </div>
            </div>
          )}
          {feedback.venue_rating && (
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Venue:</span>
              <div className='flex items-center gap-1'>
                <Star className='h-3 w-3 fill-yellow-400 text-yellow-400' />
                <span className='font-medium'>{feedback.venue_rating}</span>
              </div>
            </div>
          )}
          {feedback.organization_rating && (
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Organization:</span>
              <div className='flex items-center gap-1'>
                <Star className='h-3 w-3 fill-yellow-400 text-yellow-400' />
                <span className='font-medium'>
                  {feedback.organization_rating}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Text Feedback */}
      <div className='space-y-3'>
        {feedback.what_went_well && (
          <div>
            <div className='text-sm font-medium text-green-600 dark:text-green-400 mb-1'>
              What went well
            </div>
            <p className='text-sm text-muted-foreground'>
              {feedback.what_went_well}
            </p>
          </div>
        )}
        {feedback.what_could_improve && (
          <div>
            <div className='text-sm font-medium text-orange-600 dark:text-orange-400 mb-1'>
              What could improve
            </div>
            <p className='text-sm text-muted-foreground'>
              {feedback.what_could_improve}
            </p>
          </div>
        )}
        {feedback.suggestions && (
          <div>
            <div className='text-sm font-medium text-blue-600 dark:text-blue-400 mb-1'>
              Suggestions
            </div>
            <p className='text-sm text-muted-foreground'>
              {feedback.suggestions}
            </p>
          </div>
        )}
      </div>

      {/* Would Attend Again */}
      {feedback.would_attend_again !== null &&
        feedback.would_attend_again !== undefined && (
          <div
            className={cn(
              'text-sm font-medium',
              feedback.would_attend_again
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            )}
          >
            {feedback.would_attend_again
              ? '✓ Would attend again'
              : '✗ Would not attend again'}
          </div>
        )}
    </div>
  );
}
