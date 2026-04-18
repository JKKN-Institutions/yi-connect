/**
 * Sponsor Lead Capture Form (Stutzee Feature 3D)
 *
 * Quick-entry form used inside the sponsor portal. Supports optional QR-scan
 * prefill via ticket_token. Loops ("Capture another") after success for
 * fast floor operation by EC members.
 */

'use client'

import { useState, useTransition, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  QrCode,
  Keyboard,
  Loader2,
  Flame,
  Thermometer,
  Snowflake,
  CircleDot,
  CheckCircle2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { QRScanner } from '@/components/mobile/qr-scanner'
import { captureSponsorsLead } from '@/app/actions/sponsor-leads'
import {
  createSponsorLeadSchema,
  type CreateSponsorLeadSchema,
  type CreateSponsorLeadInputShape,
} from '@/lib/validations/sponsor-lead'
import {
  INTEREST_AREA_OPTIONS,
  type InterestLevel,
} from '@/types/sponsor-lead'
import type { QRScanResult } from '@/types/mobile'

interface LeadCaptureFormProps {
  eventId: string
  sponsorId: string
  sponsorName: string
}

type Mode = 'form' | 'scan'

const INTEREST_OPTIONS: {
  value: InterestLevel
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}[] = [
  {
    value: 'hot',
    label: 'Hot',
    hint: 'Ready to discuss now',
    icon: Flame,
    color: 'border-red-400 data-[state=checked]:bg-red-50',
  },
  {
    value: 'warm',
    label: 'Warm',
    hint: 'Follow-up this week',
    icon: Thermometer,
    color: 'border-orange-400 data-[state=checked]:bg-orange-50',
  },
  {
    value: 'medium',
    label: 'Medium',
    hint: 'Mild interest',
    icon: CircleDot,
    color: 'border-yellow-400 data-[state=checked]:bg-yellow-50',
  },
  {
    value: 'cold',
    label: 'Cold',
    hint: 'Informational only',
    icon: Snowflake,
    color: 'border-blue-400 data-[state=checked]:bg-blue-50',
  },
]

export function LeadCaptureForm({
  eventId,
  sponsorId,
  sponsorName,
}: LeadCaptureFormProps) {
  const [mode, setMode] = useState<Mode>('form')
  const [isPending, startTransition] = useTransition()
  const [capturedCount, setCapturedCount] = useState(0)

  const defaultValues: CreateSponsorLeadInputShape = {
    event_id: eventId,
    sponsor_id: sponsorId,
    rsvp_id: null,
    guest_rsvp_id: null,
    ticket_token: null,
    full_name: '',
    email: '',
    phone: '',
    company: '',
    designation: '',
    interest_level: 'medium',
    interest_areas: [],
    notes: '',
    follow_up_requested: false,
    follow_up_by: '',
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateSponsorLeadInputShape>({
    resolver: zodResolver(createSponsorLeadSchema) as any,
    defaultValues,
  })

  const interestLevel = watch('interest_level')
  const interestAreas = watch('interest_areas') ?? []
  const followUpRequested = watch('follow_up_requested')

  const toggleArea = (area: string) => {
    const current = new Set(interestAreas as string[])
    if (current.has(area)) current.delete(area)
    else current.add(area)
    setValue('interest_areas', Array.from(current) as any, {
      shouldValidate: true,
    })
  }

  const onScan = useCallback(
    (result: QRScanResult) => {
      if (!result.success || !result.data) return
      setValue('ticket_token', result.data.trim())
      toast.success('QR scanned — details will prefill on submit.')
      setMode('form')
    },
    [setValue]
  )

  const onSubmit = (values: CreateSponsorLeadInputShape) => {
    startTransition(async () => {
      const result = await captureSponsorsLead(values as CreateSponsorLeadSchema)
      if (!result.success) {
        toast.error(result.error || 'Failed to capture lead')
        return
      }
      toast.success(`Lead captured for ${sponsorName}`)
      setCapturedCount(c => c + 1)
      reset({ ...defaultValues })
    })
  }

  if (mode === 'scan') {
    return (
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-medium'>Scan attendee QR</h3>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setMode('form')}
            disabled={isPending}
          >
            <Keyboard className='h-4 w-4 mr-2' />
            Back to form
          </Button>
        </div>
        <QRScanner onScan={onScan} />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
      {/* QR scan entry point */}
      <Card className='border-dashed'>
        <CardContent className='flex items-center justify-between py-4'>
          <div>
            <p className='text-sm font-medium'>Prefill from ticket QR</p>
            <p className='text-xs text-muted-foreground'>
              Scan attendee's ticket to auto-fill name, email, company.
            </p>
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setMode('scan')}
          >
            <QrCode className='h-4 w-4 mr-2' />
            Scan QR
          </Button>
        </CardContent>
      </Card>

      {/* Attendee details */}
      <div className='grid gap-4 md:grid-cols-2'>
        <div className='space-y-1.5'>
          <Label htmlFor='full_name'>
            Full name <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='full_name'
            placeholder='e.g. Priya Sharma'
            {...register('full_name')}
            aria-invalid={!!errors.full_name}
          />
          {errors.full_name && (
            <p className='text-xs text-destructive'>
              {errors.full_name.message}
            </p>
          )}
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='email'>Email</Label>
          <Input
            id='email'
            type='email'
            placeholder='name@company.com'
            {...register('email')}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className='text-xs text-destructive'>{errors.email.message}</p>
          )}
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='phone'>Phone</Label>
          <Input id='phone' placeholder='+91 98765 43210' {...register('phone')} />
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='company'>Company</Label>
          <Input id='company' placeholder='Organization' {...register('company')} />
        </div>
        <div className='space-y-1.5 md:col-span-2'>
          <Label htmlFor='designation'>Designation</Label>
          <Input
            id='designation'
            placeholder='e.g. Head of CSR'
            {...register('designation')}
          />
        </div>
      </div>

      {/* Interest level */}
      <div className='space-y-2'>
        <Label>
          Interest level <span className='text-destructive'>*</span>
        </Label>
        <RadioGroup
          value={interestLevel}
          onValueChange={value =>
            setValue('interest_level', value as InterestLevel, {
              shouldValidate: true,
            })
          }
          className='grid grid-cols-2 md:grid-cols-4 gap-3'
        >
          {INTEREST_OPTIONS.map(opt => {
            const Icon = opt.icon
            return (
              <Label
                key={opt.value}
                htmlFor={`il-${opt.value}`}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-lg border p-3 cursor-pointer transition-colors',
                  opt.color,
                  interestLevel === opt.value
                    ? 'ring-2 ring-primary ring-offset-1'
                    : 'hover:bg-muted/50'
                )}
                data-state={
                  interestLevel === opt.value ? 'checked' : 'unchecked'
                }
              >
                <div className='flex items-center gap-2'>
                  <RadioGroupItem value={opt.value} id={`il-${opt.value}`} />
                  <Icon className='h-4 w-4' />
                  <span className='font-medium text-sm'>{opt.label}</span>
                </div>
                <span className='text-xs text-muted-foreground pl-6'>
                  {opt.hint}
                </span>
              </Label>
            )
          })}
        </RadioGroup>
      </div>

      {/* Interest areas */}
      <div className='space-y-2'>
        <Label>Interest areas</Label>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-2'>
          {INTEREST_AREA_OPTIONS.map(area => {
            const checked = (interestAreas as string[]).includes(area.value)
            return (
              <label
                key={area.value}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm',
                  checked
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleArea(area.value)}
                />
                {area.label}
              </label>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      <div className='space-y-1.5'>
        <Label htmlFor='notes'>Notes</Label>
        <Textarea
          id='notes'
          rows={3}
          placeholder='What did they say? What do they want next?'
          {...register('notes')}
        />
      </div>

      {/* Follow-up */}
      <div className='flex flex-col md:flex-row md:items-end gap-4'>
        <div className='flex items-center gap-3'>
          <Switch
            id='follow_up_requested'
            checked={followUpRequested}
            onCheckedChange={val => setValue('follow_up_requested', val)}
          />
          <Label htmlFor='follow_up_requested' className='cursor-pointer'>
            Follow-up requested
          </Label>
        </div>
        {followUpRequested && (
          <div className='space-y-1.5 md:flex-1'>
            <Label htmlFor='follow_up_by'>Follow-up by</Label>
            <Input
              id='follow_up_by'
              type='date'
              {...register('follow_up_by')}
            />
          </div>
        )}
      </div>

      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t'>
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          {capturedCount > 0 && (
            <span className='inline-flex items-center gap-1.5 text-emerald-700'>
              <CheckCircle2 className='h-4 w-4' />
              {capturedCount} lead{capturedCount === 1 ? '' : 's'} captured this
              session
            </span>
          )}
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='ghost'
            onClick={() => reset({ ...defaultValues })}
            disabled={isPending}
          >
            Clear
          </Button>
          <Button type='submit' disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Saving…
              </>
            ) : (
              'Capture lead'
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
