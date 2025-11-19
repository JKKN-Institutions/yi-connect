'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, X } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { createSuccessionPosition, updateSuccessionPosition } from '@/app/actions/succession'
import { CreateSuccessionPositionSchema } from '@/lib/validations/succession'
import type { SuccessionPosition } from '@/lib/types/succession'
import toast from 'react-hot-toast'

type FormData = z.infer<typeof CreateSuccessionPositionSchema>

interface SuccessionPositionFormProps {
  cycleId: string
  position?: SuccessionPosition
}

const hierarchyLevels = [
  { value: 1, label: 'Level 1 - Executive' },
  { value: 2, label: 'Level 2 - Senior Leadership' },
  { value: 3, label: 'Level 3 - Mid Leadership' },
  { value: 4, label: 'Level 4 - Team Lead' },
  { value: 5, label: 'Level 5 - Entry Leadership' },
]

export function SuccessionPositionForm({
  cycleId,
  position,
}: SuccessionPositionFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requiredSkills, setRequiredSkills] = useState<string[]>(
    position?.eligibility_criteria.required_skills || []
  )
  const [newSkill, setNewSkill] = useState('')

  const form = useForm<FormData>({
    resolver: zodResolver(CreateSuccessionPositionSchema),
    defaultValues: {
      cycle_id: cycleId,
      title: position?.title || '',
      description: position?.description || '',
      hierarchy_level: position?.hierarchy_level || 3,
      number_of_openings: position?.number_of_openings || 1,
      eligibility_criteria: {
        min_tenure: position?.eligibility_criteria.min_tenure || undefined,
        min_events: position?.eligibility_criteria.min_events || undefined,
        required_skills: position?.eligibility_criteria.required_skills || [],
        min_leadership_experience:
          position?.eligibility_criteria.min_leadership_experience || false,
        tenure_weight: position?.eligibility_criteria.tenure_weight || 25,
        events_weight: position?.eligibility_criteria.events_weight || 25,
        leadership_weight: position?.eligibility_criteria.leadership_weight || 25,
        skills_weight: position?.eligibility_criteria.skills_weight || 25,
        minimum_score: position?.eligibility_criteria.minimum_score || 60,
      },
    },
  })

  const addSkill = () => {
    if (newSkill.trim() && !requiredSkills.includes(newSkill.trim())) {
      const updated = [...requiredSkills, newSkill.trim()]
      setRequiredSkills(updated)
      form.setValue('eligibility_criteria.required_skills', updated)
      setNewSkill('')
    }
  }

  const removeSkill = (skill: string) => {
    const updated = requiredSkills.filter((s) => s !== skill)
    setRequiredSkills(updated)
    form.setValue('eligibility_criteria.required_skills', updated)
  }

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('cycle_id', data.cycle_id)
    formData.append('title', data.title)
    if (data.description) formData.append('description', data.description)
    formData.append('hierarchy_level', data.hierarchy_level.toString())
    formData.append('number_of_openings', data.number_of_openings.toString())
    formData.append(
      'eligibility_criteria',
      JSON.stringify(data.eligibility_criteria)
    )

    const result = position
      ? await updateSuccessionPosition(position.id, formData)
      : await createSuccessionPosition(formData)

    if (result.success) {
      toast.success(position ? 'Position updated successfully' : 'Position created successfully')
      router.push(`/succession/admin/cycles/${cycleId}`)
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to save position')
    }

    setIsSubmitting(false)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Basic Information</h3>
            <p className="text-sm text-muted-foreground">
              Define the position title and details
            </p>
          </div>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Position Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Chair, Co-Chair, Secretary" {...field} />
                </FormControl>
                <FormDescription>The title of this leadership position</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the responsibilities and requirements..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Additional details about this position
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="hierarchy_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hierarchy Level</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hierarchyLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value.toString()}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The seniority level of this position (1-5)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="number_of_openings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Openings</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    How many positions are available
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Eligibility Criteria */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Eligibility Criteria</h3>
            <p className="text-sm text-muted-foreground">
              Define the requirements and scoring weights
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="eligibility_criteria.min_tenure"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Tenure (Years)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="e.g., 1"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>Minimum years of membership</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eligibility_criteria.min_events"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Events Participated</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder="e.g., 5"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                      }
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>Minimum event participation count</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="eligibility_criteria.required_skills"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Required Skills</FormLabel>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a skill..."
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addSkill()
                        }
                      }}
                    />
                    <Button type="button" size="sm" onClick={addSkill}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {requiredSkills.map((skill) => (
                        <div
                          key={skill}
                          className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <FormDescription>Skills required for this position</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-6 md:grid-cols-4">
            <FormField
              control={form.control}
              name="eligibility_criteria.tenure_weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenure Weight (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                      }
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eligibility_criteria.events_weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Events Weight (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                      }
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eligibility_criteria.leadership_weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leadership Weight (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                      }
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eligibility_criteria.skills_weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skills Weight (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                      }
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
            name="eligibility_criteria.minimum_score"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Eligibility Score (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    {...field}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  Members must score at least this percentage to be eligible
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {position ? 'Update Position' : 'Create Position'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
