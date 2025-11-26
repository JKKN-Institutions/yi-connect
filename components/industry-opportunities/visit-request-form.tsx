'use client'

/**
 * Visit Request Form Component
 *
 * Form for members to request visits to industry partners.
 * Supports solo and group visit requests.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  Building2,
  Calendar,
  Users,
  Target,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { createVisitRequest } from '@/app/actions/industry-opportunity'
import {
  createVisitRequestSchema,
  type CreateVisitRequestInput,
} from '@/lib/validations/industry-opportunity'
import type { VisitType } from '@/types/industry-opportunity'
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
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Industry {
  id: string
  company_name: string
  industry_sector: string
  city: string | null
  mou_status?: 'active' | 'expired' | 'pending'
}

interface VisitRequestFormProps {
  memberId: string
  industries: Industry[]
  onSuccess?: (requestId: string) => void
  onCancel?: () => void
}

export function VisitRequestForm({
  memberId,
  industries,
  onSuccess,
  onCancel,
}: VisitRequestFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [preferredDateInput, setPreferredDateInput] = useState('')
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<'morning' | 'afternoon' | 'full_day'>('full_day')

  const form = useForm<CreateVisitRequestInput>({
    resolver: zodResolver(createVisitRequestSchema) as any,
    defaultValues: {
      industry_id: '',
      request_title: '',
      visit_purpose: '',
      visit_type: 'solo',
      expected_participants: 1,
      preferred_dates: [],
      participant_profile: '',
      group_details: '',
      additional_notes: '',
    },
  })

  const visitType = form.watch('visit_type')
  const preferredDates = form.watch('preferred_dates') || []
  const selectedIndustryId = form.watch('industry_id')

  const selectedIndustry = industries.find((i) => i.id === selectedIndustryId)

  const addPreferredDate = () => {
    if (preferredDateInput && !preferredDates.some((d) => d.date === preferredDateInput)) {
      form.setValue('preferred_dates', [...preferredDates, { date: preferredDateInput, time_slot: preferredTimeSlot }])
      setPreferredDateInput('')
    }
  }

  const removePreferredDate = (dateStr: string) => {
    form.setValue('preferred_dates', preferredDates.filter((d) => d.date !== dateStr))
  }

  const onSubmit = (data: CreateVisitRequestInput) => {
    if (preferredDates.length === 0) {
      toast.error('Please add at least one preferred date')
      return
    }

    startTransition(async () => {
      try {
        const result = await createVisitRequest(data)

        if (result.success && result.data) {
          toast.success('Visit request submitted successfully!')
          onSuccess?.(result.data.id)
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to submit request')
        }
      } catch (error) {
        console.error('Error submitting request:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  // Filter to only show industries with active MoUs
  const activeIndustries = industries.filter((i) => i.mou_status === 'active')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Request Industry Visit
        </CardTitle>
        <CardDescription>
          Submit a visit request to one of our industry partners
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Industry Selection */}
            <FormField
              control={form.control}
              name="industry_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Industry Partner *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an industry partner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeIndustries.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No active industry partners available
                        </div>
                      ) : (
                        activeIndustries.map((industry) => (
                          <SelectItem key={industry.id} value={industry.id}>
                            <div className="flex flex-col">
                              <span>{industry.company_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {industry.industry_sector}
                                {industry.city && ` • ${industry.city}`}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Only partners with active MoUs are available
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedIndustry && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle>Selected: {selectedIndustry.company_name}</AlertTitle>
                <AlertDescription>
                  {selectedIndustry.industry_sector}
                  {selectedIndustry.city && ` • ${selectedIndustry.city}`}
                </AlertDescription>
              </Alert>
            )}

            {/* Request Title */}
            <FormField
              control={form.control}
              name="request_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Request Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Industrial Visit for Software Engineering Students"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A brief title for your visit request
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Visit Type */}
            <FormField
              control={form.control}
              name="visit_type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Visit Type *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="solo" id="solo" />
                        <label htmlFor="solo" className="cursor-pointer">
                          <div className="font-medium">Solo Visit</div>
                          <div className="text-xs text-muted-foreground">Just me</div>
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="group" id="group" />
                        <label htmlFor="group" className="cursor-pointer">
                          <div className="font-medium">Group Visit</div>
                          <div className="text-xs text-muted-foreground">With others</div>
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {visitType === 'group' && (
              <FormField
                control={form.control}
                name="expected_participants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Participants *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={2}
                        placeholder="Number of participants"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 2)}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum 2 for group visits
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Purpose & Objectives */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Visit Purpose
              </h3>

              <FormField
                control={form.control}
                name="visit_purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose of Visit *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe why you want to visit this industry, what you hope to learn, and your objectives..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Be specific about your learning goals (minimum 20 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="participant_profile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participant Profile</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Background of participants (e.g., 3rd year Computer Science students, MBA students specializing in Marketing)"
                        rows={2}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {visitType === 'group' && (
                <FormField
                  control={form.control}
                  name="group_details"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Details</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Details about your group (e.g., department, class, organization)"
                          rows={2}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <Separator />

            {/* Scheduling */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Preferred Dates
              </h3>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="date"
                  value={preferredDateInput}
                  onChange={(e) => setPreferredDateInput(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1"
                />
                <Select value={preferredTimeSlot} onValueChange={(v: 'morning' | 'afternoon' | 'full_day') => setPreferredTimeSlot(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="full_day">Full Day</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addPreferredDate}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {preferredDates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {preferredDates.map((dateObj) => (
                    <Badge key={dateObj.date} variant="secondary" className="gap-1">
                      {new Date(dateObj.date).toLocaleDateString()} ({dateObj.time_slot.replace('_', ' ')})
                      <button type="button" onClick={() => removePreferredDate(dateObj.date)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add at least one preferred date for your visit
                </p>
              )}
            </div>

            <Separator />

            {/* Additional Notes */}
            <FormField
              control={form.control}
              name="additional_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any accessibility needs, dietary requirements, or other special requests"
                      rows={2}
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Process Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Visit Request Process</AlertTitle>
              <AlertDescription>
                <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
                  <li>Your request will be reviewed by Yi leadership</li>
                  <li>If approved, it will be forwarded to the industry partner</li>
                  <li>The industry will confirm availability and schedule</li>
                  <li>You&apos;ll receive updates at each stage</li>
                </ol>
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isPending || preferredDates.length === 0}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Building2 className="mr-2 h-4 w-4" />
                    Submit Request
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

export default VisitRequestForm
