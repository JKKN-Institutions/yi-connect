/**
 * Vendor Form Component
 *
 * Form for creating and editing vendor stakeholder records
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
import { createVendor } from '@/app/actions/stakeholder'
import { vendorFormSchema } from '@/lib/validations/stakeholder'
import type { VendorFormInput } from '@/types/stakeholder'

interface VendorFormProps {
  chapterId: string
  initialData?: Partial<VendorFormInput>
  mode?: 'create' | 'edit'
}

export function VendorForm({ chapterId, initialData, mode = 'create' }: VendorFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [service, setService] = useState('')
  const [location, setLocation] = useState('')

  const form = useForm<VendorFormInput>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: initialData || {
      vendor_name: '',
      vendor_category: 'catering',
      status: 'prospective',
      city: '',
      state: '',
      connection_type: 'direct',
      accepts_negotiation: false,
      has_gst_certificate: false,
      has_service_agreement: false,
      services_offered: [],
      serves_locations: [],
    },
  })

  const onSubmit = async (data: VendorFormInput) => {
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('chapter_id', chapterId)
        formData.append('vendor_name', data.vendor_name)
        formData.append('vendor_category', data.vendor_category)
        if (data.status) formData.append('status', data.status)
        if (data.contact_person) formData.append('contact_person', data.contact_person)
        if (data.email) formData.append('email', data.email)
        if (data.phone_primary) formData.append('phone_primary', data.phone_primary)
        if (data.phone_secondary) formData.append('phone_secondary', data.phone_secondary)
        if (data.address_line1) formData.append('address_line1', data.address_line1)
        if (data.city) formData.append('city', data.city)
        if (data.state) formData.append('state', data.state)
        if (data.pincode) formData.append('pincode', data.pincode)
        if (data.connection_type) formData.append('connection_type', data.connection_type)
        if (data.services_offered && data.services_offered.length > 0) {
          formData.append('services_offered', JSON.stringify(data.services_offered))
        }
        if (data.capacity) formData.append('capacity', data.capacity)
        if (data.quality_rating) formData.append('quality_rating', String(data.quality_rating))
        if (data.pricing_model) formData.append('pricing_model', data.pricing_model)
        formData.append('accepts_negotiation', String(data.accepts_negotiation || false))
        if (data.payment_terms) formData.append('payment_terms', data.payment_terms)
        if (data.advance_percentage) formData.append('advance_percentage', String(data.advance_percentage))
        if (data.cancellation_policy) formData.append('cancellation_policy', data.cancellation_policy)
        if (data.lead_time_required) formData.append('lead_time_required', data.lead_time_required)
        if (data.minimum_order_value) formData.append('minimum_order_value', String(data.minimum_order_value))
        if (data.serves_locations && data.serves_locations.length > 0) {
          formData.append('serves_locations', JSON.stringify(data.serves_locations))
        }
        formData.append('has_gst_certificate', String(data.has_gst_certificate || false))
        if (data.gst_number) formData.append('gst_number', data.gst_number)
        formData.append('has_service_agreement', String(data.has_service_agreement || false))
        if (data.notes) formData.append('notes', data.notes)

        const result = await createVendor(formData)

        if (result.success) {
          toast.success('Vendor created successfully')
          router.push('/stakeholders/vendors')
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to create vendor')
        }
      } catch (error) {
        toast.error('An unexpected error occurred')
        console.error('Form submission error:', error)
      }
    })
  }

  const addService = () => {
    if (service.trim()) {
      const current = form.getValues('services_offered') || []
      if (!current.includes(service.trim())) {
        form.setValue('services_offered', [...current, service.trim()])
        setService('')
      }
    }
  }

  const removeService = (item: string) => {
    const current = form.getValues('services_offered') || []
    form.setValue('services_offered', current.filter((s) => s !== item))
  }

  const addLocation = () => {
    if (location.trim()) {
      const current = form.getValues('serves_locations') || []
      if (!current.includes(location.trim())) {
        form.setValue('serves_locations', [...current, location.trim()])
        setLocation('')
      }
    }
  }

  const removeLocation = (item: string) => {
    const current = form.getValues('serves_locations') || []
    form.setValue('serves_locations', current.filter((l) => l !== item))
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Basic Information</h3>
            <p className="text-sm text-muted-foreground">Vendor details and contact</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="vendor_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter vendor name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vendor_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor Category *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="catering">Catering</SelectItem>
                      <SelectItem value="venue">Venue</SelectItem>
                      <SelectItem value="printing">Printing</SelectItem>
                      <SelectItem value="photography">Photography</SelectItem>
                      <SelectItem value="decoration">Decoration</SelectItem>
                      <SelectItem value="av_equipment">AV Equipment</SelectItem>
                      <SelectItem value="transportation">Transportation</SelectItem>
                      <SelectItem value="accommodation">Accommodation</SelectItem>
                      <SelectItem value="merchandise">Merchandise</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_person"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person</FormLabel>
                  <FormControl>
                    <Input placeholder="Primary contact name" {...field} />
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="vendor@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone_primary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Phone number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Service Details */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Service Details</h3>
            <p className="text-sm text-muted-foreground">Services and capacity</p>
          </div>

          <FormField
            control={form.control}
            name="services_offered"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Services Offered</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addService()
                      }
                    }}
                  />
                  <Button type="button" onClick={addService} variant="secondary">
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
                          onClick={() => removeService(item)}
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
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 500 people, 10 events/month" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quality_rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quality Rating (1-5)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      placeholder="Rating"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
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

        {/* Pricing & Terms */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Pricing & Terms</h3>
            <p className="text-sm text-muted-foreground">Commercial details</p>
          </div>

          <FormField
            control={form.control}
            name="accepts_negotiation"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Accepts Price Negotiation</FormLabel>
                  <FormDescription>Check if vendor is open to negotiate pricing</FormDescription>
                </div>
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="pricing_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pricing Model</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pricing model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="per_person">Per Person</SelectItem>
                      <SelectItem value="per_event">Per Event</SelectItem>
                      <SelectItem value="per_hour">Per Hour</SelectItem>
                      <SelectItem value="per_day">Per Day</SelectItem>
                      <SelectItem value="fixed_package">Fixed Package</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 50% advance, 50% post-event" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="minimum_order_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Order Value (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Minimum order amount"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                      }
                    />
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
        </div>

        <Separator />

        {/* Documentation */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Documentation</h3>
            <p className="text-sm text-muted-foreground">Legal and compliance</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="has_gst_certificate"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Has GST Certificate</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="has_service_agreement"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Has Service Agreement</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="gst_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GST Number</FormLabel>
                <FormControl>
                  <Input placeholder="GST registration number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional information"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create Vendor' : 'Update Vendor'}
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
