'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Eye, Edit, Trash2, Vote, Calendar } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Button } from '@/components/ui/button'
import { MeetingStatusBadge, MeetingTypeBadge } from '../displays/succession-status-badges'
import { deleteMeeting } from '@/app/actions/succession'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'

interface MeetingsTableProps {
  meetings: any[]
}

export function MeetingsTable({ meetings }: MeetingsTableProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openDeleteDialog = (meeting: any) => {
    setSelectedMeeting(meeting)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedMeeting) return

    setIsSubmitting(true)
    const result = await deleteMeeting(selectedMeeting.id)

    if (result.success) {
      toast.success('Meeting deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedMeeting(null)
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to delete meeting')
    }

    setIsSubmitting(false)
  }

  const formatMeetingDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPp') // e.g., "Jan 1, 2024, 2:30 PM"
    } catch {
      return dateString
    }
  }

  const isPastMeeting = (dateString: string) => {
    return new Date(dateString) < new Date()
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No meetings scheduled</p>
        <p className="text-sm mt-2">
          Schedule steering committee meetings to vote on candidates
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meeting Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location / Link</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.map((meeting: any) => {
              const past = isPastMeeting(meeting.meeting_date)
              return (
                <TableRow key={meeting.id} className={past ? 'opacity-75' : ''}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {formatMeetingDate(meeting.meeting_date)}
                      </div>
                      {past && (
                        <div className="text-xs text-muted-foreground">Past meeting</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <MeetingTypeBadge type={meeting.meeting_type} />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {meeting.location && (
                        <div className="text-sm">{meeting.location}</div>
                      )}
                      {meeting.meeting_link && (
                        <a
                          href={meeting.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Join Meeting
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <MeetingStatusBadge status={meeting.status} />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {meeting.created_by_member.first_name}{' '}
                      {meeting.created_by_member.last_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/succession/admin/meetings/${meeting.id}`)
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {(meeting.status === 'scheduled' ||
                          meeting.status === 'in_progress') && (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/succession/admin/meetings/${meeting.id}/vote`
                                )
                              }
                            >
                              <Vote className="mr-2 h-4 w-4" />
                              Cast Votes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/succession/admin/meetings/${meeting.id}/edit`
                                )
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Meeting
                            </DropdownMenuItem>
                          </>
                        )}
                        {meeting.status === 'scheduled' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(meeting)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Meeting</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this meeting? This action cannot be
              undone. All associated votes will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
