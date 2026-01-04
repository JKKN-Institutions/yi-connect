'use client'

/**
 * AAA Plan Builder Form Component
 *
 * Form for creating and editing AAA Plans (Awareness → Action → Advocacy)
 * Used by EC Chairs during Pathfinder to plan their vertical's annual activities.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  Megaphone,
  Rocket,
  Shield,
  Calendar,
  Lock,
  Target,
  CalendarCheck,
  Info,
  Users,
  BarChart3,
  ChevronDown,
  Plus,
  X,
  Sparkles,
} from 'lucide-react'
import { createAAAPlan, updateAAAPlan, lockFirstEventDate } from '@/app/actions/aaa'
import {
  createAAAPlanSchema,
  updateAAAPlanSchema,
  type CreateAAAPlanInput,
  type UpdateAAAPlanInput,
} from '@/lib/validations/aaa'
import type { AAAPlanWithDetails } from '@/types/aaa'
import type { AAADefaults } from '@/lib/data/aaa-defaults'
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  ActivityTemplatePicker,
  type ActivitySlotType,
  type TemplateSelection,
} from './activity-template-picker'

interface AAAPlanFormProps {
  verticalId: string
  verticalName: string
  chapterId: string
  plan?: AAAPlanWithDetails
  calendarYear?: number
  /** Pre-populated suggestions from Pathfinder 2026 (only used for new plans) */
  defaults?: AAADefaults
}

export function AAAPlanForm({
  verticalId,
  verticalName,
  chapterId,
  plan,
  calendarYear,
  defaults,
}: AAAPlanFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLocking, setIsLocking] = useState(false)
  const isEditing = !!plan

  // Stretch goal toggles
  const [hasStretchAwareness, setHasStretchAwareness] = useState(plan?.has_stretch_awareness || false)
  const [hasStretchAction, setHasStretchAction] = useState(plan?.has_stretch_action || false)
  const [hasStretchAdvocacy, setHasStretchAdvocacy] = useState(plan?.has_stretch_advocacy || false)

  // Template picker state
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [templatePickerSlot, setTemplatePickerSlot] = useState<{
    type: ActivitySlotType
    number: number
  }>({ type: 'awareness', number: 1 })

  // Open template picker for a specific slot
  const openTemplatePicker = (type: ActivitySlotType, number: number) => {
    setTemplatePickerSlot({ type, number })
    setTemplatePickerOpen(true)
  }

  // Handle template selection
  const handleTemplateSelect = (template: TemplateSelection) => {
    const { type, number } = templatePickerSlot
    const prefix = `${type}_${number}` as const

    // Map template fields to form fields
    if (template.title) {
      form.setValue(`${prefix}_title` as keyof CreateAAAPlanInput, template.title)
    }
    if (template.description) {
      form.setValue(`${prefix}_description` as keyof CreateAAAPlanInput, template.description)
    }
    if (type === 'awareness' && template.audience) {
      form.setValue(`${prefix}_audience` as keyof CreateAAAPlanInput, template.audience)
    }
    if (type === 'action' && template.target) {
      form.setValue(`${prefix}_target` as keyof CreateAAAPlanInput, template.target)
    }
    if (template.targetAttendance) {
      form.setValue(`${prefix}_target_attendance` as keyof CreateAAAPlanInput, template.targetAttendance)
    }
    if (template.engagementGoal) {
      form.setValue(`${prefix}_engagement_goal` as keyof CreateAAAPlanInput, template.engagementGoal)
    }
    if (template.impactMeasures) {
      form.setValue(`${prefix}_impact_measures` as keyof CreateAAAPlanInput, template.impactMeasures)
    }

    toast.success('Template applied!')
  }

  // Get current calendar year if not provided
  const currentCalendarYear = calendarYear || new Date().getFullYear()

  // Use defaults for new plans (not editing), fallback to empty strings
  const getStringDefault = (field: keyof NonNullable<typeof defaults>): string => {
    // For new plans, use defaults if available (string fields only)
    const value = defaults?.[field]
    return typeof value === 'string' ? value : ''
  }

  const getNumberDefault = (field: keyof NonNullable<typeof defaults>): number | undefined => {
    // For new plans, use defaults if available (number fields only)
    const value = defaults?.[field]
    return typeof value === 'number' ? value : undefined
  }

  const form = useForm<CreateAAAPlanInput>({
    resolver: zodResolver(createAAAPlanSchema) as Resolver<CreateAAAPlanInput>,
    mode: 'onChange',
    defaultValues: {
      vertical_id: verticalId,
      chapter_id: chapterId,
      calendar_year: plan?.calendar_year || currentCalendarYear,

      // Awareness 1
      awareness_1_title: plan?.awareness_1_title || getStringDefault('awareness_1_title'),
      awareness_1_description: plan?.awareness_1_description || getStringDefault('awareness_1_description'),
      awareness_1_audience: plan?.awareness_1_audience || getStringDefault('awareness_1_audience'),
      awareness_1_target_date: plan?.awareness_1_target_date || '',
      awareness_1_target_attendance: plan?.awareness_1_target_attendance || defaults?.awareness_1_target_attendance || undefined,
      awareness_1_engagement_goal: plan?.awareness_1_engagement_goal || getStringDefault('awareness_1_engagement_goal'),
      awareness_1_impact_measures: plan?.awareness_1_impact_measures || getStringDefault('awareness_1_impact_measures'),

      // Awareness 2
      awareness_2_title: plan?.awareness_2_title || getStringDefault('awareness_2_title'),
      awareness_2_description: plan?.awareness_2_description || getStringDefault('awareness_2_description'),
      awareness_2_audience: plan?.awareness_2_audience || getStringDefault('awareness_2_audience'),
      awareness_2_target_date: plan?.awareness_2_target_date || '',
      awareness_2_target_attendance: plan?.awareness_2_target_attendance || defaults?.awareness_2_target_attendance || undefined,
      awareness_2_engagement_goal: plan?.awareness_2_engagement_goal || getStringDefault('awareness_2_engagement_goal'),
      awareness_2_impact_measures: plan?.awareness_2_impact_measures || getStringDefault('awareness_2_impact_measures'),

      // Awareness 3
      awareness_3_title: plan?.awareness_3_title || getStringDefault('awareness_3_title'),
      awareness_3_description: plan?.awareness_3_description || getStringDefault('awareness_3_description'),
      awareness_3_audience: plan?.awareness_3_audience || getStringDefault('awareness_3_audience'),
      awareness_3_target_date: plan?.awareness_3_target_date || '',
      awareness_3_target_attendance: plan?.awareness_3_target_attendance || defaults?.awareness_3_target_attendance || undefined,
      awareness_3_engagement_goal: plan?.awareness_3_engagement_goal || getStringDefault('awareness_3_engagement_goal'),
      awareness_3_impact_measures: plan?.awareness_3_impact_measures || getStringDefault('awareness_3_impact_measures'),

      // Action 1
      action_1_title: plan?.action_1_title || getStringDefault('action_1_title'),
      action_1_description: plan?.action_1_description || getStringDefault('action_1_description'),
      action_1_target: plan?.action_1_target || getStringDefault('action_1_target'),
      action_1_target_date: plan?.action_1_target_date || '',
      action_1_target_attendance: plan?.action_1_target_attendance || defaults?.action_1_target_attendance || undefined,
      action_1_engagement_goal: plan?.action_1_engagement_goal || getStringDefault('action_1_engagement_goal'),
      action_1_impact_measures: plan?.action_1_impact_measures || getStringDefault('action_1_impact_measures'),

      // Action 2
      action_2_title: plan?.action_2_title || getStringDefault('action_2_title'),
      action_2_description: plan?.action_2_description || getStringDefault('action_2_description'),
      action_2_target: plan?.action_2_target || getStringDefault('action_2_target'),
      action_2_target_date: plan?.action_2_target_date || '',
      action_2_target_attendance: plan?.action_2_target_attendance || defaults?.action_2_target_attendance || undefined,
      action_2_engagement_goal: plan?.action_2_engagement_goal || getStringDefault('action_2_engagement_goal'),
      action_2_impact_measures: plan?.action_2_impact_measures || getStringDefault('action_2_impact_measures'),

      // First Event
      first_event_date: plan?.first_event_date || '',

      // Advocacy
      advocacy_goal: plan?.advocacy_goal || getStringDefault('advocacy_goal'),
      advocacy_target_contact: plan?.advocacy_target_contact || getStringDefault('advocacy_target_contact'),
      advocacy_approach: plan?.advocacy_approach || getStringDefault('advocacy_approach'),

      // Milestones
      milestone_jan_target: plan?.milestone_jan_target || getStringDefault('milestone_jan_target'),
      milestone_feb_target: plan?.milestone_feb_target || getStringDefault('milestone_feb_target'),
      milestone_mar_target: plan?.milestone_mar_target || getStringDefault('milestone_mar_target'),

      // Stretch Goals
      has_stretch_awareness: plan?.has_stretch_awareness || false,
      has_stretch_action: plan?.has_stretch_action || false,
      has_stretch_advocacy: plan?.has_stretch_advocacy || false,

      // Awareness 4 (Stretch)
      awareness_4_title: plan?.awareness_4_title || '',
      awareness_4_description: plan?.awareness_4_description || '',
      awareness_4_audience: plan?.awareness_4_audience || '',
      awareness_4_target_date: plan?.awareness_4_target_date || '',
      awareness_4_target_attendance: plan?.awareness_4_target_attendance || undefined,
      awareness_4_engagement_goal: plan?.awareness_4_engagement_goal || '',
      awareness_4_impact_measures: plan?.awareness_4_impact_measures || '',

      // Action 3 (Stretch)
      action_3_title: plan?.action_3_title || '',
      action_3_description: plan?.action_3_description || '',
      action_3_target: plan?.action_3_target || '',
      action_3_target_date: plan?.action_3_target_date || '',
      action_3_target_attendance: plan?.action_3_target_attendance || undefined,
      action_3_engagement_goal: plan?.action_3_engagement_goal || '',
      action_3_impact_measures: plan?.action_3_impact_measures || '',

      // Advocacy 2 (Stretch)
      advocacy_2_goal: plan?.advocacy_2_goal || '',
      advocacy_2_target_contact: plan?.advocacy_2_target_contact || '',
      advocacy_2_approach: plan?.advocacy_2_approach || '',
    },
  })

  const firstEventDate = form.watch('first_event_date')
  const isFirstEventLocked = plan?.first_event_locked || false

  const handleLockFirstEvent = async () => {
    if (!plan?.id || !firstEventDate) {
      toast.error('Please save the plan and set a first event date first')
      return
    }

    setIsLocking(true)
    try {
      const result = await lockFirstEventDate(plan.id, firstEventDate)
      if (result.success) {
        toast.success(
          <div className="flex flex-col">
            <span className="font-semibold">First Event Date Locked!</span>
            <span className="text-sm">This date cannot be changed anymore.</span>
          </div>
        )
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to lock first event date')
      }
    } catch (error) {
      toast.error('An error occurred while locking the date')
    } finally {
      setIsLocking(false)
    }
  }

  const onSubmit = (data: CreateAAAPlanInput) => {
    startTransition(async () => {
      try {
        if (isEditing && plan) {
          const result = await updateAAAPlan({ id: plan.id, ...data } as UpdateAAAPlanInput)
          if (result.success) {
            toast.success(
              <div className="flex flex-col">
                <span className="font-semibold">AAA Plan Updated!</span>
                <span className="text-sm">Your changes have been saved.</span>
              </div>
            )
            router.push(`/pathfinder`)
            router.refresh()
          } else {
            toast.error(result.error || 'Failed to update AAA plan')
          }
        } else {
          const result = await createAAAPlan(data)
          if (result.success && result.data) {
            toast.success(
              <div className="flex flex-col">
                <span className="font-semibold">AAA Plan Created!</span>
                <span className="text-sm">Your plan has been saved successfully.</span>
              </div>
            )
            router.push(`/pathfinder`)
          } else {
            toast.error(result.error || 'Failed to create AAA plan')
          }
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <TooltipProvider>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Header Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>AAA Framework for {verticalName}</AlertTitle>
            <AlertDescription>
              Plan your vertical's activities: 3 Awareness sessions, 2 Action events, and 1 Advocacy goal.
              Set monthly milestones and lock your first event date commitment.
            </AlertDescription>
          </Alert>

          {/* Pre-filled suggestions notice */}
          {!isEditing && defaults && (
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
              <Megaphone className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">
                Pre-filled with Pathfinder 2026 Suggestions
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                This form has been pre-populated with suggested activities from the Yi Erode Pathfinder 2026 plan.
                Feel free to edit, modify, or replace any of these suggestions to fit your chapter's needs.
              </AlertDescription>
            </Alert>
          )}

          {/* AWARENESS SECTION */}
          <Card>
            <CardHeader className="bg-blue-50 dark:bg-blue-950/30 rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Megaphone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Awareness Activities</CardTitle>
                  <CardDescription>
                    3 sessions to create awareness about your vertical's cause
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Awareness 1 */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    Awareness #1
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => openTemplatePicker('awareness', 1)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Browse Templates
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="awareness_1_title"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Session Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Road Safety Workshop" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="awareness_1_audience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Audience</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., College Students" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="awareness_1_target_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="awareness_1_description"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the session objectives and format..."
                            className="min-h-[80px]"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Depth Metrics */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <BarChart3 className="h-4 w-4" />
                    <span>Depth Metrics</span>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="grid gap-4 sm:grid-cols-3 p-3 bg-muted/50 rounded-md">
                      <FormField
                        control={form.control}
                        name="awareness_1_target_attendance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Target Attendance
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                placeholder="e.g., 100"
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="awareness_1_engagement_goal"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Engagement Goal</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="What does success look like?"
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
                        name="awareness_1_impact_measures"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-3">
                            <FormLabel>Impact Measures</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="How will you measure impact? (e.g., surveys, quiz scores, sign-ups)"
                                className="min-h-[60px]"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Awareness 2 */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    Awareness #2
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => openTemplatePicker('awareness', 2)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Browse Templates
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="awareness_2_title"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Session Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Climate Change Seminar" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="awareness_2_audience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Audience</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., School Students" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="awareness_2_target_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="awareness_2_description"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the session objectives and format..."
                            className="min-h-[80px]"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Depth Metrics */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <BarChart3 className="h-4 w-4" />
                    <span>Depth Metrics</span>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="grid gap-4 sm:grid-cols-3 p-3 bg-muted/50 rounded-md">
                      <FormField
                        control={form.control}
                        name="awareness_2_target_attendance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Target Attendance
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                placeholder="e.g., 100"
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="awareness_2_engagement_goal"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Engagement Goal</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="What does success look like?"
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
                        name="awareness_2_impact_measures"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-3">
                            <FormLabel>Impact Measures</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="How will you measure impact? (e.g., surveys, quiz scores, sign-ups)"
                                className="min-h-[60px]"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Awareness 3 */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    Awareness #3
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => openTemplatePicker('awareness', 3)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Browse Templates
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="awareness_3_title"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Session Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Health Awareness Drive" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="awareness_3_audience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Audience</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Rural Communities" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="awareness_3_target_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="awareness_3_description"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the session objectives and format..."
                            className="min-h-[80px]"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Depth Metrics */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <BarChart3 className="h-4 w-4" />
                    <span>Depth Metrics</span>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="grid gap-4 sm:grid-cols-3 p-3 bg-muted/50 rounded-md">
                      <FormField
                        control={form.control}
                        name="awareness_3_target_attendance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Target Attendance
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                placeholder="e.g., 100"
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="awareness_3_engagement_goal"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Engagement Goal</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="What does success look like?"
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
                        name="awareness_3_impact_measures"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-3">
                            <FormLabel>Impact Measures</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="How will you measure impact? (e.g., surveys, quiz scores, sign-ups)"
                                className="min-h-[60px]"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Stretch Goal: Awareness 4 */}
              {!hasStretchAwareness ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
                  onClick={() => {
                    setHasStretchAwareness(true)
                    form.setValue('has_stretch_awareness', true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <Sparkles className="h-4 w-4 mr-1" />
                  Add 4th Awareness (Stretch Goal)
                </Button>
              ) : (
                <div className="space-y-4 p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Awareness #4 (Stretch)
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={() => openTemplatePicker('awareness', 4)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Templates
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setHasStretchAwareness(false)
                          form.setValue('has_stretch_awareness', false)
                          form.setValue('awareness_4_title', '')
                          form.setValue('awareness_4_description', '')
                          form.setValue('awareness_4_audience', '')
                          form.setValue('awareness_4_target_date', '')
                          form.setValue('awareness_4_target_attendance', undefined)
                          form.setValue('awareness_4_engagement_goal', '')
                          form.setValue('awareness_4_impact_measures', '')
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="awareness_4_title"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Session Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Advanced Workshop Series" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="awareness_4_audience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Audience</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Community Leaders" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="awareness_4_target_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="awareness_4_description"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the session objectives and format..."
                              className="min-h-[80px]"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Depth Metrics */}
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <BarChart3 className="h-4 w-4" />
                      <span>Depth Metrics</span>
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <div className="grid gap-4 sm:grid-cols-3 p-3 bg-muted/50 rounded-md">
                        <FormField
                          control={form.control}
                          name="awareness_4_target_attendance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Target Attendance
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="e.g., 100"
                                  {...field}
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="awareness_4_engagement_goal"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Engagement Goal</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="What does success look like?"
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
                          name="awareness_4_impact_measures"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-3">
                              <FormLabel>Impact Measures</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="How will you measure impact? (e.g., surveys, quiz scores, sign-ups)"
                                  className="min-h-[60px]"
                                  {...field}
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ACTION SECTION */}
          <Card>
            <CardHeader className="bg-orange-50 dark:bg-orange-950/30 rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <Rocket className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Action Events</CardTitle>
                  <CardDescription>
                    2 impactful events that drive real change
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Action 1 */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-orange-100 text-orange-800">
                    Action #1
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => openTemplatePicker('action', 1)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Browse Templates
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="action_1_title"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Event Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Tree Plantation Drive" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="action_1_target"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Impact Target</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 1000 trees planted" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="action_1_target_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="action_1_description"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the event plan and expected outcomes..."
                            className="min-h-[80px]"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Depth Metrics */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <BarChart3 className="h-4 w-4" />
                    <span>Depth Metrics</span>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="grid gap-4 sm:grid-cols-3 p-3 bg-muted/50 rounded-md">
                      <FormField
                        control={form.control}
                        name="action_1_target_attendance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Target Attendance
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                placeholder="e.g., 500"
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="action_1_engagement_goal"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Engagement Goal</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="What does success look like?"
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
                        name="action_1_impact_measures"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-3">
                            <FormLabel>Impact Measures</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="How will you measure impact? (e.g., trees planted, photos, beneficiaries)"
                                className="min-h-[60px]"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Action 2 */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-orange-100 text-orange-800">
                    Action #2
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => openTemplatePicker('action', 2)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Browse Templates
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="action_2_title"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Event Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Skill Development Camp" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="action_2_target"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Impact Target</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 500 youth trained" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="action_2_target_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="action_2_description"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the event plan and expected outcomes..."
                            className="min-h-[80px]"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Depth Metrics */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <BarChart3 className="h-4 w-4" />
                    <span>Depth Metrics</span>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
                    <div className="grid gap-4 sm:grid-cols-3 p-3 bg-muted/50 rounded-md">
                      <FormField
                        control={form.control}
                        name="action_2_target_attendance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Target Attendance
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                placeholder="e.g., 500"
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="action_2_engagement_goal"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Engagement Goal</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="What does success look like?"
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
                        name="action_2_impact_measures"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-3">
                            <FormLabel>Impact Measures</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="How will you measure impact? (e.g., beneficiaries, testimonials, coverage)"
                                className="min-h-[60px]"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Stretch Goal: Action 3 */}
              {!hasStretchAction ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed border-orange-300 text-orange-600 hover:bg-orange-50"
                  onClick={() => {
                    setHasStretchAction(true)
                    form.setValue('has_stretch_action', true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <Sparkles className="h-4 w-4 mr-1" />
                  Add 3rd Action (Stretch Goal)
                </Button>
              ) : (
                <div className="space-y-4 p-4 border-2 border-dashed border-orange-300 rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Action #3 (Stretch)
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={() => openTemplatePicker('action', 3)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Templates
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setHasStretchAction(false)
                          form.setValue('has_stretch_action', false)
                          form.setValue('action_3_title', '')
                          form.setValue('action_3_description', '')
                          form.setValue('action_3_target', '')
                          form.setValue('action_3_target_date', '')
                          form.setValue('action_3_target_attendance', undefined)
                          form.setValue('action_3_engagement_goal', '')
                          form.setValue('action_3_impact_measures', '')
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="action_3_title"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Event Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Community Service Day" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="action_3_target"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Impact Target</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 300 volunteers" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="action_3_target_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="action_3_description"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the event plan and expected outcomes..."
                              className="min-h-[80px]"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Depth Metrics */}
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <BarChart3 className="h-4 w-4" />
                      <span>Depth Metrics</span>
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <div className="grid gap-4 sm:grid-cols-3 p-3 bg-muted/50 rounded-md">
                        <FormField
                          control={form.control}
                          name="action_3_target_attendance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Target Attendance
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="e.g., 300"
                                  {...field}
                                  value={field.value ?? ''}
                                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="action_3_engagement_goal"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Engagement Goal</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="What does success look like?"
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
                          name="action_3_impact_measures"
                          render={({ field }) => (
                            <FormItem className="sm:col-span-3">
                              <FormLabel>Impact Measures</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="How will you measure impact? (e.g., beneficiaries, testimonials, coverage)"
                                  className="min-h-[60px]"
                                  {...field}
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              <Separator />

              {/* First Event Date */}
              <div className={cn(
                "p-4 border-2 rounded-lg",
                isFirstEventLocked
                  ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                  : "border-dashed border-orange-300"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className={cn(
                      "h-5 w-5",
                      isFirstEventLocked ? "text-green-600" : "text-orange-500"
                    )} />
                    <h4 className="font-semibold">First Event Commitment</h4>
                    {isFirstEventLocked && (
                      <Badge variant="default" className="bg-green-600">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                  {!isFirstEventLocked && isEditing && firstEventDate && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-orange-500 text-orange-600">
                          <Lock className="h-4 w-4 mr-1" />
                          Lock Date
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Lock First Event Date?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Once locked, this date cannot be changed. This is your commitment to
                            conduct your first event by <strong>{firstEventDate}</strong>.
                            <br /><br />
                            Are you sure you want to lock this date?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleLockFirstEvent}
                            disabled={isLocking}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            {isLocking ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Lock className="h-4 w-4 mr-2" />
                            )}
                            Lock Date
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="first_event_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Event Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ''}
                          disabled={isFirstEventLocked}
                          className={cn(isFirstEventLocked && "bg-muted")}
                        />
                      </FormControl>
                      <FormDescription>
                        {isFirstEventLocked
                          ? `Locked on ${plan?.first_event_locked_at ? new Date(plan.first_event_locked_at).toLocaleDateString() : 'Pathfinder'}`
                          : "Set the date for your first event. You can lock this later to show commitment."
                        }
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* ADVOCACY SECTION */}
          <Card>
            <CardHeader className="bg-purple-50 dark:bg-purple-950/30 rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Advocacy Goal</CardTitle>
                  <CardDescription>
                    1 policy advocacy or systemic change initiative
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <FormField
                control={form.control}
                name="advocacy_goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Advocacy Goal</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Advocate for mandatory road safety education in schools..."
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      What policy change or systemic improvement are you advocating for?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="advocacy_target_contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Contact / Authority</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., District Collector, Education Minister"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="advocacy_approach"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approach / Strategy</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="How do you plan to approach and achieve this advocacy goal?"
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Stretch Goal: Advocacy 2 */}
              {!hasStretchAdvocacy ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed border-purple-300 text-purple-600 hover:bg-purple-50"
                  onClick={() => {
                    setHasStretchAdvocacy(true)
                    form.setValue('has_stretch_advocacy', true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <Sparkles className="h-4 w-4 mr-1" />
                  Add 2nd Advocacy (Stretch Goal)
                </Button>
              ) : (
                <div className="space-y-4 p-4 border-2 border-dashed border-purple-300 rounded-lg bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Advocacy #2 (Stretch)
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setHasStretchAdvocacy(false)
                        form.setValue('has_stretch_advocacy', false)
                        form.setValue('advocacy_2_goal', '')
                        form.setValue('advocacy_2_target_contact', '')
                        form.setValue('advocacy_2_approach', '')
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name="advocacy_2_goal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Advocacy Goal</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Propose environmental policy changes..."
                            className="min-h-[100px]"
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          What additional policy change or systemic improvement are you advocating for?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="advocacy_2_target_contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Contact / Authority</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Mayor, State Minister"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="advocacy_2_approach"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approach / Strategy</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="How do you plan to approach and achieve this advocacy goal?"
                            className="min-h-[80px]"
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
            </CardContent>
          </Card>

          {/* 90-DAY MILESTONES */}
          <Card>
            <CardHeader className="bg-green-50 dark:bg-green-950/30 rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-500 rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>90-Day Milestones</CardTitle>
                  <CardDescription>
                    Monthly targets for the first quarter (Jan - Mar)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="milestone_jan_target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        January Target
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What will you achieve by end of January?"
                          className="min-h-[100px]"
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
                  name="milestone_feb_target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        February Target
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What will you achieve by end of February?"
                          className="min-h-[100px]"
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
                  name="milestone_mar_target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        March Target
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What will you achieve by end of March?"
                          className="min-h-[100px]"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Hidden fields */}
          <input type="hidden" {...form.register('vertical_id')} />
          <input type="hidden" {...form.register('chapter_id')} />
          <input type="hidden" {...form.register('calendar_year')} />

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
              {isEditing ? 'Update AAA Plan' : 'Create AAA Plan'}
            </Button>
          </div>
        </form>
      </Form>

      {/* Template Picker Dialog */}
      <ActivityTemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        slotType={templatePickerSlot.type}
        slotNumber={templatePickerSlot.number}
        onSelect={handleTemplateSelect}
        currentVerticalId={verticalId}
      />
    </TooltipProvider>
  )
}
