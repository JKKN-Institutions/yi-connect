'use client'
'use no memo'

/**
 * SessionForm
 *
 * Sheet-based add/edit form for event sessions. Covers all session fields
 * and a simple multi-select for speaker assignment.
 */

import { useState, useTransition, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

import {
  createSessionSchema,
  updateSessionSchema,
} from '@/lib/validations/event'
import { createSession, updateSession } from '@/app/actions/events'
import type {
  EventSessionWithRelations,
  SessionType,
} from '@/types/event'
import { SESSION_TYPES } from '@/types/event'
import {
  toDateTimeLocalValue,
  fromDateTimeLocalValue,
} from './session-time'

export interface SpeakerOption {
  id: string
  speaker_name: string
  current_organization?: string | null
  designation?: string | null
}

interface SessionFormProps {
  eventId: string
  session?: EventSessionWithRelations
  speakers: SpeakerOption[]
  trigger?: React.ReactNode
  onSuccess?: () => void
}

type FormValues = {
  title: string
  description?: string
  session_type: SessionType
  start_time: string
  end_time: string
  room_or_track?: string
  capacity?: number | null
  is_active: boolean
  speaker_ids: string[]
}

export function SessionForm({
  eventId,
  session,
  speakers,
  trigger,
  onSuccess,
}: SessionFormProps) {
  const isEdit = Boolean(session)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const defaultValues: FormValues = {
    title: session?.title ?? '',
    description: session?.description ?? '',
    session_type: (session?.session_type ?? 'presentation') as SessionType,
    start_time: session ? toDateTimeLocalValue(session.start_time) : '',
    end_time: session ? toDateTimeLocalValue(session.end_time) : '',
    room_or_track: session?.room_or_track ?? '',
    capacity: session?.capacity ?? undefined,
    is_active: session?.is_active ?? true,
    speaker_ids:
      session?.speakers?.map((s) => s.speaker_id).filter(Boolean) ?? [],
  }

  const form = useForm<FormValues>({
    // We handle input -> output conversion manually, so we don't feed
    // the zod schema here (it expects ISO times). Validation happens
    // server-side + basic required checks happen natively.
    defaultValues,
  })

  useEffect(() => {
    if (open) {
      form.reset(defaultValues)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        if (!values.title?.trim()) {
          toast.error('Title is required')
          return
        }
        if (!values.start_time || !values.end_time) {
          toast.error('Start and end time are required')
          return
        }

        const startIso = fromDateTimeLocalValue(values.start_time)
        const endIso = fromDateTimeLocalValue(values.end_time)

        if (new Date(endIso) <= new Date(startIso)) {
          toast.error('End time must be after start time')
          return
        }

        const payload = {
          title: values.title.trim(),
          description: values.description?.trim() || undefined,
          session_type: values.session_type,
          start_time: startIso,
          end_time: endIso,
          room_or_track: values.room_or_track?.trim() || undefined,
          capacity:
            values.capacity === null || values.capacity === undefined
              ? undefined
              : Number(values.capacity),
          is_active: values.is_active,
          speaker_ids: values.speaker_ids,
        }

        if (isEdit && session) {
          const result = await updateSession(session.id, payload)
          if (result.success) {
            toast.success('Session updated')
            setOpen(false)
            onSuccess?.()
          } else {
            toast.error(result.error || 'Failed to update session')
          }
        } else {
          const result = await createSession({
            ...payload,
            event_id: eventId,
          })
          if (result.success) {
            toast.success('Session added')
            setOpen(false)
            form.reset()
            onSuccess?.()
          } else {
            toast.error(result.error || 'Failed to create session')
          }
        }
      } catch (err) {
        console.error(err)
        toast.error('Unexpected error')
      }
    })
  }

  const selectedSpeakerIds = form.watch('speaker_ids') ?? []

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button size='sm'>
            {isEdit ? (
              <>
                <Pencil className='mr-2 h-4 w-4' /> Edit Session
              </>
            ) : (
              <>
                <Plus className='mr-2 h-4 w-4' /> Add Session
              </>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side='right'
        className='w-full sm:max-w-lg overflow-y-auto'
      >
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit Session' : 'Add Session'}</SheetTitle>
          <SheetDescription>
            Times shown in India Standard Time (Asia/Kolkata).
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='px-4 pb-6 space-y-5'
          >
            <FormField
              control={form.control}
              name='title'
              rules={{ required: 'Title is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder='Opening Keynote' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='session_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(SESSION_TYPES).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='start_time'
                rules={{ required: 'Start time is required' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start *</FormLabel>
                    <FormControl>
                      <Input type='datetime-local' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='end_time'
                rules={{ required: 'End time is required' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End *</FormLabel>
                    <FormControl>
                      <Input type='datetime-local' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='room_or_track'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room / Track</FormLabel>
                  <FormControl>
                    <Input placeholder='Hall A / Track 1' {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='capacity'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room capacity</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      placeholder='Optional'
                      value={
                        field.value === null || field.value === undefined
                          ? ''
                          : field.value
                      }
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? undefined : Number(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Informational only — no registration enforcement.
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Short summary of this session...'
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='is_active'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-md border p-3'>
                  <div>
                    <FormLabel className='mb-1 block'>Visible in agenda</FormLabel>
                    <FormDescription className='text-xs'>
                      Hide draft sessions until they're finalised.
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

            <div className='space-y-2'>
              <FormLabel>Speakers</FormLabel>
              <p className='text-xs text-muted-foreground'>
                {speakers.length === 0
                  ? 'No speakers in your chapter yet — add them from Stakeholders → Speakers.'
                  : `Select from ${speakers.length} speaker(s) in your chapter.`}
              </p>

              {selectedSpeakerIds.length > 0 && (
                <div className='flex flex-wrap gap-1 mb-2'>
                  {selectedSpeakerIds.map((id) => {
                    const sp = speakers.find((s) => s.id === id)
                    if (!sp) return null
                    return (
                      <Badge key={id} variant='secondary' className='text-xs'>
                        {sp.speaker_name}
                      </Badge>
                    )
                  })}
                </div>
              )}

              {speakers.length > 0 && (
                <div className='max-h-48 overflow-y-auto rounded-md border p-2 space-y-1'>
                  {speakers.map((sp) => {
                    const checked = selectedSpeakerIds.includes(sp.id)
                    return (
                      <label
                        key={sp.id}
                        className='flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer'
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v
                              ? [...selectedSpeakerIds, sp.id]
                              : selectedSpeakerIds.filter((id) => id !== sp.id)
                            form.setValue('speaker_ids', next)
                          }}
                        />
                        <span className='flex-1 min-w-0'>
                          <span className='font-medium'>{sp.speaker_name}</span>
                          {(sp.designation || sp.current_organization) && (
                            <span className='text-xs text-muted-foreground ml-2'>
                              {[sp.designation, sp.current_organization]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className='flex gap-2 pt-2'>
              <Button
                type='button'
                variant='outline'
                className='flex-1'
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type='submit' className='flex-1' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {isEdit ? 'Save' : 'Add Session'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
