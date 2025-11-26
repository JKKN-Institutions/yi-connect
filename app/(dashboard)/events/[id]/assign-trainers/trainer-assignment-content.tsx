'use client'

/**
 * Trainer Assignment Content Component
 *
 * Client component for trainer selection and invitation.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send, LayoutGrid, List, Loader2 } from 'lucide-react'
import {
  assignTrainersToEvent,
  sendTrainerInvitations,
} from '@/app/actions/trainer-assignments'
import { TrainerRecommendationCard } from '@/components/events/trainer-recommendation-card'
import { TrainerAssignmentTable } from '@/components/events/trainer-assignment-table'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'
import type {
  TrainerRecommendation,
  EventTrainerAssignmentWithDetails,
} from '@/types/event'

interface TrainerAssignmentContentProps {
  eventId: string
  trainers: TrainerRecommendation[]
  trainersNeeded: number
  existingAssignments: EventTrainerAssignmentWithDetails[]
}

export function TrainerAssignmentContent({
  eventId,
  trainers,
  trainersNeeded,
  existingAssignments,
}: TrainerAssignmentContentProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedTrainers, setSelectedTrainers] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  // Get already assigned trainer IDs
  const assignedTrainerIds = existingAssignments.map((a) => a.trainer_profile_id)

  // Filter out already assigned trainers
  const availableTrainers = trainers.filter(
    (t) => !assignedTrainerIds.includes(t.trainer_profile_id)
  )

  const handleSelect = (trainerId: string) => {
    setSelectedTrainers((prev) => [...prev, trainerId])
  }

  const handleDeselect = (trainerId: string) => {
    setSelectedTrainers((prev) => prev.filter((id) => id !== trainerId))
  }

  const handleAssignAndInvite = () => {
    if (selectedTrainers.length === 0) {
      toast.error('Please select at least one trainer')
      return
    }
    setConfirmDialogOpen(true)
  }

  const confirmAssignment = () => {
    startTransition(async () => {
      try {
        // First assign trainers
        const assignResult = await assignTrainersToEvent({
          event_id: eventId,
          trainer_profile_ids: selectedTrainers,
          selection_method: 'manual',
        })

        if (!assignResult.success) {
          toast.error(assignResult.error || 'Failed to assign trainers')
          return
        }

        // Then send invitations
        const inviteResult = await sendTrainerInvitations(
          eventId,
          selectedTrainers
        )

        if (inviteResult.success) {
          toast.success(`${selectedTrainers.length} trainer(s) invited successfully`)
          setSelectedTrainers([])
          setConfirmDialogOpen(false)
          router.refresh()
        } else {
          toast.error(inviteResult.error || 'Failed to send invitations')
        }
      } catch (error) {
        console.error('Error assigning trainers:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Trainers</CardTitle>
              <CardDescription>
                {availableTrainers.length} trainers available
                {selectedTrainers.length > 0 && (
                  <span className="ml-2">
                    • <Badge variant="secondary">{selectedTrainers.length} selected</Badge>
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'table')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="grid">
                    <LayoutGrid className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    <List className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Assign Button */}
              <Button
                onClick={handleAssignAndInvite}
                disabled={selectedTrainers.length === 0 || isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Assign & Invite ({selectedTrainers.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {availableTrainers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No available trainers found for this event type and location.</p>
              <p className="text-sm mt-2">
                Try expanding the search criteria or check trainer certifications.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableTrainers.map((trainer) => (
                <TrainerRecommendationCard
                  key={trainer.trainer_profile_id}
                  trainer={trainer}
                  isSelected={selectedTrainers.includes(trainer.trainer_profile_id)}
                  onSelect={handleSelect}
                  onDeselect={handleDeselect}
                  disabled={!trainer.is_available}
                />
              ))}
            </div>
          ) : (
            <TrainerAssignmentTable
              trainers={availableTrainers}
              selectedTrainers={selectedTrainers}
              onSelectionChange={setSelectedTrainers}
              trainersNeeded={trainersNeeded}
              onInviteSelected={handleAssignAndInvite}
              isLoading={isPending}
            />
          )}
        </CardContent>
      </Card>

      {/* Existing Assignments */}
      {existingAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Assignments</CardTitle>
            <CardDescription>
              Trainers already assigned to this event
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {existingAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">
                        {assignment.trainer?.member?.profile?.full_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {assignment.trainer?.member?.profile?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {assignment.match_score && (
                      <Badge variant="outline">{assignment.match_score} pts</Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        assignment.status === 'confirmed'
                          ? 'bg-green-50 text-green-700'
                          : assignment.status === 'accepted'
                          ? 'bg-blue-50 text-blue-700'
                          : assignment.status === 'invited'
                          ? 'bg-yellow-50 text-yellow-700'
                          : assignment.status === 'declined'
                          ? 'bg-red-50 text-red-700'
                          : ''
                      }
                    >
                      {assignment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Trainer Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to assign and invite {selectedTrainers.length} trainer(s) to this event.
              They will receive a notification with a 24-hour deadline to respond.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAssignment} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Confirm & Send Invites'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
