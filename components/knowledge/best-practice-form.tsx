'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createBestPracticeSchema,
  updateBestPracticeSchema
} from '@/lib/validations/knowledge';
import {
  createBestPractice,
  updateBestPractice
} from '@/app/actions/knowledge';
import type { BestPractice } from '@/types/knowledge';
import type { FormState } from '@/types/knowledge';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface BestPracticeFormProps {
  bestPractice?: BestPractice;
  onSuccess?: () => void;
}

export function BestPracticeForm({
  bestPractice,
  onSuccess
}: BestPracticeFormProps) {
  const router = useRouter();
  const isEditing = !!bestPractice;

  const schema = isEditing
    ? updateBestPracticeSchema
    : createBestPracticeSchema;
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: bestPractice
      ? {
          title: bestPractice.title,
          description: bestPractice.description,
          full_content: bestPractice.full_content || '',
          impact_metrics: {
            beneficiaries: bestPractice.impact_metrics?.beneficiaries ?? undefined,
            cost_saved: bestPractice.impact_metrics?.cost_saved ?? undefined,
            time_saved_hours: bestPractice.impact_metrics?.time_saved_hours ?? undefined,
          }
        }
      : {
          title: '',
          description: '',
          full_content: '',
          impact_metrics: {
            beneficiaries: undefined,
            cost_saved: undefined,
            time_saved_hours: undefined,
          }
        }
  });

  const action = isEditing
    ? updateBestPractice.bind(null, bestPractice.id)
    : createBestPractice;

  const initialState: FormState = { success: false, message: '' };
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      if (state.message) toast.success(state.message);
      if (state.redirectTo) {
        router.push(state.redirectTo);
      } else if (onSuccess) {
        onSuccess();
      }
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, router, onSuccess]);

  return (
    <Form {...form}>
      <form action={formAction} className='space-y-6'>
        <FormField
          control={form.control}
          name='title'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder='e.g., Effective Volunteer Coordination Strategy'
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='description'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder='Brief overview of the best practice'
                  rows={4}
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>
                Provide a concise summary that will be shown in listings
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='full_content'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Content (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value || ''}
                  placeholder='Detailed explanation of the best practice, implementation steps, and lessons learned'
                  rows={10}
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>
                Provide comprehensive details including how to implement this
                practice
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Impact Metrics */}
        <div className='space-y-4'>
          <h3 className='text-lg font-medium'>Impact Metrics (Optional)</h3>
          <p className='text-sm text-muted-foreground'>
            Quantify the impact of this best practice
          </p>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <FormField
              control={form.control}
              name='impact_metrics.beneficiaries'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beneficiaries</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min='0'
                      placeholder='e.g., 100'
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === '' ? undefined : parseInt(val) || 0);
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>Number of people impacted</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='impact_metrics.cost_saved'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost Saved (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min='0'
                      placeholder='e.g., 5000'
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === '' ? undefined : parseFloat(val) || 0);
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>Amount saved in rupees</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='impact_metrics.time_saved_hours'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time Saved (hours)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min='0'
                      step='0.5'
                      placeholder='e.g., 20'
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === '' ? undefined : parseFloat(val) || 0);
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>Hours saved</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className='flex justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type='submit' disabled={isPending}>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isEditing ? 'Update Best Practice' : 'Create Best Practice'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
