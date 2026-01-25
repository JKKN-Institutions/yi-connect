'use client'

/**
 * Activity Planner Wizard Component
 *
 * Multi-step wizard for planning activities.
 * Steps: Activity Info -> Date -> Vertical -> Participation -> Review -> Checklist
 */

import { useState, useTransition } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  FileText,
  Calendar,
  Layers,
  Users,
  ClipboardCheck,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { createPlannedActivity } from '@/app/actions/planned-activities'
import type { CreatePlannedActivityInput } from '@/types/planned-activity'

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

// Import step components
import { StepActivityInfo } from './steps/step-activity-info'
import { StepDate } from './steps/step-date'
import { StepVertical } from './steps/step-vertical'
import { StepParticipation } from './steps/step-participation'
import { StepReview } from './steps/step-review'
import { StepChecklist } from './steps/step-checklist'

const STEPS = [
  { id: 'activity', title: 'Activity', icon: FileText, question: 'What activity are you planning?' },
  { id: 'date', title: 'Date', icon: Calendar, question: 'When is this activity planned?' },
  { id: 'vertical', title: 'Vertical', icon: Layers, question: 'Which vertical is this for?' },
  { id: 'participation', title: 'Participants', icon: Users, question: 'How many participants expected?' },
  { id: 'review', title: 'Review', icon: ClipboardCheck, question: 'Review your planned activity' },
  { id: 'checklist', title: 'Checklist', icon: Check, question: 'Data collection checklist' },
] as const

type StepId = (typeof STEPS)[number]['id']

interface FormData {
  activity_name: string
  activity_description: string
  planned_date: string
  vertical_id: string
  expected_ec_count: number
  expected_non_ec_count: number
  preparation_notes: string
}

interface ActivityPlannerWizardProps {
  isOpen: boolean
  onClose: () => void
}

export function ActivityPlannerWizard({ isOpen, onClose }: ActivityPlannerWizardProps) {
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState<StepId>('activity')
  const [error, setError] = useState<string | null>(null)
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null)
  const [selectedVertical, setSelectedVertical] = useState<VerticalOption | null>(null)

  const [formData, setFormData] = useState<FormData>({
    activity_name: '',
    activity_description: '',
    planned_date: '',
    vertical_id: '',
    expected_ec_count: 0,
    expected_non_ec_count: 0,
    preparation_notes: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)
  // Exclude checklist from progress calculation (it's post-save)
  const progress = savedActivityId
    ? 100
    : ((currentStepIndex + 1) / (STEPS.length - 1)) * 100

  // Reset wizard state when closed
  const handleClose = () => {
    setCurrentStep('activity')
    setFormData({
      activity_name: '',
      activity_description: '',
      planned_date: '',
      vertical_id: '',
      expected_ec_count: 0,
      expected_non_ec_count: 0,
      preparation_notes: '',
    })
    setErrors({})
    setError(null)
    setSavedActivityId(null)
    setSelectedVertical(null)
    onClose()
  }

  // Update form data
  const updateField = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // Validate current step
  const validateStep = (step: StepId): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 'activity':
        if (!formData.activity_name.trim()) {
          newErrors.activity_name = 'Activity name is required'
        }
        break
      case 'date':
        if (!formData.planned_date) {
          newErrors.planned_date = 'Please select a date'
        }
        break
      case 'vertical':
        if (!formData.vertical_id) {
          newErrors.vertical_id = 'Please select a vertical'
        }
        break
      case 'participation':
        if (formData.expected_ec_count < 0) {
          newErrors.expected_ec_count = 'Count cannot be negative'
        }
        if (formData.expected_non_ec_count < 0) {
          newErrors.expected_non_ec_count = 'Count cannot be negative'
        }
        if (formData.expected_ec_count === 0 && formData.expected_non_ec_count === 0) {
          newErrors.participation = 'At least one participant expected'
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Navigate steps
  const goNext = () => {
    if (!validateStep(currentStep)) return

    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  // Handle vertical selection
  const handleVerticalSelect = (vertical: VerticalOption) => {
    setSelectedVertical(vertical)
    updateField('vertical_id', vertical.id)
  }

  // Submit and save planned activity
  const handleSave = () => {
    if (!validateStep('review')) return

    setError(null)
    startTransition(async () => {
      try {
        const input: CreatePlannedActivityInput = {
          activity_name: formData.activity_name,
          activity_description: formData.activity_description || undefined,
          planned_date: formData.planned_date,
          vertical_id: formData.vertical_id,
          expected_ec_count: formData.expected_ec_count,
          expected_non_ec_count: formData.expected_non_ec_count,
          preparation_notes: formData.preparation_notes || undefined,
        }

        const result = await createPlannedActivity(input)

        if (result.success && result.data) {
          setSavedActivityId(result.data.id)
          setCurrentStep('checklist')
          toast.success('Activity planned successfully!')
        } else {
          setError(result.error || 'Failed to save planned activity')
        }
      } catch (err) {
        console.error('Error saving planned activity:', err)
        setError('An unexpected error occurred')
      }
    })
  }

  const currentStepData = STEPS.find((s) => s.id === currentStep)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            {currentStepData && <currentStepData.icon className="h-5 w-5 text-primary" />}
            Plan an Activity
          </SheetTitle>
          <SheetDescription>
            {currentStepData?.question}
          </SheetDescription>
        </SheetHeader>

        {/* Progress */}
        <div className="py-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Step {currentStepIndex + 1} of {STEPS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {currentStep === 'activity' && (
            <StepActivityInfo
              activityName={formData.activity_name}
              activityDescription={formData.activity_description}
              errors={errors}
              onUpdate={updateField}
            />
          )}
          {currentStep === 'date' && (
            <StepDate
              plannedDate={formData.planned_date}
              errors={errors}
              onUpdate={updateField}
            />
          )}
          {currentStep === 'vertical' && (
            <StepVertical
              selectedVerticalId={formData.vertical_id}
              errors={errors}
              onSelect={handleVerticalSelect}
            />
          )}
          {currentStep === 'participation' && (
            <StepParticipation
              expectedEcCount={formData.expected_ec_count}
              expectedNonEcCount={formData.expected_non_ec_count}
              preparationNotes={formData.preparation_notes}
              errors={errors}
              onUpdate={updateField}
            />
          )}
          {currentStep === 'review' && (
            <StepReview
              formData={formData}
              selectedVertical={selectedVertical}
            />
          )}
          {currentStep === 'checklist' && (
            <StepChecklist
              activityId={savedActivityId || ''}
              verticalSlug={selectedVertical?.slug || ''}
              onDone={handleClose}
            />
          )}
        </div>

        {/* Navigation */}
        {currentStep !== 'checklist' && (
          <div className="flex justify-between pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={goPrev}
              disabled={currentStepIndex === 0 || isPending}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            {currentStep === 'review' ? (
              <Button type="button" onClick={handleSave} disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Check className="h-4 w-4 mr-1" />
                Save Activity
              </Button>
            ) : (
              <Button type="button" onClick={goNext} disabled={isPending}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
