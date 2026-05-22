'use client'

/**
 * Step 5: Review
 * Summary of the planned activity before saving
 */

import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calendar, Users, Layers, FileText, StickyNote } from 'lucide-react'

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

interface FormData {
  activity_name: string
  activity_description: string
  planned_date: string
  vertical_id: string
  expected_ec_count: number
  expected_non_ec_count: number
  preparation_notes: string
}

interface StepReviewProps {
  formData: FormData
  selectedVertical: VerticalOption | null
}

export function StepReview({ formData, selectedVertical }: StepReviewProps) {
  const totalParticipants = formData.expected_ec_count + formData.expected_non_ec_count

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Activity Name</p>
            <p className="font-medium">{formData.activity_name}</p>
          </div>
          {formData.activity_description && (
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-sm">{formData.activity_description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Planned Date</span>
            </div>
            <p className="font-medium">
              {formData.planned_date
                ? format(new Date(formData.planned_date), 'PPP')
                : 'Not set'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Layers className="h-4 w-4" />
              <span className="text-sm">Vertical</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedVertical?.icon && (
                <span className="text-lg">{selectedVertical.icon}</span>
              )}
              <p className="font-medium">
                {selectedVertical?.name || 'Not selected'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Users className="h-4 w-4" />
            <span className="text-sm">Expected Participation</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {formData.expected_ec_count}
              </p>
              <p className="text-xs text-muted-foreground">EC Members</p>
            </div>
            <Separator orientation="vertical" className="h-12" />
            <div className="text-center">
              <p className="text-2xl font-bold">
                {formData.expected_non_ec_count}
              </p>
              <p className="text-xs text-muted-foreground">Non-EC</p>
            </div>
            <Separator orientation="vertical" className="h-12" />
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {totalParticipants}
              </p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {formData.preparation_notes && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <StickyNote className="h-4 w-4" />
              <span className="text-sm">Preparation Notes</span>
            </div>
            <p className="text-sm">{formData.preparation_notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="text-center pt-2">
        <Badge variant="outline" className="text-sm">
          Status: Planned
        </Badge>
      </div>
    </div>
  )
}
