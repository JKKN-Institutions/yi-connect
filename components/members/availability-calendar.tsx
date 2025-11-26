/**
 * Availability Calendar Component
 *
 * Interactive calendar for members to set their availability.
 */

'use client'

import { useState, useTransition, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Check,
  X,
  Clock,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  generateCalendarMonth,
  AVAILABILITY_STATUS_INFO,
  DEFAULT_TIME_SLOTS,
  type Availability,
  type AvailabilityStatus,
  type TimeSlot,
  type CalendarDay,
} from '@/types/availability'
import { setAvailability, bulkSetAvailability, clearAvailability } from '@/app/actions/availability'
import { toast } from 'react-hot-toast'

interface AvailabilityCalendarProps {
  memberId: string
  initialAvailabilities?: Availability[]
  canEdit?: boolean
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function AvailabilityCalendar({
  memberId,
  initialAvailabilities = [],
  canEdit = true,
}: AvailabilityCalendarProps) {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [availabilities, setAvailabilities] = useState<Availability[]>(initialAvailabilities)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [showSetDialog, setShowSetDialog] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Dialog state
  const [dialogStatus, setDialogStatus] = useState<AvailabilityStatus>('available')
  const [dialogTimeSlots, setDialogTimeSlots] = useState<TimeSlot[]>([])
  const [dialogNotes, setDialogNotes] = useState('')
  const [useTimeSlots, setUseTimeSlots] = useState(false)

  // Generate calendar data
  const calendarMonth = useMemo(
    () => generateCalendarMonth(currentYear, currentMonth, availabilities),
    [currentYear, currentMonth, availabilities]
  )

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1)
      setCurrentMonth(11)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1)
      setCurrentMonth(0)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const goToToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
  }

  const toggleDateSelection = (date: string, day: CalendarDay) => {
    if (!canEdit) return

    // Don't allow selecting past dates
    const dateObj = new Date(date)
    if (dateObj < new Date(today.toISOString().split('T')[0])) return

    const newSelection = new Set(selectedDates)
    if (newSelection.has(date)) {
      newSelection.delete(date)
    } else {
      newSelection.add(date)
    }
    setSelectedDates(newSelection)
  }

  const clearSelection = () => {
    setSelectedDates(new Set())
  }

  const openSetDialog = () => {
    if (selectedDates.size === 0) {
      toast.error('Please select at least one date')
      return
    }
    setDialogStatus('available')
    setDialogTimeSlots([])
    setDialogNotes('')
    setUseTimeSlots(false)
    setShowSetDialog(true)
  }

  const handleSetAvailability = () => {
    startTransition(async () => {
      const dates = Array.from(selectedDates)
      const timeSlots = useTimeSlots ? dialogTimeSlots : undefined

      let result
      if (dates.length === 1) {
        result = await setAvailability({
          member_id: memberId,
          date: dates[0],
          status: dialogStatus,
          time_slots: timeSlots,
          notes: dialogNotes || undefined,
        })
      } else {
        result = await bulkSetAvailability({
          member_id: memberId,
          dates,
          status: dialogStatus,
          time_slots: timeSlots,
        })
      }

      if (result.success) {
        // Update local state
        const newAvailabilities = [...availabilities]
        dates.forEach((date) => {
          const existingIndex = newAvailabilities.findIndex(
            (a) => a.date === date && a.member_id === memberId
          )
          const newRecord: Availability = {
            id: existingIndex >= 0 ? newAvailabilities[existingIndex].id : `temp-${date}`,
            member_id: memberId,
            date,
            status: dialogStatus,
            time_slots: timeSlots || null,
            notes: dialogNotes || null,
            time_commitment_hours: null,
            preferred_days: null,
            notice_period: null,
            geographic_flexibility: null,
            preferred_contact_method: null,
            is_assigned: false,
            assigned_session_id: null,
            blocked_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          if (existingIndex >= 0) {
            newAvailabilities[existingIndex] = newRecord
          } else {
            newAvailabilities.push(newRecord)
          }
        })
        setAvailabilities(newAvailabilities)
        setSelectedDates(new Set())
        setShowSetDialog(false)
        toast.success(`Availability set for ${dates.length} date(s)`)
      } else if (!result.success) {
        toast.error(result.error || 'Failed to set availability')
      }
    })
  }

  const handleClearAvailability = (date: string) => {
    startTransition(async () => {
      const result = await clearAvailability(memberId, date)

      if (result.success) {
        setAvailabilities(availabilities.filter((a) => a.date !== date))
        toast.success('Availability cleared')
      } else if (!result.success) {
        toast.error(result.error || 'Failed to clear availability')
      }
    })
  }

  const toggleTimeSlot = (slot: TimeSlot) => {
    const exists = dialogTimeSlots.some(
      (s) => s.start === slot.start && s.end === slot.end
    )
    if (exists) {
      setDialogTimeSlots(dialogTimeSlots.filter(
        (s) => !(s.start === slot.start && s.end === slot.end)
      ))
    } else {
      setDialogTimeSlots([...dialogTimeSlots, slot])
    }
  }

  const getStatusForDate = (date: string): AvailabilityStatus | undefined => {
    const availability = availabilities.find((a) => a.date === date)
    return availability?.status
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Availability Calendar</CardTitle>
              <CardDescription>
                Mark your availability for sessions and events
              </CardDescription>
            </div>
          </div>
          {canEdit && selectedDates.size > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedDates.size} selected
              </Badge>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
              <Button size="sm" onClick={openSetDialog}>
                Set Availability
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">
              {MONTHS[currentMonth]} {currentYear}
            </h3>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          {Object.entries(AVAILABILITY_STATUS_INFO).map(([status, info]) => (
            <div key={status} className="flex items-center gap-2">
              <div className={cn('w-4 h-4 rounded', info.bgColor)} />
              <span className={info.color}>{info.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-primary" />
            <span>Selected</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="border rounded-lg overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-muted/50">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Weeks */}
          {calendarMonth.weeks.map((week) => (
            <div key={week.weekNumber} className="grid grid-cols-7 border-t">
              {week.days.map((day) => {
                const status = getStatusForDate(day.date)
                const statusInfo = status ? AVAILABILITY_STATUS_INFO[status] : null
                const isSelected = selectedDates.has(day.date)
                const isPast = new Date(day.date) < new Date(today.toISOString().split('T')[0])

                return (
                  <div
                    key={day.date}
                    className={cn(
                      'relative min-h-[80px] p-1 border-r last:border-r-0 transition-colors',
                      !day.isCurrentMonth && 'bg-muted/30',
                      isPast && 'opacity-50',
                      canEdit && !isPast && 'cursor-pointer hover:bg-muted/50',
                      isSelected && 'ring-2 ring-primary ring-inset',
                      day.isToday && 'bg-primary/5'
                    )}
                    onClick={() => toggleDateSelection(day.date, day)}
                  >
                    {/* Date Number */}
                    <div
                      className={cn(
                        'text-sm font-medium',
                        !day.isCurrentMonth && 'text-muted-foreground',
                        day.isToday && 'text-primary'
                      )}
                    >
                      {new Date(day.date).getDate()}
                    </div>

                    {/* Status Indicator */}
                    {statusInfo && (
                      <div
                        className={cn(
                          'mt-1 px-1.5 py-0.5 rounded text-xs truncate',
                          statusInfo.bgColor,
                          statusInfo.color
                        )}
                      >
                        {statusInfo.label}
                      </div>
                    )}

                    {/* Time Slots Indicator */}
                    {day.availability?.time_slots && day.availability.time_slots.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {day.availability.time_slots.length}
                      </div>
                    )}

                    {/* Assigned Indicator */}
                    {day.availability?.is_assigned && (
                      <Badge
                        variant="secondary"
                        className="absolute top-1 right-1 text-xs px-1"
                      >
                        Assigned
                      </Badge>
                    )}

                    {/* Clear Button (on hover for single day) */}
                    {canEdit && status && !isPast && !isSelected && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleClearAvailability(day.date)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </CardContent>

      {/* Set Availability Dialog */}
      <Dialog open={showSetDialog} onOpenChange={setShowSetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Availability</DialogTitle>
            <DialogDescription>
              Set your availability for {selectedDates.size} selected date(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Status Selection */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={dialogStatus}
                onValueChange={(v) => setDialogStatus(v as AvailabilityStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      Available
                    </div>
                  </SelectItem>
                  <SelectItem value="busy">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      Busy
                    </div>
                  </SelectItem>
                  <SelectItem value="unavailable">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-red-600" />
                      Unavailable
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time Slots (only for available/busy) */}
            {dialogStatus !== 'unavailable' && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useTimeSlots"
                    checked={useTimeSlots}
                    onCheckedChange={(c) => setUseTimeSlots(!!c)}
                  />
                  <Label htmlFor="useTimeSlots">Specify time slots</Label>
                </div>

                {useTimeSlots && (
                  <div className="space-y-2 pl-6">
                    {DEFAULT_TIME_SLOTS.map((slot) => {
                      const isSelected = dialogTimeSlots.some(
                        (s) => s.start === slot.start && s.end === slot.end
                      )
                      return (
                        <div
                          key={`${slot.start}-${slot.end}`}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`slot-${slot.start}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleTimeSlot(slot)}
                          />
                          <Label htmlFor={`slot-${slot.start}`}>
                            {slot.label} ({slot.start} - {slot.end})
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={dialogNotes}
                onChange={(e) => setDialogNotes(e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetAvailability} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Set Availability'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
