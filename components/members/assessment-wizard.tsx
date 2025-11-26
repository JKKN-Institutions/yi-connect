/**
 * Assessment Wizard Component
 *
 * Multi-step wizard for completing skill-will assessments.
 * Guides members through 5 questions to determine their category.
 */

'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  updateAssessmentAnswers,
  completeAssessment,
} from '@/app/actions/assessments'
import {
  ENERGY_FOCUS_OPTIONS,
  AGE_GROUP_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  TIME_COMMITMENT_OPTIONS,
  TRAVEL_WILLINGNESS_OPTIONS,
  CATEGORY_INFO,
  type SkillWillAssessment,
  type EnergyFocus,
  type AgeGroup,
  type SkillLevel,
  type TimeCommitment,
  type TravelWillingness,
  type SkillWillCategory,
} from '@/types/assessment'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

interface AssessmentWizardProps {
  assessment: SkillWillAssessment
  onComplete?: (category: SkillWillCategory) => void
}

const STEPS = [
  { title: 'Energy Focus', description: 'What type of work energizes you?' },
  { title: 'Age Group', description: 'Which age group do you prefer to work with?' },
  { title: 'Experience Level', description: 'What is your current skill level?' },
  { title: 'Time Commitment', description: 'How much time can you dedicate?' },
  { title: 'Travel Willingness', description: 'How far are you willing to travel?' },
]

export function AssessmentWizard({ assessment, onComplete }: AssessmentWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedCategory, setCompletedCategory] = useState<SkillWillCategory | null>(null)

  // Form state
  const [answers, setAnswers] = useState({
    q1: assessment.q1_energy_focus || '',
    q2: assessment.q2_age_group || '',
    q3: assessment.q3_skill_level || '',
    q4: assessment.q4_time_commitment || '',
    q5: assessment.q5_travel_willingness || '',
  })

  const progress = ((currentStep + 1) / STEPS.length) * 100

  const handleNext = () => {
    // Save current step answer
    saveCurrentAnswer()

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Complete assessment
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const saveCurrentAnswer = () => {
    const updateData: Record<string, any> = { id: assessment.id }

    switch (currentStep) {
      case 0:
        if (answers.q1) updateData.q1_energy_focus = answers.q1
        break
      case 1:
        if (answers.q2) updateData.q2_age_group = answers.q2
        break
      case 2:
        if (answers.q3) updateData.q3_skill_level = answers.q3
        break
      case 3:
        if (answers.q4) updateData.q4_time_commitment = answers.q4
        break
      case 4:
        if (answers.q5) updateData.q5_travel_willingness = answers.q5
        break
    }

    if (Object.keys(updateData).length > 1) {
      startTransition(async () => {
        await updateAssessmentAnswers(updateData)
      })
    }
  }

  const handleComplete = () => {
    startTransition(async () => {
      // Save final answer first
      await updateAssessmentAnswers({
        id: assessment.id,
        q5_travel_willingness: answers.q5 as TravelWillingness,
      })

      // Complete assessment
      const result = await completeAssessment({ id: assessment.id })

      if (result.success && result.data) {
        setCompletedCategory(result.data.category)
        toast.success('Assessment completed!')
        onComplete?.(result.data.category)
      } else if (!result.success) {
        toast.error(result.error || 'Failed to complete assessment')
      }
    })
  }

  const getCurrentAnswer = () => {
    switch (currentStep) {
      case 0: return answers.q1
      case 1: return answers.q2
      case 2: return answers.q3
      case 3: return answers.q4
      case 4: return answers.q5
      default: return ''
    }
  }

  const setCurrentAnswer = (value: string) => {
    switch (currentStep) {
      case 0:
        setAnswers({ ...answers, q1: value })
        break
      case 1:
        setAnswers({ ...answers, q2: value })
        break
      case 2:
        setAnswers({ ...answers, q3: value })
        break
      case 3:
        setAnswers({ ...answers, q4: value })
        break
      case 4:
        setAnswers({ ...answers, q5: value })
        break
    }
  }

  const getOptions = () => {
    switch (currentStep) {
      case 0: return ENERGY_FOCUS_OPTIONS
      case 1: return AGE_GROUP_OPTIONS
      case 2: return SKILL_LEVEL_OPTIONS
      case 3: return TIME_COMMITMENT_OPTIONS
      case 4: return TRAVEL_WILLINGNESS_OPTIONS
      default: return []
    }
  }

  // Show results if completed
  if (completedCategory) {
    const categoryInfo = CATEGORY_INFO[completedCategory]

    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Assessment Complete!</CardTitle>
          <CardDescription>
            Your skill-will assessment has been evaluated
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <Badge className={cn('text-lg px-4 py-2', categoryInfo.color)}>
              <Sparkles className="h-4 w-4 mr-2" />
              {categoryInfo.label}
            </Badge>
          </div>
          <p className="text-center text-muted-foreground">
            {categoryInfo.description}
          </p>
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="font-medium mb-2">Recommended Next Steps:</h4>
            <p className="text-sm text-muted-foreground">{categoryInfo.actionPlan}</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => router.refresh()} className="w-full">
            View Full Results
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline">
            Step {currentStep + 1} of {STEPS.length}
          </Badge>
          {assessment.q1_ai_suggestion && currentStep === 0 && (
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-700">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Suggestion Available
            </Badge>
          )}
        </div>
        <CardTitle>{STEPS[currentStep].title}</CardTitle>
        <CardDescription>{STEPS[currentStep].description}</CardDescription>
        <Progress value={progress} className="mt-4" />
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={getCurrentAnswer()}
          onValueChange={setCurrentAnswer}
          className="space-y-3"
        >
          {getOptions().map((option) => (
            <div
              key={option.value}
              className={cn(
                'flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors',
                getCurrentAnswer() === option.value
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              )}
              onClick={() => setCurrentAnswer(option.value)}
            >
              <RadioGroupItem value={option.value} id={option.value} />
              <div className="flex-1">
                <Label htmlFor={option.value} className="text-base font-medium cursor-pointer">
                  {option.label}
                </Label>
                {'description' in option && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </RadioGroup>

        {/* AI Suggestion */}
        {currentStep === 0 && assessment.q1_ai_suggestion && (
          <div className="mt-4 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-purple-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-700">AI Suggestion</p>
                <p className="text-sm text-muted-foreground">{assessment.q1_ai_suggestion}</p>
                {assessment.q1_ai_reason && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Reason: {assessment.q1_ai_reason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && assessment.q2_ai_suggestion && (
          <div className="mt-4 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-purple-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-700">AI Suggestion</p>
                <p className="text-sm text-muted-foreground">{assessment.q2_ai_suggestion}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0 || isPending}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <Button
          onClick={handleNext}
          disabled={!getCurrentAnswer() || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : currentStep === STEPS.length - 1 ? (
            <>
              Complete
              <CheckCircle2 className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
