'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { schoolFormSchema } from '@/lib/validations/stakeholder'
import { createSchool } from '@/app/actions/stakeholder'
import { useToast } from '@/hooks/use-toast'

type SchoolFormValues = z.infer<typeof schoolFormSchema>

interface SchoolFormProps {
  chapterId: string | null // Allow null for super admins
}

const schoolTypes = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'high_school', label: 'High School' },
  { value: 'cbse', label: 'CBSE' },
  { value: 'state_board', label: 'State Board' },
  { value: 'matric', label: 'Matriculation' },
  { value: 'icse', label: 'ICSE' },
  { value: 'international', label: 'International' },
]

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'prospective', label: 'Prospective' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'dormant', label: 'Dormant' },
]

const mediumOptions = ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam']
const suitableProgramOptions = [
  'Yi Power',
  'Career Guidance',
  'Skill Development',
  'Entrepreneurship',
  'Environment',
  'Health & Hygiene',
  'Sports',
]

export function SchoolForm({ chapterId }: SchoolFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedMedium, setSelectedMedium] = useState<string[]>([])
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([])
  const { toast } = useToast()
  const router = useRouter()

  const form = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolFormSchema) as any,
    defaultValues: {
      school_name: '',
      school_type: 'cbse',
      status: 'prospective',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      total_students: undefined,
      grade_range: '',
      medium: [],
      suitable_programs: [],
      has_auditorium: false,
      has_smart_class: false,
      has_ground: false,
      has_library: false,
      best_time_to_approach: '',
      decision_maker: '',
      lead_time_required: '',
      notes: '',
    },
  })

  async function onSubmit(values: SchoolFormValues) {
    setIsSubmitting(true)

    try {
      const formData = new FormData()

      // Add regular fields
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && !Array.isArray(value) && typeof value !== 'boolean') {
          formData.append(key, value.toString())
        }
      })

      // Add array fields
      selectedMedium.forEach(medium => {
        formData.append('medium[]', medium)
      })
      selectedPrograms.forEach(program => {
        formData.append('suitable_programs[]', program)
      })

      // Add boolean fields
      formData.append('has_auditorium', values.has_auditorium ? 'true' : 'false')
      formData.append('has_smart_class', values.has_smart_class ? 'true' : 'false')
      formData.append('has_ground', values.has_ground ? 'true' : 'false')
      formData.append('has_library', values.has_library ? 'true' : 'false')

      const result = await createSchool({ message: '', success: false }, formData)

      if (result.success) {
        toast({
          title: 'Success',
          description: 'School created successfully',
        })
        // Redirect will be handled by the server action
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to create school',
          variant: 'destructive',
        })

        // Show field errors if any
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            form.setError(field as any, {
              type: 'manual',
              message: Array.isArray(messages) ? messages[0] : messages,
            })
          })
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleMedium = (medium: string) => {
    setSelectedMedium(prev =>
      prev.includes(medium) ? prev.filter(m => m !== medium) : [...prev, medium]
    )
  }

  const toggleProgram = (program: string) => {
    setSelectedPrograms(prev =>
      prev.includes(program) ? prev.filter(p => p !== program) : [...prev, program]
    )
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
              name="school_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter school name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="school_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select school type" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              name="total_students"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Students</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 500"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="grade_range"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grade Range</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 1-12, LKG-UKG" {...field} />
                </FormControl>
                <FormDescription>
                  Enter the range of grades/classes (e.g., "1-10" or "LKG-12")
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Address */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Address</h3>

          <FormField
            control={form.control}
            name="address_line1"
            render={({ field }) => (
              <FormItem>
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
              <FormItem>
                <FormLabel>Address Line 2</FormLabel>
                <FormControl>
                  <Input placeholder="Area, landmark" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <Input placeholder="6-digit pincode" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* School Profile */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">School Profile</h3>

          <FormItem>
            <FormLabel>Medium of Instruction</FormLabel>
            <div className="flex flex-wrap gap-4">
              {mediumOptions.map((medium) => (
                <div key={medium} className="flex items-center space-x-2">
                  <Checkbox
                    id={`medium-${medium}`}
                    checked={selectedMedium.includes(medium)}
                    onCheckedChange={() => toggleMedium(medium)}
                  />
                  <label
                    htmlFor={`medium-${medium}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {medium}
                  </label>
                </div>
              ))}
            </div>
          </FormItem>

          <FormItem>
            <FormLabel>Suitable Yi Programs</FormLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suitableProgramOptions.map((program) => (
                <div key={program} className="flex items-center space-x-2">
                  <Checkbox
                    id={`program-${program}`}
                    checked={selectedPrograms.includes(program)}
                    onCheckedChange={() => toggleProgram(program)}
                  />
                  <label
                    htmlFor={`program-${program}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {program}
                  </label>
                </div>
              ))}
            </div>
          </FormItem>
        </div>

        {/* Facilities */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Facilities</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="has_auditorium"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Has Auditorium</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="has_smart_class"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Has Smart Class</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="has_ground"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Has Playground/Ground</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="has_library"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Has Library</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Operational Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Operational Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="decision_maker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decision Maker</FormLabel>
                  <FormControl>
                    <Input placeholder="Principal, Correspondent, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="best_time_to_approach"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Best Time to Approach</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Weekdays 10 AM - 12 PM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="lead_time_required"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead Time Required</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 2 weeks, 1 month" {...field} />
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any additional notes about the school..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit Button */}
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
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating School...
              </>
            ) : (
              'Create School'
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
