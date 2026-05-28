/**
 * New Event Page
 *
 * Create a new sub-chapter event.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2, AlertCircle, Send } from 'lucide-react'
import { createSubChapterEvent, submitEventForApproval } from '@/app/actions/sub-chapters'
import {
  SUB_CHAPTER_EVENT_TYPE_INFO,
  type SubChapterEventType,
} from '@/types/sub-chapter'

const eventTypes = Object.entries(SUB_CHAPTER_EVENT_TYPE_INFO).map(([value, info]) => ({
  value: value as SubChapterEventType,
  label: info.label,
  description: info.description,
}))

export default function NewEventPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventType, setEventType] = useState<SubChapterEventType>('campus_event')
  const [isOnline, setIsOnline] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const submitAction = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-action')

    // Get sub_chapter_id from cookie (will be read server-side)
    const subChapterId = document.cookie
      .split('; ')
      .find((row) => row.startsWith('sub_chapter_id='))
      ?.split('=')[1]

    if (!subChapterId) {
      setError('Session expired. Please login again.')
      setIsLoading(false)
      return
    }

    const result = await createSubChapterEvent({
      sub_chapter_id: subChapterId,
      event_type: eventType,
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || undefined,
      event_date: formData.get('event_date') as string,
      start_time: (formData.get('start_time') as string) || undefined,
      end_time: (formData.get('end_time') as string) || undefined,
      venue: (formData.get('venue') as string) || undefined,
      is_online: isOnline,
      meeting_link: isOnline ? (formData.get('meeting_link') as string) || undefined : undefined,
      expected_participants: formData.get('expected_participants')
        ? parseInt(formData.get('expected_participants') as string)
        : undefined,
      speaker_topic: (formData.get('speaker_topic') as string) || undefined,
      visit_purpose: (formData.get('visit_purpose') as string) || undefined,
    })

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    // If user clicked "Submit for Approval"
    if (submitAction === 'submit' && result.data?.id) {
      const submitResult = await submitEventForApproval(result.data.id)
      if (!submitResult.success) {
        setError(submitResult.error)
        setIsLoading(false)
        return
      }
    }

    router.push('/chapter-lead/events')
    router.refresh()
  }

  const showSpeakerFields = eventType === 'guest_speaker'
  const showVisitFields = eventType === 'industrial_visit'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/chapter-lead/events">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Create Event
          </h1>
          <p className="text-muted-foreground mt-1">
            Schedule a new chapter event or activity
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
                <CardDescription>
                  Basic information about the event
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="event_type">Event Type</Label>
                  <Select
                    value={eventType}
                    onValueChange={(v) => setEventType(v as SubChapterEventType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      {eventTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <p>{type.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {type.description}
                            </p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Event Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g., Entrepreneurship Workshop"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe the event, its objectives, and target audience..."
                    rows={4}
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="event_date">Date</Label>
                    <Input
                      id="event_date"
                      name="event_date"
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      name="start_time"
                      type="time"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      name="end_time"
                      type="time"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected_participants">Expected Participants</Label>
                  <Input
                    id="expected_participants"
                    name="expected_participants"
                    type="number"
                    min={1}
                    placeholder="e.g., 50"
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Venue / Online */}
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
                <CardDescription>Where will the event take place?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Online Event</Label>
                    <p className="text-sm text-muted-foreground">
                      Toggle if this is a virtual event
                    </p>
                  </div>
                  <Switch
                    checked={isOnline}
                    onCheckedChange={setIsOnline}
                    disabled={isLoading}
                  />
                </div>

                {isOnline ? (
                  <div className="space-y-2">
                    <Label htmlFor="meeting_link">Meeting Link</Label>
                    <Input
                      id="meeting_link"
                      name="meeting_link"
                      type="url"
                      placeholder="https://meet.google.com/..."
                      disabled={isLoading}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="venue">Venue</Label>
                    <Input
                      id="venue"
                      name="venue"
                      placeholder="e.g., College Auditorium"
                      disabled={isLoading}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Guest Speaker Fields */}
            {showSpeakerFields && (
              <Card>
                <CardHeader>
                  <CardTitle>Speaker Request</CardTitle>
                  <CardDescription>
                    Request a Yi member to speak at your event
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="speaker_topic">Topic / Theme</Label>
                    <Input
                      id="speaker_topic"
                      name="speaker_topic"
                      placeholder="e.g., Career guidance, Entrepreneurship, Leadership"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      A Yi member will be assigned based on availability and expertise
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Industrial Visit Fields */}
            {showVisitFields && (
              <Card>
                <CardHeader>
                  <CardTitle>Industrial Visit Details</CardTitle>
                  <CardDescription>
                    Request an industry visit for your chapter
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="visit_purpose">Purpose of Visit</Label>
                    <Textarea
                      id="visit_purpose"
                      name="visit_purpose"
                      placeholder="Describe what students will learn from this visit..."
                      rows={3}
                      disabled={isLoading}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                  data-action="draft"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save as Draft
                </Button>

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isLoading}
                  data-action="submit"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="h-4 w-4" />
                  Submit for Approval
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Submitted events will be reviewed by your Yi mentor
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Guest Speaker:</strong> Submit at least 2 weeks in advance
                  to allow time for speaker confirmation.
                </p>
                <p>
                  <strong>Industrial Visit:</strong> Include transportation requirements
                  and safety considerations in the description.
                </p>
                <p>
                  <strong>Campus Event:</strong> Coordinate with your institution for
                  venue booking.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
