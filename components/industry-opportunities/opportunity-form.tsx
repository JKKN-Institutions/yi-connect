'use client'

/**
 * Opportunity Form Component
 *
 * Form for creating and editing industry opportunities.
 * Used by industry coordinators to post opportunities.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  Plus,
  X,
  Building2,
  Calendar,
  Users,
  MapPin,
  Briefcase,
  Tag,
  FileText,
  DollarSign,
  Globe,
} from 'lucide-react'
import { createOpportunity, updateOpportunity } from '@/app/actions/industry-opportunity'
import {
  createOpportunitySchema,
  type CreateOpportunityInput,
} from '@/lib/validations/industry-opportunity'
import {
  OPPORTUNITY_TYPES,
  type OpportunityType,
  type IndustryOpportunity,
} from '@/types/industry-opportunity'
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
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface OpportunityFormProps {
  industryId: string
  chapterId: string
  opportunity?: IndustryOpportunity
  onSuccess?: (id: string) => void
  onCancel?: () => void
}

const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  industrial_visit: 'Industrial Visit',
  internship: 'Internship',
  mentorship: 'Mentorship',
  guest_lecture: 'Guest Lecture',
  job_opening: 'Job Opening',
  project_collaboration: 'Project Collaboration',
  training_program: 'Training Program',
  sponsorship: 'Sponsorship',
  csr_partnership: 'CSR Partnership',
  other: 'Other',
}

export function OpportunityForm({
  industryId,
  chapterId,
  opportunity,
  onSuccess,
  onCancel,
}: OpportunityFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentTab, setCurrentTab] = useState('basic')
  const [tagInput, setTagInput] = useState('')
  const [requirementInput, setRequirementInput] = useState('')
  const [benefitInput, setBenefitInput] = useState('')
  const [outcomeInput, setOutcomeInput] = useState('')

  const isEditing = !!opportunity

  const form = useForm<CreateOpportunityInput>({
    resolver: zodResolver(createOpportunitySchema) as any,
    defaultValues: {
      industry_id: opportunity?.industry_id || industryId,
      chapter_id: opportunity?.chapter_id || chapterId,
      title: opportunity?.title || '',
      description: opportunity?.description || '',
      opportunity_type: opportunity?.opportunity_type || 'industrial_visit',
      start_date: opportunity?.start_date || '',
      end_date: opportunity?.end_date || '',
      duration_description: opportunity?.duration_description || '',
      application_deadline: opportunity?.application_deadline || '',
      max_participants: opportunity?.max_participants || undefined,
      eligibility_criteria: opportunity?.eligibility_criteria || {
        industries: [],
        skills: [],
        min_experience_years: 0,
      },
      location: opportunity?.location || '',
      is_remote: opportunity?.is_remote || false,
      meeting_link: opportunity?.meeting_link || '',
      is_paid: opportunity?.is_paid || false,
      compensation_type: opportunity?.compensation_type || '',
      compensation_details: opportunity?.compensation_details || '',
      benefits: opportunity?.benefits || [],
      learning_outcomes: opportunity?.learning_outcomes || [],
      requirements: opportunity?.requirements || [],
      what_to_bring: opportunity?.what_to_bring || [],
      contact_person_name: opportunity?.contact_person_name || '',
      contact_person_email: opportunity?.contact_person_email || '',
      contact_person_phone: opportunity?.contact_person_phone || '',
      banner_image_url: opportunity?.banner_image_url || '',
      tags: opportunity?.tags || [],
      visibility: opportunity?.visibility || 'chapter',
    },
  })

  const isRemote = form.watch('is_remote')
  const isPaid = form.watch('is_paid')
  const tags = form.watch('tags') || []
  const requirements = form.watch('requirements') || []
  const benefits = form.watch('benefits') || []
  const learningOutcomes = form.watch('learning_outcomes') || []

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag)) {
      form.setValue('tags', [...tags, tag])
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    form.setValue('tags', tags.filter((t) => t !== tagToRemove))
  }

  const addRequirement = () => {
    const req = requirementInput.trim()
    if (req && !requirements.includes(req)) {
      form.setValue('requirements', [...requirements, req])
      setRequirementInput('')
    }
  }

  const removeRequirement = (req: string) => {
    form.setValue('requirements', requirements.filter((r) => r !== req))
  }

  const addBenefit = () => {
    const ben = benefitInput.trim()
    if (ben && !benefits.includes(ben)) {
      form.setValue('benefits', [...benefits, ben])
      setBenefitInput('')
    }
  }

  const removeBenefit = (ben: string) => {
    form.setValue('benefits', benefits.filter((b) => b !== ben))
  }

  const addOutcome = () => {
    const out = outcomeInput.trim()
    if (out && !learningOutcomes.includes(out)) {
      form.setValue('learning_outcomes', [...learningOutcomes, out])
      setOutcomeInput('')
    }
  }

  const removeOutcome = (out: string) => {
    form.setValue('learning_outcomes', learningOutcomes.filter((o) => o !== out))
  }

  const onSubmit = (data: CreateOpportunityInput) => {
    startTransition(async () => {
      try {
        let result
        if (isEditing && opportunity) {
          result = await updateOpportunity(opportunity.id, data)
        } else {
          result = await createOpportunity(data)
        }

        if (result.success) {
          toast.success(
            isEditing
              ? 'Opportunity updated successfully'
              : 'Opportunity created successfully'
          )
          if (result.data?.id) {
            onSuccess?.(result.data.id)
          }
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to save opportunity')
        }
      } catch (error) {
        console.error('Error saving opportunity:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Opportunity' : 'Create Opportunity'}</CardTitle>
        <CardDescription>
          {isEditing
            ? 'Update the details of this opportunity'
            : 'Post a new opportunity for Yi members'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Industrial Visit to Manufacturing Plant" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="opportunity_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opportunity Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OPPORTUNITY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {OPPORTUNITY_TYPE_LABELS[type]}
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the opportunity in detail..."
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum 50 characters. Explain what participants will experience or learn.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="application_deadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Application Deadline *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="max_participants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Participants</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Leave empty for unlimited"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <FormLabel>Tags</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addTag}>
                      <Tag className="h-4 w-4" />
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="duration_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 2 hours, 3 months" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="is_remote"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Remote</FormLabel>
                          <FormDescription>Can participate remotely</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_paid"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Paid</FormLabel>
                          <FormDescription>Offers compensation</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {!isRemote && (
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Address or venue" className="pl-9" {...field} value={field.value || ''} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {isRemote && (
                  <FormField
                    control={form.control}
                    name="meeting_link"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Link</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="https://..." className="pl-9" {...field} value={field.value || ''} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {isPaid && (
                  <>
                    <FormField
                      control={form.control}
                      name="compensation_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Compensation Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="stipend">Stipend</SelectItem>
                              <SelectItem value="hourly">Hourly</SelectItem>
                              <SelectItem value="fixed">Fixed Amount</SelectItem>
                              <SelectItem value="salary">Salary</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="compensation_details"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Compensation Details</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Rs. 15,000/month" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <Separator />

                {/* Learning Outcomes */}
                <div className="space-y-2">
                  <FormLabel>Learning Outcomes</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="What participants will learn..."
                      value={outcomeInput}
                      onChange={(e) => setOutcomeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addOutcome()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addOutcome}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {learningOutcomes.length > 0 && (
                    <ul className="space-y-1">
                      {learningOutcomes.map((outcome, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="flex-1">{outcome}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOutcome(outcome)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Benefits */}
                <div className="space-y-2">
                  <FormLabel>Benefits</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Certificate, Networking"
                      value={benefitInput}
                      onChange={(e) => setBenefitInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addBenefit()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addBenefit}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {benefits.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {benefits.map((ben) => (
                        <Badge key={ben} variant="secondary" className="gap-1">
                          {ben}
                          <button type="button" onClick={() => removeBenefit(ben)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Eligibility Tab */}
              <TabsContent value="eligibility" className="space-y-4 pt-4">
                {/* Requirements */}
                <div className="space-y-2">
                  <FormLabel>Requirements</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Must be enrolled in engineering"
                      value={requirementInput}
                      onChange={(e) => setRequirementInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addRequirement()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addRequirement}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {requirements.length > 0 && (
                    <ul className="space-y-1">
                      {requirements.map((req, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="flex-1">{req}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRequirement(req)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibility</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="chapter">Chapter Only</SelectItem>
                          <SelectItem value="national">All Chapters</SelectItem>
                          <SelectItem value="public">Public</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Who can view and apply to this opportunity
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Contact Tab */}
              <TabsContent value="contact" className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="contact_person_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="Name" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contact_person_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="email@company.com" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_person_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 98765 43210" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : isEditing ? (
                  'Update Opportunity'
                ) : (
                  'Create Opportunity'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default OpportunityForm
