'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TimelineStepStatusBadge } from './succession-status-badges'
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'
import { format, isPast, isFuture, isWithinInterval } from 'date-fns'
import { cn } from '@/lib/utils'

interface TimelineStep {
  id: string
  step_number: number
  step_name: string
  description: string | null
  start_date: string
  end_date: string
  status: 'pending' | 'active' | 'completed' | 'overdue'
  auto_trigger_action: string | null
}

interface TimelineVisualizationProps {
  steps: TimelineStep[]
  compact?: boolean
}

export function TimelineVisualization({ steps, compact = false }: TimelineVisualizationProps) {
  const sortedSteps = [...steps].sort((a, b) => a.step_number - b.step_number)

  const getStepIcon = (step: TimelineStep) => {
    const now = new Date()
    const startDate = new Date(step.start_date)
    const endDate = new Date(step.end_date)

    if ((step.status as string) === 'completed') {
      return <CheckCircle2 className="h-6 w-6 text-green-600" />
    }

    if ((step.status as string) === 'overdue' || (isPast(endDate) && (step.status as string) !== 'completed')) {
      return <AlertCircle className="h-6 w-6 text-red-600" />
    }

    if ((step.status as string) === 'active' || isWithinInterval(now, { start: startDate, end: endDate })) {
      return <Clock className="h-6 w-6 text-blue-600 animate-pulse" />
    }

    return <Circle className="h-6 w-6 text-gray-400" />
  }

  const isCurrentStep = (step: TimelineStep) => {
    const now = new Date()
    const startDate = new Date(step.start_date)
    const endDate = new Date(step.end_date)
    return isWithinInterval(now, { start: startDate, end: endDate })
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {sortedSteps.map((step) => {
          const current = isCurrentStep(step)
          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg',
                current && 'bg-blue-50 border border-blue-200'
              )}
            >
              {getStepIcon(step)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('font-medium text-sm', current && 'text-blue-900')}>
                    Week {step.step_number}: {step.step_name}
                  </span>
                  {current && <Badge className="bg-blue-600">Current</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(step.start_date), 'MMM d')} -{' '}
                  {format(new Date(step.end_date), 'MMM d, yyyy')}
                </div>
              </div>
              <TimelineStepStatusBadge status={step.status} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-border" />

      <div className="space-y-6">
        {sortedSteps.map((step, index) => {
          const current = isCurrentStep(step)
          const isLast = index === sortedSteps.length - 1

          return (
            <div key={step.id} className="relative">
              {/* Timeline dot/icon */}
              <div className="absolute left-5 top-6 z-10 bg-background p-1">
                {getStepIcon(step)}
              </div>

              {/* Content card */}
              <Card
                className={cn(
                  'ml-20 transition-all',
                  current &&
                    'border-2 border-blue-500 shadow-lg ring-2 ring-blue-100'
                )}
              >
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono">
                            Week {step.step_number}
                          </Badge>
                          {current && (
                            <Badge className="bg-blue-600 animate-pulse">
                              Current Step
                            </Badge>
                          )}
                        </div>
                        <h3
                          className={cn(
                            'text-lg font-semibold',
                            current && 'text-blue-900'
                          )}
                        >
                          {step.step_name}
                        </h3>
                        {step.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {step.description}
                          </p>
                        )}
                      </div>
                      <TimelineStepStatusBadge status={step.status} />
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Start:</span>{' '}
                        <span className="font-medium">
                          {format(new Date(step.start_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">End:</span>{' '}
                        <span className="font-medium">
                          {format(new Date(step.end_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    {step.auto_trigger_action && (
                      <div className="pt-2 border-t">
                        <div className="text-xs text-muted-foreground">
                          Auto-trigger: {step.auto_trigger_action.replace(/_/g, ' ')}
                        </div>
                      </div>
                    )}

                    {current && (
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-blue-900 font-medium">
                            This step is currently in progress
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Progress indicator showing overall completion
interface TimelineProgressProps {
  steps: TimelineStep[]
}

export function TimelineProgress({ steps }: TimelineProgressProps) {
  const totalSteps = steps.length
  const completedSteps = steps.filter((s) => (s.status as string) === 'completed').length
  const activeSteps = steps.filter((s) => (s.status as string) === 'active').length
  const overdueSteps = steps.filter((s) => (s.status as string) === 'overdue').length
  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold">{percentage}%</div>
          <div className="text-sm text-muted-foreground">Overall Progress</div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xl font-bold text-green-600">{completedSteps}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div>
            <div className="text-xl font-bold text-blue-600">{activeSteps}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div>
            <div className="text-xl font-bold text-red-600">{overdueSteps}</div>
            <div className="text-xs text-muted-foreground">Overdue</div>
          </div>
        </div>
      </div>

      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
