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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { assignEvaluator } from '@/app/actions/succession'

const AssignEvaluatorSchema = z.object({
  cycle_id: z.string().uuid(),
  member_id: z.string().uuid(),
})

type FormData = z.infer<typeof AssignEvaluatorSchema>

interface EvaluatorAssignmentFormProps {
  cycleId: string
  members: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
  }>
  existingEvaluatorIds: string[]
  onSuccess?: () => void
}

export function EvaluatorAssignmentForm({
  cycleId,
  members,
  existingEvaluatorIds,
  onSuccess,
}: EvaluatorAssignmentFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter out members who are already evaluators
  const availableMembers = members.filter(
    (member) => !existingEvaluatorIds.includes(member.id)
  )

  const form = useForm<FormData>({
    resolver: zodResolver(AssignEvaluatorSchema),
    defaultValues: {
      cycle_id: cycleId,
      member_id: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('cycle_id', data.cycle_id)
    formData.append('member_id', data.member_id)

    const result = await assignEvaluator(formData)

    if (result.success) {
      toast.success('Evaluator assigned successfully')
      form.reset({ cycle_id: cycleId, member_id: '' })
      router.refresh()
      if (onSuccess) onSuccess()
    } else {
      toast.error(result.error || 'Failed to assign evaluator')
    }

    setIsSubmitting(false)
  }

  if (availableMembers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">
          All eligible members have already been assigned as evaluators.
        </p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="member_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Select Member</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a member to assign as evaluator" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Select a member to assign as an evaluator for this cycle
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
            {isSubmitting ? 'Assigning...' : 'Assign Evaluator'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
