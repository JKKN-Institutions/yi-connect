'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Users, Filter, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { createSegment } from '@/app/actions/communication';
import toast from 'react-hot-toast';

// Available roles for filtering
const AVAILABLE_ROLES = [
  'Super Admin',
  'National Admin',
  'Chair',
  'Co-Chair',
  'Executive Member',
  'EC Member',
  'Member',
  'Associate Member',
  'Student Member',
];

// Member status options
const MEMBER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
];

// Membership type options
const MEMBERSHIP_TYPE_OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'associate', label: 'Associate' },
  { value: 'student', label: 'Student' },
  { value: 'honorary', label: 'Honorary' },
  { value: 'lifetime', label: 'Lifetime' },
];

// Form schema
const segmentFormSchema = z.object({
  name: z.string()
    .min(3, 'Segment name must be at least 3 characters')
    .max(200, 'Segment name must not exceed 200 characters'),
  description: z.string().max(1000).optional(),
  filter_rules: z.object({
    roles: z.array(z.string()).optional(),
    engagement: z.object({
      min: z.number().min(0).max(100).optional(),
      max: z.number().min(0).max(100).optional(),
    }).optional(),
    leadership_readiness: z.object({
      min: z.number().min(0).max(100).optional(),
      max: z.number().min(0).max(100).optional(),
    }).optional(),
    member_status: z.array(z.string()).optional(),
    membership_type: z.array(z.string()).optional(),
  }),
});

type SegmentFormValues = z.infer<typeof segmentFormSchema>;

interface SegmentFormProps {
  initialData?: {
    id: string;
    name: string;
    description?: string;
    filter_rules: {
      roles?: string[];
      engagement?: { min?: number; max?: number };
      leadership_readiness?: { min?: number; max?: number };
      member_status?: string[];
      membership_type?: string[];
    };
  };
}

export function SegmentForm({ initialData }: SegmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [engagementRange, setEngagementRange] = useState<[number, number]>(
    initialData?.filter_rules?.engagement
      ? [initialData.filter_rules.engagement.min ?? 0, initialData.filter_rules.engagement.max ?? 100]
      : [0, 100]
  );
  const [leadershipRange, setLeadershipRange] = useState<[number, number]>(
    initialData?.filter_rules?.leadership_readiness
      ? [initialData.filter_rules.leadership_readiness.min ?? 0, initialData.filter_rules.leadership_readiness.max ?? 100]
      : [0, 100]
  );
  const [useEngagementFilter, setUseEngagementFilter] = useState(
    !!initialData?.filter_rules?.engagement
  );
  const [useLeadershipFilter, setUseLeadershipFilter] = useState(
    !!initialData?.filter_rules?.leadership_readiness
  );

  const form = useForm<SegmentFormValues>({
    resolver: zodResolver(segmentFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      filter_rules: {
        roles: initialData?.filter_rules?.roles || [],
        member_status: initialData?.filter_rules?.member_status || [],
        membership_type: initialData?.filter_rules?.membership_type || [],
      },
    },
  });

  const selectedRoles = form.watch('filter_rules.roles') || [];
  const selectedStatus = form.watch('filter_rules.member_status') || [];
  const selectedMembershipType = form.watch('filter_rules.membership_type') || [];

  async function onSubmit(data: SegmentFormValues) {
    startTransition(async () => {
      try {
        // Build filter rules
        const filterRules: any = {};

        if (data.filter_rules.roles && data.filter_rules.roles.length > 0) {
          filterRules.roles = data.filter_rules.roles;
        }

        if (useEngagementFilter) {
          filterRules.engagement = {
            min: engagementRange[0],
            max: engagementRange[1],
          };
        }

        if (useLeadershipFilter) {
          filterRules.leadership_readiness = {
            min: leadershipRange[0],
            max: leadershipRange[1],
          };
        }

        if (data.filter_rules.member_status && data.filter_rules.member_status.length > 0) {
          filterRules.member_status = data.filter_rules.member_status;
        }

        if (data.filter_rules.membership_type && data.filter_rules.membership_type.length > 0) {
          filterRules.membership_type = data.filter_rules.membership_type;
        }

        const result = await createSegment({
          name: data.name,
          description: data.description,
          filter_rules: filterRules,
        });

        if (result.success) {
          toast.success(result.message);
          router.push('/communications/segments');
        } else {
          toast.error(result.error || result.message);
        }
      } catch (error) {
        console.error('Error creating segment:', error);
        toast.error('An unexpected error occurred');
      }
    });
  }

  const toggleRole = (role: string) => {
    const current = form.getValues('filter_rules.roles') || [];
    const newRoles = current.includes(role)
      ? current.filter(r => r !== role)
      : [...current, role];
    form.setValue('filter_rules.roles', newRoles);
  };

  const toggleStatus = (status: string) => {
    const current = form.getValues('filter_rules.member_status') || [];
    const newStatus = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    form.setValue('filter_rules.member_status', newStatus);
  };

  const toggleMembershipType = (type: string) => {
    const current = form.getValues('filter_rules.membership_type') || [];
    const newTypes = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    form.setValue('filter_rules.membership_type', newTypes);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Segment Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Active EC Members" {...field} />
                </FormControl>
                <FormDescription>
                  A descriptive name to identify this segment
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
                    placeholder="Describe the purpose of this segment..."
                    className="resize-none"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Filter Rules */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Filter Rules</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Define criteria to filter members. Leave empty to include all members.
          </p>

          <Accordion type="multiple" defaultValue={['roles']} className="w-full">
            {/* Roles Filter */}
            <AccordionItem value="roles">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Roles</span>
                  {selectedRoles.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedRoles.length} selected
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {AVAILABLE_ROLES.map((role) => (
                    <div
                      key={role}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`role-${role}`}
                        checked={selectedRoles.includes(role)}
                        onCheckedChange={() => toggleRole(role)}
                      />
                      <Label
                        htmlFor={`role-${role}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {role}
                      </Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Engagement Score Filter */}
            <AccordionItem value="engagement">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4" />
                  <span>Engagement Score</span>
                  {useEngagementFilter && (
                    <Badge variant="secondary" className="ml-2">
                      {engagementRange[0]}% - {engagementRange[1]}%
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="use-engagement"
                      checked={useEngagementFilter}
                      onCheckedChange={(checked) => setUseEngagementFilter(!!checked)}
                    />
                    <Label htmlFor="use-engagement" className="text-sm font-normal cursor-pointer">
                      Filter by engagement score
                    </Label>
                  </div>

                  {useEngagementFilter && (
                    <div className="space-y-4 px-2">
                      <Slider
                        value={engagementRange}
                        onValueChange={(value) => setEngagementRange(value as [number, number])}
                        min={0}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Min: {engagementRange[0]}%</span>
                        <span>Max: {engagementRange[1]}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Leadership Readiness Filter */}
            <AccordionItem value="leadership">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4" />
                  <span>Leadership Readiness</span>
                  {useLeadershipFilter && (
                    <Badge variant="secondary" className="ml-2">
                      {leadershipRange[0]}% - {leadershipRange[1]}%
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="use-leadership"
                      checked={useLeadershipFilter}
                      onCheckedChange={(checked) => setUseLeadershipFilter(!!checked)}
                    />
                    <Label htmlFor="use-leadership" className="text-sm font-normal cursor-pointer">
                      Filter by leadership readiness score
                    </Label>
                  </div>

                  {useLeadershipFilter && (
                    <div className="space-y-4 px-2">
                      <Slider
                        value={leadershipRange}
                        onValueChange={(value) => setLeadershipRange(value as [number, number])}
                        min={0}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Min: {leadershipRange[0]}%</span>
                        <span>Max: {leadershipRange[1]}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Member Status Filter */}
            <AccordionItem value="status">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Member Status</span>
                  {selectedStatus.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedStatus.length} selected
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {MEMBER_STATUS_OPTIONS.map((status) => (
                    <div
                      key={status.value}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`status-${status.value}`}
                        checked={selectedStatus.includes(status.value)}
                        onCheckedChange={() => toggleStatus(status.value)}
                      />
                      <Label
                        htmlFor={`status-${status.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {status.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Membership Type Filter */}
            <AccordionItem value="membership">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Membership Type</span>
                  {selectedMembershipType.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedMembershipType.length} selected
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {MEMBERSHIP_TYPE_OPTIONS.map((type) => (
                    <div
                      key={type.value}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`membership-${type.value}`}
                        checked={selectedMembershipType.includes(type.value)}
                        onCheckedChange={() => toggleMembershipType(type.value)}
                      />
                      <Label
                        htmlFor={`membership-${type.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/communications/segments')}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? 'Update Segment' : 'Create Segment'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
