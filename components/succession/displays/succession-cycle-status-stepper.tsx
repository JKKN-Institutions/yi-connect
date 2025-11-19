'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SuccessionCycleStatus } from '@/lib/types/succession'

const STATUSES: Array<{
  key: SuccessionCycleStatus
  label: string
  description: string
}> = [
  { key: 'draft', label: 'Draft', description: 'Cycle created' },
  { key: 'active', label: 'Active', description: 'Cycle activated' },
  { key: 'nominations_open', label: 'Nominations', description: 'Open for nominations' },
  { key: 'nominations_closed', label: 'Nominations Closed', description: 'Review nominations' },
  { key: 'applications_open', label: 'Applications', description: 'Open for applications' },
  { key: 'applications_closed', label: 'Applications Closed', description: 'Review applications' },
  { key: 'evaluations', label: 'Evaluations', description: 'Scoring candidates' },
  { key: 'evaluations_closed', label: 'Evaluations Complete', description: 'Scores finalized' },
  { key: 'interviews', label: 'Interviews', description: 'Conducting interviews' },
  { key: 'interviews_closed', label: 'Interviews Complete', description: 'Feedback collected' },
  { key: 'selection', label: 'Selection', description: 'Committee decision' },
  { key: 'approval_pending', label: 'Approval', description: 'Awaiting approval' },
  { key: 'completed', label: 'Completed', description: 'Results published' },
]

interface SuccessionCycleStatusStepperProps {
  currentStatus: SuccessionCycleStatus
}

export function SuccessionCycleStatusStepper({
  currentStatus,
}: SuccessionCycleStatusStepperProps) {
  const currentIndex = STATUSES.findIndex((s) => s.key === currentStatus)

  return (
    <div className="space-y-8">
      {STATUSES.map((status, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isUpcoming = index > currentIndex

        return (
          <div key={status.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2',
                  isCompleted && 'border-green-500 bg-green-500 text-white',
                  isCurrent && 'border-blue-500 bg-blue-500 text-white',
                  isUpcoming && 'border-gray-300 bg-white text-gray-400'
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              {index < STATUSES.length - 1 && (
                <div
                  className={cn(
                    'h-16 w-0.5',
                    isCompleted ? 'bg-green-500' : 'bg-gray-300'
                  )}
                />
              )}
            </div>
            <div className="flex-1 pb-8">
              <div
                className={cn(
                  'font-medium',
                  isCurrent && 'text-blue-600',
                  isUpcoming && 'text-muted-foreground'
                )}
              >
                {status.label}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {status.description}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
