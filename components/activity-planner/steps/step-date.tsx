'use client'

/**
 * Step 2: Date Selection
 * Pick when the activity is planned
 */

import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface StepDateProps {
  plannedDate: string
  errors: Record<string, string>
  onUpdate: (field: 'planned_date', value: string) => void
}

export function StepDate({ plannedDate, errors, onUpdate }: StepDateProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = plannedDate ? new Date(plannedDate) : undefined

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onUpdate('planned_date', format(date, 'yyyy-MM-dd'))
      setOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>
          Planned Date <span className="text-destructive">*</span>
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !plannedDate && 'text-muted-foreground',
                errors.planned_date && 'border-destructive'
              )}
              aria-invalid={!!errors.planned_date}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {plannedDate ? format(new Date(plannedDate), 'PPP') : 'Select a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.planned_date && (
          <p className="text-sm text-destructive">{errors.planned_date}</p>
        )}
        <p className="text-xs text-muted-foreground">
          When do you plan to conduct this activity?
        </p>
      </div>

      {/* Quick date suggestions */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Quick select:</Label>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Tomorrow', days: 1 },
            { label: 'Next week', days: 7 },
            { label: 'Next month', days: 30 },
          ].map((option) => {
            const date = new Date()
            date.setDate(date.getDate() + option.days)
            const dateStr = format(date, 'yyyy-MM-dd')
            const isSelected = plannedDate === dateStr

            return (
              <Button
                key={option.label}
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate('planned_date', dateStr)}
              >
                {option.label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
