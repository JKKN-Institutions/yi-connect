'use client'

import { useState, useEffect } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { createSuccessionCycle, updateSuccessionCycle } from '@/app/actions/succession'
import { SuccessionCycleStatusSchema } from '@/lib/validations/succession'
import type { SuccessionCycle } from '@/lib/types/succession'
import toast from 'react-hot-toast'

// Form schema - defined locally to avoid refinement extension issues
const FormSchema = z.object({
  year: z.number().int().min(2020, 'Year must be 2020 or later').max(2100, 'Invalid year'),
  cycle_name: z.string().min(1, 'Cycle name is required').max(100, 'Cycle name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: SuccessionCycleStatusSchema.optional(),
  is_published: z.boolean().optional(),
})

type FormData = z.infer<typeof FormSchema>

// Status options with labels
const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'nominations_open', label: 'Nominations Open' },
  { value: 'nominations_closed', label: 'Nominations Closed' },
  { value: 'applications_open', label: 'Applications Open' },
  { value: 'applications_closed', label: 'Applications Closed' },
  { value: 'evaluations', label: 'Evaluations' },
  { value: 'evaluations_closed', label: 'Evaluations Closed' },
  { value: 'interviews', label: 'Interviews' },
  { value: 'interviews_closed', label: 'Interviews Closed' },
  { value: 'selection', label: 'Selection' },
  { value: 'approval_pending', label: 'Approval Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

interface SuccessionCycleFormProps {
  cycle?: SuccessionCycle
}

// Helper to format date for input (YYYY-MM-DD)
function formatDateForInput(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

export function SuccessionCycleForm({ cycle }: SuccessionCycleFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      cycle_name: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'draft',
      is_published: false,
    },
  })

  // Reset form values when cycle prop changes (for edit mode)
  useEffect(() => {
    if (cycle) {
      form.reset({
        year: cycle.year,
        cycle_name: cycle.cycle_name,
        description: cycle.description || '',
        start_date: formatDateForInput(cycle.start_date),
        end_date: formatDateForInput(cycle.end_date),
        status: cycle.status,
        is_published: cycle.is_published || false,
      })
    }
  }, [cycle, form])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('year', data.year.toString())
    formData.append('cycle_name', data.cycle_name)
    if (data.description) formData.append('description', data.description)
    if (data.start_date) formData.append('start_date', data.start_date)
    if (data.end_date) formData.append('end_date', data.end_date)
    if (data.status) formData.append('status', data.status)
    if (data.is_published !== undefined) formData.append('is_published', data.is_published.toString())

    const result = cycle
      ? await updateSuccessionCycle(cycle.id, formData)
      : await createSuccessionCycle(formData)

    if (result.success) {
      toast.success(cycle ? 'Cycle updated successfully' : 'Cycle created successfully')
      router.push('/succession/admin/cycles')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to save cycle')
    }

    setIsSubmitting(false)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={2020}
                    max={2100}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  The year this succession cycle takes place
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cycle_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cycle Name</FormLabel>
                <FormControl>
                  <Input placeholder="2025 Leadership Selection" {...field} />
                </FormControl>
                <FormDescription>
                  A descriptive name for this cycle
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the purpose and objectives of this succession cycle..."
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Additional information about this succession cycle
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date (Optional)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  When this cycle begins
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date (Optional)</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  When this cycle ends
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Status field - only show for editing existing cycles */}
        {cycle && (
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || 'draft'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Current status of the succession cycle
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Published toggle - only show for editing existing cycles */}
        {cycle && (
          <FormField
            control={form.control}
            name="is_published"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Published</FormLabel>
                  <FormDescription>
                    Make this cycle visible to all members
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <div className="flex gap-4 justify-end">
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
            {cycle ? 'Update Cycle' : 'Create Cycle'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
