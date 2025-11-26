/**
 * Session Booking Form Component
 *
 * Multi-step form for coordinators to book sessions.
 */

'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import {
  CalendarIcon,
  Users,
  Clock,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Sparkles,
  BookOpen,
  GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { createBooking } from '@/app/actions/session-bookings'
import { toast } from 'react-hot-toast'
import type {
  SessionTypeWithVertical,
  TimeSlot,
  ParticipantDetails,
  CreateBookingInput,
} from '@/types/session-booking'

interface BookingFormProps {
  coordinatorId: string
  stakeholderType: string
  stakeholderId: string
  stakeholderName?: string
  sessionTypes: SessionTypeWithVertical[]
  trainerAvailability?: Record<string, { available: number; total: number }>
  onSuccess?: (bookingId: string) => void
  onCancel?: () => void
}

const STEPS = [
  { id: 1, title: 'Session Type', description: 'Choose the type of session' },
  { id: 2, title: 'Date & Time', description: 'Select preferred date and time' },
  { id: 3, title: 'Participants', description: 'Enter participant details' },
  { id: 4, title: 'Review', description: 'Review and confirm' },
]

const TIME_SLOTS: { value: TimeSlot; label: string; time: string }[] = [
  { value: 'morning', label: 'Morning', time: '9:00 AM - 12:00 PM' },
  { value: 'afternoon', label: 'Afternoon', time: '1:00 PM - 4:00 PM' },
  { value: 'evening', label: 'Evening', time: '5:00 PM - 8:00 PM' },
]

export function BookingForm({
  coordinatorId,
  stakeholderType,
  stakeholderId,
  stakeholderName,
  sessionTypes,
  trainerAvailability = {},
  onSuccess,
  onCancel,
}: BookingFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isPending, startTransition] = useTransition()

  // Form state
  const [selectedSessionType, setSelectedSessionType] = useState<string>('')
  const [preferredDate, setPreferredDate] = useState<Date>()
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<TimeSlot>()
  const [alternateDate, setAlternateDate] = useState<Date>()
  const [alternateTimeSlot, setAlternateTimeSlot] = useState<TimeSlot>()
  const [expectedParticipants, setExpectedParticipants] = useState<number>(50)
  const [participantDetails, setParticipantDetails] = useState<ParticipantDetails>({})
  const [customRequirements, setCustomRequirements] = useState('')

  const selectedType = sessionTypes.find((t) => t.id === selectedSessionType)

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!selectedSessionType
      case 2:
        return !!preferredDate && !!preferredTimeSlot
      case 3:
        return expectedParticipants > 0
      default:
        return true
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const input: CreateBookingInput = {
        coordinator_id: coordinatorId,
        stakeholder_type: stakeholderType,
        stakeholder_id: stakeholderId,
        session_type_id: selectedSessionType,
        preferred_date: format(preferredDate!, 'yyyy-MM-dd'),
        preferred_time_slot: preferredTimeSlot,
        alternate_date: alternateDate ? format(alternateDate, 'yyyy-MM-dd') : undefined,
        alternate_time_slot: alternateTimeSlot,
        expected_participants: expectedParticipants,
        participant_details: participantDetails,
        custom_requirements: customRequirements || undefined,
      }

      const result = await createBooking(input)

      if (result.success && result.data) {
        toast.success('Session booked successfully!')
        onSuccess?.(result.data.id)
      } else if (!result.success) {
        toast.error(result.error || 'Failed to book session')
      }
    })
  }

  const getDateAvailability = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const availability = trainerAvailability[dateStr]
    if (!availability) return null
    return availability
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Book New Session</CardTitle>
            <CardDescription>
              Booking for {stakeholderName}
            </CardDescription>
          </div>
          <Badge variant="outline">
            Step {currentStep} of {STEPS.length}
          </Badge>
        </div>
        <Progress value={(currentStep / STEPS.length) * 100} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Session Type */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Choose Session Type
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select the type of session you want to book
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {sessionTypes.map((type) => (
                <div
                  key={type.id}
                  className={cn(
                    'relative rounded-lg border p-4 cursor-pointer transition-all hover:border-primary/50',
                    selectedSessionType === type.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border'
                  )}
                  onClick={() => setSelectedSessionType(type.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{type.display_name}</h4>
                      {type.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {type.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {type.typical_duration_minutes} min
                        </Badge>
                        {type.vertical && (
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: type.vertical.color || undefined }}
                          >
                            {type.vertical.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {selectedSessionType === type.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary absolute top-4 right-4" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Select Date & Time
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose your preferred date and time slot
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Preferred Date */}
              <div className="space-y-3">
                <Label>Preferred Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !preferredDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {preferredDate ? format(preferredDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={preferredDate}
                      onSelect={setPreferredDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {preferredDate && (
                  <div className="space-y-2">
                    <Label>Preferred Time Slot *</Label>
                    <div className="grid gap-2">
                      {TIME_SLOTS.map((slot) => (
                        <div
                          key={slot.value}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                            preferredTimeSlot === slot.value
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/50'
                          )}
                          onClick={() => setPreferredTimeSlot(slot.value)}
                        >
                          <div>
                            <p className="font-medium">{slot.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {slot.time}
                            </p>
                          </div>
                          {preferredTimeSlot === slot.value && (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Alternate Date (Optional) */}
              <div className="space-y-3">
                <Label>Alternate Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !alternateDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {alternateDate ? format(alternateDate, 'PPP') : 'Pick alternate date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={alternateDate}
                      onSelect={setAlternateDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {alternateDate && (
                  <div className="space-y-2">
                    <Label>Alternate Time Slot</Label>
                    <Select
                      value={alternateTimeSlot}
                      onValueChange={(v) => setAlternateTimeSlot(v as TimeSlot)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select time slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label} ({slot.time})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Participants */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Participant Details
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Provide details about the participants
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="participants">Expected Participants *</Label>
                <Input
                  id="participants"
                  type="number"
                  min="1"
                  value={expectedParticipants}
                  onChange={(e) => setExpectedParticipants(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade">Grade/Class</Label>
                <Input
                  id="grade"
                  placeholder="e.g., Class 6, Year 1"
                  value={participantDetails.grade || ''}
                  onChange={(e) =>
                    setParticipantDetails({ ...participantDetails, grade: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department (for colleges)</Label>
                <Input
                  id="department"
                  placeholder="e.g., Computer Science"
                  value={participantDetails.department || ''}
                  onChange={(e) =>
                    setParticipantDetails({ ...participantDetails, department: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age_range">Age Range</Label>
                <Input
                  id="age_range"
                  placeholder="e.g., 10-12 years"
                  value={participantDetails.age_range || ''}
                  onChange={(e) =>
                    setParticipantDetails({ ...participantDetails, age_range: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Language Preference</Label>
              <div className="flex gap-4">
                {['Tamil', 'English', 'Hindi'].map((lang) => (
                  <div key={lang} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lang-${lang}`}
                      checked={participantDetails.language_preference?.includes(lang)}
                      onCheckedChange={(checked) => {
                        const current = participantDetails.language_preference || []
                        setParticipantDetails({
                          ...participantDetails,
                          language_preference: checked
                            ? [...current, lang]
                            : current.filter((l) => l !== lang),
                        })
                      }}
                    />
                    <Label htmlFor={`lang-${lang}`} className="font-normal">
                      {lang}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirements">Special Requirements</Label>
              <Textarea
                id="requirements"
                placeholder="Any special requirements or notes..."
                value={customRequirements}
                onChange={(e) => setCustomRequirements(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Review & Confirm
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please review your booking details
              </p>
            </div>

            <div className="space-y-4 p-4 rounded-lg bg-muted/30">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Session Type</p>
                  <p className="font-medium">{selectedType?.display_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Institution</p>
                  <p className="font-medium">{stakeholderName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Preferred Date</p>
                  <p className="font-medium">
                    {preferredDate ? format(preferredDate, 'PPP') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time Slot</p>
                  <p className="font-medium">
                    {TIME_SLOTS.find((s) => s.value === preferredTimeSlot)?.label || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Participants</p>
                  <p className="font-medium">{expectedParticipants}</p>
                </div>
                {participantDetails.grade && (
                  <div>
                    <p className="text-sm text-muted-foreground">Grade/Class</p>
                    <p className="font-medium">{participantDetails.grade}</p>
                  </div>
                )}
              </div>

              {alternateDate && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Alternate Option</p>
                  <p className="font-medium">
                    {format(alternateDate, 'PPP')} -{' '}
                    {TIME_SLOTS.find((s) => s.value === alternateTimeSlot)?.label || 'Any time'}
                  </p>
                </div>
              )}

              {customRequirements && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Special Requirements</p>
                  <p className="text-sm">{customRequirements}</p>
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-700">What happens next?</p>
                  <ul className="text-sm text-blue-600 mt-1 space-y-1">
                    <li>• Yi will assign a trainer within 24 hours</li>
                    <li>• Materials will be uploaded 3 days before the session</li>
                    <li>• Trainer will contact you 1 day before</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {currentStep > 1 ? (
              <Button variant="outline" onClick={handleBack} disabled={isPending}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            ) : onCancel ? (
              <Button variant="outline" onClick={onCancel} disabled={isPending}>
                Cancel
              </Button>
            ) : null}
          </div>

          <div>
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm Booking
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
