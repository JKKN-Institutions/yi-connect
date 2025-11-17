/**
 * Government Stakeholder Form Component
 *
 * Form for creating and editing government stakeholder records
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
import { createGovernmentStakeholder } from '@/app/actions/stakeholder'
import { governmentStakeholderFormSchema } from '@/lib/validations/stakeholder'
import type { GovernmentStakeholderFormInput } from '@/types/stakeholder'

interface GovernmentStakeholderFormProps {
  chapterId: string
  initialData?: Partial<GovernmentStakeholderFormInput>
  mode?: 'create' | 'edit'
}

export function GovernmentStakeholderForm({
  chapterId,
  initialData,
  mode = 'create',
}: GovernmentStakeholderFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [keyResponsibility, setKeyResponsibility] = useState('')
  const [decisionAuthority, setDecisionAuthority] = useState('')
  const [areaOfSupport, setAreaOfSupport] = useState('')
  const [protocolRequirement, setProtocolRequirement] = useState('')

  const form = useForm<GovernmentStakeholderFormInput>({
    resolver: zodResolver(governmentStakeholderFormSchema),
    defaultValues: initialData || {
      official_name: '',
      department: '',
      designation: '',
      status: 'prospective',
      city: '',
      state: '',
      connection_type: 'direct',
      is_elected: false,
      can_provide_permissions: false,
      can_provide_funding: false,
      can_provide_venue: false,
      key_responsibilities: [],
      decision_making_authority: [],
      areas_of_support: [],
      protocol_requirements: [],
    },
  })

  const onSubmit = async (data: GovernmentStakeholderFormInput) => {
    startTransition(async () => {
      try {
        const formData = new FormData()

        // Basic Information
        formData.append('chapter_id', chapterId)
        formData.append('official_name', data.official_name)
        formData.append('department', data.department)
        formData.append('designation', data.designation)
        if (data.status) formData.append('status', data.status)

        // Contact
        if (data.office_address) formData.append('office_address', data.office_address)
        if (data.city) formData.append('city', data.city)
        if (data.state) formData.append('state', data.state)
        if (data.email) formData.append('email', data.email)
        if (data.phone) formData.append('phone', data.phone)

        // Connection
        if (data.connection_type) formData.append('connection_type', data.connection_type)
        if (data.connected_through_member_id)
          formData.append('connected_through_member_id', data.connected_through_member_id)

        // Official Profile
        if (data.jurisdiction) formData.append('jurisdiction', data.jurisdiction)
        if (data.key_responsibilities && data.key_responsibilities.length > 0) {
          formData.append('key_responsibilities', JSON.stringify(data.key_responsibilities))
        }
        if (data.decision_making_authority && data.decision_making_authority.length > 0) {
          formData.append('decision_making_authority', JSON.stringify(data.decision_making_authority))
        }

        // Tenure
        if (data.appointment_date) formData.append('appointment_date', data.appointment_date)
        if (data.tenure_end_date) formData.append('tenure_end_date', data.tenure_end_date)
        formData.append('is_elected', String(data.is_elected || false))
        if (data.term_duration) formData.append('term_duration', data.term_duration)

        // Collaboration
        if (data.areas_of_support && data.areas_of_support.length > 0) {
          formData.append('areas_of_support', JSON.stringify(data.areas_of_support))
        }
        formData.append('can_provide_permissions', String(data.can_provide_permissions || false))
        formData.append('can_provide_funding', String(data.can_provide_funding || false))
        formData.append('can_provide_venue', String(data.can_provide_venue || false))

        // Operational
        if (data.best_time_to_meet) formData.append('best_time_to_meet', data.best_time_to_meet)
        if (data.protocol_requirements && data.protocol_requirements.length > 0) {
          formData.append('protocol_requirements', JSON.stringify(data.protocol_requirements))
        }
        if (data.lead_time_required) formData.append('lead_time_required', data.lead_time_required)

        // Additional
        if (data.notes) formData.append('notes', data.notes)

        const result = await createGovernmentStakeholder(formData)

        if (result.success) {
          toast.success('Government stakeholder created successfully')
          router.push('/stakeholders/government')
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to create government stakeholder')
        }
      } catch (error) {
        toast.error('An unexpected error occurred')
        console.error('Form submission error:', error)
      }
    })
  }

  const addKeyResponsibility = () => {
    if (keyResponsibility.trim()) {
      const current = form.getValues('key_responsibilities') || []
      if (!current.includes(keyResponsibility.trim())) {
        form.setValue('key_responsibilities', [...current, keyResponsibility.trim()])
        setKeyResponsibility('')
      }
    }
  }

  const removeKeyResponsibility = (item: string) => {
    const current = form.getValues('key_responsibilities') || []
    form.setValue(
      'key_responsibilities',
      current.filter((r) => r !== item)
    )
  }

  const addDecisionAuthority = () => {
    if (decisionAuthority.trim()) {
      const current = form.getValues('decision_making_authority') || []
      if (!current.includes(decisionAuthority.trim())) {
        form.setValue('decision_making_authority', [...current, decisionAuthority.trim()])
        setDecisionAuthority('')
      }
    }
  }

  const removeDecisionAuthority = (item: string) => {
    const current = form.getValues('decision_making_authority') || []
    form.setValue(
      'decision_making_authority',
      current.filter((a) => a !== item)
    )
  }

  const addAreaOfSupport = () => {
    if (areaOfSupport.trim()) {
      const current = form.getValues('areas_of_support') || []
      if (!current.includes(areaOfSupport.trim())) {
        form.setValue('areas_of_support', [...current, areaOfSupport.trim()])
        setAreaOfSupport('')
      }
    }
  }

  const removeAreaOfSupport = (item: string) => {
    const current = form.getValues('areas_of_support') || []
    form.setValue(
      'areas_of_support',
      current.filter((a) => a !== item)
    )
  }

  const addProtocolRequirement = () => {
    if (protocolRequirement.trim()) {
      const current = form.getValues('protocol_requirements') || []
      if (!current.includes(protocolRequirement.trim())) {
        form.setValue('protocol_requirements', [...current, protocolRequirement.trim()])
        setProtocolRequirement('')
      }
    }
  }

  const removeProtocolRequirement = (item: string) => {
    const current = form.getValues('protocol_requirements') || []
    form.setValue(
      'protocol_requirements',
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
            <p className="text-sm text-muted-foreground">
              Official details and department information
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="official_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Official Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter official name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., District Collectorate, Municipal Corporation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="designation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., District Collector, Commissioner" {...field} />
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
          </div>
        </div>

        <Separator />

        {/* Contact Information */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Contact Information</h3>
            <p className="text-sm text-muted-foreground">Office address and contact details</p>
          </div>
          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="office_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Office Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Office address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="official@example.gov.in" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Official Profile */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Official Profile</h3>
            <p className="text-sm text-muted-foreground">
              Jurisdiction and decision-making authority
            </p>
          </div>

          <FormField
            control={form.control}
            name="jurisdiction"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jurisdiction</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Coimbatore District, Tamil Nadu" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="key_responsibilities"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Key Responsibilities</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add responsibility (e.g., Law & Order, Revenue)"
                    value={keyResponsibility}
                    onChange={(e) => setKeyResponsibility(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addKeyResponsibility()
                      }
                    }}
                  />
                  <Button type="button" onClick={addKeyResponsibility} variant="secondary">
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
                          onClick={() => removeKeyResponsibility(item)}
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
            name="decision_making_authority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Decision Making Authority</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add authority area (e.g., Budget Approval, Permits)"
                    value={decisionAuthority}
                    onChange={(e) => setDecisionAuthority(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addDecisionAuthority()
                      }
                    }}
                  />
                  <Button type="button" onClick={addDecisionAuthority} variant="secondary">
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
                          onClick={() => removeDecisionAuthority(item)}
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

        {/* Tenure Information */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Tenure Information</h3>
            <p className="text-sm text-muted-foreground">
              Appointment dates and term duration
            </p>
          </div>

          <FormField
            control={form.control}
            name="is_elected"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Elected Official</FormLabel>
                  <FormDescription>
                    Check if this is an elected position (e.g., Mayor, Councillor)
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="appointment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Appointment Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tenure_end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenure End Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="term_duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Term Duration</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 3 years, 5 years" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Collaboration */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Collaboration & Support</h3>
            <p className="text-sm text-muted-foreground">
              Types of support this official can provide
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="can_provide_permissions"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Can Provide Permissions</FormLabel>
                    <FormDescription className="text-xs">
                      Permits and approvals
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="can_provide_funding"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Can Provide Funding</FormLabel>
                    <FormDescription className="text-xs">
                      Financial support
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="can_provide_venue"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Can Provide Venue</FormLabel>
                    <FormDescription className="text-xs">
                      Government facilities
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="areas_of_support"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Areas of Support</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add support area (e.g., Youth Programs, Education)"
                    value={areaOfSupport}
                    onChange={(e) => setAreaOfSupport(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addAreaOfSupport()
                      }
                    }}
                  />
                  <Button type="button" onClick={addAreaOfSupport} variant="secondary">
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
                          onClick={() => removeAreaOfSupport(item)}
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
            <p className="text-sm text-muted-foreground">
              Meeting protocols and operational requirements
            </p>
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
              name="best_time_to_meet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Best Time to Meet</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Tuesdays 2-4 PM" {...field} />
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
                    <Input placeholder="e.g., 1 week, 2 weeks" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="protocol_requirements"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Protocol Requirements</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add protocol (e.g., Prior Appointment, Written Request)"
                    value={protocolRequirement}
                    onChange={(e) => setProtocolRequirement(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addProtocolRequirement()
                      }
                    }}
                  />
                  <Button type="button" onClick={addProtocolRequirement} variant="secondary">
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
                          onClick={() => removeProtocolRequirement(item)}
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

        {/* Additional Notes */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Additional Notes</h3>
            <p className="text-sm text-muted-foreground">
              Any other relevant information
            </p>
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
            {mode === 'create' ? 'Create Government Stakeholder' : 'Update Government Stakeholder'}
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
