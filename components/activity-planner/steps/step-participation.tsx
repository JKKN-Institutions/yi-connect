'use client'

/**
 * Step 4: Participation
 * Expected EC and Non-EC participant counts
 */

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Users, UserCheck } from 'lucide-react'

interface StepParticipationProps {
  expectedEcCount: number
  expectedNonEcCount: number
  preparationNotes: string
  errors: Record<string, string>
  onUpdate: (
    field: 'expected_ec_count' | 'expected_non_ec_count' | 'preparation_notes',
    value: string | number
  ) => void
}

export function StepParticipation({
  expectedEcCount,
  expectedNonEcCount,
  preparationNotes,
  errors,
  onUpdate,
}: StepParticipationProps) {
  const totalParticipants = expectedEcCount + expectedNonEcCount

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="expected_ec_count" className="text-base">
                  EC Members
                </Label>
                <p className="text-xs text-muted-foreground">
                  Yi Chapter EC members expected
                </p>
              </div>
            </div>
            <Input
              id="expected_ec_count"
              type="number"
              min={0}
              value={expectedEcCount}
              onChange={(e) =>
                onUpdate('expected_ec_count', parseInt(e.target.value) || 0)
              }
              placeholder="0"
              aria-invalid={!!errors.expected_ec_count}
            />
            {errors.expected_ec_count && (
              <p className="text-sm text-destructive mt-1">
                {errors.expected_ec_count}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <Label htmlFor="expected_non_ec_count" className="text-base">
                  Non-EC Members
                </Label>
                <p className="text-xs text-muted-foreground">
                  Students, beneficiaries, public, etc.
                </p>
              </div>
            </div>
            <Input
              id="expected_non_ec_count"
              type="number"
              min={0}
              value={expectedNonEcCount}
              onChange={(e) =>
                onUpdate('expected_non_ec_count', parseInt(e.target.value) || 0)
              }
              placeholder="0"
              aria-invalid={!!errors.expected_non_ec_count}
            />
            {errors.expected_non_ec_count && (
              <p className="text-sm text-destructive mt-1">
                {errors.expected_non_ec_count}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {errors.participation && (
        <p className="text-sm text-destructive text-center">
          {errors.participation}
        </p>
      )}

      {/* Total summary */}
      <div className="text-center p-3 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">Total Expected Participants</p>
        <p className="text-2xl font-bold">{totalParticipants}</p>
      </div>

      {/* Preparation notes */}
      <div className="space-y-2">
        <Label htmlFor="preparation_notes">Preparation Notes (Optional)</Label>
        <Textarea
          id="preparation_notes"
          value={preparationNotes}
          onChange={(e) => onUpdate('preparation_notes', e.target.value)}
          placeholder="Any notes for preparing this activity..."
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Reminders, venue details, materials needed, etc.
        </p>
      </div>
    </div>
  )
}
