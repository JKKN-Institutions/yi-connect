'use client'

/**
 * Vertical Form Component
 *
 * Form for creating and editing verticals.
 * Module 9: Vertical Performance Tracker
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Palette, Sparkles } from 'lucide-react'
import { createVertical, updateVertical } from '@/app/actions/vertical'
import {
  createVerticalSchema,
  updateVerticalSchema,
  type CreateVerticalInput,
  type UpdateVerticalInput,
} from '@/lib/validations/vertical'
import { DEFAULT_VERTICAL_COLORS, DEFAULT_VERTICAL_ICONS } from '@/types/vertical'
import type { VerticalWithChair } from '@/types/vertical'
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
import { Switch } from '@/components/ui/switch'
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

interface VerticalFormProps {
  vertical?: VerticalWithChair
  chapterId: string
}

export function VerticalForm({ vertical, chapterId }: VerticalFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!vertical

  const form = useForm<CreateVerticalInput>({
    resolver: zodResolver(createVerticalSchema) as Resolver<CreateVerticalInput>,
    mode: 'onChange',
    defaultValues: {
      chapter_id: vertical?.chapter_id || chapterId,
      name: vertical?.name || '',
      slug: vertical?.slug || '',
      description: vertical?.description || '',
      color: vertical?.color || DEFAULT_VERTICAL_COLORS[0],
      icon: vertical?.icon || DEFAULT_VERTICAL_ICONS[0],
      is_active: vertical?.is_active ?? true,
      display_order: vertical?.display_order || 0,
    },
  })

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    form.setValue('name', name)
    // Auto-generate slug if not editing or if slug is empty
    if (!isEditing || !form.getValues('slug')) {
      form.setValue('slug', generateSlug(name))
    }
  }

  const onSubmit = (data: CreateVerticalInput) => {
    startTransition(async () => {
      try {
        if (isEditing && vertical) {
          const result = await updateVertical(vertical.id, data as UpdateVerticalInput)
          if (result.success) {
            toast.success('Vertical updated successfully')
            router.push(`/verticals/${vertical.id}`)
            router.refresh()
          } else {
            toast.error(result.error || 'Failed to update vertical')
          }
        } else {
          const result = await createVertical(data)
          if (result.success && result.data) {
            toast.success('Vertical created successfully')
            router.push(`/verticals/${result.data.id}`)
          } else {
            toast.error(result.error || 'Failed to create vertical')
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
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the basic details for this vertical
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vertical Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Masoom, Yuva, Health"
                      {...field}
                      onChange={handleNameChange}
                    />
                  </FormControl>
                  <FormDescription>
                    The display name for this vertical
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Slug */}
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., masoom, yuva, health"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    URL-friendly identifier (auto-generated from name)
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
                      placeholder="Describe the purpose and goals of this vertical..."
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Brief description of the vertical's focus area
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how this vertical appears in the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Color Picker */}
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Color</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg border-2 border-border"
                          style={{ backgroundColor: field.value || '#3b82f6' }}
                        />
                        <Input
                          placeholder="#3b82f6"
                          {...field}
                          value={field.value || ''}
                          className="max-w-[150px]"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {DEFAULT_VERTICAL_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => form.setValue('color', color)}
                            className={cn(
                              'h-8 w-8 rounded-md border-2 transition-all',
                              field.value === color
                                ? 'border-primary ring-2 ring-primary ring-offset-2'
                                : 'border-transparent hover:border-muted-foreground/30'
                            )}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Choose a brand color for this vertical
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Icon Selector */}
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an icon" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DEFAULT_VERTICAL_ICONS.map((icon) => (
                        <SelectItem key={icon} value={icon}>
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            {icon}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Icon to represent this vertical (Lucide icon name)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Display Order */}
            <FormField
              control={form.control}
              name="display_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Order</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Order in which this vertical appears (lower numbers first)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              Control the visibility of this vertical
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Inactive verticals are hidden from the dashboard
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
          </CardContent>
        </Card>

        {/* Hidden chapter_id field */}
        <input type="hidden" {...form.register('chapter_id')} />

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
            {isEditing ? 'Update Vertical' : 'Create Vertical'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
