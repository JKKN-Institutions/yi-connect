/**
 * Industrial Visit Booking Form
 * RSVP form with carpool and family options
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Users, Car, Info } from 'lucide-react';
import toast from 'react-hot-toast';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createIVBooking } from '@/app/actions/industrial-visits';
import { createIVBookingSchema } from '@/lib/validations/industrial-visit';

interface IVBookingFormProps {
  eventId: string;
}

const formSchema = z.object({
  family_count: z.coerce.number().int().min(0).max(10),
  family_names: z.string().optional(),
  carpool_status: z.enum(['not_needed', 'need_ride', 'offering_ride']),
  seats_available: z.coerce.number().int().min(0).max(10).optional(),
  pickup_location: z.string().max(255).optional(),
  pickup_details: z.string().max(500).optional(),
  dietary_restrictions: z.string().max(500).optional(),
  special_requirements: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof formSchema>;

export function IVBookingForm({ eventId }: IVBookingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      family_count: 0,
      family_names: '',
      carpool_status: 'not_needed',
      seats_available: 0,
      pickup_location: '',
      pickup_details: '',
      dietary_restrictions: '',
      special_requirements: '',
      notes: '',
    },
  });

  const carpoolStatus = form.watch('carpool_status');
  const familyCount = form.watch('family_count');

  async function onSubmit(data: FormData) {
    try {
      setIsSubmitting(true);

      // Parse family names if provided
      const familyNames =
        data.family_names && data.family_names.trim()
          ? data.family_names
              .split(',')
              .map((name) => name.trim())
              .filter(Boolean)
          : null;

      // Validate family names count matches family_count
      if (data.family_count > 0 && familyNames && familyNames.length !== data.family_count) {
        toast.error(`Please provide exactly ${data.family_count} family member names`);
        return;
      }

      const formData = new FormData();
      formData.append('event_id', eventId);
      formData.append('family_count', data.family_count.toString());
      if (familyNames) {
        formData.append('family_names', JSON.stringify(familyNames));
      }
      formData.append('carpool_status', data.carpool_status);
      if (data.seats_available) {
        formData.append('seats_available', data.seats_available.toString());
      }
      if (data.pickup_location) {
        formData.append('pickup_location', data.pickup_location);
      }
      if (data.pickup_details) {
        formData.append('pickup_details', data.pickup_details);
      }
      if (data.dietary_restrictions) {
        formData.append('dietary_restrictions', data.dietary_restrictions);
      }
      if (data.special_requirements) {
        formData.append('special_requirements', data.special_requirements);
      }
      if (data.notes) {
        formData.append('notes', data.notes);
      }

      const result = await createIVBooking(formData);

      if (result.success) {
        toast.success(result.message || 'Booking confirmed successfully!');
        router.push('/industrial-visits/my-bookings');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to create booking');
      }
    } catch (error: any) {
      toast.error(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
        {/* Family Members */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Family Members</h3>
          </div>

          <FormField
            control={form.control}
            name="family_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Family Members</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="0"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  How many family members will accompany you?
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {familyCount > 0 && (
            <FormField
              control={form.control}
              name="family_names"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Family Member Names</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Doe, Jane Doe"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter {familyCount} name{familyCount > 1 ? 's' : ''}, separated by commas
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Carpool Options */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Carpool Preferences</h3>
          </div>

          <FormField
            control={form.control}
            name="carpool_status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carpool Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select carpool preference" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="not_needed">Not Needed</SelectItem>
                    <SelectItem value="need_ride">Need a Ride</SelectItem>
                    <SelectItem value="offering_ride">Offering a Ride</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Do you need or can you offer a ride?
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {carpoolStatus === 'offering_ride' && (
            <>
              <FormField
                control={form.control}
                name="seats_available"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seats Available</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        placeholder="4"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      How many seats can you offer?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pickup_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Downtown, near City Hall"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pickup_details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Details (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional details about pickup location, time, etc."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {carpoolStatus === 'need_ride' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                We'll match you with available carpool drivers after you book. You'll
                be notified via email.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Additional Information */}
        <div className="space-y-4">
          <h3 className="font-medium">Additional Information</h3>

          <FormField
            control={form.control}
            name="dietary_restrictions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dietary Restrictions (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Vegetarian, allergic to nuts, etc."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="special_requirements"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Special Requirements (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Wheelchair access, etc."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any additional notes or questions"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Booking...' : 'Confirm Booking'}
        </Button>
      </form>
    </Form>
  );
}
