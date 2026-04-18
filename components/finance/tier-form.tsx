'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { createSponsorshipTierSchema } from '@/lib/validations/finance';
import {
  createSponsorshipTier,
  updateSponsorshipTier,
} from '@/app/actions/finance';
import type { SponsorshipTier } from '@/types/finance';

// Shared form shape (covers create + edit)
const tierFormSchema = z.object({
  name: z.string().min(1, 'Tier name is required').max(100),
  tier_level: z.enum(['platinum', 'gold', 'silver', 'bronze', 'supporter']),
  min_amount: z.coerce.number().positive('Must be greater than 0'),
  max_amount: z.coerce.number().positive('Must be greater than 0').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  description: z.string().max(1000).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color (e.g. #FFD700)')
    .optional()
    .or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).optional(),
  benefits: z
    .array(
      z.object({
        label: z.string().min(1, 'Benefit label is required').max(200),
        included: z.boolean(),
      })
    )
    .optional(),
});

type TierFormValues = z.infer<typeof tierFormSchema>;

const TIER_LEVELS: Array<{
  value: 'platinum' | 'gold' | 'silver' | 'bronze' | 'supporter';
  label: string;
  defaultColor: string;
}> = [
  { value: 'platinum', label: 'Platinum', defaultColor: '#6366F1' },
  { value: 'gold', label: 'Gold', defaultColor: '#EAB308' },
  { value: 'silver', label: 'Silver', defaultColor: '#94A3B8' },
  { value: 'bronze', label: 'Bronze', defaultColor: '#B45309' },
  { value: 'supporter', label: 'Supporter', defaultColor: '#3B82F6' },
];

interface TierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  tier?: SponsorshipTier; // provided in edit mode
}

export function TierForm({ open, onOpenChange, chapterId, tier }: TierFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(tier);

  const defaultBenefits =
    tier?.benefits && Array.isArray(tier.benefits)
      ? (tier.benefits as Array<{ label: string; included: boolean }>)
      : [];

  const form = useForm<TierFormValues>({
    resolver: zodResolver(tierFormSchema) as any,
    defaultValues: {
      name: tier?.name ?? '',
      tier_level: (tier?.tier_level as TierFormValues['tier_level']) ?? 'gold',
      min_amount: tier ? Number(tier.min_amount) : ('' as any),
      max_amount: tier?.max_amount ? Number(tier.max_amount) : ('' as any),
      description: tier?.description ?? '',
      color: tier?.color ?? '',
      sort_order: tier?.sort_order ?? 0,
      benefits: defaultBenefits,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'benefits',
  });

  const onSubmit = (values: TierFormValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('name', values.name);
      fd.set('tier_level', values.tier_level);
      fd.set('min_amount', String(values.min_amount));
      if (values.max_amount !== undefined && values.max_amount !== null && String(values.max_amount) !== '') {
        fd.set('max_amount', String(values.max_amount));
      }
      if (values.description) fd.set('description', values.description);
      if (values.color) fd.set('color', values.color);
      if (values.sort_order !== undefined) fd.set('sort_order', String(values.sort_order));
      fd.set('benefits', JSON.stringify(values.benefits ?? []));

      let result;
      if (isEdit && tier) {
        fd.set('tier_id', tier.id);
        result = await updateSponsorshipTier(
          { message: '', success: false },
          fd
        );
      } else {
        fd.set('chapter_id', chapterId);
        result = await createSponsorshipTier(
          { message: '', success: false },
          fd
        );
      }

      if (result.success) {
        toast.success(
          isEdit ? 'Tier updated successfully' : 'Tier created successfully'
        );
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        toast.error(result.message || 'Failed to save tier');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full sm:max-w-xl overflow-y-auto'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Sponsorship Tier' : 'New Sponsorship Tier'}</SheetTitle>
          <SheetDescription>
            Configure tier thresholds, benefits and styling. Benefits display as
            a checklist on deal pages and event sponsor sections.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-5 p-4'
          >
            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem className='sm:col-span-2'>
                    <FormLabel>Tier Name *</FormLabel>
                    <FormControl>
                      <Input placeholder='e.g., Platinum Partner' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='tier_level'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level *</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        // auto-pick a default color if not set
                        const match = TIER_LEVELS.find((t) => t.value === v);
                        if (match && !form.getValues('color')) {
                          form.setValue('color', match.defaultColor);
                        }
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className='w-full'>
                          <SelectValue placeholder='Select level' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIER_LEVELS.map((lvl) => (
                          <SelectItem key={lvl.value} value={lvl.value}>
                            <span className='inline-flex items-center gap-2'>
                              <span
                                className='inline-block h-2.5 w-2.5 rounded-full'
                                style={{ backgroundColor: lvl.defaultColor }}
                              />
                              {lvl.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='sort_order'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        placeholder='0'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='min_amount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Amount (₹) *</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        step='1'
                        placeholder='50000'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='max_amount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Amount (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        step='1'
                        placeholder='Leave blank for no cap'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='color'
                render={({ field }) => (
                  <FormItem className='sm:col-span-2'>
                    <FormLabel>Color</FormLabel>
                    <div className='flex items-center gap-3'>
                      <FormControl>
                        <Input
                          type='color'
                          className='h-10 w-16 p-1'
                          value={field.value || '#000000'}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <Input
                        placeholder='#FFD700'
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        className='max-w-[180px]'
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem className='sm:col-span-2'>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Short description of this tier…'
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Benefits editor */}
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <h4 className='text-sm font-semibold'>Benefits Checklist</h4>
                  <p className='text-xs text-muted-foreground'>
                    Toggle each benefit as included or excluded to build a tier
                    comparison view.
                  </p>
                </div>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => append({ label: '', included: true })}
                >
                  <Plus className='mr-1 h-4 w-4' /> Add Benefit
                </Button>
              </div>

              {fields.length === 0 && (
                <p className='rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground'>
                  No benefits yet. Add the first benefit to build this tier.
                </p>
              )}

              <div className='space-y-2'>
                {fields.map((f, idx) => {
                  const included = form.watch(`benefits.${idx}.included`);
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        'flex items-start gap-2 rounded-md border p-2',
                        included ? 'bg-green-50/40' : 'bg-muted/30'
                      )}
                    >
                      <FormField
                        control={form.control}
                        name={`benefits.${idx}.included`}
                        render={({ field }) => (
                          <FormItem className='mt-2'>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                aria-label='Benefit included'
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <span
                        className='mt-2 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center'
                        aria-hidden
                      >
                        {included ? (
                          <Check className='h-4 w-4 text-green-600' />
                        ) : (
                          <X className='h-4 w-4 text-muted-foreground' />
                        )}
                      </span>
                      <FormField
                        control={form.control}
                        name={`benefits.${idx}.label`}
                        render={({ field }) => (
                          <FormItem className='flex-1'>
                            <FormControl>
                              <Input
                                placeholder='e.g., Logo on all event backdrops'
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        onClick={() => remove(idx)}
                        aria-label='Remove benefit'
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className='flex gap-3 pt-2'>
              <Button type='submit' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {isEdit ? 'Save Changes' : 'Create Tier'}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
