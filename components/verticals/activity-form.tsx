'use client'

/**
 * Activity Form Component
 *
 * Form for creating and editing vertical activities.
 * Module 9: Vertical Performance Tracker
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Calendar, Users, Clock, IndianRupee } from 'lucide-react'
import { createActivity, updateActivity } from '@/app/actions/vertical'
import {
  createActivitySchema,
  updateActivitySchema,
  type CreateActivityInput,
  type UpdateActivityInput,
} from '@/lib/validations/vertical'
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  type VerticalActivity,
} from '@/types/vertical'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ActivityFormProps {
  verticalId: string
  verticalName: string
  userId: string
  activity?: VerticalActivity
  onSuccess?: () => void
}

export function ActivityForm({
  verticalId,
  verticalName,
  userId,
  activity,
  onSuccess,
}: ActivityFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!activity

  const form = useForm<CreateActivityInput>({
    resolver: zodResolver(createActivitySchema) as Resolver<CreateActivityInput>,
    mode: 'onChange',
    defaultValues: {
      vertical_id: verticalId,
      event_id: activity?.event_id || null,
      activity_date: activity?.activity_date || new Date().toISOString().split('T')[0],
      activity_title: activity?.activity_title || '',
      activity_type: (activity?.activity_type as CreateActivityInput['activity_type']) || ACTIVITY_TYPES.EVENT,
      description: activity?.description || '',
      beneficiaries_count: activity?.beneficiaries_count || 0,
      volunteer_hours: activity?.volunteer_hours || 0,
      cost_incurred: activity?.cost_incurred || 0,
      impact_notes: activity?.impact_notes || '',
      photo_urls: activity?.photo_urls || [],
      created_by: userId,
    },
  })

  const onSubmit = (data: CreateActivityInput) => {
    startTransition(async () => {
      try {
        if (isEditing && activity) {
          const result = await updateActivity(activity.id, data as UpdateActivityInput)
          if (result.success) {
            toast.success('Activity updated successfully')
            if (onSuccess) {
              onSuccess()
            } else {
              router.push(`/verticals/${verticalId}`)
              router.refresh()
            }
          } else {
            toast.error(result.error || 'Failed to update activity')
          }
        } else {
          const result = await createActivity(data)
          if (result.success) {
            toast.success('Activity created successfully')
            if (onSuccess) {
              onSuccess()
            } else {
              router.push(`/verticals/${verticalId}`)
            }
          } else {
            toast.error(result.error || 'Failed to create activity')
          }
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Activity Details
            </CardTitle>
            <CardDescription>
              Record an activity for {verticalName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Activity Title */}
            <FormField
              control={form.control}
              name="activity_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Masoom Awareness Session at XYZ School"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Activity Type */}
              <FormField
                control={form.control}
                name="activity_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Activity Date */}
              <FormField
                control={form.control}
                name="activity_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the activity, its purpose, and outcomes..."
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Impact Metrics Card */}
        <Card>
          <CardHeader>
            <CardTitle>Impact Metrics</CardTitle>
            <CardDescription>
              Record the impact and resources used for this activity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Beneficiaries Count */}
              <FormField
                control={form.control}
                name="beneficiaries_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Beneficiaries
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      People impacted
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Volunteer Hours */}
              <FormField
                control={form.control}
                name="volunteer_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Volunteer Hours
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Total hours contributed
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cost Incurred */}
              <FormField
                control={form.control}
                name="cost_incurred"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IndianRupee className="h-4 w-4" />
                      Cost Incurred
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Amount in ₹
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Impact Notes */}
            <FormField
              control={form.control}
              name="impact_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Impact Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the impact and outcomes of this activity..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Qualitative assessment of the activity's impact
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Hidden fields */}
        <input type="hidden" {...form.register('vertical_id')} />
        <input type="hidden" {...form.register('created_by')} />

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Update Activity' : 'Create Activity'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
