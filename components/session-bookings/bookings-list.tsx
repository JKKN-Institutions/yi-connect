/**
 * Bookings List Component
 *
 * Displays a list of session bookings with status and actions.
 */

'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  MoreHorizontal,
  Eye,
  XCircle,
  RefreshCw,
  CheckCircle,
  Loader2,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { cancelBooking } from '@/app/actions/session-bookings'
import { toast } from 'react-hot-toast'
import type { SessionBookingFull, BOOKING_STATUS_INFO } from '@/types/session-booking'

interface BookingsListProps {
  bookings: SessionBookingFull[]
  showActions?: boolean
  onViewBooking?: (bookingId: string) => void
  onReschedule?: (bookingId: string) => void
  emptyMessage?: string
}

const STATUS_INFO: typeof BOOKING_STATUS_INFO = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    description: 'Waiting for trainer assignment',
  },
  pending_trainer: {
    label: 'Pending Trainer',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-500/20',
    description: 'Finding available trainer',
  },
  trainer_assigned: {
    label: 'Trainer Assigned',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-500/20',
    description: 'Trainer confirmed',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-500/20',
    description: 'Session confirmed',
  },
  materials_pending: {
    label: 'Materials Pending',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-500/20',
    description: 'Waiting for materials',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-cyan-700 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    description: 'Session ongoing',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    description: 'Session completed',
  },
  rescheduled: {
    label: 'Rescheduled',
    color: 'text-indigo-700 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    description: 'Session rescheduled',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-500/20',
    description: 'Session cancelled',
  },
}

export function BookingsList({
  bookings,
  showActions = true,
  onViewBooking,
  onReschedule,
  emptyMessage = 'No bookings found',
}: BookingsListProps) {
  const [isPending, startTransition] = useTransition()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const handleCancel = () => {
    if (!selectedBookingId || !cancelReason.trim()) return

    startTransition(async () => {
      const result = await cancelBooking({
        booking_id: selectedBookingId,
        reason: cancelReason,
      })

      if (result.success) {
        toast.success('Booking cancelled')
        setShowCancelDialog(false)
        setSelectedBookingId(null)
        setCancelReason('')
      } else if (!result.success) {
        toast.error(result.error || 'Failed to cancel booking')
      }
    })
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {bookings.map((booking) => {
          const statusInfo = STATUS_INFO[booking.status]
          const sessionDate = booking.confirmed_date || booking.preferred_date
          const trainerName = booking.assigned_trainer?.member?.profile?.full_name

          return (
            <Card key={booking.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: Session Info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className={cn('text-sm', statusInfo?.bgColor, statusInfo?.color)}>
                        {statusInfo?.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {booking.session_type?.display_name}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(sessionDate), 'PPP')}</span>
                      </div>
                      {booking.confirmed_time_start && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            {booking.confirmed_time_start} - {booking.confirmed_time_end}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{booking.expected_participants} participants</span>
                      </div>
                    </div>

                    {booking.venue && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{booking.venue}</span>
                      </div>
                    )}

                    {/* Trainer Info */}
                    {trainerName && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={booking.assigned_trainer?.member?.profile?.avatar_url || undefined}
                          />
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{trainerName}</p>
                          <p className="text-xs text-muted-foreground">Assigned Trainer</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  {showActions && !['completed', 'cancelled'].includes(booking.status) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {onViewBooking && (
                          <DropdownMenuItem onClick={() => onViewBooking(booking.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                        )}
                        {onReschedule && (
                          <DropdownMenuItem onClick={() => onReschedule(booking.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reschedule
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setSelectedBookingId(booking.id)
                            setShowCancelDialog(true)
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel Booking
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Completed badge */}
                  {booking.status === 'completed' && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">Session Completed</p>
                        {booking.attendance_count && (
                          <p className="text-xs text-muted-foreground">
                            {booking.attendance_count} attended
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Cancellation Reason *</Label>
              <Textarea
                id="reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please provide a reason for cancellation..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false)
                setCancelReason('')
              }}
            >
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Booking'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
