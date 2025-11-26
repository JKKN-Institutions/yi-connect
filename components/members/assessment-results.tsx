/**
 * Assessment Results Component
 *
 * Displays the completed skill-will assessment results including
 * category, scores, vertical recommendations, and development roadmap.
 */

'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Target,
  Users,
  Star,
  MapPin,
  Clock,
  TrendingUp,
  CheckCircle2,
  Circle,
  Sparkles,
  UserPlus,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CATEGORY_INFO,
  ENERGY_FOCUS_OPTIONS,
  AGE_GROUP_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  TIME_COMMITMENT_OPTIONS,
  TRAVEL_WILLINGNESS_OPTIONS,
  type SkillWillAssessmentFull,
  type RoadmapMilestone,
} from '@/types/assessment'
import { assignVertical, assignMentor, completeRoadmapMilestone } from '@/app/actions/assessments'
import { toast } from 'react-hot-toast'

interface AssessmentResultsProps {
  assessment: SkillWillAssessmentFull
  verticals?: Array<{ id: string; name: string; color: string | null }>
  availableMentors?: Array<{
    member_id: string
    full_name: string
    mentee_count: number
  }>
  canEdit?: boolean
}

export function AssessmentResults({
  assessment,
  verticals = [],
  availableMentors = [],
  canEdit = false,
}: AssessmentResultsProps) {
  const [isPending, startTransition] = useTransition()
  const [showVerticalDialog, setShowVerticalDialog] = useState(false)
  const [showMentorDialog, setShowMentorDialog] = useState(false)
  const [selectedVertical, setSelectedVertical] = useState(assessment.assigned_vertical_id || '')
  const [selectedMentor, setSelectedMentor] = useState(assessment.mentor_id || '')
  const [notes, setNotes] = useState('')

  const categoryInfo = assessment.category ? CATEGORY_INFO[assessment.category] : null

  const handleAssignVertical = () => {
    if (!selectedVertical) return

    startTransition(async () => {
      const result = await assignVertical({
        assessment_id: assessment.id,
        vertical_id: selectedVertical,
        assigned_by: '', // Will be set by server action based on current user
        notes,
      })

      if (result.success) {
        toast.success('Vertical assigned successfully')
        setShowVerticalDialog(false)
      } else {
        toast.error(result.error || 'Failed to assign vertical')
      }
    })
  }

  const handleAssignMentor = () => {
    if (!selectedMentor) return

    startTransition(async () => {
      const result = await assignMentor({
        assessment_id: assessment.id,
        mentor_id: selectedMentor,
        notes,
      })

      if (result.success) {
        toast.success('Mentor assigned successfully')
        setShowMentorDialog(false)
      } else {
        toast.error(result.error || 'Failed to assign mentor')
      }
    })
  }

  const handleCompleteMilestone = (month: number) => {
    startTransition(async () => {
      const result = await completeRoadmapMilestone(assessment.id, month)

      if (result.success) {
        toast.success('Milestone marked as complete')
      } else {
        toast.error(result.error || 'Failed to complete milestone')
      }
    })
  }

  const getAnswerLabel = (type: string, value: string | null) => {
    if (!value) return 'Not answered'

    const optionsMap: Record<string, readonly { value: string; label: string }[]> = {
      energy_focus: ENERGY_FOCUS_OPTIONS,
      age_group: AGE_GROUP_OPTIONS,
      skill_level: SKILL_LEVEL_OPTIONS,
      time_commitment: TIME_COMMITMENT_OPTIONS,
      travel_willingness: TRAVEL_WILLINGNESS_OPTIONS,
    }

    const options = optionsMap[type] || []
    const option = options.find((o) => o.value === value)
    return option?.label || value
  }

  return (
    <div className="space-y-6">
      {/* Category & Scores Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Skill-Will Assessment</CardTitle>
                <CardDescription>
                  Completed on {new Date(assessment.completed_at!).toLocaleDateString()}
                </CardDescription>
              </div>
            </div>
            {categoryInfo && (
              <Badge className={cn('text-sm px-3 py-1', categoryInfo.color)}>
                <Sparkles className="h-3 w-3 mr-1" />
                {categoryInfo.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Visualization */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Skill Score</span>
                <span className="font-medium">
                  {assessment.skill_score !== null
                    ? `${Math.round(assessment.skill_score * 100)}%`
                    : '-'}
                </span>
              </div>
              <Progress
                value={(assessment.skill_score || 0) * 100}
                className="h-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Will Score</span>
                <span className="font-medium">
                  {assessment.will_score !== null
                    ? `${Math.round(assessment.will_score * 100)}%`
                    : '-'}
                </span>
              </div>
              <Progress
                value={(assessment.will_score || 0) * 100}
                className="h-2"
              />
            </div>
          </div>

          {/* Category Description */}
          {categoryInfo && (
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{categoryInfo.description}</p>
              <p className="text-sm mt-2">
                <span className="font-medium">Recommended Action: </span>
                {categoryInfo.actionPlan}
              </p>
            </div>
          )}

          <Separator />

          {/* Answers Summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Energy Focus</span>
              <p className="text-sm font-medium">
                {getAnswerLabel('energy_focus', assessment.q1_energy_focus)}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Preferred Age Group</span>
              <p className="text-sm font-medium">
                {getAnswerLabel('age_group', assessment.q2_age_group)}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Skill Level</span>
              <p className="text-sm font-medium">
                {getAnswerLabel('skill_level', assessment.q3_skill_level)}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Time Commitment</span>
              <p className="text-sm font-medium">
                {getAnswerLabel('time_commitment', assessment.q4_time_commitment)}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Travel Willingness</span>
              <p className="text-sm font-medium">
                {getAnswerLabel('travel_willingness', assessment.q5_travel_willingness)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vertical Assignment & Mentor */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Vertical Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Vertical Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {assessment.assigned_vertical ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: assessment.assigned_vertical.color || '#888' }}
                  />
                  <span className="font-medium">{assessment.assigned_vertical.name}</span>
                </div>
                <Badge variant="secondary">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Assigned
                </Badge>
              </div>
            ) : (
              <>
                {/* Recommendation */}
                {assessment.recommended_vertical && (
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-700">
                          Recommended: {assessment.recommended_vertical.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {assessment.recommended_match_pct}% match
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alternatives */}
                {assessment.alternative_verticals.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">Other Options:</span>
                    <div className="flex flex-wrap gap-2">
                      {assessment.alternative_verticals.map((alt) => (
                        <Badge key={alt.vertical_id} variant="outline">
                          {alt.vertical_name} ({alt.match_pct}%)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {canEdit && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowVerticalDialog(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Vertical
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Mentor Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4" />
              Mentor Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {assessment.mentor ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{assessment.mentor.profile?.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {assessment.mentor.profile?.email}
                  </p>
                </div>
                <Badge variant="secondary">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Assigned
                </Badge>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {assessment.category === 'enthusiast' || assessment.category === 'dead_wood'
                    ? 'A mentor can help accelerate development'
                    : 'No mentor required for this category'}
                </p>

                {canEdit && (assessment.category === 'enthusiast' || assessment.category === 'dead_wood') && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowMentorDialog(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Mentor
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Development Roadmap */}
      {assessment.roadmap && assessment.roadmap.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              6-Month Development Roadmap
            </CardTitle>
            <CardDescription>
              Track your progress through these milestones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assessment.roadmap.map((milestone: RoadmapMilestone) => (
                <div
                  key={milestone.month}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-lg border',
                    milestone.completed ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30'
                  )}
                >
                  <div className="flex-shrink-0">
                    {milestone.completed ? (
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="outline" className="mb-1">
                          Month {milestone.month}
                        </Badge>
                        <h4 className="font-medium">{milestone.title}</h4>
                      </div>
                      {canEdit && !milestone.completed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCompleteMilestone(milestone.month)}
                          disabled={isPending}
                        >
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {milestone.description}
                    </p>
                    {milestone.tasks.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {milestone.tasks.map((task, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                            <Circle className="h-2 w-2 flex-shrink-0" />
                            {task}
                          </li>
                        ))}
                      </ul>
                    )}
                    {milestone.completed && milestone.completed_at && (
                      <p className="text-xs text-green-600 mt-2">
                        Completed on {new Date(milestone.completed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vertical Assignment Dialog */}
      <Dialog open={showVerticalDialog} onOpenChange={setShowVerticalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Vertical</DialogTitle>
            <DialogDescription>
              Select a vertical to assign to this member based on their assessment results.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vertical</Label>
              <Select value={selectedVertical} onValueChange={setSelectedVertical}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vertical" />
                </SelectTrigger>
                <SelectContent>
                  {verticals.map((vertical) => (
                    <SelectItem key={vertical.id} value={vertical.id}>
                      {vertical.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this assignment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerticalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignVertical} disabled={!selectedVertical || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Vertical'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mentor Assignment Dialog */}
      <Dialog open={showMentorDialog} onOpenChange={setShowMentorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Mentor</DialogTitle>
            <DialogDescription>
              Select a Star member to mentor this member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Mentor</Label>
              <Select value={selectedMentor} onValueChange={setSelectedMentor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a mentor" />
                </SelectTrigger>
                <SelectContent>
                  {availableMentors.map((mentor) => (
                    <SelectItem key={mentor.member_id} value={mentor.member_id}>
                      {mentor.full_name} ({mentor.mentee_count} mentees)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this mentorship..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMentorDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignMentor} disabled={!selectedMentor || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Mentor'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
