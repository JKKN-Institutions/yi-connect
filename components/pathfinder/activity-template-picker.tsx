'use client'

/**
 * Activity Template Picker
 *
 * Modal dialog for browsing and selecting activity templates
 * to pre-fill AAA plan activity fields.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  X,
  BookOpen,
  Target,
  Megaphone,
  Sparkles,
  Users,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityTemplate, AAAClassification } from '@/types/activity-templates'

// ============================================================================
// TYPES
// ============================================================================

export type ActivitySlotType = 'awareness' | 'action' | 'advocacy'

export interface TemplateSelection {
  title: string
  description: string
  audience?: string
  target?: string
  targetAttendance?: number
  engagementGoal?: string
  impactMeasures?: string
}

interface ActivityTemplatePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slotType: ActivitySlotType
  slotNumber: number
  onSelect: (template: TemplateSelection) => void
  currentVerticalId?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AAA_CONFIG: Record<
  ActivitySlotType,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  awareness: {
    label: 'Awareness',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
  },
  action: {
    label: 'Action',
    icon: <Target className="h-4 w-4" />,
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100',
  },
  advocacy: {
    label: 'Advocacy',
    icon: <Megaphone className="h-4 w-4" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
  },
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ActivityTemplatePicker({
  open,
  onOpenChange,
  slotType,
  slotNumber,
  onSelect,
  currentVerticalId,
}: ActivityTemplatePickerProps) {
  const [templates, setTemplates] = useState<ActivityTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterVertical, setFilterVertical] = useState<string>('all')
  const [filterClassification, setFilterClassification] = useState<string>(slotType)

  const config = AAA_CONFIG[slotType]

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filterClassification && filterClassification !== 'all') {
        params.set('classification', filterClassification)
      }
      if (filterVertical && filterVertical !== 'all') {
        params.set('vertical_id', filterVertical)
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim())
      }

      const response = await fetch(`/api/activity-templates?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }

      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      console.error('Error fetching templates:', err)
      setError('Failed to load templates. Please try again.')
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [filterClassification, filterVertical, searchQuery])

  // Fetch on open and when filters change
  useEffect(() => {
    if (open) {
      fetchTemplates()
    }
  }, [open, fetchTemplates])

  // Reset filters when opening
  useEffect(() => {
    if (open) {
      setSearchQuery('')
      setFilterVertical(currentVerticalId || 'all')
      setFilterClassification(slotType)
    }
  }, [open, slotType, currentVerticalId])

  // Handle template selection
  const handleSelect = (template: ActivityTemplate) => {
    const selection: TemplateSelection = {
      title: template.default_title || template.name,
      description: template.description || '',
      targetAttendance: template.expected_participants || undefined,
    }

    // Map audience/target based on slot type
    if (slotType === 'awareness') {
      selection.audience = template.default_target_audience || undefined
      selection.engagementGoal = `Engage ${template.expected_participants || 50}+ participants in ${template.name.toLowerCase()}`
      selection.impactMeasures = 'Attendance count, feedback survey, knowledge assessment'
    } else if (slotType === 'action') {
      selection.target = template.default_target_audience || undefined
      selection.engagementGoal = `Complete ${template.name.toLowerCase()} with measurable outcomes`
      selection.impactMeasures = 'Participants count, activities completed, tangible outputs'
    }

    onSelect(selection)
    onOpenChange(false)
  }

  // Filter templates client-side (in addition to server-side)
  const filteredTemplates = templates.filter((template) => {
    // Additional client-side filtering if needed
    if (
      searchQuery.trim() &&
      !template.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !template.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !template.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    ) {
      return false
    }
    return true
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                config.bgColor.replace('hover:', '')
              )}
            >
              {config.icon}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Choose {config.label} Activity Template
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {config.label} {slotNumber} - Select a template to pre-fill activity details
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Filters */}
        <div className="px-6 py-4 border-b bg-muted/30 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Row */}
          <div className="flex gap-3">
            <Select value={filterClassification} onValueChange={setFilterClassification}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Activity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="awareness">Awareness</SelectItem>
                <SelectItem value="action">Action</SelectItem>
                <SelectItem value="advocacy">Advocacy</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterVertical} onValueChange={setFilterVertical}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All verticals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verticals</SelectItem>
                {/* Dynamic verticals would be fetched, but we show common ones */}
                <SelectItem value="masoom">MASOOM</SelectItem>
                <SelectItem value="climate">Climate Change</SelectItem>
                <SelectItem value="road-safety">Road Safety</SelectItem>
                <SelectItem value="health">Health</SelectItem>
                <SelectItem value="yuva">Yuva</SelectItem>
                <SelectItem value="thalir">Thalir</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Templates List */}
        <ScrollArea className="flex-1 px-6 py-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 border rounded-lg space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchTemplates} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                No templates found. Try adjusting your filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => handleSelect(template)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// TEMPLATE CARD COMPONENT
// ============================================================================

interface TemplateCardProps {
  template: ActivityTemplate
  onSelect: () => void
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const classification = template.default_aaa_classification as AAAClassification | null
  const classConfig = classification ? AAA_CONFIG[classification] : null

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-4 border rounded-lg transition-all',
        'hover:border-primary hover:shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'group'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm truncate group-hover:text-primary">
              {template.name}
            </h4>
            {classConfig && (
              <Badge variant="outline" className={cn('text-xs shrink-0', classConfig.color)}>
                {classConfig.label}
              </Badge>
            )}
          </div>

          {/* Description */}
          {template.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {template.description}
            </p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {template.expected_participants && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                ~{template.expected_participants} participants
              </span>
            )}
            {template.default_duration_hours && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {template.default_duration_hours}h
              </span>
            )}
            {template.vertical && (
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: template.vertical.color
                    ? `${template.vertical.color}20`
                    : undefined,
                  color: template.vertical.color || undefined,
                }}
              >
                {template.vertical.name}
              </Badge>
            )}
          </div>

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {template.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs font-normal">
                  {tag}
                </Badge>
              ))}
              {template.tags.length > 3 && (
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                  +{template.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Arrow */}
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
      </div>
    </button>
  )
}

export default ActivityTemplatePicker
