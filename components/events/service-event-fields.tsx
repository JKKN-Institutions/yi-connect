'use client'

/**
 * Service Event Fields Component
 *
 * Conditional form fields for service events (Masoom, Thalir, Yuva, etc.)
 * These fields appear when creating events for schools/colleges.
 */

import { useEffect, useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Info, Users, Building2, Phone, Mail, User } from 'lucide-react'
import {
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
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  SERVICE_EVENT_TYPES,
  STAKEHOLDER_TYPES,
  type ServiceEventType,
  type StakeholderType,
} from '@/types/event'

interface Stakeholder {
  id: string
  name: string
  type: string
  city?: string | null
  contact_person?: string | null
  contact_phone?: string | null
  contact_email?: string | null
}

interface ServiceEventFieldsProps {
  form: UseFormReturn<any>
  stakeholders?: Stakeholder[]
  disabled?: boolean
}

const SERVICE_TYPE_INFO: Record<ServiceEventType, { description: string; targetAge: string }> = {
  masoom: {
    description: 'Child safety awareness for school students',
    targetAge: 'Classes 3-7 (Ages 8-12)',
  },
  thalir: {
    description: 'Life skills and adolescence education',
    targetAge: 'Classes 8-10 (Ages 13-16)',
  },
  yuva: {
    description: 'Youth empowerment and career guidance',
    targetAge: 'Classes 11-12 & College (Ages 17-22)',
  },
  road_safety: {
    description: 'Road safety awareness program',
    targetAge: 'All age groups',
  },
  career_guidance: {
    description: 'Career counseling and guidance sessions',
    targetAge: 'Classes 10-12 & College',
  },
  soft_skills: {
    description: 'Communication, leadership & personality development',
    targetAge: 'College students & Young professionals',
  },
  other: {
    description: 'Other specialized training programs',
    targetAge: 'Varies based on program',
  },
}

export function ServiceEventFields({
  form,
  stakeholders = [],
  disabled = false,
}: ServiceEventFieldsProps) {
  const [filteredStakeholders, setFilteredStakeholders] = useState<Stakeholder[]>([])

  const isServiceEvent = form.watch('is_service_event')
  const stakeholderType = form.watch('stakeholder_type')
  const selectedStakeholderId = form.watch('stakeholder_id')
  const serviceType = form.watch('service_type')
  const expectedStudents = form.watch('expected_students')

  // Filter stakeholders by type
  useEffect(() => {
    if (stakeholderType) {
      setFilteredStakeholders(
        stakeholders.filter((s) => s.type === stakeholderType)
      )
    } else {
      setFilteredStakeholders([])
    }
  }, [stakeholderType, stakeholders])

  // Auto-fill contact details when stakeholder is selected
  useEffect(() => {
    if (selectedStakeholderId) {
      const stakeholder = stakeholders.find((s) => s.id === selectedStakeholderId)
      if (stakeholder) {
        if (stakeholder.contact_person && !form.getValues('contact_person_name')) {
          form.setValue('contact_person_name', stakeholder.contact_person)
        }
        if (stakeholder.contact_phone && !form.getValues('contact_person_phone')) {
          form.setValue('contact_person_phone', stakeholder.contact_phone)
        }
        if (stakeholder.contact_email && !form.getValues('contact_person_email')) {
          form.setValue('contact_person_email', stakeholder.contact_email)
        }
      }
    }
  }, [selectedStakeholderId, stakeholders, form])

  // Calculate trainers needed (1 per 60 students)
  const trainersNeeded = expectedStudents ? Math.ceil(expectedStudents / 60) : 0

  if (!isServiceEvent) {
    return (
      <FormField
        control={form.control}
        name="is_service_event"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Service Event</FormLabel>
              <FormDescription>
                Enable this for Yi service programs like Masoom, Thalir, or Yuva
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            </FormControl>
          </FormItem>
        )}
      />
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Service Event Details</CardTitle>
            <CardDescription>
              Configure details for this Yi service program
            </CardDescription>
          </div>
          <FormField
            control={form.control}
            name="is_service_event"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={disabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Service Type Selection */}
        <FormField
          control={form.control}
          name="service_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service Type *</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || ''}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(SERVICE_EVENT_TYPES).map(([value, label]) => (
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

        {/* Service Type Info */}
        {serviceType && SERVICE_TYPE_INFO[serviceType as ServiceEventType] && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">
                {SERVICE_TYPE_INFO[serviceType as ServiceEventType].description}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Target: {SERVICE_TYPE_INFO[serviceType as ServiceEventType].targetAge}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Stakeholder Selection */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Institution Details
          </h4>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="stakeholder_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution Type *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value)
                      // Clear stakeholder when type changes
                      form.setValue('stakeholder_id', '')
                    }}
                    value={field.value || ''}
                    disabled={disabled}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(STAKEHOLDER_TYPES).map(([value, label]) => (
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

            <FormField
              control={form.control}
              name="stakeholder_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Institution *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ''}
                    disabled={disabled || !stakeholderType}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          stakeholderType
                            ? "Select institution"
                            : "Select type first"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredStakeholders.length === 0 ? (
                        <div className="py-2 px-2 text-sm text-muted-foreground">
                          No {stakeholderType ? STAKEHOLDER_TYPES[stakeholderType as StakeholderType] : ''} found
                        </div>
                      ) : (
                        filteredStakeholders.map((stakeholder) => (
                          <SelectItem key={stakeholder.id} value={stakeholder.id}>
                            <div className="flex flex-col">
                              <span>{stakeholder.name}</span>
                              {stakeholder.city && (
                                <span className="text-xs text-muted-foreground">
                                  {stakeholder.city}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Expected Students & Trainers */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Attendance & Trainers
          </h4>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="expected_students"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Students *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 120"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : '')}
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormDescription>
                    Number of students expected to attend
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Trainers Needed</FormLabel>
              <div className="flex items-center gap-2 h-10 px-3 py-2 border rounded-md bg-muted/50">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{trainersNeeded}</span>
                <span className="text-muted-foreground">trainer{trainersNeeded !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-calculated: 1 trainer per 60 students
              </p>
            </div>
          </div>

          {trainersNeeded > 0 && (
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                This event requires <Badge variant="secondary">{trainersNeeded} trainer{trainersNeeded !== 1 ? 's' : ''}</Badge>.
                {' '}After creating the event, you can assign trainers from the event dashboard.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* Contact Person Details */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Institution Contact
          </h4>

          <FormField
            control={form.control}
            name="contact_person_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Mr. Kumar, Principal"
                    {...field}
                    value={field.value || ''}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="contact_person_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="+91 98765 43210"
                        className="pl-9"
                        {...field}
                        value={field.value || ''}
                        disabled={disabled}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_person_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="contact@school.edu"
                        className="pl-9"
                        {...field}
                        value={field.value || ''}
                        disabled={disabled}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ServiceEventFields
