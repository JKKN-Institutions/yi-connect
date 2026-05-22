'use client'

/**
 * Step 6: Data Collection Checklist
 * Shows what data needs to be collected for the health card entry
 */

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  ArrowRight,
  ListChecks,
} from 'lucide-react'
import {
  VERTICAL_SPECIFIC_FIELDS,
  type VerticalSpecificField,
} from '@/types/health-card'

interface StepChecklistProps {
  activityId: string
  verticalSlug: string
  onDone: () => void
}

// Base fields that are always collected
const BASE_FIELDS = [
  { label: 'Activity Name', description: 'Name of the activity conducted' },
  { label: 'Activity Date', description: 'When the activity took place' },
  { label: 'EC Members Count', description: 'Number of EC members who participated' },
  { label: 'Non-EC Members Count', description: 'Number of non-EC participants' },
  { label: 'AAA Type (Optional)', description: 'Awareness, Action, or Advocacy classification' },
]

export function StepChecklist({ activityId, verticalSlug, onDone }: StepChecklistProps) {
  const router = useRouter()
  const verticalFields = VERTICAL_SPECIFIC_FIELDS[verticalSlug] || []

  const handleCompleteNow = () => {
    // Navigate to health card form with prefill from planned activity
    router.push(`/pathfinder/health-card/new?from=planned&id=${activityId}`)
    onDone()
  }

  const handleViewPlanned = () => {
    router.push('/pathfinder/planned-activities')
    onDone()
  }

  return (
    <div className="space-y-6">
      {/* Success message */}
      <div className="text-center py-4">
        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold">Activity Planned!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Here&apos;s what you&apos;ll need to collect when reporting
        </p>
      </div>

      {/* Data collection checklist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Data to Collect
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Base fields */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Standard Fields</p>
            <ul className="space-y-2">
              {BASE_FIELDS.map((field) => (
                <li key={field.label} className="flex items-start gap-2">
                  <Circle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{field.label}</p>
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Vertical-specific fields */}
          {verticalFields.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    Vertical-Specific
                  </Badge>
                </div>
                <ul className="space-y-2">
                  {verticalFields.map((field: VerticalSpecificField) => (
                    <li key={field.key} className="flex items-start gap-2">
                      <Circle className="h-4 w-4 mt-0.5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">
                          {field.label}
                          {field.required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </p>
                        {field.type === 'select' && field.options && (
                          <p className="text-xs text-muted-foreground">
                            Options: {field.options.map((o) => o.label).join(', ')}
                          </p>
                        )}
                        {field.placeholder && (
                          <p className="text-xs text-muted-foreground">
                            {field.placeholder}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleCompleteNow}
          className="w-full"
          size="lg"
        >
          Complete Now
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <Button
          onClick={handleViewPlanned}
          variant="outline"
          className="w-full"
        >
          <ListChecks className="h-4 w-4 mr-2" />
          View My Planned Activities
        </Button>
        <Button
          onClick={onDone}
          variant="ghost"
          className="w-full"
        >
          Close
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        You can complete this activity later from the Planned Activities page
      </p>
    </div>
  )
}
