'use client'

/**
 * CMP Target Edit Form Component
 *
 * Form for editing existing CMP targets
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Target, Users, TrendingUp, Loader2, Save } from 'lucide-react'
import { z } from 'zod'
import { updateCMPTargetAction } from '@/app/actions/cmp-targets'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useToast } from '@/hooks/use-toast'
import type { CMPTarget } from '@/types/cmp-targets'

// Edit form schema - subset of fields that can be updated
const editFormSchema = z.object({
  id: z.string().uuid(),
  min_activities: z.number().int().min(0, 'Cannot be negative'),
  min_participants: z.number().int().min(0, 'Cannot be negative'),
  min_ec_participation: z.number().int().min(0, 'Cannot be negative'),
  min_awareness_activities: z.number().int().min(0).nullable().optional(),
  min_action_activities: z.number().int().min(0).nullable().optional(),
  min_advocacy_activities: z.number().int().min(0).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
})

type EditFormValues = z.infer<typeof editFormSchema>

interface CMPTargetEditFormProps {
  target: CMPTarget
  verticalName: string
}

export function CMPTargetEditForm({ target, verticalName }: CMPTargetEditFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      id: target.id,
      min_activities: target.min_activities,
      min_participants: target.min_participants,
      min_ec_participation: target.min_ec_participation,
      min_awareness_activities: target.min_awareness_activities,
      min_action_activities: target.min_action_activities,
      min_advocacy_activities: target.min_advocacy_activities,
      description: target.description || '',
    },
  })

  async function onSubmit(data: EditFormValues) {
    startTransition(async () => {
      const result = await updateCMPTargetAction(data)

      if (result.success) {
        toast({
          title: 'Target updated',
          description: 'CMP target has been updated successfully.',
        })
        router.push('/pathfinder/cmp-targets')
        router.refresh()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update target',
          variant: 'destructive',
        })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Save className="h-5 w-5" />
          Edit Target
        </CardTitle>
        <CardDescription>
          Update minimum targets for {verticalName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Hidden ID field */}
            <input type="hidden" {...form.register('id')} />

            {/* Main Targets */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Minimum Targets
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="min_activities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Activities *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>Per calendar year</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="min_participants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Participants</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>Across all activities</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="min_ec_participation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EC Members</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>Minimum EC participation</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* AAA Breakdown (Optional) */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                AAA Breakdown
                <span className="text-muted-foreground font-normal">(Optional)</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="min_awareness_activities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Awareness (A1)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Optional"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="min_action_activities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Action (A2)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Optional"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="min_advocacy_activities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Advocacy (A3)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Optional"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes about this target..."
                      className="resize-none"
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
