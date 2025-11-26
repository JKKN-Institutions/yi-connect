'use client'

/**
 * Session Report Form Component
 *
 * Comprehensive form for post-session reporting.
 * Captures attendance, feedback, and impact metrics.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  Users,
  Clock,
  MessageSquare,
  Star,
  Camera,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { submitSessionReport } from '@/app/actions/session-reports'
import {
  submitSessionReportSchema,
  type SubmitSessionReportInput,
} from '@/lib/validations/event'
import {
  VENUE_CONDITIONS,
  ENGAGEMENT_LEVELS,
  type VenueCondition,
  type EngagementLevel,
} from '@/types/event'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface SessionReportFormProps {
  eventId: string
  trainerAssignmentId?: string
  expectedAttendance?: number
  eventTitle?: string
}

const STEPS = [
  { id: 'attendance', title: 'Attendance', icon: Users },
  { id: 'logistics', title: 'Logistics', icon: Clock },
  { id: 'feedback', title: 'Feedback', icon: MessageSquare },
  { id: 'evidence', title: 'Evidence', icon: Camera },
]

export function SessionReportForm({
  eventId,
  trainerAssignmentId,
  expectedAttendance = 0,
  eventTitle,
}: SessionReportFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(0)

  const form = useForm<SubmitSessionReportInput>({
    resolver: zodResolver(submitSessionReportSchema) as any,
    defaultValues: {
      event_id: eventId,
      trainer_assignment_id: trainerAssignmentId,
      actual_attendance: 0,
      male_count: 0,
      female_count: 0,
      staff_present: 0,
      class_breakdown: {},
      actual_start_time: '',
      actual_end_time: '',
      topics_covered: [],
      venue_condition: 'good',
      av_equipment_worked: true,
      logistical_issues: '',
      engagement_level: 'moderate',
      knowledge_retention_score: 70,
      behavioral_change_observed: '',
      coordinator_name: '',
      coordinator_feedback: '',
      coordinator_rating: 4,
      willing_to_host_again: true,
      follow_up_required: false,
      follow_up_notes: '',
      follow_up_date: '',
      photo_urls: [],
      attendance_sheet_url: '',
      trainer_notes: '',
      highlights: '',
      challenges_faced: '',
      recommendations: '',
      best_practices_noted: '',
    },
  })

  const actualAttendance = form.watch('actual_attendance')
  const maleCount = form.watch('male_count') || 0
  const femaleCount = form.watch('female_count') || 0
  const followUpRequired = form.watch('follow_up_required')

  // Calculate attendance percentage
  const attendancePercentage = expectedAttendance > 0
    ? Math.round((actualAttendance / expectedAttendance) * 100)
    : 0

  const onSubmit = (data: SubmitSessionReportInput) => {
    startTransition(async () => {
      try {
        const result = await submitSessionReport(data)

        if (result.success) {
          toast.success('Session report submitted successfully!')
          router.push(`/events/${eventId}`)
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to submit report')
        }
      } catch (error) {
        console.error('Error submitting report:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post-Session Report</CardTitle>
        {eventTitle && (
          <CardDescription>Reporting for: {eventTitle}</CardDescription>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-between mt-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-2 cursor-pointer transition-colors',
                  isActive && 'text-primary',
                  isCompleted && 'text-green-600',
                  !isActive && !isCompleted && 'text-muted-foreground'
                )}
                onClick={() => setCurrentStep(index)}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2',
                    isActive && 'border-primary bg-primary text-primary-foreground',
                    isCompleted && 'border-green-600 bg-green-600 text-white',
                    !isActive && !isCompleted && 'border-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className="hidden sm:inline text-sm font-medium">
                  {step.title}
                </span>
                {index < STEPS.length - 1 && (
                  <div className="hidden sm:block w-12 h-0.5 bg-muted mx-2" />
                )}
              </div>
            )
          })}
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Attendance */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="actual_attendance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Attendance *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="male_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Male</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="female_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Female</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Attendance Summary */}
                {expectedAttendance > 0 && (
                  <Alert>
                    <Users className="h-4 w-4" />
                    <AlertTitle>Attendance Summary</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <div className="flex items-center gap-4 mt-2">
                        <span>Expected: {expectedAttendance}</span>
                        <span>Actual: {actualAttendance}</span>
                        <Badge
                          variant={attendancePercentage >= 80 ? 'default' : 'secondary'}
                        >
                          {attendancePercentage}%
                        </Badge>
                      </div>
                      <Progress value={attendancePercentage} className="h-2" />
                    </AlertDescription>
                  </Alert>
                )}

                {/* Gender count validation */}
                {maleCount + femaleCount > actualAttendance && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Male + Female count ({maleCount + femaleCount}) exceeds total attendance ({actualAttendance})
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="staff_present"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff/Teachers Present</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Number of school staff present"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Teachers or school staff who attended/observed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2: Logistics */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="actual_start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actual Start Time</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="actual_end_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actual End Time</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="venue_condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Venue Condition</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'good'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(VENUE_CONDITIONS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="av_equipment_worked"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">AV Equipment</FormLabel>
                          <FormDescription>
                            Projector/audio worked properly
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="logistical_issues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logistical Issues</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any issues with venue, timing, equipment, etc."
                          rows={3}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 3: Feedback */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="engagement_level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student Engagement</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'moderate'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(ENGAGEMENT_LEVELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="knowledge_retention_score"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Knowledge Retention ({field.value || 70}%)</FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={[field.value || 70]}
                            onValueChange={(value) => field.onChange(value[0])}
                          />
                        </FormControl>
                        <FormDescription>
                          Estimated retention based on Q&A and interaction
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Coordinator Feedback</h4>

                  <FormField
                    control={form.control}
                    name="coordinator_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coordinator Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="School/college coordinator name"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="coordinator_feedback"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coordinator Feedback</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Verbal feedback from the school coordinator"
                            rows={3}
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="coordinator_rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coordinator Rating</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => field.onChange(rating)}
                                className={cn(
                                  'p-1 transition-colors',
                                  rating <= (field.value || 0)
                                    ? 'text-yellow-500'
                                    : 'text-muted-foreground hover:text-yellow-400'
                                )}
                              >
                                <Star
                                  className="h-6 w-6"
                                  fill={rating <= (field.value || 0) ? 'currentColor' : 'none'}
                                />
                              </button>
                            ))}
                            <span className="ml-2 text-sm text-muted-foreground">
                              {field.value}/5
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="willing_to_host_again"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Willing to Host Again</FormLabel>
                          <FormDescription>
                            Institution is interested in future sessions
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="follow_up_required"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Follow-up Required</FormLabel>
                          <FormDescription>
                            Is a follow-up session or action needed?
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {followUpRequired && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="follow_up_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Follow-up Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="follow_up_notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Follow-up Notes</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="What needs to be followed up"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Evidence & Notes */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <Alert>
                  <Camera className="h-4 w-4" />
                  <AlertTitle>Upload Evidence</AlertTitle>
                  <AlertDescription>
                    Upload photos and attendance sheets to document the session.
                    These help with reporting and future reference.
                  </AlertDescription>
                </Alert>

                {/* Photo Upload Placeholder - would integrate with file upload */}
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium">Session Photos</p>
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                </div>

                <Separator />

                <FormField
                  control={form.control}
                  name="highlights"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Highlights</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Key positive moments from the session"
                          rows={3}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="challenges_faced"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Challenges Faced</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any difficulties encountered during the session"
                          rows={3}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recommendations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recommendations</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Suggestions for future sessions at this venue"
                          rows={3}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trainer_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any other observations or notes"
                          rows={3}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              {currentStep < STEPS.length - 1 ? (
                <Button type="button" onClick={nextStep}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Submit Report
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default SessionReportForm
