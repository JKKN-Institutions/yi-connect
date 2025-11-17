/**
 * NGO Form Component
 *
 * Form for creating and editing NGO stakeholder records
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

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
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { createNGO } from '@/app/actions/stakeholder'
import { ngoFormSchema } from '@/lib/validations/stakeholder'
import type { NGOFormInput } from '@/types/stakeholder'

interface NGOFormProps {
  chapterId: string
  initialData?: Partial<NGOFormInput>
  mode?: 'create' | 'edit'
}

export function NGOForm({ chapterId, initialData, mode = 'create' }: NGOFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [focusArea, setFocusArea] = useState('')
  const [targetBeneficiary, setTargetBeneficiary] = useState('')
  const [collaborationArea, setCollaborationArea] = useState('')
  const [resourceProvide, setResourceProvide] = useState('')
  const [resourceNeed, setResourceNeed] = useState('')

  const form = useForm<NGOFormInput>({
    resolver: zodResolver(ngoFormSchema),
    defaultValues: initialData || {
      ngo_name: '',
      status: 'prospective',
      city: '',
      state: '',
      connection_type: 'direct',
      is_registered: false,
      focus_areas: [],
      target_beneficiaries: [],
      collaboration_areas: [],
      resources_they_can_provide: [],
      resources_they_need: [],
    },
  })

  const onSubmit = async (data: NGOFormInput) => {
    startTransition(async () => {
      try {
        const formData = new FormData()

        // Basic Information
        formData.append('chapter_id', chapterId)
        formData.append('ngo_name', data.ngo_name)
        if (data.registration_number)
          formData.append('registration_number', data.registration_number)
        if (data.status) formData.append('status', data.status)

        // Address
        if (data.address_line1) formData.append('address_line1', data.address_line1)
        if (data.address_line2) formData.append('address_line2', data.address_line2)
        if (data.city) formData.append('city', data.city)
        if (data.state) formData.append('state', data.state)
        if (data.pincode) formData.append('pincode', data.pincode)
        if (data.website) formData.append('website', data.website)

        // Connection
        if (data.connection_type) formData.append('connection_type', data.connection_type)
        if (data.connected_through_member_id)
          formData.append('connected_through_member_id', data.connected_through_member_id)

        // NGO Profile
        if (data.focus_areas && data.focus_areas.length > 0) {
          formData.append('focus_areas', JSON.stringify(data.focus_areas))
        }
        if (data.target_beneficiaries && data.target_beneficiaries.length > 0) {
          formData.append('target_beneficiaries', JSON.stringify(data.target_beneficiaries))
        }
        if (data.geographic_reach) formData.append('geographic_reach', data.geographic_reach)
        if (data.team_size) formData.append('team_size', String(data.team_size))

        // Registration
        formData.append('is_registered', String(data.is_registered || false))
        if (data.registration_type) formData.append('registration_type', data.registration_type)
        if (data.tax_exemption_status)
          formData.append('tax_exemption_status', data.tax_exemption_status)

        // Partnership
        if (data.collaboration_areas && data.collaboration_areas.length > 0) {
          formData.append('collaboration_areas', JSON.stringify(data.collaboration_areas))
        }
        if (data.resources_they_can_provide && data.resources_they_can_provide.length > 0) {
          formData.append(
            'resources_they_can_provide',
            JSON.stringify(data.resources_they_can_provide)
          )
        }
        if (data.resources_they_need && data.resources_they_need.length > 0) {
          formData.append('resources_they_need', JSON.stringify(data.resources_they_need))
        }

        // Operational
        if (data.decision_maker) formData.append('decision_maker', data.decision_maker)
        if (data.decision_making_process)
          formData.append('decision_making_process', data.decision_making_process)
        if (data.lead_time_required) formData.append('lead_time_required', data.lead_time_required)

        // Additional
        if (data.notes) formData.append('notes', data.notes)

        const result = await createNGO(formData)

        if (result.success) {
          toast.success('NGO created successfully')
          router.push('/stakeholders/ngos')
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to create NGO')
        }
      } catch (error) {
        toast.error('An unexpected error occurred')
        console.error('Form submission error:', error)
      }
    })
  }

  const addFocusArea = () => {
    if (focusArea.trim()) {
      const current = form.getValues('focus_areas') || []
      if (!current.includes(focusArea.trim())) {
        form.setValue('focus_areas', [...current, focusArea.trim()])
        setFocusArea('')
      }
    }
  }

  const removeFocusArea = (item: string) => {
    const current = form.getValues('focus_areas') || []
    form.setValue(
      'focus_areas',
      current.filter((a) => a !== item)
    )
  }

  const addTargetBeneficiary = () => {
    if (targetBeneficiary.trim()) {
      const current = form.getValues('target_beneficiaries') || []
      if (!current.includes(targetBeneficiary.trim())) {
        form.setValue('target_beneficiaries', [...current, targetBeneficiary.trim()])
        setTargetBeneficiary('')
      }
    }
  }

  const removeTargetBeneficiary = (item: string) => {
    const current = form.getValues('target_beneficiaries') || []
    form.setValue(
      'target_beneficiaries',
      current.filter((b) => b !== item)
    )
  }

  const addCollaborationArea = () => {
    if (collaborationArea.trim()) {
      const current = form.getValues('collaboration_areas') || []
      if (!current.includes(collaborationArea.trim())) {
        form.setValue('collaboration_areas', [...current, collaborationArea.trim()])
        setCollaborationArea('')
      }
    }
  }

  const removeCollaborationArea = (item: string) => {
    const current = form.getValues('collaboration_areas') || []
    form.setValue(
      'collaboration_areas',
      current.filter((a) => a !== item)
    )
  }

  const addResourceProvide = () => {
    if (resourceProvide.trim()) {
      const current = form.getValues('resources_they_can_provide') || []
      if (!current.includes(resourceProvide.trim())) {
        form.setValue('resources_they_can_provide', [...current, resourceProvide.trim()])
        setResourceProvide('')
      }
    }
  }

  const removeResourceProvide = (item: string) => {
    const current = form.getValues('resources_they_can_provide') || []
    form.setValue(
      'resources_they_can_provide',
      current.filter((r) => r !== item)
    )
  }

  const addResourceNeed = () => {
    if (resourceNeed.trim()) {
      const current = form.getValues('resources_they_need') || []
      if (!current.includes(resourceNeed.trim())) {
        form.setValue('resources_they_need', [...current, resourceNeed.trim()])
        setResourceNeed('')
      }
    }
  }

  const removeResourceNeed = (item: string) => {
    const current = form.getValues('resources_they_need') || []
    form.setValue(
      'resources_they_need',
      current.filter((r) => r !== item)
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Basic Information</h3>
            <p className="text-sm text-muted-foreground">NGO details and registration</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="ngo_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NGO Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter NGO name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="registration_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Registration/Trust number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="prospective">Prospective</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="dormant">Dormant</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.org" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Address */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Address</h3>
            <p className="text-sm text-muted-foreground">Location details</p>
          </div>
          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="address_line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input placeholder="Street address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address_line2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl>
                    <Input placeholder="Apartment, suite, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State *</FormLabel>
                    <FormControl>
                      <Input placeholder="State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pincode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pincode</FormLabel>
                    <FormControl>
                      <Input placeholder="Pincode" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* NGO Profile */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">NGO Profile</h3>
            <p className="text-sm text-muted-foreground">Mission and operational details</p>
          </div>

          <FormField
            control={form.control}
            name="focus_areas"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Focus Areas</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add focus area (e.g., Education, Health, Environment)"
                    value={focusArea}
                    onChange={(e) => setFocusArea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addFocusArea()
                      }
                    }}
                  />
                  <Button type="button" onClick={addFocusArea} variant="secondary">
                    Add
                  </Button>
                </div>
                {field.value && field.value.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value.map((item) => (
                      <div
                        key={item}
                        className="bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm flex items-center gap-2"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeFocusArea(item)}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="target_beneficiaries"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Beneficiaries</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add beneficiary group (e.g., Children, Women, Elderly)"
                    value={targetBeneficiary}
                    onChange={(e) => setTargetBeneficiary(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTargetBeneficiary()
                      }
                    }}
                  />
                  <Button type="button" onClick={addTargetBeneficiary} variant="secondary">
                    Add
                  </Button>
                </div>
                {field.value && field.value.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value.map((item) => (
                      <div
                        key={item}
                        className="bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm flex items-center gap-2"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeTargetBeneficiary(item)}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="geographic_reach"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Geographic Reach</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reach" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="district">District</SelectItem>
                      <SelectItem value="state">State</SelectItem>
                      <SelectItem value="regional">Regional</SelectItem>
                      <SelectItem value="national">National</SelectItem>
                      <SelectItem value="international">International</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="team_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Size</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Number of team members"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Registration Details */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Registration Details</h3>
            <p className="text-sm text-muted-foreground">Legal registration status</p>
          </div>

          <FormField
            control={form.control}
            name="is_registered"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Registered NGO</FormLabel>
                  <FormDescription>
                    Check if this NGO is legally registered
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="registration_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="trust">Trust</SelectItem>
                      <SelectItem value="society">Society</SelectItem>
                      <SelectItem value="section_8">Section 8 Company</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tax_exemption_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Exemption Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="12a">12A Registered</SelectItem>
                      <SelectItem value="80g">80G Certified</SelectItem>
                      <SelectItem value="both">Both 12A & 80G</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Partnership & Resources */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Partnership & Resources</h3>
            <p className="text-sm text-muted-foreground">Collaboration opportunities</p>
          </div>

          <FormField
            control={form.control}
            name="collaboration_areas"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Collaboration Areas</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add collaboration area"
                    value={collaborationArea}
                    onChange={(e) => setCollaborationArea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCollaborationArea()
                      }
                    }}
                  />
                  <Button type="button" onClick={addCollaborationArea} variant="secondary">
                    Add
                  </Button>
                </div>
                {field.value && field.value.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value.map((item) => (
                      <div
                        key={item}
                        className="bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm flex items-center gap-2"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeCollaborationArea(item)}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="resources_they_can_provide"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resources They Can Provide</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add resource (e.g., Volunteers, Venue, Equipment)"
                    value={resourceProvide}
                    onChange={(e) => setResourceProvide(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addResourceProvide()
                      }
                    }}
                  />
                  <Button type="button" onClick={addResourceProvide} variant="secondary">
                    Add
                  </Button>
                </div>
                {field.value && field.value.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value.map((item) => (
                      <div
                        key={item}
                        className="bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm flex items-center gap-2"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeResourceProvide(item)}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="resources_they_need"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resources They Need</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add resource need (e.g., Funding, Training, Materials)"
                    value={resourceNeed}
                    onChange={(e) => setResourceNeed(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addResourceNeed()
                      }
                    }}
                  />
                  <Button type="button" onClick={addResourceNeed} variant="secondary">
                    Add
                  </Button>
                </div>
                {field.value && field.value.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value.map((item) => (
                      <div
                        key={item}
                        className="bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm flex items-center gap-2"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeResourceNeed(item)}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Operational Details */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Operational Details</h3>
            <p className="text-sm text-muted-foreground">Working relationships and processes</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="connection_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select connection type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="referred">Referred</SelectItem>
                      <SelectItem value="cold">Cold Contact</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="decision_maker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decision Maker</FormLabel>
                  <FormControl>
                    <Input placeholder="Name/Role of decision maker" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="decision_making_process"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Decision Making Process</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the decision-making process" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lead_time_required"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Time Required</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 2 weeks, 1 month" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Additional Notes */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Additional Notes</h3>
            <p className="text-sm text-muted-foreground">Any other relevant information</p>
          </div>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional information, observations, or requirements"
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create NGO' : 'Update NGO'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
