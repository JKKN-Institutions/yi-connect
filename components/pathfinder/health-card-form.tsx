'use client'

/**
 * Health Card Activity Reporting Form
 *
 * Dynamic form for logging activities by vertical.
 * Shows different fields based on the selected vertical.
 */

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  FileText,
  Users,
  Calendar,
  MapPin,
  Building2,
  Activity,
  CheckCircle2,
  Target,
} from 'lucide-react'
import { createHealthCardEntry } from '@/app/actions/health-card'
import {
  createHealthCardSchema,
  type CreateHealthCardInput,
} from '@/lib/validations/health-card'
import {
  SUBMITTER_ROLES,
  YI_REGIONS,
  AAA_TYPES,
  getVerticalSpecificFields,
  type VerticalSpecificField,
  type YiRegion,
  type SubmitterRole,
  type AAAType,
} from '@/types/health-card'
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
import { Separator } from '@/components/ui/separator'
import toast from 'react-hot-toast'

interface Vertical {
  id: string
  name: string
  slug: string
  color: string | null
  icon: string | null
}

interface Chapter {
  id: string
  name: string
  short_name: string | null
}

interface HealthCardFormProps {
  chapterId: string
  chapterName: string
  verticals: Vertical[]
  chapters?: Chapter[]
  defaultEmail?: string
  defaultName?: string
  defaultRole?: SubmitterRole
}

export function HealthCardForm({
  chapterId,
  chapterName,
  verticals,
  chapters = [],
  defaultEmail = '',
  defaultName = '',
  defaultRole = 'member',
}: HealthCardFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedVertical, setSelectedVertical] = useState<Vertical | null>(null)
  const [verticalSpecificFields, setVerticalSpecificFields] = useState<VerticalSpecificField[]>([])
  const [verticalData, setVerticalData] = useState<Record<string, unknown>>({})

  const form = useForm<CreateHealthCardInput>({
    resolver: zodResolver(createHealthCardSchema),
    defaultValues: {
      submitter_name: defaultName,
      submitter_role: defaultRole,
      email: defaultEmail,
      activity_date: new Date().toISOString().split('T')[0],
      activity_name: '',
      activity_description: '',
      aaa_type: undefined, // Optional AAA classification
      chapter_id: chapterId,
      region: 'srtn' as YiRegion,
      ec_members_count: 0,
      non_ec_members_count: 0,
      vertical_id: '',
      vertical_specific_data: {},
    },
  })

  // Update vertical-specific fields when vertical changes
  useEffect(() => {
    if (selectedVertical) {
      const fields = getVerticalSpecificFields(selectedVertical.slug)
      setVerticalSpecificFields(fields)
      // Reset vertical-specific data when changing vertical
      setVerticalData({})
    } else {
      setVerticalSpecificFields([])
      setVerticalData({})
    }
  }, [selectedVertical])

  const handleVerticalChange = (verticalId: string) => {
    const vertical = verticals.find((v) => v.id === verticalId)
    setSelectedVertical(vertical || null)
    form.setValue('vertical_id', verticalId)
  }

  const handleVerticalDataChange = (key: string, value: unknown) => {
    setVerticalData((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const onSubmit = (data: CreateHealthCardInput) => {
    startTransition(async () => {
      try {
        const result = await createHealthCardEntry({
          ...data,
          vertical_specific_data: verticalData,
        })
        if (result.success) {
          toast.success(
            <div className="flex flex-col">
              <span className="font-semibold">Activity Submitted!</span>
              <span className="text-sm">Health card entry recorded successfully.</span>
            </div>
          )
          router.push('/pathfinder/health-card')
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to submit activity')
        }
      } catch (error) {
        console.error('Error:', error)
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <FileText className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Chapter Health Card</CardTitle>
            <CardDescription className="text-lg">
              Log your vertical activity for {chapterName}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Submitter Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Submitter Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="submitter_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="submitter_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUBMITTER_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Activity Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Activity Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="activity_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="activity_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Name of the activity" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="activity_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the activity..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AAA Classification - Optional */}
            <FormField
              control={form.control}
              name="aaa_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-amber-600" />
                    AAA Classification
                    <Badge variant="outline" className="ml-1 font-normal">Optional</Badge>
                  </FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value || null)}
                    value={field.value || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select AAA type (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AAA_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{type.label}</span>
                            <span className="text-xs text-muted-foreground">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Classify this activity in the AAA Framework (Awareness → Action → Advocacy)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Chapter & Region */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Chapter & Region</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="chapter_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chapter *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select chapter" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {chapters.length > 0 ? (
                        chapters.map((chapter) => (
                          <SelectItem key={chapter.id} value={chapter.id}>
                            {chapter.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value={chapterId}>{chapterName}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {YI_REGIONS.map((region) => (
                        <SelectItem key={region.value} value={region.value}>
                          {region.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Participation */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Participation</CardTitle>
            </div>
            <CardDescription>
              Number of EC and Non-EC members who participated
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="ec_members_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>EC Members Participated *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>Executive Committee members</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="non_ec_members_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Non-EC Members Participated *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>Regular members and volunteers</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Vertical Selection */}
        <Card className="border-2 border-amber-200/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-lg">Vertical Selection</CardTitle>
            </div>
            <CardDescription>
              Select a vertical to see activity-specific fields
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="vertical_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vertical *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value)
                      handleVerticalChange(value)
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vertical" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {verticals.map((vertical) => (
                        <SelectItem key={vertical.id} value={vertical.id}>
                          <div className="flex items-center gap-2">
                            {vertical.color && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: vertical.color }}
                              />
                            )}
                            {vertical.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Vertical-Specific Fields */}
        {selectedVertical && verticalSpecificFields.length > 0 && (
          <Card className="border-2" style={{ borderColor: selectedVertical.color || '#e5e7eb' }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" style={{ color: selectedVertical.color || undefined }} />
                <CardTitle className="text-lg">{selectedVertical.name} - Activity Details</CardTitle>
              </div>
              <CardDescription>
                Additional fields specific to {selectedVertical.name} activities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {verticalSpecificFields.map((field) => (
                <div key={field.key}>
                  {field.type === 'select' && field.options ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {field.label} {field.required && '*'}
                      </label>
                      <Select
                        onValueChange={(value) => handleVerticalDataChange(field.key, value)}
                        value={(verticalData[field.key] as string) || ''}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : field.type === 'number' ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {field.label} {field.required && '*'}
                      </label>
                      <Input
                        type="number"
                        min={0}
                        placeholder={field.placeholder || '0'}
                        value={(verticalData[field.key] as number) || ''}
                        onChange={(e) =>
                          handleVerticalDataChange(field.key, parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                  ) : field.type === 'textarea' ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {field.label} {field.required && '*'}
                      </label>
                      <Textarea
                        placeholder={field.placeholder}
                        value={(verticalData[field.key] as string) || ''}
                        onChange={(e) => handleVerticalDataChange(field.key, e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {field.label} {field.required && '*'}
                      </label>
                      <Input
                        placeholder={field.placeholder}
                        value={(verticalData[field.key] as string) || ''}
                        onChange={(e) => handleVerticalDataChange(field.key, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} size="lg">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Submit Activity
          </Button>
        </div>
      </form>
    </Form>
  )
}
