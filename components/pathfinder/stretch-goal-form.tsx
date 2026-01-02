'use client'

/**
 * Stretch Goal Form Component
 *
 * Form for creating/editing stretch goals
 */

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Target, Rocket, Trophy, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import {
  createStretchGoalSchema,
  type CreateStretchGoalSchemaInput,
} from '@/lib/validations/stretch-goals'
import {
  createStretchGoalAction,
  createDefaultStretchGoalsAction,
} from '@/app/actions/stretch-goals'
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
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import {
  FISCAL_YEAR_OPTIONS,
  getCurrentFiscalYear,
  formatFiscalYear,
  type CMPTarget,
} from '@/types/cmp-targets'
import {
  DEFAULT_STRETCH_MULTIPLIERS,
  calculateDefaultStretchTargets,
} from '@/types/stretch-goals'

interface StretchGoalFormProps {
  verticals: Array<{ id: string; name: string; color: string | null }>
  cmpTargets: CMPTarget[]
  chapterId: string | null
  yearsWithStretchGoals: Array<{ year: number; hasStretchGoals: boolean }>
  initialData?: CreateStretchGoalSchemaInput
}

export function StretchGoalForm({
  verticals,
  cmpTargets,
  chapterId,
  yearsWithStretchGoals,
  initialData,
}: StretchGoalFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isCreatingDefaults, setIsCreatingDefaults] = useState(false)
  const [multiplier, setMultiplier] = useState(1.5)

  const currentFiscalYear = getCurrentFiscalYear()

  const form = useForm<CreateStretchGoalSchemaInput>({
    resolver: zodResolver(createStretchGoalSchema),
    defaultValues: initialData || {
      vertical_id: '',
      fiscal_year: currentFiscalYear,
      stretch_activities: 6,
      stretch_participants: 75,
      stretch_ec_participation: 20,
      stretch_awareness: null,
      stretch_action: null,
      stretch_advocacy: null,
      name: 'Stretch Goal',
      description: '',
      reward_description: '',
      chapter_id: chapterId,
    },
  })

  const selectedVerticalId = form.watch('vertical_id')
  const selectedYear = form.watch('fiscal_year')

  // Find CMP target for selected vertical
  const selectedCMPTarget = useMemo(() => {
    return cmpTargets.find(
      (t) =>
        t.vertical_id === selectedVerticalId && t.fiscal_year === selectedYear
    )
  }, [cmpTargets, selectedVerticalId, selectedYear])

  const yearHasStretchGoals = yearsWithStretchGoals.find(
    (y) => y.year === selectedYear
  )?.hasStretchGoals

  const hasCMPTargets = cmpTargets.some((t) => t.fiscal_year === selectedYear)

  // Update stretch targets when CMP target or multiplier changes
  const handleVerticalChange = (verticalId: string) => {
    form.setValue('vertical_id', verticalId)

    const cmpTarget = cmpTargets.find(
      (t) => t.vertical_id === verticalId && t.fiscal_year === selectedYear
    )

    if (cmpTarget) {
      const defaults = calculateDefaultStretchTargets(cmpTarget)
      form.setValue('stretch_activities', defaults.stretch_activities)
      form.setValue('stretch_participants', defaults.stretch_participants)
      form.setValue('stretch_ec_participation', defaults.stretch_ec_participation)
      form.setValue('cmp_target_id', cmpTarget.id)
    }
  }

  async function onSubmit(data: CreateStretchGoalSchemaInput) {
    startTransition(async () => {
      const result = await createStretchGoalAction(data)

      if (result.success) {
        toast({
          title: 'Stretch goal created',
          description: 'Your ambitious target has been set!',
        })
        router.push('/pathfinder/stretch-goals')
        router.refresh()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create stretch goal',
          variant: 'destructive',
        })
      }
    })
  }

  async function handleCreateDefaults() {
    setIsCreatingDefaults(true)

    const result = await createDefaultStretchGoalsAction(
      selectedYear || currentFiscalYear,
      chapterId || undefined,
      multiplier
    )

    setIsCreatingDefaults(false)

    if (result.success) {
      toast({
        title: 'Stretch goals created',
        description: `Created ${result.count} stretch goals from CMP targets.`,
      })
      router.push('/pathfinder/stretch-goals')
      router.refresh()
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to create stretch goals',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* No CMP Targets Warning */}
      {!hasCMPTargets && (
        <Alert variant="destructive">
          <Target className="h-4 w-4" />
          <AlertTitle>CMP Targets Required</AlertTitle>
          <AlertDescription>
            No CMP targets found for {formatFiscalYear(selectedYear ?? currentFiscalYear)}.
            Please set CMP targets first before creating stretch goals.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Action: Create Defaults from CMP */}
      {!yearHasStretchGoals && hasCMPTargets && (
        <Card className="border-dashed border-purple-300 bg-purple-50/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Quick Setup
            </CardTitle>
            <CardDescription>
              Create stretch goals for all verticals from CMP targets with a multiplier
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Stretch Multiplier</span>
                <span className="font-medium">{multiplier}x CMP</span>
              </div>
              <Slider
                value={[multiplier]}
                onValueChange={([value]) => setMultiplier(value)}
                min={1.25}
                max={3}
                step={0.25}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1.25x (Easy)</span>
                <span>2x (Medium)</span>
                <span>3x (Ambitious)</span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleCreateDefaults}
              disabled={isCreatingDefaults}
              className="border-purple-300 text-purple-700 hover:bg-purple-100"
            >
              {isCreatingDefaults && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Rocket className="mr-2 h-4 w-4" />
              Create {multiplier}x Stretch Goals for {formatFiscalYear(selectedYear ?? currentFiscalYear)}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manual Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-purple-600" />
            Set Custom Stretch Goal
          </CardTitle>
          <CardDescription>
            Define specific stretch targets for a single vertical
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
                      <Select
                        onValueChange={handleVerticalChange}
                        value={field.value}
                      >
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

              {/* CMP Baseline Display */}
              {selectedCMPTarget && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4" />
                    CMP Baseline
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Activities:</span>{' '}
                      <span className="font-medium">{selectedCMPTarget.min_activities}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Participants:</span>{' '}
                      <span className="font-medium">{selectedCMPTarget.min_participants}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">EC Members:</span>{' '}
                      <span className="font-medium">{selectedCMPTarget.min_ec_participation}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stretch Targets */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-purple-600" />
                  Stretch Targets
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="stretch_activities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activities *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        {selectedCMPTarget && (
                          <FormDescription>
                            {Math.round((field.value / selectedCMPTarget.min_activities) * 100)}% of CMP
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stretch_participants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Participants</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        {selectedCMPTarget && selectedCMPTarget.min_participants > 0 && (
                          <FormDescription>
                            {Math.round((field.value / selectedCMPTarget.min_participants) * 100)}% of CMP
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stretch_ec_participation"
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
                        {selectedCMPTarget && selectedCMPTarget.min_ec_participation > 0 && (
                          <FormDescription>
                            {Math.round((field.value / selectedCMPTarget.min_ec_participation) * 100)}% of CMP
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* AAA Stretch Targets (Optional) */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  AAA Breakdown
                  <span className="text-muted-foreground font-normal">(Optional)</span>
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="stretch_awareness"
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
                    name="stretch_action"
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
                    name="stretch_advocacy"
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

              {/* Goal Metadata */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Goal Details
                </h3>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Q2 Push, Year-End Sprint"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Why this stretch goal matters..."
                          className="resize-none"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reward_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Reward / Recognition
                        <span className="text-muted-foreground font-normal ml-1">
                          (Optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Team celebration, special recognition at meeting"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        What happens when this stretch goal is achieved?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit */}
              <div className="flex gap-4">
                <Button type="submit" disabled={isPending || !hasCMPTargets}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Rocket className="mr-2 h-4 w-4" />
                  Create Stretch Goal
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
