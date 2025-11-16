/**
 * Industry Slot Creation Form
 * Simplified form for industries to create self-service IV slots
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Calendar, Users, MapPin, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { industryCreateIVSlot } from '@/app/actions/industrial-visits';
import { industryCreateIVSlotSchema } from '@/lib/validations/industrial-visit';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255),
  description: z.string().optional(),
  start_date: z.date({ message: 'Start date is required' }),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  end_date: z.date({ message: 'End date is required' }),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  max_capacity: z.coerce.number().int().positive('Capacity must be a positive number'),
  requirements: z.string().max(1000).optional(),
  learning_outcomes: z.string().max(1000).optional(),
  contact_person_name: z.string().max(255).optional(),
  contact_person_phone: z.string().regex(/^[0-9+\-\s()]+$/, 'Invalid phone number').max(20).optional(),
  contact_person_role: z.string().max(100).optional(),
  logistics_parking: z.string().max(500).optional(),
  logistics_food: z.string().max(500).optional(),
  logistics_meeting_point: z.string().max(500).optional(),
  logistics_arrival_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
});

type FormData = z.infer<typeof formSchema>;

export function IndustrySlotForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      start_time: '09:00',
      end_time: '17:00',
      max_capacity: 20,
      requirements: '',
      learning_outcomes: '',
      contact_person_name: '',
      contact_person_phone: '',
      contact_person_role: '',
      logistics_parking: '',
      logistics_food: '',
      logistics_meeting_point: '',
      logistics_arrival_time: '09:00',
    },
  });

  async function onSubmit(data: FormData) {
    try {
      setIsSubmitting(true);

      // Combine date and time
      const startDateTime = new Date(data.start_date);
      const [startHour, startMinute] = data.start_time.split(':');
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

      const endDateTime = new Date(data.end_date);
      const [endHour, endMinute] = data.end_time.split(':');
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

      // Validate end date is after start date
      if (endDateTime <= startDateTime) {
        toast.error('End date and time must be after start date and time');
        return;
      }

      const formData = new FormData();
      formData.append('title', data.title);
      if (data.description) formData.append('description', data.description);
      formData.append('start_date', startDateTime.toISOString());
      formData.append('end_date', endDateTime.toISOString());
      formData.append('max_capacity', data.max_capacity.toString());
      if (data.requirements) formData.append('requirements', data.requirements);
      if (data.learning_outcomes) formData.append('learning_outcomes', data.learning_outcomes);
      if (data.contact_person_name) formData.append('contact_person_name', data.contact_person_name);
      if (data.contact_person_phone) formData.append('contact_person_phone', data.contact_person_phone);
      if (data.contact_person_role) formData.append('contact_person_role', data.contact_person_role);
      if (data.logistics_parking) formData.append('logistics_parking', data.logistics_parking);
      if (data.logistics_food) formData.append('logistics_food', data.logistics_food);
      if (data.logistics_meeting_point) formData.append('logistics_meeting_point', data.logistics_meeting_point);
      if (data.logistics_arrival_time) formData.append('logistics_arrival_time', data.logistics_arrival_time);

      const result = await industryCreateIVSlot(formData);

      if (result.success) {
        toast.success(result.message || 'Slot created successfully!');
        router.push('/industry-portal/slots');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to create slot');
      }
    } catch (error: any) {
      toast.error(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">
        {/* Auto-Service Notice */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This slot will be automatically published and available for Yi members to book.
            Your company information will be displayed to members.
          </AlertDescription>
        </Alert>

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Basic Information
          </h3>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Factory Tour & Manufacturing Process Demonstration"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  A clear, descriptive title for the industrial visit
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe what participants will experience during the visit..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Date & Time */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date & Time
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <Calendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="start_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time *</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>End Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <Calendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="end_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Time *</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Capacity */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Capacity
          </h3>

          <FormField
            control={form.control}
            name="max_capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum Participants *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    placeholder="20"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  How many Yi members can attend this visit?
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Learning Details */}
        <div className="space-y-4">
          <h3 className="font-semibold">Learning Details</h3>

          <FormField
            control={form.control}
            name="learning_outcomes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Learning Outcomes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What will participants learn? What insights will they gain?"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Highlight the educational value of this visit
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="requirements"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Requirements</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any special requirements? (e.g., safety gear, dress code, prerequisites)"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Contact Person */}
        <div className="space-y-4">
          <h3 className="font-semibold">Contact Person (Optional)</h3>
          <p className="text-sm text-muted-foreground">
            Provide a contact person for participants to reach out with questions
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="contact_person_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_person_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role/Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Operations Manager" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_person_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Logistics */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Logistics Information
          </h3>

          <FormField
            control={form.control}
            name="logistics_meeting_point"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meeting Point</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Main Reception, Building A"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="logistics_arrival_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recommended Arrival Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormDescription>
                  What time should participants arrive?
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="logistics_parking"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parking Information</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Parking instructions, visitor parking locations, etc."
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="logistics_food"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Food & Refreshments</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Will refreshments be provided? Any meal plans?"
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Creating Slot...' : 'Create Slot'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
