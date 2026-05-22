'use client'

/**
 * Step 3: Vertical Selection
 * Select which vertical this activity belongs to
 */

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Simple vertical type for the activity planner
interface VerticalOption {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  icon: string | null
  is_active: boolean
}

interface StepVerticalProps {
  selectedVerticalId: string
  errors: Record<string, string>
  onSelect: (vertical: VerticalOption) => void
}

export function StepVertical({ selectedVerticalId, errors, onSelect }: StepVerticalProps) {
  const [verticals, setVerticals] = useState<VerticalOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadVerticals() {
      try {
        const response = await fetch('/api/verticals')
        if (!response.ok) throw new Error('Failed to fetch verticals')
        const data = await response.json()
        setVerticals(data)
      } catch (error) {
        console.error('Failed to load verticals:', error)
      } finally {
        setLoading(false)
      }
    }
    loadVerticals()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>
          Vertical <span className="text-destructive">*</span>
        </Label>
        {errors.vertical_id && (
          <p className="text-sm text-destructive">{errors.vertical_id}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Select the vertical this activity belongs to
        </p>
      </div>

      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-2">
          {verticals.map((vertical) => {
            const isSelected = selectedVerticalId === vertical.id

            return (
              <button
                key={vertical.id}
                type="button"
                onClick={() => onSelect(vertical)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  {vertical.icon && (
                    <span className="text-2xl">{vertical.icon}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{vertical.name}</p>
                    {vertical.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {vertical.description}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <svg
                        className="h-3 w-3 text-primary-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
