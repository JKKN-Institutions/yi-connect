'use client'

/**
 * Achievement Form Component
 *
 * Form for creating and editing vertical achievements.
 * Module 9: Vertical Performance Tracker
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Trophy, Award, Star, Target, Lightbulb } from 'lucide-react'
import { createAchievement, updateAchievement } from '@/app/actions/vertical'
import {
  createAchievementSchema,
  updateAchievementSchema,
  type CreateAchievementInput,
  type UpdateAchievementInput,
} from '@/lib/validations/vertical'
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_LABELS,
  type VerticalAchievement,
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
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface AchievementFormProps {
  verticalId: string
  verticalName: string
  userId: string
  achievement?: VerticalAchievement
  onSuccess?: () => void
}

// Category icons mapping
const categoryIcons = {
  [ACHIEVEMENT_CATEGORIES.AWARD]: Award,
  [ACHIEVEMENT_CATEGORIES.MILESTONE]: Target,
  [ACHIEVEMENT_CATEGORIES.RECOGNITION]: Star,
  [ACHIEVEMENT_CATEGORIES.IMPACT]: Trophy,
  [ACHIEVEMENT_CATEGORIES.INNOVATION]: Lightbulb,
}

export function AchievementForm({
  verticalId,
  verticalName,
  userId,
  achievement,
  onSuccess,
}: AchievementFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!achievement

  const form = useForm<CreateAchievementInput>({
    resolver: zodResolver(createAchievementSchema),
    mode: 'onChange',
    defaultValues: {
      vertical_id: verticalId,
      achievement_date: achievement?.achievement_date || new Date().toISOString().split('T')[0],
      title: achievement?.title || '',
      description: achievement?.description || '',
      category: (achievement?.category as CreateAchievementInput['category']) || ACHIEVEMENT_CATEGORIES.MILESTONE,
      impact_metrics: (achievement?.impact_metrics as Record<string, unknown>) || null,
      recognition_type: achievement?.recognition_type || '',
      photo_urls: achievement?.photo_urls || [],
      created_by: userId,
    },
  })

  const selectedCategory = form.watch('category')
  const CategoryIcon = categoryIcons[selectedCategory as keyof typeof categoryIcons] || Trophy

  const onSubmit = (data: CreateAchievementInput) => {
    startTransition(async () => {
      try {
        if (isEditing && achievement) {
          const result = await updateAchievement(achievement.id, data as UpdateAchievementInput)
          if (result.success) {
            toast.success('Achievement updated successfully')
            if (onSuccess) {
              onSuccess()
            } else {
              router.push(`/verticals/${verticalId}`)
              router.refresh()
            }
          } else {
            toast.error(result.error || 'Failed to update achievement')
          }
        } else {
          const result = await createAchievement(data)
          if (result.success) {
            toast.success('Achievement recorded successfully')
            if (onSuccess) {
              onSuccess()
            } else {
              router.push(`/verticals/${verticalId}`)
            }
          } else {
            toast.error(result.error || 'Failed to create achievement')
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
        {/* Achievement Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CategoryIcon className="h-5 w-5 text-yellow-500" />
              Achievement Details
            </CardTitle>
            <CardDescription>
              Record an achievement for {verticalName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Achievement Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Achievement Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Best Vertical Award 2024"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Category */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ACHIEVEMENT_CATEGORY_LABELS).map(([value, label]) => {
                          const Icon = categoryIcons[value as keyof typeof categoryIcons] || Trophy
                          return (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {label}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Achievement Date */}
              <FormField
                control={form.control}
                name="achievement_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Achievement Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Recognition Type */}
            <FormField
              control={form.control}
              name="recognition_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recognition Type</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., National Award, Chapter Recognition, etc."
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    The type or level of recognition received
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the achievement, its significance, and how it was attained..."
                      className="min-h-[120px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide details about this achievement
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Category-specific Tips */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <CategoryIcon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {selectedCategory === ACHIEVEMENT_CATEGORIES.AWARD && 'Recording an Award'}
                  {selectedCategory === ACHIEVEMENT_CATEGORIES.MILESTONE && 'Recording a Milestone'}
                  {selectedCategory === ACHIEVEMENT_CATEGORIES.RECOGNITION && 'Recording Recognition'}
                  {selectedCategory === ACHIEVEMENT_CATEGORIES.IMPACT && 'Recording Impact'}
                  {selectedCategory === ACHIEVEMENT_CATEGORIES.INNOVATION && 'Recording Innovation'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedCategory === ACHIEVEMENT_CATEGORIES.AWARD &&
                    'Include the awarding body, criteria met, and any certificate/trophy received.'}
                  {selectedCategory === ACHIEVEMENT_CATEGORIES.MILESTONE &&
                    'Document the specific milestone reached, such as member counts, events completed, or targets achieved.'}
                  {selectedCategory === ACHIEVEMENT_CATEGORIES.RECOGNITION &&
                    'Note who recognized the vertical, the context, and any public acknowledgment.'}
                  {selectedCategory === ACHIEVEMENT_CATEGORIES.IMPACT &&
                    'Quantify the impact with specific numbers, testimonials, or measurable outcomes.'}
                  {selectedCategory === ACHIEVEMENT_CATEGORIES.INNOVATION &&
                    'Describe the innovative approach, its implementation, and the problem it solved.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hidden fields */}
        <input type="hidden" {...form.register('vertical_id')} />
        <input type="hidden" {...form.register('created_by')} />

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
            {isEditing ? 'Update Achievement' : 'Record Achievement'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
