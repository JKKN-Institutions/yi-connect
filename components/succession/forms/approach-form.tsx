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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createApproach, updateApproachResponse } from '@/app/actions/succession'
import { CreateApproachSchema, ApproachResponseStatusSchema } from '@/lib/validations/succession'
import type { SuccessionPosition } from '@/lib/types/succession'
import { toast } from 'react-hot-toast'

type CreateFormData = Omit<z.infer<typeof CreateApproachSchema>, 'approached_by'>

interface ApproachFormProps {
  cycleId: string
  positions: SuccessionPosition[]
  nominees: Array<{ id: string; first_name: string; last_name: string; email: string }>
}

export function ApproachForm({ cycleId, positions, nominees }: ApproachFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateFormData>({
    resolver: zodResolver(
      CreateApproachSchema.omit({ approached_by: true })
    ),
    defaultValues: {
      cycle_id: cycleId,
      position_id: '',
      nominee_id: '',
      response_status: 'pending',
      notes: '',
    },
  })

  const onSubmit = async (data: CreateFormData) => {
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('cycle_id', data.cycle_id)
    formData.append('position_id', data.position_id)
    formData.append('nominee_id', data.nominee_id)
    formData.append('response_status', data.response_status || 'pending')
    if (data.notes) formData.append('notes', data.notes)
    if (data.conditions_text) formData.append('conditions_text', data.conditions_text)

    const result = await createApproach(formData)

    if (result.success) {
      toast.success('Approach record created successfully')
      router.push('/succession/admin/approaches')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to create approach record')
    }

    setIsSubmitting(false)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="position_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Position</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a position" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {positions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.title} (Level {position.hierarchy_level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Select the leadership position offered to the candidate
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nominee_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Candidate</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a candidate" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {nominees.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name} {member.last_name} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Select the candidate who was approached for this position
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="response_status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Response Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select response status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="conditional">Conditional</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Current response status from the candidate
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch('response_status') === 'conditional' && (
          <FormField
            control={form.control}
            name="conditions_text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conditions</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter the conditions specified by the candidate..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Describe the conditions under which the candidate would accept
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter any additional notes about this approach..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Add any relevant context, discussion points, or follow-up items
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Approach
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}

// Component for updating approach response (can be used by nominees)
interface UpdateApproachResponseFormProps {
  approachId: string
  currentStatus: 'pending' | 'accepted' | 'declined' | 'conditional'
  currentConditions?: string
  currentNotes?: string
}

export function UpdateApproachResponseForm({
  approachId,
  currentStatus,
  currentConditions,
  currentNotes,
}: UpdateApproachResponseFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formSchema = z.object({
    response_status: ApproachResponseStatusSchema,
    conditions_text: z.string().max(1000).optional(),
    notes: z.string().max(2000).optional(),
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      response_status: currentStatus,
      conditions_text: currentConditions || '',
      notes: currentNotes || '',
    },
  })

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsSubmitting(true)

    const result = await updateApproachResponse(
      approachId,
      data.response_status,
      data.conditions_text,
      data.notes
    )

    if (result.success) {
      toast.success('Response updated successfully')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to update response')
    }

    setIsSubmitting(false)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="response_status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Response</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your response" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="pending">Still Considering</SelectItem>
                  <SelectItem value="accepted">Accept Position</SelectItem>
                  <SelectItem value="declined">Decline Position</SelectItem>
                  <SelectItem value="conditional">Accept with Conditions</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch('response_status') === 'conditional' && (
          <FormField
            control={form.control}
            name="conditions_text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your Conditions</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Specify your conditions for accepting..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Comments (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Share any thoughts or feedback..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Response
          </Button>
        </div>
      </form>
    </Form>
  )
}
