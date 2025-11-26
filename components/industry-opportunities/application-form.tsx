'use client'

/**
 * Application Form Component
 *
 * Form for members to apply to industry opportunities.
 * Captures motivation, qualifications, and preferences.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  Send,
  FileText,
  Target,
  Car,
  UtensilsCrossed,
  AlertCircle,
} from 'lucide-react'
import { submitApplication } from '@/app/actions/industry-opportunity'
import {
  submitApplicationSchema,
  type SubmitApplicationInput,
} from '@/lib/validations/industry-opportunity'
import type { OpportunityWithDetails } from '@/types/industry-opportunity'
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
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ApplicationFormProps {
  opportunity: OpportunityWithDetails
  memberId: string
  memberMatchScore?: number
  onSuccess?: (applicationId: string) => void
  onCancel?: () => void
}

export function ApplicationForm({
  opportunity,
  memberId,
  memberMatchScore,
  onSuccess,
  onCancel,
}: ApplicationFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<SubmitApplicationInput>({
    resolver: zodResolver(submitApplicationSchema) as any,
    defaultValues: {
      opportunity_id: opportunity.id,
      motivation_statement: '',
      learning_goals: '',
      relevant_experience: '',
      transportation_preference: 'own_transport',
      dietary_preference: 'none',
    },
  })

  const motivationLength = form.watch('motivation_statement')?.length || 0

  const onSubmit = (data: SubmitApplicationInput) => {
    startTransition(async () => {
      try {
        const result = await submitApplication(data)

        if (result.success && result.data) {
          toast.success('Application submitted successfully!')
          onSuccess?.(result.data.id)
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to submit application')
        }
      } catch (error) {
        console.error('Error submitting application:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Apply for Opportunity
        </CardTitle>
        <CardDescription>
          Applying for: {opportunity.title}
        </CardDescription>

        {/* Match Score Display */}
        {memberMatchScore !== undefined && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Your Match Score:</span>
            <Badge
              variant="outline"
              className={cn(
                'text-lg px-3 py-1',
                memberMatchScore >= 80 && 'bg-green-50 text-green-700 border-green-200',
                memberMatchScore >= 60 && memberMatchScore < 80 && 'bg-blue-50 text-blue-700 border-blue-200',
                memberMatchScore >= 40 && memberMatchScore < 60 && 'bg-yellow-50 text-yellow-700 border-yellow-200',
                memberMatchScore < 40 && 'bg-gray-50 text-gray-700 border-gray-200'
              )}
            >
              {memberMatchScore}%
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Motivation */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Why are you interested?
              </h3>

              <FormField
                control={form.control}
                name="motivation_statement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivation Statement *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Explain why you're interested in this opportunity and what you hope to gain..."
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <div className="flex justify-between">
                      <FormDescription>
                        Minimum 50 characters
                      </FormDescription>
                      <span
                        className={cn(
                          'text-xs',
                          motivationLength < 50 && 'text-red-500',
                          motivationLength >= 50 && 'text-green-500'
                        )}
                      >
                        {motivationLength}/50+
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="learning_goals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Learning Goals</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What specific skills or knowledge do you hope to gain?"
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

            <Separator />

            {/* Experience & Skills */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Your Background
              </h3>

              <FormField
                control={form.control}
                name="relevant_experience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relevant Experience</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe any relevant experience, projects, or coursework..."
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
                name="skills_to_contribute"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skills You Can Contribute</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What unique skills or perspectives can you bring?"
                        rows={2}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="resume_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resume Link</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://drive.google.com/..."
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Google Drive, Dropbox, or LinkedIn
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="portfolio_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Portfolio/LinkedIn</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://linkedin.com/in/..."
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Logistics */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Car className="h-4 w-4" />
                Logistics & Preferences
              </h3>

              <FormField
                control={form.control}
                name="availability_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Availability Notes</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Any scheduling constraints or preferences"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="transportation_preference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transportation</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'own_transport'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select preference" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="own_transport">Own Transport</SelectItem>
                          <SelectItem value="need_ride">Need Carpool/Ride</SelectItem>
                          <SelectItem value="public_transport">Public Transport</SelectItem>
                          <SelectItem value="not_applicable">Not Applicable</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dietary_preference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dietary Preference</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select preference" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Preference</SelectItem>
                          <SelectItem value="vegetarian">Vegetarian</SelectItem>
                          <SelectItem value="vegan">Vegan</SelectItem>
                          <SelectItem value="non_vegetarian">Non-Vegetarian</SelectItem>
                          <SelectItem value="other">Other (specify in notes)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Submission Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Before you submit</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>Your application will be reviewed by the industry coordinator</li>
                  <li>You&apos;ll receive notifications about your application status</li>
                  <li>You can withdraw your application anytime before acceptance</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Application
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default ApplicationForm
