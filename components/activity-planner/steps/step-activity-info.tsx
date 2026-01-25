'use client'

/**
 * Step 1: Activity Info
 * Collects activity name and optional description
 */

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface StepActivityInfoProps {
  activityName: string
  activityDescription: string
  errors: Record<string, string>
  onUpdate: (field: 'activity_name' | 'activity_description', value: string) => void
}

export function StepActivityInfo({
  activityName,
  activityDescription,
  errors,
  onUpdate,
}: StepActivityInfoProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="activity_name">
          Activity Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="activity_name"
          value={activityName}
          onChange={(e) => onUpdate('activity_name', e.target.value)}
          placeholder="e.g., MASOOM Session at ABC School"
          aria-invalid={!!errors.activity_name}
          autoFocus
        />
        {errors.activity_name && (
          <p className="text-sm text-destructive">{errors.activity_name}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Give your activity a clear, descriptive name
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity_description">Description (Optional)</Label>
        <Textarea
          id="activity_description"
          value={activityDescription}
          onChange={(e) => onUpdate('activity_description', e.target.value)}
          placeholder="Brief description of what this activity involves..."
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Add any additional context or goals for this activity
        </p>
      </div>
    </div>
  )
}
