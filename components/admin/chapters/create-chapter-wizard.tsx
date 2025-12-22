/**
 * Create Chapter Wizard
 *
 * Multi-step wizard for creating a new chapter with chair invitation and feature selection.
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  Building,
  User,
  Settings,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  CHAPTER_FEATURES,
  getFeaturesByCategory,
  CATEGORY_INFO,
  FeatureName,
  getDefaultEnabledFeatures,
  hasDependenciesMet,
  getDependentFeatures,
} from '@/lib/features'
import { createChapterWithInvitation, sendChairInvitationWhatsApp } from '@/app/actions/chapters'
import type { CreateChapterInput } from '@/types/chapter'

const STEPS = [
  { id: 'basic', title: 'Chapter Info', icon: Building },
  { id: 'chair', title: 'Chair Invitation', icon: User },
  { id: 'features', title: 'Features', icon: Settings },
] as const

type StepId = (typeof STEPS)[number]['id']

export function CreateChapterWizard() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState<StepId>('basic')
  const [error, setError] = useState<string | null>(null)

  // Form data
  const [formData, setFormData] = useState<CreateChapterInput>({
    name: '',
    location: '',
    region: 'SRTN',
    established_date: '',
    chair_name: '',
    chair_email: '',
    chair_phone: '',
    personal_message: '',
    enabled_features: getDefaultEnabledFeatures(),
  })

  // Validation errors per step
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100

  // Update form data
  const updateField = (field: keyof CreateChapterInput, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field
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
      case 'basic':
        if (!formData.name.trim()) newErrors.name = 'Chapter name is required'
        if (!formData.location.trim())
          newErrors.location = 'Location is required'
        if (!formData.region.trim()) newErrors.region = 'Region is required'
        break
      case 'chair':
        if (!formData.chair_name.trim())
          newErrors.chair_name = 'Chair name is required'
        if (!formData.chair_email?.trim() && !formData.chair_phone?.trim()) {
          newErrors.chair_contact =
            'Either email or phone number is required for invitation'
        }
        break
      case 'features':
        if (formData.enabled_features.length === 0) {
          newErrors.features = 'At least one feature must be enabled'
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

  // Toggle feature
  const toggleFeature = (feature: FeatureName, checked: boolean) => {
    setFormData((prev) => {
      let newFeatures = [...prev.enabled_features]

      if (checked) {
        // Add feature and check dependencies
        if (!newFeatures.includes(feature)) {
          newFeatures.push(feature)
        }
        // Also enable dependencies
        const deps = CHAPTER_FEATURES[feature].dependencies
        deps.forEach((dep) => {
          if (!newFeatures.includes(dep)) {
            newFeatures.push(dep)
          }
        })
      } else {
        // Remove feature
        newFeatures = newFeatures.filter((f) => f !== feature)
        // Also remove features that depend on this one
        const dependents = getDependentFeatures(feature)
        newFeatures = newFeatures.filter((f) => !dependents.includes(f))
      }

      return { ...prev, enabled_features: newFeatures }
    })
  }

  // Submit form
  const handleSubmit = () => {
    if (!validateStep('features')) return

    setError(null)
    startTransition(async () => {
      try {
        const result = await createChapterWithInvitation(formData)

        if (result.success) {
          toast.success('Chapter created successfully!')

          // Auto-send WhatsApp invitation if phone number provided
          if (result.invitation_id && formData.chair_phone) {
            const whatsappResult = await sendChairInvitationWhatsApp(result.invitation_id)
            if (whatsappResult.success) {
              toast.success('Invitation sent via WhatsApp!')
            } else {
              toast.warning(
                'Chapter created, but WhatsApp send failed. You can resend from the chapter page.'
              )
            }
          } else if (result.invitation_token) {
            toast.info(
              'Chair invitation created. Send via WhatsApp from the chapter page.'
            )
          }

          router.push(`/admin/chapters/${result.chapter_id}`)
        } else {
          setError(result.error || 'Failed to create chapter')
        }
      } catch (err) {
        console.error('Error creating chapter:', err)
        setError('An unexpected error occurred')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="space-y-4">
        <div className="flex justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = step.id === currentStep
            const isCompleted = index < currentStepIndex

            return (
              <div
                key={step.id}
                className="flex flex-col items-center gap-2 flex-1"
              >
                <div
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                    ${isCompleted ? 'bg-primary border-primary text-primary-foreground' : ''}
                    ${isActive ? 'border-primary text-primary' : ''}
                    ${!isActive && !isCompleted ? 'border-muted-foreground/30 text-muted-foreground' : ''}
                  `}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {step.title}
                </span>
              </div>
            )
          })}
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step content */}
      <Card>
        {currentStep === 'basic' && (
          <BasicInfoStep
            formData={formData}
            errors={errors}
            updateField={updateField}
          />
        )}
        {currentStep === 'chair' && (
          <ChairInviteStep
            formData={formData}
            errors={errors}
            updateField={updateField}
          />
        )}
        {currentStep === 'features' && (
          <FeatureSelectStep
            formData={formData}
            errors={errors}
            toggleFeature={toggleFeature}
          />
        )}

        <CardFooter className="flex justify-between pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={goPrev}
            disabled={currentStepIndex === 0 || isPending}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {currentStepIndex < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext} disabled={isPending}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Chapter
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

// Step 1: Basic Info
function BasicInfoStep({
  formData,
  errors,
  updateField,
}: {
  formData: CreateChapterInput
  errors: Record<string, string>
  updateField: (field: keyof CreateChapterInput, value: unknown) => void
}) {
  return (
    <>
      <CardHeader>
        <CardTitle>Chapter Information</CardTitle>
        <CardDescription>
          Enter the basic details for the new Yi chapter
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Chapter Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., Yi DemoChapter, Yi Trichy"
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location *</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder="e.g., Trichy, Tamil Nadu"
            aria-invalid={!!errors.location}
          />
          {errors.location && (
            <p className="text-sm text-destructive">{errors.location}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="region">Region *</Label>
          <Input
            id="region"
            value={formData.region}
            onChange={(e) => updateField('region', e.target.value)}
            placeholder="e.g., SRTN, SRKA, WR"
            aria-invalid={!!errors.region}
          />
          {errors.region && (
            <p className="text-sm text-destructive">{errors.region}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Yi regional code (SRTN = Southern Region Tamil Nadu)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="established_date">Established Date</Label>
          <Input
            id="established_date"
            type="date"
            value={formData.established_date || ''}
            onChange={(e) => updateField('established_date', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Optional</p>
        </div>
      </CardContent>
    </>
  )
}

// Step 2: Chair Invitation
function ChairInviteStep({
  formData,
  errors,
  updateField,
}: {
  formData: CreateChapterInput
  errors: Record<string, string>
  updateField: (field: keyof CreateChapterInput, value: unknown) => void
}) {
  return (
    <>
      <CardHeader>
        <CardTitle>Chapter Chair Invitation</CardTitle>
        <CardDescription>
          Invite the Chapter Chair who will manage this chapter. They will
          receive a WhatsApp invitation to accept the role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="chair_name">Chair Full Name *</Label>
          <Input
            id="chair_name"
            value={formData.chair_name}
            onChange={(e) => updateField('chair_name', e.target.value)}
            placeholder="Full name of the Chapter Chair"
            aria-invalid={!!errors.chair_name}
          />
          {errors.chair_name && (
            <p className="text-sm text-destructive">{errors.chair_name}</p>
          )}
        </div>

        <Separator />
        <p className="text-sm text-muted-foreground">
          Provide at least one contact method for the invitation:
        </p>

        <div className="space-y-2">
          <Label htmlFor="chair_phone">WhatsApp Phone Number</Label>
          <Input
            id="chair_phone"
            type="tel"
            value={formData.chair_phone || ''}
            onChange={(e) => updateField('chair_phone', e.target.value)}
            placeholder="+91 98765 43210"
            aria-invalid={!!errors.chair_contact}
          />
          <p className="text-xs text-muted-foreground">
            Recommended: Chair will receive invitation via WhatsApp
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="chair_email">Email Address</Label>
          <Input
            id="chair_email"
            type="email"
            value={formData.chair_email || ''}
            onChange={(e) => updateField('chair_email', e.target.value)}
            placeholder="chair@example.com"
            aria-invalid={!!errors.chair_contact}
          />
          <p className="text-xs text-muted-foreground">
            Alternative contact method
          </p>
        </div>

        {errors.chair_contact && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.chair_contact}</AlertDescription>
          </Alert>
        )}

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="personal_message">Personal Message (Optional)</Label>
          <Textarea
            id="personal_message"
            value={formData.personal_message || ''}
            onChange={(e) => updateField('personal_message', e.target.value)}
            placeholder="Add a personal note to include with the invitation..."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            This message will be included in the WhatsApp invitation
          </p>
        </div>
      </CardContent>
    </>
  )
}

// Step 3: Feature Selection
function FeatureSelectStep({
  formData,
  errors,
  toggleFeature,
}: {
  formData: CreateChapterInput
  errors: Record<string, string>
  toggleFeature: (feature: FeatureName, checked: boolean) => void
}) {
  const categories = getFeaturesByCategory()

  return (
    <>
      <CardHeader>
        <CardTitle>Enable Features</CardTitle>
        <CardDescription>
          Select which features to enable for this chapter. Features can be
          changed later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {errors.features && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.features}</AlertDescription>
          </Alert>
        )}

        {(
          Object.entries(categories) as [
            keyof typeof categories,
            FeatureName[],
          ][]
        ).map(([category, features]) => (
          <div key={category} className="space-y-3">
            <div>
              <h3 className="font-medium">
                {CATEGORY_INFO[category as keyof typeof CATEGORY_INFO].name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {
                  CATEGORY_INFO[category as keyof typeof CATEGORY_INFO]
                    .description
                }
              </p>
            </div>

            <div className="grid gap-3">
              {features.map((featureName) => {
                const feature = CHAPTER_FEATURES[featureName]
                const isEnabled = formData.enabled_features.includes(featureName)
                const Icon = feature.icon
                const missingDeps =
                  feature.dependencies.length > 0 &&
                  !hasDependenciesMet(featureName, formData.enabled_features)

                return (
                  <div
                    key={featureName}
                    className={`
                      flex items-start space-x-3 p-3 rounded-lg border
                      ${isEnabled ? 'border-primary bg-primary/5' : 'border-muted'}
                      ${missingDeps ? 'opacity-60' : ''}
                    `}
                  >
                    <Checkbox
                      id={featureName}
                      checked={isEnabled}
                      onCheckedChange={(checked) =>
                        toggleFeature(featureName, checked === true)
                      }
                      disabled={missingDeps}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <Label
                          htmlFor={featureName}
                          className="font-medium cursor-pointer"
                        >
                          {feature.name}
                        </Label>
                        {feature.default && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                      {feature.dependencies.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Requires:{' '}
                          {feature.dependencies
                            .map((d) => CHAPTER_FEATURES[d].name)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {formData.enabled_features.length} features selected
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const defaults = getDefaultEnabledFeatures()
              // Reset to defaults by toggling
              Object.keys(CHAPTER_FEATURES).forEach((f) => {
                toggleFeature(f as FeatureName, defaults.includes(f as FeatureName))
              })
            }}
          >
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </>
  )
}
