'use client'

/**
 * Planned Activity Actions Component
 *
 * Dropdown menu with actions for a planned activity:
 * - Start (mark as in progress)
 * - Cancel
 * - Delete
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  MoreVertical,
  Play,
  XCircle,
  Trash2,
  Loader2,
} from 'lucide-react'
import {
  updatePlannedActivityStatus,
  deletePlannedActivity,
} from '@/app/actions/planned-activities'
import type { PlannedActivityWithDetails } from '@/types/planned-activity'

interface PlannedActivityActionsProps {
  activity: PlannedActivityWithDetails
}

export function PlannedActivityActions({ activity }: PlannedActivityActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const handleStartActivity = () => {
    startTransition(async () => {
      const result = await updatePlannedActivityStatus(activity.id, 'in_progress')
      if (result.success) {
        toast.success('Activity started')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to start activity')
      }
    })
  }

  const handleCancelActivity = () => {
    startTransition(async () => {
      const result = await updatePlannedActivityStatus(activity.id, 'cancelled')
      if (result.success) {
        toast.success('Activity cancelled')
        setShowCancelDialog(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to cancel activity')
      }
    })
  }

  const handleDeleteActivity = () => {
    startTransition(async () => {
      const result = await deletePlannedActivity(activity.id)
      if (result.success) {
        toast.success('Activity deleted')
        setShowDeleteDialog(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to delete activity')
      }
    })
  }

  // Don't show actions for completed activities
  if (activity.status === 'completed') {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {activity.status === 'planned' && (
            <DropdownMenuItem onClick={handleStartActivity}>
              <Play className="h-4 w-4 mr-2" />
              Start Activity
            </DropdownMenuItem>
          )}

          {activity.status !== 'cancelled' && (
            <DropdownMenuItem
              onClick={() => setShowCancelDialog(true)}
              className="text-amber-600 focus:text-amber-600"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Activity
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark &quot;{activity.activity_name}&quot; as cancelled.
              You can still view it in the cancelled tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelActivity}
              disabled={isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Activity
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{activity.activity_name}&quot;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteActivity}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
