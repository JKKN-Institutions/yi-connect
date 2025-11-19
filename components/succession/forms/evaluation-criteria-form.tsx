'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'react-hot-toast'
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
import { Button } from '@/components/ui/button'
import { createEvaluationCriteria, updateEvaluationCriteria } from '@/app/actions/succession'
import { CreateEvaluationCriteriaSchema } from '@/lib/validations/succession'

type FormData = z.infer<typeof CreateEvaluationCriteriaSchema>

interface EvaluationCriteriaFormProps {
  positionId: string
  criteria?: {
    id: string
    criterion_name: string
    description: string | null
    weight: number
    max_score: number
    display_order: number
  }
  onSuccess?: () => void
}

export function EvaluationCriteriaForm({
  positionId,
  criteria,
  onSuccess,
}: EvaluationCriteriaFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(CreateEvaluationCriteriaSchema),
    defaultValues: {
      position_id: positionId,
      criterion_name: criteria?.criterion_name || '',
      description: criteria?.description || '',
      weight: criteria?.weight || 10,
      max_score: criteria?.max_score || 10,
      display_order: criteria?.display_order || 0,
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('position_id', data.position_id)
    formData.append('criterion_name', data.criterion_name)
    if (data.description) formData.append('description', data.description)
    formData.append('weight', data.weight.toString())
    formData.append('max_score', data.max_score.toString())
    formData.append('display_order', (data.display_order ?? 0).toString())

    const result = criteria
      ? await updateEvaluationCriteria(criteria.id, formData)
      : await createEvaluationCriteria(formData)

    if (result.success) {
      toast.success(
        criteria
          ? 'Evaluation criteria updated successfully'
          : 'Evaluation criteria created successfully'
      )
      router.refresh()
      if (onSuccess) onSuccess()
    } else {
      toast.error(result.error || 'Failed to save evaluation criteria')
    }

    setIsSubmitting(false)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="criterion_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Criterion Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., Leadership Skills" />
              </FormControl>
              <FormDescription>
                The name of the evaluation criterion (minimum 3 characters)
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
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Describe what this criterion evaluates..."
                  rows={3}
                />
              </FormControl>
              <FormDescription>
                Optional description to help evaluators understand this criterion
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (%)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    max="100"
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Percentage weight (0-100)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="max_score"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maximum Score</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="1"
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Max points for this criterion
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="display_order"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Order</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min="0"
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                Order in which this criterion appears (0 = first)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSuccess?.()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : criteria ? 'Update Criterion' : 'Create Criterion'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
