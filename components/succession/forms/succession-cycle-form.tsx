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
import { createSuccessionCycle, updateSuccessionCycle } from '@/app/actions/succession'
import { CreateSuccessionCycleSchema } from '@/lib/validations/succession'
import type { SuccessionCycle } from '@/lib/types/succession'
import { toast } from 'react-hot-toast'

type FormData = z.infer<typeof CreateSuccessionCycleSchema>

interface SuccessionCycleFormProps {
  cycle?: SuccessionCycle
}

export function SuccessionCycleForm({ cycle }: SuccessionCycleFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(CreateSuccessionCycleSchema),
    defaultValues: {
      year: cycle?.year || new Date().getFullYear(),
      cycle_name: cycle?.cycle_name || '',
      description: cycle?.description || '',
      start_date: cycle?.start_date || '',
      end_date: cycle?.end_date || '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('year', data.year.toString())
    formData.append('cycle_name', data.cycle_name)
    if (data.description) formData.append('description', data.description)
    if (data.start_date) formData.append('start_date', data.start_date)
    if (data.end_date) formData.append('end_date', data.end_date)

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
                  <Input type="date" {...field} />
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
                  <Input type="date" {...field} />
                </FormControl>
                <FormDescription>
                  When this cycle ends
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
