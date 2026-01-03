'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
import { createSponsorshipDealSchema } from '@/lib/validations/finance';
import { createSponsorshipDeal } from '@/app/actions/finance';
import type { SponsorshipTier } from '@/types/finance';

type SponsorshipDealFormValues = z.infer<typeof createSponsorshipDealSchema>;

const DEAL_STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'committed', label: 'Committed' },
  { value: 'contract_signed', label: 'Contract Signed' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'lost', label: 'Lost' }
] as const;

interface SponsorOption {
  id: string;
  organization_name: string;
}

interface SponsorshipDealFormProps {
  chapterId: string;
  sponsors: SponsorOption[];
  tiers: SponsorshipTier[];
}

export function SponsorshipDealForm({
  chapterId,
  sponsors,
  tiers
}: SponsorshipDealFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<SponsorshipDealFormValues>({
    resolver: zodResolver(createSponsorshipDealSchema) as any,
    defaultValues: {
      deal_name: '',
      sponsor_id: '',
      tier_id: undefined,
      proposed_amount: 0,
      deal_stage: 'prospect',
      probability_percentage: 50,
      notes: '',
      chapter_id: chapterId
    }
  });

  const onSubmit = (data: SponsorshipDealFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            formData.set(key, JSON.stringify(value));
          } else {
            formData.set(key, String(value));
          }
        }
      });

      const result = await createSponsorshipDeal({ message: '', success: false }, formData);

      if (result.success) {
        toast.success('Sponsorship deal created successfully');
        router.push('/finance/sponsorships');
      } else {
        toast.error(result.message || 'Failed to create sponsorship deal');
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="deal_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Annual Summit 2025 - Gold Sponsor" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sponsor_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sponsor *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sponsor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {sponsors.map((sponsor) => (
                      <SelectItem key={sponsor.id} value={sponsor.id}>
                        {sponsor.organization_name}
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
            name="tier_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sponsorship Tier</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {tiers.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id}>
                        {tier.name} ({tier.tier_level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>Associate with a predefined sponsorship tier</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="proposed_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proposed Amount (INR) *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    placeholder="100000"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deal_stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal Stage *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DEAL_STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
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
            name="probability_percentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Win Probability (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="50"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>Likelihood of closing this deal (0-100%)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="proposal_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proposal Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expected_closure_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expected Closure Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="calendar_year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Calendar Year</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={2020}
                    max={2100}
                    placeholder={new Date().getFullYear().toString()}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes about this sponsorship deal..."
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Deal
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
