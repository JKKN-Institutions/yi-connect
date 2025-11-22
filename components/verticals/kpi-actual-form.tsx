'use client'

/**
 * KPI Actual Entry Form Component
 *
 * Form for recording actual KPI values for a specific quarter.
 * Module 9: Vertical Performance Tracker
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { recordKPIActual } from '@/app/actions/vertical'
import {
  recordKPIActualSchema,
  type RecordKPIActualInput,
} from '@/lib/validations/vertical'
import {
  QUARTER_LABELS,
  METRIC_TYPE_LABELS,
  type VerticalKPI,
  type VerticalKPIActual,
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
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface KPIActualFormProps {
  kpi: VerticalKPI
  verticalId: string
  verticalName: string
  userId: string
  existingActuals?: VerticalKPIActual[]
  defaultQuarter?: number
  onSuccess?: () => void
}

export function KPIActualForm({
  kpi,
  verticalId,
  verticalName,
  userId,
  existingActuals = [],
  defaultQuarter,
  onSuccess,
}: KPIActualFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Determine current quarter if not provided
  const currentQuarter = defaultQuarter || (() => {
    const month = new Date().getMonth() + 1
    if (month >= 4 && month <= 6) return 1
    if (month >= 7 && month <= 9) return 2
    if (month >= 10 && month <= 12) return 3
    return 4
  })()

  // Get target for each quarter
  const getTarget = (quarter: number) => {
    switch (quarter) {
      case 1: return kpi.target_q1
      case 2: return kpi.target_q2
      case 3: return kpi.target_q3
      case 4: return kpi.target_q4
      default: return 0
    }
  }

  // Get existing actual for a quarter
  const getExistingActual = (quarter: number) => {
    return existingActuals.find((a) => a.quarter === quarter)
  }

  // Calculate annual totals
  const annualTarget = kpi.target_q1 + kpi.target_q2 + kpi.target_q3 + kpi.target_q4
  const annualActual = existingActuals.reduce((sum, a) => sum + a.actual_value, 0)
  const achievementRate = annualTarget > 0 ? (annualActual / annualTarget) * 100 : 0

  const form = useForm<RecordKPIActualInput>({
    resolver: zodResolver(recordKPIActualSchema),
    mode: 'onChange',
    defaultValues: {
      kpi_id: kpi.id,
      quarter: currentQuarter,
      actual_value: getExistingActual(currentQuarter)?.actual_value || 0,
      notes: getExistingActual(currentQuarter)?.notes || '',
      recorded_by: userId,
    },
  })

  const selectedQuarter = form.watch('quarter')
  const enteredValue = form.watch('actual_value') || 0
  const targetValue = getTarget(selectedQuarter)
  const quarterAchievement = targetValue > 0 ? (enteredValue / targetValue) * 100 : 0

  const onSubmit = (data: RecordKPIActualInput) => {
    startTransition(async () => {
      try {
        const result = await recordKPIActual(data)
        if (result.success) {
          toast.success('KPI actual recorded successfully')
          if (onSuccess) {
            onSuccess()
          } else {
            router.push(`/verticals/${verticalId}`)
            router.refresh()
          }
        } else {
          toast.error(result.error || 'Failed to record KPI actual')
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  // Achievement status indicator
  const getStatusIndicator = (rate: number) => {
    if (rate >= 100) return { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' }
    if (rate >= 75) return { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100' }
    if (rate >= 50) return { icon: Minus, color: 'text-yellow-600', bg: 'bg-yellow-100' }
    return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-100' }
  }

  const quarterStatus = getStatusIndicator(quarterAchievement)
  const StatusIcon = quarterStatus.icon

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* KPI Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {kpi.kpi_name}
                </CardTitle>
                <CardDescription>
                  {verticalName} · {METRIC_TYPE_LABELS[kpi.metric_type as keyof typeof METRIC_TYPE_LABELS]}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-lg">
                Weight: {kpi.weight}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Annual Progress */}
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Annual Progress</span>
                <span className={cn(
                  achievementRate >= 100 ? 'text-green-600' :
                  achievementRate >= 75 ? 'text-blue-600' :
                  achievementRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                )}>
                  {annualActual} / {annualTarget} ({achievementRate.toFixed(1)}%)
                </span>
              </div>
              <Progress value={Math.min(achievementRate, 100)} />

              {/* Quarterly Breakdown */}
              <div className="grid grid-cols-4 gap-2 pt-2">
                {[1, 2, 3, 4].map((q) => {
                  const target = getTarget(q)
                  const actual = getExistingActual(q)
                  const rate = target > 0 && actual ? (actual.actual_value / target) * 100 : 0
                  return (
                    <div
                      key={q}
                      className={cn(
                        'p-2 rounded-md text-center text-sm',
                        actual ? 'bg-muted' : 'border border-dashed'
                      )}
                    >
                      <div className="font-medium">{QUARTER_LABELS[q as keyof typeof QUARTER_LABELS]}</div>
                      <div className="text-xs text-muted-foreground">
                        {actual ? `${actual.actual_value}/${target}` : `Target: ${target}`}
                      </div>
                      {actual && (
                        <div className={cn(
                          'text-xs font-medium',
                          rate >= 100 ? 'text-green-600' : 'text-muted-foreground'
                        )}>
                          {rate.toFixed(0)}%
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entry Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Record Actual Value</CardTitle>
            <CardDescription>
              Enter the actual achieved value for the selected quarter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Quarter Selection */}
              <FormField
                control={form.control}
                name="quarter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quarter *</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(parseInt(value))
                        // Update actual value if existing
                        const existing = getExistingActual(parseInt(value))
                        if (existing) {
                          form.setValue('actual_value', existing.actual_value)
                          form.setValue('notes', existing.notes || '')
                        } else {
                          form.setValue('actual_value', 0)
                          form.setValue('notes', '')
                        }
                      }}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select quarter" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4].map((q) => (
                          <SelectItem key={q} value={q.toString()}>
                            {QUARTER_LABELS[q as keyof typeof QUARTER_LABELS]}
                            {getExistingActual(q) && ' (recorded)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Target: {targetValue}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actual Value */}
              <FormField
                control={form.control}
                name="actual_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actual Value *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                        <div className={cn(
                          'absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded',
                          quarterStatus.bg
                        )}>
                          <StatusIcon className={cn('h-4 w-4', quarterStatus.color)} />
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Achievement: {quarterAchievement.toFixed(1)}%
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes about this entry..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Explain any variance from target or special circumstances
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Hidden fields */}
        <input type="hidden" {...form.register('kpi_id')} />
        <input type="hidden" {...form.register('recorded_by')} />

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
            {getExistingActual(selectedQuarter) ? 'Update Entry' : 'Record Entry'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
