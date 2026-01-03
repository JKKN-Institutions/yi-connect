'use client'

/**
 * Vertical Plan Form Component
 *
 * Form for creating and editing vertical annual plans with KPIs.
 * Module 9: Vertical Performance Tracker
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  Plus,
  Trash2,
  Target,
  GripVertical,
  AlertCircle,
} from 'lucide-react'
import { createVerticalPlan, updateVerticalPlan } from '@/app/actions/vertical'
import {
  createVerticalPlanSchema,
  updateVerticalPlanSchema,
  type CreateVerticalPlanInput,
  type UpdateVerticalPlanInput,
} from '@/lib/validations/vertical'
import {
  METRIC_TYPES,
  METRIC_TYPE_LABELS,
  PLAN_STATUSES,
  type VerticalPlanWithKPIs,
  type MetricType,
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
import { Input } from '@/components/ui/input'
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
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface PlanFormProps {
  verticalId: string
  verticalName: string
  plan?: VerticalPlanWithKPIs
  calendarYear?: number
}

// Default KPI structure
const defaultKPI = {
  kpi_name: '',
  metric_type: METRIC_TYPES.COUNT as MetricType,
  target_q1: 0,
  target_q2: 0,
  target_q3: 0,
  target_q4: 0,
  weight: 10,
  display_order: 0,
}

export function PlanForm({ verticalId, verticalName, plan, calendarYear }: PlanFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!plan

  // Calculate current calendar year if not provided
  const currentCalendarYear = calendarYear || new Date().getFullYear()

  const form = useForm<CreateVerticalPlanInput>({
    resolver: zodResolver(createVerticalPlanSchema) as Resolver<CreateVerticalPlanInput>,
    mode: 'onChange',
    defaultValues: {
      vertical_id: verticalId,
      calendar_year: plan?.calendar_year || currentCalendarYear,
      plan_name: (plan as any)?.plan_name || `${verticalName} Annual Plan ${currentCalendarYear}`,
      mission: (plan as any)?.mission || '',
      vision: (plan as any)?.vision || '',
      q1_budget: (plan as any)?.q1_budget || 0,
      q2_budget: (plan as any)?.q2_budget || 0,
      q3_budget: (plan as any)?.q3_budget || 0,
      q4_budget: (plan as any)?.q4_budget || 0,
      status: (plan?.status as CreateVerticalPlanInput['status']) || PLAN_STATUSES.DRAFT,
      kpis: plan?.kpis?.map((kpi) => ({
        kpi_name: kpi.kpi_name,
        metric_type: kpi.metric_type as MetricType,
        target_q1: kpi.target_q1,
        target_q2: kpi.target_q2,
        target_q3: kpi.target_q3,
        target_q4: kpi.target_q4,
        weight: kpi.weight,
        display_order: kpi.display_order,
      })) || [{ ...defaultKPI }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'kpis',
  })

  // Calculate total weight of KPIs
  const kpis = form.watch('kpis') || []
  const totalWeight = kpis.reduce((sum, kpi) => sum + (kpi.weight || 0), 0)
  const weightValid = Math.abs(totalWeight - 100) < 0.01

  // Add new KPI
  const addKPI = () => {
    append({
      ...defaultKPI,
      display_order: fields.length,
    })
  }

  // Remove KPI
  const removeKPI = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    } else {
      toast.error('At least one KPI is required')
    }
  }

  // Handle form validation errors
  const onError = (errors: any) => {
    // Get the first error message to display
    const errorMessages: string[] = []

    if (errors.plan_name) {
      errorMessages.push(`Plan Name: ${errors.plan_name.message}`)
    }
    if (errors.calendar_year) {
      errorMessages.push(`Calendar Year: ${errors.calendar_year.message}`)
    }
    if (errors.total_budget) {
      errorMessages.push(`Total Budget: ${errors.total_budget.message}`)
    }
    if (errors.kpis) {
      if (errors.kpis.message) {
        errorMessages.push(`KPIs: ${errors.kpis.message}`)
      } else if (Array.isArray(errors.kpis)) {
        errors.kpis.forEach((kpiError: any, index: number) => {
          if (kpiError?.kpi_name?.message) {
            errorMessages.push(`KPI ${index + 1}: ${kpiError.kpi_name.message}`)
          }
          if (kpiError?.weight?.message) {
            errorMessages.push(`KPI ${index + 1} Weight: ${kpiError.weight.message}`)
          }
        })
      }
    }

    if (errorMessages.length > 0) {
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Please fix the following errors:</span>
          {errorMessages.slice(0, 3).map((msg, i) => (
            <span key={i} className="text-sm">• {msg}</span>
          ))}
          {errorMessages.length > 3 && (
            <span className="text-sm text-muted-foreground">
              ...and {errorMessages.length - 3} more
            </span>
          )}
        </div>,
        { duration: 5000 }
      )
    } else {
      toast.error('Please fill in all required fields correctly')
    }
  }

  const onSubmit = (data: CreateVerticalPlanInput) => {
    if (!weightValid && data.kpis && data.kpis.length > 0) {
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">KPI Weight Error</span>
          <span className="text-sm">Total KPI weights must equal exactly 100%</span>
          <span className="text-sm text-muted-foreground">Current total: {totalWeight}%</span>
        </div>,
        { duration: 4000 }
      )
      return
    }

    startTransition(async () => {
      try {
        if (isEditing && plan) {
          const result = await updateVerticalPlan(plan.id, data as UpdateVerticalPlanInput)
          if (result.success) {
            toast.success(
              <div className="flex flex-col">
                <span className="font-semibold">Plan Updated!</span>
                <span className="text-sm">Your changes have been saved successfully.</span>
              </div>
            )
            router.push(`/verticals/${verticalId}`)
            router.refresh()
          } else {
            toast.error(
              <div className="flex flex-col">
                <span className="font-semibold">Failed to Update Plan</span>
                <span className="text-sm">{result.error || 'An error occurred while saving.'}</span>
              </div>,
              { duration: 5000 }
            )
          }
        } else {
          const result = await createVerticalPlan(data)
          if (result.success && result.data) {
            toast.success(
              <div className="flex flex-col">
                <span className="font-semibold">Plan Created!</span>
                <span className="text-sm">Your new plan has been created successfully.</span>
              </div>
            )
            router.push(`/verticals/${verticalId}`)
          } else {
            toast.error(
              <div className="flex flex-col">
                <span className="font-semibold">Failed to Create Plan</span>
                <span className="text-sm">{result.error || 'An error occurred while creating the plan.'}</span>
              </div>,
              { duration: 5000 }
            )
          }
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        toast.error(
          <div className="flex flex-col">
            <span className="font-semibold">Unexpected Error</span>
            <span className="text-sm">Something went wrong. Please try again.</span>
          </div>,
          { duration: 5000 }
        )
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
        {/* Plan Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
            <CardDescription>
              Define the annual plan for {verticalName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Plan Name */}
              <FormField
                control={form.control}
                name="plan_name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Plan Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Masoom Annual Plan FY2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Calendar Year */}
              <FormField
                control={form.control}
                name="calendar_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calendar Year *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select calendar year" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[currentCalendarYear - 1, currentCalendarYear, currentCalendarYear + 1].map(
                          (year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year} (Jan - Dec)
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>

            {/* Quarterly Budgets */}
            <div>
              <h4 className="text-sm font-medium mb-3">Budget Allocation (₹)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="q1_budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Q1 Budget</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          {...field}
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="q2_budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Q2 Budget</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          {...field}
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="q3_budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Q3 Budget</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          {...field}
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="q4_budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Q4 Budget</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          {...field}
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Total Budget: ₹{(
                  (form.watch('q1_budget') || 0) +
                  (form.watch('q2_budget') || 0) +
                  (form.watch('q3_budget') || 0) +
                  (form.watch('q4_budget') || 0)
                ).toLocaleString()}
              </p>
            </div>

            {/* Vision */}
            <FormField
              control={form.control}
              name="vision"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vision</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the vision for this vertical's annual plan..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mission */}
            <FormField
              control={form.control}
              name="mission"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mission</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the mission for this vertical..."
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* KPIs Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Key Performance Indicators (KPIs)
                </CardTitle>
                <CardDescription>
                  Define measurable targets for each quarter
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={weightValid ? 'default' : 'destructive'}
                  className="text-sm"
                >
                  Total Weight: {totalWeight}%
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Weight Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Weight Distribution</span>
                <span className={cn(weightValid ? 'text-green-600' : 'text-destructive')}>
                  {totalWeight}% / 100%
                </span>
              </div>
              <Progress
                value={Math.min(totalWeight, 100)}
                className={cn(!weightValid && totalWeight > 100 && 'bg-destructive/20')}
              />
            </div>

            {!weightValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Total KPI weights must equal exactly 100%. Current total: {totalWeight}%
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* KPI List */}
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="border-dashed">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2 mb-4">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />
                      <div className="flex-1 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          {/* KPI Name */}
                          <FormField
                            control={form.control}
                            name={`kpis.${index}.kpi_name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>KPI Name *</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., Sessions conducted"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Metric Type */}
                          <FormField
                            control={form.control}
                            name={`kpis.${index}.metric_type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Metric Type *</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {Object.entries(METRIC_TYPE_LABELS).map(
                                      ([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                          {label}
                                        </SelectItem>
                                      )
                                    )}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Quarterly Targets */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <FormField
                            control={form.control}
                            name={`kpis.${index}.target_q1`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Q1 Target</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={0}
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`kpis.${index}.target_q2`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Q2 Target</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={0}
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`kpis.${index}.target_q3`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Q3 Target</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={0}
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`kpis.${index}.target_q4`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Q4 Target</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={0}
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Weight */}
                        <div className="flex items-end gap-4">
                          <FormField
                            control={form.control}
                            name={`kpis.${index}.weight`}
                            render={({ field }) => (
                              <FormItem className="flex-1 max-w-[150px]">
                                <FormLabel>Weight (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    {...field}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="text-sm text-muted-foreground pb-2">
                            Annual Target:{' '}
                            {(form.watch(`kpis.${index}.target_q1`) || 0) +
                              (form.watch(`kpis.${index}.target_q2`) || 0) +
                              (form.watch(`kpis.${index}.target_q3`) || 0) +
                              (form.watch(`kpis.${index}.target_q4`) || 0)}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeKPI(index)}
                        disabled={fields.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addKPI} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add KPI
            </Button>
          </CardContent>
        </Card>

        {/* Hidden fields */}
        <input type="hidden" {...form.register('vertical_id')} />

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
          <Button type="submit" disabled={isPending || !weightValid}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Update Plan' : 'Create Plan'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
