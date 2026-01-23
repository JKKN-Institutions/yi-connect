'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';

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
import { schoolFormSchema } from '@/lib/validations/stakeholder';
import { createSchool, updateSchool } from '@/app/actions/stakeholder';
import toast from 'react-hot-toast';

type SchoolFormValues = z.infer<typeof schoolFormSchema>;

interface SchoolFormProps {
  chapterId: string | null; // Allow null for super admins
  initialData?: Partial<SchoolFormValues> & { id?: string };
  mode?: 'create' | 'edit';
}

const schoolTypes = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'high_school', label: 'High School' },
  { value: 'cbse', label: 'CBSE' },
  { value: 'state_board', label: 'State Board' },
  { value: 'matric', label: 'Matriculation' },
  { value: 'icse', label: 'ICSE' },
  { value: 'international', label: 'International' }
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'prospective', label: 'Prospective' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'dormant', label: 'Dormant' }
];

const connectionTypeOptions = [
  { value: 'direct', label: 'Direct' },
  { value: 'through_member', label: 'Through Member' },
  { value: 'through_ngo', label: 'Through NGO' },
  { value: 'cold', label: 'Cold' },
  { value: 'referral', label: 'Referral' }
];

const schoolCategoryOptions = [
  { value: 'co_ed', label: 'Co-ed' },
  { value: 'boys', label: 'Boys Only' },
  { value: 'girls', label: 'Girls Only' }
];

const managementTypeOptions = [
  { value: 'government', label: 'Government' },
  { value: 'private', label: 'Private' },
  { value: 'aided', label: 'Government Aided' },
  { value: 'autonomous', label: 'Autonomous' }
];

const mediumOptions = [
  'English',
  'Tamil',
  'Hindi',
  'Telugu',
  'Kannada',
  'Malayalam'
];
const suitableProgramOptions = [
  'Yi Power',
  'Career Guidance',
  'Skill Development',
  'Entrepreneurship',
  'Environment',
  'Health & Hygiene',
  'Sports'
];

export function SchoolForm({ chapterId, initialData, mode = 'create' }: SchoolFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMedium, setSelectedMedium] = useState<string[]>(
    initialData?.medium || []
  );
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(
    initialData?.suitable_programs || []
  );
  const router = useRouter();
  const isEditing = mode === 'edit';

  const form = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolFormSchema) as any,
    defaultValues: {
      school_name: initialData?.school_name || '',
      school_type: initialData?.school_type || 'cbse',
      status: initialData?.status || 'prospective',
      address_line1: initialData?.address_line1 || '',
      address_line2: initialData?.address_line2 || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      pincode: initialData?.pincode || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      website: initialData?.website || '',
      connection_type: initialData?.connection_type || undefined,
      connected_through_member_id: initialData?.connected_through_member_id || '',
      connection_notes: initialData?.connection_notes || '',
      total_students: initialData?.total_students || undefined,
      grade_range: initialData?.grade_range || '',
      medium: initialData?.medium || [],
      school_category: initialData?.school_category || '',
      management_type: initialData?.management_type || '',
      suitable_programs: initialData?.suitable_programs || [],
      has_auditorium: initialData?.has_auditorium || false,
      has_smart_class: initialData?.has_smart_class || false,
      has_ground: initialData?.has_ground || false,
      has_parking: initialData?.has_parking || false,
      has_library: initialData?.has_library || false,
      facility_notes: initialData?.facility_notes || '',
      best_time_to_approach: initialData?.best_time_to_approach || '',
      decision_maker: initialData?.decision_maker || '',
      lead_time_required: initialData?.lead_time_required || '',
      notes: initialData?.notes || ''
    }
  });

  async function onSubmit(values: SchoolFormValues) {
    setIsSubmitting(true);

    try {
      const formData = new FormData();

      // Add regular fields
      Object.entries(values).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          !Array.isArray(value) &&
          typeof value !== 'boolean'
        ) {
          formData.append(key, value.toString());
        }
      });

      // Add array fields
      selectedMedium.forEach((medium) => {
        formData.append('medium[]', medium);
      });
      selectedPrograms.forEach((program) => {
        formData.append('suitable_programs[]', program);
      });

      // Add boolean fields
      formData.append(
        'has_auditorium',
        values.has_auditorium ? 'true' : 'false'
      );
      formData.append(
        'has_smart_class',
        values.has_smart_class ? 'true' : 'false'
      );
      formData.append('has_ground', values.has_ground ? 'true' : 'false');
      formData.append('has_parking', values.has_parking ? 'true' : 'false');
      formData.append('has_library', values.has_library ? 'true' : 'false');

      let result;
      if (isEditing && initialData?.id) {
        result = await updateSchool(
          initialData.id,
          { message: '', success: false },
          formData
        );
      } else {
        result = await createSchool(
          { message: '', success: false },
          formData
        );
      }

      if (result.success) {
        toast.success(isEditing ? 'School updated successfully' : 'School created successfully');
        // Redirect will be handled by the server action
      } else {
        toast.error(result.message || `Failed to ${isEditing ? 'update' : 'create'} school`);

        // Show field errors if any
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            form.setError(field as any, {
              type: 'manual',
              message: Array.isArray(messages) ? messages[0] : messages
            });
          });
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleMedium = (medium: string) => {
    setSelectedMedium((prev) =>
      prev.includes(medium)
        ? prev.filter((m) => m !== medium)
        : [...prev, medium]
    );
  };

  const toggleProgram = (program: string) => {
    setSelectedPrograms((prev) =>
      prev.includes(program)
        ? prev.filter((p) => p !== program)
        : [...prev, program]
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        {/* Basic Information */}
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold'>Basic Information</h3>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='school_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Enter school name'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='school_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Select school type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schoolTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Select status' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
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
              name='total_students'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Students</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      placeholder='e.g., 500'
                      {...field}
                      value={field.value || ''}
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
          </div>

          <FormField
            control={form.control}
            name='grade_range'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grade Range</FormLabel>
                <FormControl>
                  <Input
                    placeholder='e.g., 1-12, LKG-UKG'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  Enter the range of grades/classes (e.g., &quot;1-10&quot; or
                  &quot;LKG-12&quot;)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Address */}
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold'>Address</h3>

          <FormField
            control={form.control}
            name='address_line1'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1</FormLabel>
                <FormControl>
                  <Input
                    placeholder='Street address'
                    {...field}
                    value={field.value || ''}
                  />
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
                  <Input
                    placeholder='Area, landmark'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <FormField
              control={form.control}
              name='city'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='City'
                      {...field}
                      value={field.value || ''}
                    />
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
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='State'
                      {...field}
                      value={field.value || ''}
                    />
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
                    <Input
                      placeholder='6-digit pincode'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold'>Contact Information</h3>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <FormField
              control={form.control}
              name='phone'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='10-digit phone'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='school@example.com'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
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
                    <Input
                      placeholder='https://...'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Connection/Relationship */}
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold'>Connection & Relationship</h3>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='connection_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How Connected</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Select connection type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {connectionTypeOptions.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
              name='connection_notes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Notes</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Details about the connection'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* School Profile */}
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold'>School Profile</h3>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='school_category'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Select category' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schoolCategoryOptions.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
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
              name='management_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Management Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Select management type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {managementTypeOptions.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormItem>
            <FormLabel>Medium of Instruction</FormLabel>
            <div className='flex flex-wrap gap-4'>
              {mediumOptions.map((medium) => (
                <div key={medium} className='flex items-center space-x-2'>
                  <Checkbox
                    id={`medium-${medium}`}
                    checked={selectedMedium.includes(medium)}
                    onCheckedChange={() => toggleMedium(medium)}
                  />
                  <label
                    htmlFor={`medium-${medium}`}
                    className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                  >
                    {medium}
                  </label>
                </div>
              ))}
            </div>
          </FormItem>

          <FormItem>
            <FormLabel>Suitable Yi Programs</FormLabel>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              {suitableProgramOptions.map((program) => (
                <div key={program} className='flex items-center space-x-2'>
                  <Checkbox
                    id={`program-${program}`}
                    checked={selectedPrograms.includes(program)}
                    onCheckedChange={() => toggleProgram(program)}
                  />
                  <label
                    htmlFor={`program-${program}`}
                    className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                  >
                    {program}
                  </label>
                </div>
              ))}
            </div>
          </FormItem>
        </div>

        {/* Facilities */}
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold'>Facilities</h3>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='has_auditorium'
              render={({ field }) => (
                <FormItem className='flex flex-row items-start space-x-3 space-y-0'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className='space-y-1 leading-none'>
                    <FormLabel>Has Auditorium</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='has_smart_class'
              render={({ field }) => (
                <FormItem className='flex flex-row items-start space-x-3 space-y-0'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className='space-y-1 leading-none'>
                    <FormLabel>Has Smart Class</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='has_ground'
              render={({ field }) => (
                <FormItem className='flex flex-row items-start space-x-3 space-y-0'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className='space-y-1 leading-none'>
                    <FormLabel>Has Playground/Ground</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='has_library'
              render={({ field }) => (
                <FormItem className='flex flex-row items-start space-x-3 space-y-0'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className='space-y-1 leading-none'>
                    <FormLabel>Has Library</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='has_parking'
              render={({ field }) => (
                <FormItem className='flex flex-row items-start space-x-3 space-y-0'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className='space-y-1 leading-none'>
                    <FormLabel>Has Parking</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='facility_notes'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Facility Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Additional notes about facilities...'
                    className='min-h-[80px]'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Operational Details */}
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold'>Operational Details</h3>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='decision_maker'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decision Maker</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Principal, Correspondent, etc.'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='best_time_to_approach'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Best Time to Approach</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g., Weekdays 10 AM - 12 PM'
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='lead_time_required'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead Time Required</FormLabel>
                <FormControl>
                  <Input
                    placeholder='e.g., 2 weeks, 1 month'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  How much advance notice is needed for events/programs
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='notes'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Any additional notes about the school...'
                    className='min-h-[100px]'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit Button */}
        <div className='flex justify-end gap-4'>
          <Button
            type='button'
            variant='outline'
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type='submit' disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                {isEditing ? 'Updating School...' : 'Creating School...'}
              </>
            ) : (
              isEditing ? 'Update School' : 'Create School'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
