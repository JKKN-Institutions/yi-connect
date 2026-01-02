'use client'

/**
 * CMP Target Form Component
 *
 * Form for creating/editing CMP targets
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Target, Users, TrendingUp, Loader2, Sparkles } from 'lucide-react'
import { createCMPTargetSchema, type CreateCMPTargetSchemaInput } from '@/lib/validations/cmp-targets'
import { createCMPTargetAction, createDefaultTargetsAction } from '@/app/actions/cmp-targets'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { FISCAL_YEAR_OPTIONS } from '@/types/cmp-targets'

interface CMPTargetFormProps {
  verticals: Array<{ id: string; name: string; color: string | null }>
  chapterId: string | null
  yearsWithTargets: Array<{ year: number; hasTargets: boolean }>
  initialData?: CreateCMPTargetSchemaInput
}

export function CMPTargetForm({
  verticals,
  chapterId,
  yearsWithTargets,
  initialData,
}: CMPTargetFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isCreatingDefaults, setIsCreatingDefaults] = useState(false)

  const currentYear = new Date().getFullYear()

  const form = useForm<CreateCMPTargetSchemaInput>({
    resolver: zodResolver(createCMPTargetSchema),
    defaultValues: initialData || {
      vertical_id: '',
      fiscal_year: currentYear,
      min_activities: 4,
      min_participants: 50,
      min_ec_participation: 10,
      min_awareness_activities: null,
      min_action_activities: null,
      min_advocacy_activities: null,
      chapter_id: chapterId,
      is_national_target: !chapterId,
      description: '',
    },
  })

  const selectedYear = form.watch('fiscal_year')
  const yearHasTargets = yearsWithTargets.find((y) => y.year === selectedYear)?.hasTargets

  async function onSubmit(data: CreateCMPTargetSchemaInput) {
    startTransition(async () => {
      const result = await createCMPTargetAction(data)

      if (result.success) {
        toast({
          title: 'Target created',
          description: 'CMP target has been set successfully.',
        })
        router.push('/pathfinder/cmp-targets')
        router.refresh()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create target',
          variant: 'destructive',
        })
      }
    })
  }

  async function handleCreateDefaults() {
    setIsCreatingDefaults(true)

    const result = await createDefaultTargetsAction(
      selectedYear || currentYear,
      chapterId || undefined
    )

    setIsCreatingDefaults(false)

    if (result.success) {
      toast({
        title: 'Default targets created',
        description: `Created ${result.count} targets for all verticals.`,
      })
      router.push('/pathfinder/cmp-targets')
      router.refresh()
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to create default targets',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Action: Create Defaults */}
      {!yearHasTargets && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Quick Setup
            </CardTitle>
            <CardDescription>
              Create default targets (4 activities, 50 participants) for all verticals at once
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={handleCreateDefaults}
              disabled={isCreatingDefaults}
            >
              {isCreatingDefaults && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Default Targets for FY {selectedYear ?? currentYear}-{(selectedYear ?? currentYear) + 1}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manual Form */}
      <Card>
        <CardHeader>
          <CardTitle>Set Custom Target</CardTitle>
          <CardDescription>
            Define specific targets for a single vertical
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Vertical and Year */}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="vertical_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vertical *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vertical" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {verticals.map((vertical) => (
                            <SelectItem key={vertical.id} value={vertical.id}>
                              <span className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: vertical.color || '#6b7280' }}
                                />
                                {vertical.name}
                              </span>
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
                  name="fiscal_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fiscal Year *</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(parseInt(v))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FISCAL_YEAR_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>Per fiscal year</FormDescription>
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
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
                              field.onChange(e.target.value ? parseInt(e.target.value) : null)
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
                              field.onChange(e.target.value ? parseInt(e.target.value) : null)
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
                              field.onChange(e.target.value ? parseInt(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Scope */}
              <FormField
                control={form.control}
                name="is_national_target"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">National Target</FormLabel>
                      <FormDescription>
                        Apply this target to all chapters nationally
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
                        {...field}
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
                  Create Target
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
    </div>
  )
}
