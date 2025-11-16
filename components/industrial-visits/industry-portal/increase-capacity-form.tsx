/**
 * Increase Capacity Form (Industry Portal)
 * Form for industries to increase slot capacity
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Users, TrendingUp, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { industryIncreaseCapacity } from '@/app/actions/industrial-visits';

const formSchema = z.object({
  new_capacity: z.coerce
    .number()
    .int()
    .positive('Capacity must be a positive number'),
});

type FormData = z.infer<typeof formSchema>;

interface IncreaseCapacityFormProps {
  slotId: string;
  currentCapacity: number;
  currentRegistrations: number;
}

export function IncreaseCapacityForm({
  slotId,
  currentCapacity,
  currentRegistrations,
}: IncreaseCapacityFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      new_capacity: currentCapacity + 10,
    },
  });

  const newCapacity = form.watch('new_capacity');
  const capacityIncrease = newCapacity - currentCapacity;
  const newSpotsAvailable = newCapacity - currentRegistrations;
  const utilizationPercentage = Math.round(
    (currentRegistrations / newCapacity) * 100
  );

  async function onSubmit(data: FormData) {
    try {
      // Validate new capacity is greater than current
      if (data.new_capacity <= currentCapacity) {
        toast.error(
          `New capacity must be greater than current capacity (${currentCapacity})`
        );
        return;
      }

      // Validate new capacity is at least current registrations
      if (data.new_capacity < currentRegistrations) {
        toast.error(
          `New capacity must be at least ${currentRegistrations} (current registrations)`
        );
        return;
      }

      setIsSubmitting(true);

      const result = await industryIncreaseCapacity(slotId, data.new_capacity);

      if (result.success) {
        toast.success(
          result.message || 'Capacity increased successfully!'
        );
        router.push('/industry-portal/slots');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to increase capacity');
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
        {/* Current Status */}
        <div className="space-y-3 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Capacity</span>
            <span className="text-2xl font-bold">{currentCapacity}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Current Registrations
            </span>
            <span className="text-sm font-medium">{currentRegistrations}</span>
          </div>
          <Progress
            value={(currentRegistrations / currentCapacity) * 100}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            Your slot is currently at {Math.round((currentRegistrations / currentCapacity) * 100)}% capacity
          </p>
        </div>

        {/* Alert for Waitlist */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Waitlist Members</AlertTitle>
          <AlertDescription>
            If there are members on the waitlist, they will be automatically promoted
            when you increase capacity.
          </AlertDescription>
        </Alert>

        {/* New Capacity Input */}
        <FormField
          control={form.control}
          name="new_capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Capacity *</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={currentRegistrations}
                    placeholder={`Minimum: ${currentRegistrations}`}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormDescription>
                Must be greater than current capacity ({currentCapacity}) and at least
                equal to current registrations ({currentRegistrations})
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Preview */}
        {newCapacity > currentCapacity && (
          <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-4 w-4" />
              <span className="font-semibold">Preview New Capacity</span>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">New Total Capacity</span>
                <span className="font-medium">{newCapacity}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Capacity Increase</span>
                <span className="font-medium text-primary">
                  +{capacityIncrease}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">New Spots Available</span>
                <span className="font-medium text-green-600">
                  {newSpotsAvailable}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">New Utilization</span>
                <span className="font-medium">{utilizationPercentage}%</span>
              </div>
            </div>

            <Progress value={utilizationPercentage} className="h-2" />
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Increasing Capacity...' : 'Increase Capacity'}
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
