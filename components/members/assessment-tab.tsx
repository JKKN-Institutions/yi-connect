/**
 * Assessment Tab Component
 *
 * Tab content for displaying and managing skill-will assessments
 * on the member detail page.
 */

'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Target, Play, RefreshCw, Loader2 } from 'lucide-react'
import { AssessmentWizard } from './assessment-wizard'
import { AssessmentResults } from './assessment-results'
import { startAssessment } from '@/app/actions/assessments'
import type { SkillWillAssessmentFull, SkillWillCategory } from '@/types/assessment'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface AssessmentTabProps {
  assessment: SkillWillAssessmentFull | null
  memberId: string
  chapterId: string
  verticals?: Array<{ id: string; name: string; color: string | null }>
  availableMentors?: Array<{
    member_id: string
    full_name: string
    mentee_count: number
  }>
  canEdit?: boolean
}

export function AssessmentTab({
  assessment,
  memberId,
  chapterId,
  verticals = [],
  availableMentors = [],
  canEdit = false,
}: AssessmentTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentAssessment, setCurrentAssessment] = useState(assessment)
  const [showWizard, setShowWizard] = useState(false)

  const handleStartAssessment = () => {
    startTransition(async () => {
      const result = await startAssessment({
        member_id: memberId,
        chapter_id: chapterId,
      })

      if (result.success && result.data) {
        setShowWizard(true)
        // Create a minimal assessment object for the wizard
        setCurrentAssessment({
          id: result.data.id,
          member_id: memberId,
          chapter_id: chapterId,
          status: 'in_progress',
          version: (assessment?.version || 0) + 1,
          started_at: new Date().toISOString(),
          completed_at: null,
          expires_at: null,
          q1_energy_focus: null,
          q1_ai_suggestion: null,
          q1_ai_reason: null,
          q2_age_group: null,
          q2_ai_suggestion: null,
          q2_ai_reason: null,
          q3_skill_level: null,
          q4_time_commitment: null,
          q5_travel_willingness: null,
          ai_suggestions: {},
          skill_score: null,
          will_score: null,
          category: null,
          recommended_vertical_id: null,
          recommended_match_pct: null,
          alternative_verticals: [],
          assigned_vertical_id: null,
          assigned_by: null,
          assigned_at: null,
          assignment_notes: null,
          mentor_id: null,
          mentor_assigned_at: null,
          mentor_notes: null,
          roadmap: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as SkillWillAssessmentFull)
        toast.success('Assessment started!')
      } else if (!result.success) {
        toast.error(result.error || 'Failed to start assessment')
      }
    })
  }

  const handleAssessmentComplete = (category: SkillWillCategory) => {
    setShowWizard(false)
    router.refresh()
  }

  // No assessment exists - show start button
  if (!currentAssessment) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">No Assessment Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Complete the Skill-Will assessment to discover your strengths,
                get matched with the right vertical, and receive a personalized
                development roadmap.
              </p>
            </div>
            {canEdit && (
              <Button onClick={handleStartAssessment} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Assessment
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Assessment in progress - show wizard
  if (currentAssessment.status === 'in_progress' || showWizard) {
    return (
      <AssessmentWizard
        assessment={currentAssessment}
        onComplete={handleAssessmentComplete}
      />
    )
  }

  // Assessment expired - show option to restart
  if (currentAssessment.status === 'expired') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Target className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Assessment Expired</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                The previous assessment has expired. Start a new assessment to
                update your profile and get fresh recommendations.
              </p>
            </div>
            {canEdit && (
              <Button onClick={handleStartAssessment} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Restart Assessment
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Assessment completed - show results
  return (
    <div className="space-y-6">
      {/* Option to retake assessment */}
      {canEdit && (
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="outline">Version {currentAssessment.version}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartAssessment}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retake Assessment
              </>
            )}
          </Button>
        </div>
      )}

      <AssessmentResults
        assessment={currentAssessment}
        verticals={verticals}
        availableMentors={availableMentors}
        canEdit={canEdit}
      />
    </div>
  )
}
