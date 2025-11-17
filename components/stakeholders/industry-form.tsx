/**
 * Industry Form Component
 *
 * Form for creating and editing industry stakeholder records
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { createIndustry } from '@/app/actions/stakeholder';
import { industryFormSchema } from '@/lib/validations/stakeholder';
import { z } from 'zod';

type IndustryFormInput = z.infer<typeof industryFormSchema>;

interface IndustryFormProps {
  chapterId: string | null; // Allow null for super admins
  initialData?: Partial<IndustryFormInput>;
  mode?: 'create' | 'edit';
}

export function IndustryForm({
  chapterId,
  initialData,
  mode = 'create'
}: IndustryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [csrFocusArea, setCsrFocusArea] = useState('');
  const [collaborationInterest, setCollaborationInterest] = useState('');
  const [availableResource, setAvailableResource] = useState('');

  const form = useForm<IndustryFormInput>({
    resolver: zodResolver(industryFormSchema) as any,
    defaultValues: initialData || {
      organization_name: '',
      industry_sector: 'manufacturing',
      status: 'prospective',
      city: '',
      state: '',
      connection_type: 'direct',
      has_csr_program: false,
      can_provide_internships: false,
      can_provide_mentorship: false,
      csr_focus_areas: [],
      collaboration_interests: [],
      available_resources: []
    }
  });

  const onSubmit = async (data: IndustryFormInput) => {
    startTransition(async () => {
      try {
        const formData = new FormData();

        // Basic Information
        formData.append('chapter_id', chapterId || '');
        formData.append('organization_name', data.organization_name);
        formData.append('industry_sector', data.industry_sector);
        if (data.status) formData.append('status', data.status);

        // Address
        if (data.address_line1)
          formData.append('address_line1', data.address_line1);
        if (data.address_line2)
          formData.append('address_line2', data.address_line2);
        if (data.city) formData.append('city', data.city);
        if (data.state) formData.append('state', data.state);
        if (data.pincode) formData.append('pincode', data.pincode);
        if (data.website) formData.append('website', data.website);

        // Connection
        if (data.connection_type)
          formData.append('connection_type', data.connection_type);
        if (data.connected_through_member_id)
          formData.append(
            'connected_through_member_id',
            data.connected_through_member_id
          );

        // Organization Profile
        if (data.organization_size)
          formData.append('organization_size', data.organization_size);
        if (data.employee_count)
          formData.append('employee_count', String(data.employee_count));
        if (data.annual_turnover)
          formData.append('annual_turnover', data.annual_turnover);

        // CSR & Sponsorship
        formData.append(
          'has_csr_program',
          String(data.has_csr_program || false)
        );
        if (data.csr_budget_range)
          formData.append('csr_budget_range', data.csr_budget_range);
        if (data.csr_focus_areas && data.csr_focus_areas.length > 0) {
          formData.append(
            'csr_focus_areas',
            JSON.stringify(data.csr_focus_areas)
          );
        }
        if (data.sponsorship_potential)
          formData.append('sponsorship_potential', data.sponsorship_potential);

        // Collaboration
        if (
          data.collaboration_interests &&
          data.collaboration_interests.length > 0
        ) {
          formData.append(
            'collaboration_interests',
            JSON.stringify(data.collaboration_interests)
          );
        }
        if (data.available_resources && data.available_resources.length > 0) {
          formData.append(
            'available_resources',
            JSON.stringify(data.available_resources)
          );
        }
        formData.append(
          'can_provide_internships',
          String(data.can_provide_internships || false)
        );
        formData.append(
          'can_provide_mentorship',
          String(data.can_provide_mentorship || false)
        );

        // Operational
        if (data.decision_maker)
          formData.append('decision_maker', data.decision_maker);
        if (data.procurement_process)
          formData.append('procurement_process', data.procurement_process);
        if (data.lead_time_required)
          formData.append('lead_time_required', data.lead_time_required);

        // Additional
        if (data.notes) formData.append('notes', data.notes);

        const result = await createIndustry(
          { message: '', success: false },
          formData
        );

        if (result.success) {
          toast.success('Industry created successfully');
          router.push('/stakeholders/industries');
          router.refresh();
        } else {
          toast.error(
            result.errors?.organization_name?.[0] ||
              result.errors?.industry_sector?.[0] ||
              result.errors?.status?.[0] ||
              'Failed to create industry'
          );
        }
      } catch (error) {
        toast.error('An unexpected error occurred');
        console.error('Form submission error:', error);
      }
    });
  };

  const addCsrFocusArea = () => {
    if (csrFocusArea.trim()) {
      const current = form.getValues('csr_focus_areas') || [];
      if (!current.includes(csrFocusArea.trim())) {
        form.setValue('csr_focus_areas', [...current, csrFocusArea.trim()]);
        setCsrFocusArea('');
      }
    }
  };

  const removeCsrFocusArea = (area: string) => {
    const current = form.getValues('csr_focus_areas') || [];
    form.setValue(
      'csr_focus_areas',
      current.filter((a) => a !== area)
    );
  };

  const addCollaborationInterest = () => {
    if (collaborationInterest.trim()) {
      const current = form.getValues('collaboration_interests') || [];
      if (!current.includes(collaborationInterest.trim())) {
        form.setValue('collaboration_interests', [
          ...current,
          collaborationInterest.trim()
        ]);
        setCollaborationInterest('');
      }
    }
  };

  const removeCollaborationInterest = (interest: string) => {
    const current = form.getValues('collaboration_interests') || [];
    form.setValue(
      'collaboration_interests',
      current.filter((i) => i !== interest)
    );
  };

  const addAvailableResource = () => {
    if (availableResource.trim()) {
      const current = form.getValues('available_resources') || [];
      if (!current.includes(availableResource.trim())) {
        form.setValue('available_resources', [
          ...current,
          availableResource.trim()
        ]);
        setAvailableResource('');
      }
    }
  };

  const removeAvailableResource = (resource: string) => {
    const current = form.getValues('available_resources') || [];
    form.setValue(
      'available_resources',
      current.filter((r) => r !== resource)
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        {/* Basic Information */}
        <div className='space-y-4'>
          <div>
            <h3 className='text-lg font-medium'>Basic Information</h3>
            <p className='text-sm text-muted-foreground'>
              Organization details and classification
            </p>
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='organization_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name *</FormLabel>
                  <FormControl>
                    <Input placeholder='Enter organization name' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='industry_sector'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry Sector *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select industry sector' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='manufacturing'>
                        Manufacturing
                      </SelectItem>
                      <SelectItem value='it_software'>IT & Software</SelectItem>
                      <SelectItem value='healthcare'>Healthcare</SelectItem>
                      <SelectItem value='education'>Education</SelectItem>
                      <SelectItem value='finance'>Finance</SelectItem>
                      <SelectItem value='retail'>Retail</SelectItem>
                      <SelectItem value='hospitality'>Hospitality</SelectItem>
                      <SelectItem value='automotive'>Automotive</SelectItem>
                      <SelectItem value='construction'>Construction</SelectItem>
                      <SelectItem value='agriculture'>Agriculture</SelectItem>
                      <SelectItem value='textiles'>Textiles</SelectItem>
                      <SelectItem value='pharma'>Pharmaceutical</SelectItem>
                      <SelectItem value='other'>Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='status'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select status' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='active'>Active</SelectItem>
                      <SelectItem value='prospective'>Prospective</SelectItem>
                      <SelectItem value='inactive'>Inactive</SelectItem>
                      <SelectItem value='dormant'>Dormant</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='website'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder='https://example.com' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Address */}
        <div className='space-y-4'>
          <div>
            <h3 className='text-lg font-medium'>Address</h3>
            <p className='text-sm text-muted-foreground'>
              Organization location details
            </p>
          </div>
          <div className='grid gap-4'>
            <FormField
              control={form.control}
              name='address_line1'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input placeholder='Street address' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='address_line2'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl>
                    <Input placeholder='Apartment, suite, etc.' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid gap-4 md:grid-cols-3'>
              <FormField
                control={form.control}
                name='city'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder='City' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='state'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State *</FormLabel>
                    <FormControl>
                      <Input placeholder='State' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='pincode'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pincode</FormLabel>
                    <FormControl>
                      <Input placeholder='Pincode' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Organization Profile */}
        <div className='space-y-4'>
          <div>
            <h3 className='text-lg font-medium'>Organization Profile</h3>
            <p className='text-sm text-muted-foreground'>
              Size and operational information
            </p>
          </div>
          <div className='grid gap-4 md:grid-cols-3'>
            <FormField
              control={form.control}
              name='organization_size'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Size</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select size' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='startup'>Startup (1-10)</SelectItem>
                      <SelectItem value='small'>Small (11-50)</SelectItem>
                      <SelectItem value='medium'>Medium (51-250)</SelectItem>
                      <SelectItem value='large'>Large (251-1000)</SelectItem>
                      <SelectItem value='enterprise'>
                        Enterprise (1000+)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='employee_count'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee Count</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      placeholder='Number of employees'
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='annual_turnover'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Annual Turnover</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g., ₹50 Cr - ₹100 Cr' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* CSR & Sponsorship */}
        <div className='space-y-4'>
          <div>
            <h3 className='text-lg font-medium'>CSR & Sponsorship</h3>
            <p className='text-sm text-muted-foreground'>
              Corporate social responsibility and sponsorship details
            </p>
          </div>

          <FormField
            control={form.control}
            name='has_csr_program'
            render={({ field }) => (
              <FormItem className='flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className='space-y-1 leading-none'>
                  <FormLabel>Has CSR Program</FormLabel>
                  <FormDescription>
                    Check if this organization has a Corporate Social
                    Responsibility program
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <div className='grid gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='csr_budget_range'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CSR Budget Range</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g., ₹10L - ₹50L' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='sponsorship_potential'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sponsorship Potential</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select potential' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='low'>Low</SelectItem>
                      <SelectItem value='medium'>Medium</SelectItem>
                      <SelectItem value='high'>High</SelectItem>
                      <SelectItem value='very_high'>Very High</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='csr_focus_areas'
            render={({ field }) => (
              <FormItem>
                <FormLabel>CSR Focus Areas</FormLabel>
                <div className='flex gap-2'>
                  <Input
                    placeholder='Add focus area (e.g., Education, Health)'
                    value={csrFocusArea}
                    onChange={(e) => setCsrFocusArea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCsrFocusArea();
                      }
                    }}
                  />
                  <Button
                    type='button'
                    onClick={addCsrFocusArea}
                    variant='secondary'
                  >
                    Add
                  </Button>
                </div>
                {field.value && field.value.length > 0 && (
                  <div className='flex flex-wrap gap-2 mt-2'>
                    {field.value.map((area) => (
                      <div
                        key={area}
                        className='bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm flex items-center gap-2'
                      >
                        {area}
                        <button
                          type='button'
                          onClick={() => removeCsrFocusArea(area)}
                          className='hover:text-destructive'
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Collaboration */}
        <div className='space-y-4'>
          <div>
            <h3 className='text-lg font-medium'>Collaboration Opportunities</h3>
            <p className='text-sm text-muted-foreground'>
              Potential partnership and collaboration areas
            </p>
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='can_provide_internships'
              render={({ field }) => (
                <FormItem className='flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className='space-y-1 leading-none'>
                    <FormLabel>Can Provide Internships</FormLabel>
                    <FormDescription>
                      Organization offers internship opportunities
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='can_provide_mentorship'
              render={({ field }) => (
                <FormItem className='flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className='space-y-1 leading-none'>
                    <FormLabel>Can Provide Mentorship</FormLabel>
                    <FormDescription>
                      Organization offers mentorship programs
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='collaboration_interests'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Collaboration Interests</FormLabel>
                <div className='flex gap-2'>
                  <Input
                    placeholder='Add collaboration area (e.g., Joint Events, Training)'
                    value={collaborationInterest}
                    onChange={(e) => setCollaborationInterest(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCollaborationInterest();
                      }
                    }}
                  />
                  <Button
                    type='button'
                    onClick={addCollaborationInterest}
                    variant='secondary'
                  >
                    Add
                  </Button>
                </div>
                {field.value && field.value.length > 0 && (
                  <div className='flex flex-wrap gap-2 mt-2'>
                    {field.value.map((interest) => (
                      <div
                        key={interest}
                        className='bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm flex items-center gap-2'
                      >
                        {interest}
                        <button
                          type='button'
                          onClick={() => removeCollaborationInterest(interest)}
                          className='hover:text-destructive'
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='available_resources'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Available Resources</FormLabel>
                <div className='flex gap-2'>
                  <Input
                    placeholder='Add resource (e.g., Conference Hall, Equipment)'
                    value={availableResource}
                    onChange={(e) => setAvailableResource(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addAvailableResource();
                      }
                    }}
                  />
                  <Button
                    type='button'
                    onClick={addAvailableResource}
                    variant='secondary'
                  >
                    Add
                  </Button>
                </div>
                {field.value && field.value.length > 0 && (
                  <div className='flex flex-wrap gap-2 mt-2'>
                    {field.value.map((resource) => (
                      <div
                        key={resource}
                        className='bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm flex items-center gap-2'
                      >
                        {resource}
                        <button
                          type='button'
                          onClick={() => removeAvailableResource(resource)}
                          className='hover:text-destructive'
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Connection & Operational Details */}
        <div className='space-y-4'>
          <div>
            <h3 className='text-lg font-medium'>
              Connection & Operational Details
            </h3>
            <p className='text-sm text-muted-foreground'>
              How to connect and work with this organization
            </p>
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='connection_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select connection type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='direct'>Direct</SelectItem>
                      <SelectItem value='referred'>Referred</SelectItem>
                      <SelectItem value='cold'>Cold Contact</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='decision_maker'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decision Maker</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Name/Role of decision maker'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='procurement_process'
              render={({ field }) => (
                <FormItem className='md:col-span-2'>
                  <FormLabel>Procurement Process</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Describe the procurement or decision-making process'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='lead_time_required'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Time Required</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g., 2 weeks, 1 month' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Additional Notes */}
        <div className='space-y-4'>
          <div>
            <h3 className='text-lg font-medium'>Additional Notes</h3>
            <p className='text-sm text-muted-foreground'>
              Any other relevant information
            </p>
          </div>
          <FormField
            control={form.control}
            name='notes'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Additional information, observations, or requirements'
                    className='min-h-[100px]'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='flex gap-4'>
          <Button type='submit' disabled={isPending}>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {mode === 'create' ? 'Create Industry' : 'Update Industry'}
          </Button>
          <Button
            type='button'
            variant='outline'
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
