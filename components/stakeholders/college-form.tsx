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
import { collegeFormSchema } from '@/lib/validations/stakeholder';
import { createCollege } from '@/app/actions/stakeholder';
import toast from 'react-hot-toast';

type CollegeFormValues = z.infer<typeof collegeFormSchema>;

interface CollegeFormProps {
  chapterId: string | null;
}

const collegeTypes = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'arts_science', label: 'Arts & Science' },
  { value: 'medical', label: 'Medical' },
  { value: 'management', label: 'Management' },
  { value: 'polytechnic', label: 'Polytechnic' },
  { value: 'other', label: 'Other' }
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

const departmentOptions = [
  'Computer Science',
  'Electronics',
  'Mechanical',
  'Civil',
  'Electrical',
  'Information Technology',
  'Business Administration',
  'Commerce',
  'Physics',
  'Chemistry',
  'Mathematics',
  'English',
  'Tamil'
];

const accreditationOptions = [
  'NAAC A+',
  'NAAC A',
  'NAAC B+',
  'NAAC B',
  'NBA',
  'NIRF Ranked',
  'Autonomous'
];

const activityOptions = [
  'Industrial Visits',
  'Guest Lectures',
  'Workshops',
  'Entrepreneurship Programs',
  'Skill Development',
  'Cultural Events',
  'Technical Fests',
  'Internships'
];

const resourceOptions = [
  'Auditorium',
  'Smart Classrooms',
  'Labs',
  'Library',
  'Sports Facilities',
  'Hostel',
  'Wi-Fi Campus',
  'Transport'
];

export function CollegeForm({ chapterId }: CollegeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedAccreditation, setSelectedAccreditation] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const router = useRouter();

  const form = useForm<CollegeFormValues>({
    resolver: zodResolver(collegeFormSchema) as any,
    defaultValues: {
      college_name: '',
      college_type: 'engineering',
      status: 'prospective',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      connection_type: undefined,
      connected_through_member_id: '',
      total_students: undefined,
      total_staff: undefined,
      departments: [],
      accreditation: [],
      university_affiliation: '',
      has_yuva_chapter: false,
      yuva_chapter_strength: undefined,
      yuva_chapter_status: '',
      yuva_president_name: '',
      yuva_president_contact: '',
      suitable_activities: [],
      available_resources: [],
      decision_maker: '',
      decision_making_process: '',
      lead_time_required: '',
      notes: ''
    }
  });

  async function onSubmit(values: CollegeFormValues) {
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
          formData.append(key, String(value));
        }
      });

      // Add array fields
      if (values.departments) {
        values.departments.forEach((dept) => {
          formData.append('departments[]', dept);
        });
      }

      if (values.accreditation) {
        values.accreditation.forEach((acc) => {
          formData.append('accreditation[]', acc);
        });
      }

      if (values.suitable_activities) {
        values.suitable_activities.forEach((activity) => {
          formData.append('suitable_activities[]', activity);
        });
      }

      if (values.available_resources) {
        values.available_resources.forEach((resource) => {
          formData.append('available_resources[]', resource);
        });
      }

      // Add boolean fields
      formData.append('has_yuva_chapter', String(values.has_yuva_chapter));

      const result = await createCollege({}, formData);

      if (result.success) {
        toast.success('College created successfully');
        // Redirect is handled by the server action
      } else if (result.errors) {
        Object.entries(result.errors).forEach(([field, messages]) => {
          form.setError(field as any, {
            type: 'manual',
            message: messages[0]
          });
        });
        toast.error('Please check the form for errors');
      } else {
        toast.error(result.message || 'Failed to create college');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Basic Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="college_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>College Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., PSG College of Technology" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="college_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>College Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select college type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {collegeTypes.map((type) => (
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
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
              name="university_affiliation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>University Affiliation</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Anna University" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Address Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Address</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="address_line1"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input placeholder="Street address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address_line2"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl>
                    <Input placeholder="Apartment, suite, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="City" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input placeholder="State" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pincode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pincode</FormLabel>
                  <FormControl>
                    <Input placeholder="6-digit pincode" maxLength={6} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* College Profile */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">College Profile</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="total_students"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Students</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 5000"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="total_staff"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Staff</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 300"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departments"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Departments</FormLabel>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {departmentOptions.map((dept) => (
                      <div key={dept} className="flex items-center space-x-2">
                        <Checkbox
                          checked={field.value?.includes(dept)}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            if (checked) {
                              field.onChange([...current, dept]);
                            } else {
                              field.onChange(current.filter((d) => d !== dept));
                            }
                          }}
                        />
                        <label className="text-sm">{dept}</label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accreditation"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Accreditation</FormLabel>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {accreditationOptions.map((acc) => (
                      <div key={acc} className="flex items-center space-x-2">
                        <Checkbox
                          checked={field.value?.includes(acc)}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            if (checked) {
                              field.onChange([...current, acc]);
                            } else {
                              field.onChange(current.filter((a) => a !== acc));
                            }
                          }}
                        />
                        <label className="text-sm">{acc}</label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Yuva Chapter */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Yuva Chapter</h3>

          <FormField
            control={form.control}
            name="has_yuva_chapter"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Has Yuva Chapter</FormLabel>
                  <FormDescription>
                    Check if this college has an active Yi Yuva Chapter
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {form.watch('has_yuva_chapter') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <FormField
                control={form.control}
                name="yuva_chapter_strength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chapter Strength</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Number of members"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="yuva_chapter_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chapter Status</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Active, Growing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="yuva_president_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>President Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Yuva President name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="yuva_president_contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>President Contact</FormLabel>
                    <FormControl>
                      <Input placeholder="10-digit phone number" maxLength={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        {/* Collaboration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Collaboration Opportunities</h3>

          <FormField
            control={form.control}
            name="suitable_activities"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Suitable Activities</FormLabel>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {activityOptions.map((activity) => (
                    <div key={activity} className="flex items-center space-x-2">
                      <Checkbox
                        checked={field.value?.includes(activity)}
                        onCheckedChange={(checked) => {
                          const current = field.value || [];
                          if (checked) {
                            field.onChange([...current, activity]);
                          } else {
                            field.onChange(current.filter((a) => a !== activity));
                          }
                        }}
                      />
                      <label className="text-sm">{activity}</label>
                    </div>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="available_resources"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Available Resources</FormLabel>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {resourceOptions.map((resource) => (
                    <div key={resource} className="flex items-center space-x-2">
                      <Checkbox
                        checked={field.value?.includes(resource)}
                        onCheckedChange={(checked) => {
                          const current = field.value || [];
                          if (checked) {
                            field.onChange([...current, resource]);
                          } else {
                            field.onChange(current.filter((r) => r !== resource));
                          }
                        }}
                      />
                      <label className="text-sm">{resource}</label>
                    </div>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Connection & Operational */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Connection & Operational Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="connection_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="How are we connected?" />
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
              name="decision_maker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decision Maker</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Principal, Dean" {...field} />
                  </FormControl>
                  <FormDescription>Who makes decisions about collaborations?</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="decision_making_process"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decision Making Process</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe approval process..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lead_time_required"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Time Required</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 2 weeks, 1 month" {...field} />
                  </FormControl>
                  <FormDescription>How much advance notice is needed?</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional information about this college..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Creating...' : 'Create College'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
