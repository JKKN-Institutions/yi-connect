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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createMeeting, updateMeeting } from '@/app/actions/succession'
import { CreateMeetingSchema, UpdateMeetingSchema } from '@/lib/validations/succession'
import { toast } from 'react-hot-toast'

type CreateFormData = Omit<z.infer<typeof CreateMeetingSchema>, 'created_by'>
type UpdateFormData = z.infer<typeof UpdateMeetingSchema>

interface MeetingFormProps {
  cycleId: string
  meeting?: any
  mode?: 'create' | 'edit'
}

export function MeetingForm({ cycleId, meeting, mode = 'create' }: MeetingFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateFormData>({
    resolver: zodResolver(
      mode === 'create'
        ? CreateMeetingSchema.omit({ created_by: true })
        : UpdateMeetingSchema.omit({ id: true })
    ) as any,
    defaultValues: meeting
      ? {
          cycle_id: meeting.cycle_id,
          meeting_date: meeting.meeting_date?.split('T')[0] || '',
          meeting_type: meeting.meeting_type,
          location: meeting.location || '',
          meeting_link: meeting.meeting_link || '',
          agenda: meeting.agenda || '',
          notes: meeting.notes || '',
          status: meeting.status || 'scheduled',
        }
      : {
          cycle_id: cycleId,
          meeting_date: '',
          meeting_type: 'steering_committee',
          location: '',
          meeting_link: '',
          agenda: '',
          notes: '',
          status: 'scheduled',
        },
  })

  const onSubmit = async (data: CreateFormData) => {
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('cycle_id', data.cycle_id)
    formData.append('meeting_date', new Date(data.meeting_date).toISOString())
    formData.append('meeting_type', data.meeting_type)
    if (data.location) formData.append('location', data.location)
    if (data.meeting_link) formData.append('meeting_link', data.meeting_link)
    if (data.agenda) formData.append('agenda', data.agenda)
    if (data.notes) formData.append('notes', data.notes)
    if (data.status) formData.append('status', data.status)

    const result =
      mode === 'create'
        ? await createMeeting(formData)
        : await updateMeeting(meeting.id, formData)

    if (result.success) {
      toast.success(`Meeting ${mode === 'create' ? 'created' : 'updated'} successfully`)
      router.push('/succession/admin/meetings')
      router.refresh()
    } else {
      toast.error(result.error || `Failed to ${mode} meeting`)
    }

    setIsSubmitting(false)
  }

  const watchLocation = form.watch('location')
  const watchLink = form.watch('meeting_link')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="meeting_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meeting Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select meeting type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="steering_committee">Steering Committee</SelectItem>
                    <SelectItem value="rc_review">RC Review</SelectItem>
                    <SelectItem value="final_selection">Final Selection</SelectItem>
                    <SelectItem value="interview">Interview</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Type of succession meeting
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="meeting_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meeting Date & Time</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormDescription>
                  When the meeting will take place
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location {!watchLocation && !watchLink && '*'}</FormLabel>
                <FormControl>
                  <Input placeholder="Conference Room A, Office Building..." {...field} />
                </FormControl>
                <FormDescription>
                  Physical location (required if no meeting link provided)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="meeting_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meeting Link {!watchLocation && !watchLink && '*'}</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Virtual meeting URL (required if no location provided)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Current status of the meeting
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="agenda"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Agenda (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter meeting agenda..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Topics to be discussed in the meeting
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
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter meeting notes or minutes..."
                  className="min-h-[150px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Meeting notes, decisions, or follow-up items
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Schedule Meeting' : 'Update Meeting'}
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
