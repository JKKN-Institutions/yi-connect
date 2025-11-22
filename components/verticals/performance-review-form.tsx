'use client'

/**
 * Performance Review Form Component
 *
 * Form for creating and editing quarterly performance reviews.
 * Module 9: Vertical Performance Tracker
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  ClipboardCheck,
  Star,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'
import { createPerformanceReview, updatePerformanceReview } from '@/app/actions/vertical'
import {
  createPerformanceReviewSchema,
  updatePerformanceReviewSchema,
  type CreatePerformanceReviewInput,
  type UpdatePerformanceReviewInput,
} from '@/lib/validations/vertical'
import {
  QUARTER_LABELS,
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  type VerticalPerformanceReview,
} from '@/types/vertical'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface PerformanceReviewFormProps {
  verticalId: string
  verticalName: string
  chairId: string
  reviewerId: string
  fiscalYear: number
  review?: VerticalPerformanceReview
  kpiAchievementRate?: number
  budgetUtilizationRate?: number
  eventCompletionRate?: number
  onSuccess?: () => void
}

export function PerformanceReviewForm({
  verticalId,
  verticalName,
  chairId,
  reviewerId,
  fiscalYear,
  review,
  kpiAchievementRate,
  budgetUtilizationRate,
  eventCompletionRate,
  onSuccess,
}: PerformanceReviewFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!review

  // Determine current quarter
  const currentQuarter = (() => {
    const month = new Date().getMonth() + 1
    if (month >= 4 && month <= 6) return 1
    if (month >= 7 && month <= 9) return 2
    if (month >= 10 && month <= 12) return 3
    return 4
  })()

  const form = useForm<CreatePerformanceReviewInput>({
    resolver: zodResolver(createPerformanceReviewSchema) as Resolver<CreatePerformanceReviewInput>,
    mode: 'onChange',
    defaultValues: {
      vertical_id: verticalId,
      chair_id: chairId,
      fiscal_year: fiscalYear,
      quarter: review?.quarter || currentQuarter,
      overall_rating: review?.overall_rating || 3,
      kpi_achievement_rate: review?.kpi_achievement_rate ?? kpiAchievementRate ?? 0,
      budget_utilization_rate: review?.budget_utilization_rate ?? budgetUtilizationRate ?? 0,
      event_completion_rate: review?.event_completion_rate ?? eventCompletionRate ?? 0,
      strengths: review?.strengths || '',
      areas_for_improvement: review?.areas_for_improvement || '',
      recommendations: review?.recommendations || '',
      reviewed_by: reviewerId,
      status: (review?.status as CreatePerformanceReviewInput['status']) || REVIEW_STATUSES.COMPLETED,
    },
  })

  const overallRating = form.watch('overall_rating')

  const getRatingLabel = (rating: number) => {
    if (rating >= 4.5) return { label: 'Exceptional', color: 'text-green-600' }
    if (rating >= 3.5) return { label: 'Exceeds Expectations', color: 'text-blue-600' }
    if (rating >= 2.5) return { label: 'Meets Expectations', color: 'text-yellow-600' }
    if (rating >= 1.5) return { label: 'Needs Improvement', color: 'text-orange-600' }
    return { label: 'Below Expectations', color: 'text-red-600' }
  }

  const ratingInfo = getRatingLabel(overallRating)

  const onSubmit = (data: CreatePerformanceReviewInput) => {
    startTransition(async () => {
      try {
        if (isEditing && review) {
          const result = await updatePerformanceReview(review.id, data as UpdatePerformanceReviewInput)
          if (result.success) {
            toast.success('Review updated successfully')
            if (onSuccess) {
              onSuccess()
            } else {
              router.push(`/verticals/${verticalId}`)
              router.refresh()
            }
          } else {
            toast.error(result.error || 'Failed to update review')
          }
        } else {
          const result = await createPerformanceReview(data)
          if (result.success) {
            toast.success('Review created successfully')
            if (onSuccess) {
              onSuccess()
            } else {
              router.push(`/verticals/${verticalId}`)
            }
          } else {
            toast.error(result.error || 'Failed to create review')
          }
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Review Period Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Performance Review
            </CardTitle>
            <CardDescription>
              Quarterly review for {verticalName} - FY{fiscalYear}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Quarter Selection */}
              <FormField
                control={form.control}
                name="quarter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quarter *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                      disabled={isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select quarter" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4].map((q) => (
                          <SelectItem key={q} value={q.toString()}>
                            {QUARTER_LABELS[q as keyof typeof QUARTER_LABELS]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => (
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
            </div>
          </CardContent>
        </Card>

        {/* Overall Rating Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Overall Rating
            </CardTitle>
            <CardDescription>
              Rate the overall performance for this quarter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="overall_rating"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between mb-4">
                    <FormLabel>Rating (0-5)</FormLabel>
                    <Badge variant="outline" className={cn('text-lg', ratingInfo.color)}>
                      {field.value?.toFixed(1)} - {ratingInfo.label}
                    </Badge>
                  </div>
                  <FormControl>
                    <div className="space-y-4">
                      <Slider
                        min={0}
                        max={5}
                        step={0.5}
                        value={[field.value || 0]}
                        onValueChange={(values) => field.onChange(values[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0 - Poor</span>
                        <span>2.5 - Average</span>
                        <span>5 - Excellent</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Star Display */}
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'h-8 w-8 cursor-pointer transition-colors',
                    star <= Math.round(overallRating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  )}
                  onClick={() => form.setValue('overall_rating', star)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
            <CardDescription>
              Auto-calculated or manually adjusted metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {/* KPI Achievement Rate */}
              <FormField
                control={form.control}
                name="kpi_achievement_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KPI Achievement (%)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={[field.value || 0]}
                          onValueChange={(values) => field.onChange(values[0])}
                        />
                        <div className="text-center text-sm font-medium">
                          {field.value?.toFixed(0)}%
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Budget Utilization Rate */}
              <FormField
                control={form.control}
                name="budget_utilization_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Utilization (%)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={[field.value || 0]}
                          onValueChange={(values) => field.onChange(values[0])}
                        />
                        <div className="text-center text-sm font-medium">
                          {field.value?.toFixed(0)}%
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Event Completion Rate */}
              <FormField
                control={form.control}
                name="event_completion_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Completion (%)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={[field.value || 0]}
                          onValueChange={(values) => field.onChange(values[0])}
                        />
                        <div className="text-center text-sm font-medium">
                          {field.value?.toFixed(0)}%
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Qualitative Assessment Card */}
        <Card>
          <CardHeader>
            <CardTitle>Qualitative Assessment</CardTitle>
            <CardDescription>
              Provide detailed feedback for the vertical chair
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Strengths */}
            <FormField
              control={form.control}
              name="strengths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-green-600" />
                    Strengths
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What did the vertical do well this quarter?"
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Highlight key achievements and positive aspects
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Areas for Improvement */}
            <FormField
              control={form.control}
              name="areas_for_improvement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    Areas for Improvement
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What could be improved?"
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Identify specific areas that need attention
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recommendations */}
            <FormField
              control={form.control}
              name="recommendations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                    Recommendations
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Specific recommendations for next quarter..."
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Actionable suggestions for the next quarter
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Hidden fields */}
        <input type="hidden" {...form.register('vertical_id')} />
        <input type="hidden" {...form.register('chair_id')} />
        <input type="hidden" {...form.register('fiscal_year')} />
        <input type="hidden" {...form.register('reviewed_by')} />

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Update Review' : 'Submit Review'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
