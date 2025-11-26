'use client'

/**
 * Visit Request Actions Component
 *
 * Admin actions for approving/rejecting visit requests.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Calendar, Loader2 } from 'lucide-react'
import { reviewVisitRequest } from '@/app/actions/industry-opportunity'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'

interface VisitRequestActionsProps {
  requestId: string
}

export function VisitRequestActions({ requestId }: VisitRequestActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notes, setNotes] = useState('')

  const handleAction = (type: 'approve' | 'reject') => {
    setAction(type)
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!action) return

    if (action === 'approve' && !scheduledDate) {
      toast.error('Please select a scheduled date')
      return
    }

    startTransition(async () => {
      try {
        const result = await reviewVisitRequest({
          request_id: requestId,
          action: action === 'approve' ? 'approve' : 'decline',
          notes: notes || undefined,
          rejection_reason: action === 'reject' ? notes : undefined,
        })

        if (result.success) {
          toast.success(
            action === 'approve'
              ? 'Visit request approved'
              : 'Visit request rejected'
          )
          setDialogOpen(false)
          router.refresh()
        } else {
          toast.error(result.error || 'Action failed')
        }
      } catch (error) {
        console.error('Error:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actions</CardTitle>
          <CardDescription>Review this visit request</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={() => handleAction('approve')}
            className="w-full"
            disabled={isPending}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Approve & Schedule
          </Button>
          <Button
            onClick={() => handleAction('reject')}
            variant="destructive"
            className="w-full"
            disabled={isPending}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Approve Visit Request' : 'Reject Visit Request'}
            </DialogTitle>
            <DialogDescription>
              {action === 'approve'
                ? 'Set the scheduled date for this visit'
                : 'Provide a reason for rejecting this request'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {action === 'approve' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="scheduled-date">Scheduled Date *</Label>
                  <Input
                    id="scheduled-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduled-time">Scheduled Time</Label>
                  <Input
                    id="scheduled-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">
                {action === 'approve' ? 'Notes (optional)' : 'Reason for rejection'}
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  action === 'approve'
                    ? 'Any additional instructions for the visit...'
                    : 'Please explain why this request is being rejected...'
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              variant={action === 'reject' ? 'destructive' : 'default'}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : action === 'approve' ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
