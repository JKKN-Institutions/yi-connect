'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Eye, CheckCircle, XCircle } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { reviewApplication } from '@/app/actions/succession'
import { toast } from 'react-hot-toast'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  submitted: 'bg-blue-500',
  under_review: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  withdrawn: 'bg-gray-400',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

interface AdminApplicationsTableProps {
  applications: any[]
}

export function AdminApplicationsTable({ applications }: AdminApplicationsTableProps) {
  const router = useRouter()
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<any>(null)
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved')
  const [reviewNotes, setReviewNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openReviewDialog = (application: any, action: 'approved' | 'rejected') => {
    setSelectedApplication(application)
    setReviewAction(action)
    setReviewNotes('')
    setReviewDialogOpen(true)
  }

  const handleReview = async () => {
    if (!selectedApplication) return

    if (reviewNotes.length < 10) {
      toast.error('Please provide review notes (at least 10 characters)')
      return
    }

    setIsSubmitting(true)
    const result = await reviewApplication(selectedApplication.id, reviewAction, reviewNotes)

    if (result.success) {
      toast.success(`Application ${reviewAction} successfully`)
      setReviewDialogOpen(false)
      setSelectedApplication(null)
      setReviewNotes('')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to review application')
    }

    setIsSubmitting(false)
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No applications found</p>
        <p className="text-sm mt-2">
          Applications will appear here when members submit them
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
              <TableHead>Applicant</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((application: any) => (
              <TableRow key={application.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {application.applicant.first_name} {application.applicant.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {application.applicant.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{application.position.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Level {application.position.hierarchy_level}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="text-sm">{application.cycle.cycle_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {application.cycle.year}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[application.status]}>
                    {statusLabels[application.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {application.submitted_at ? (
                    <div className="text-sm">
                      {new Date(application.submitted_at).toLocaleDateString()}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not submitted</span>
                  )}
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
                          router.push(`/succession/applications/${application.id}`)
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {application.status === 'submitted' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openReviewDialog(application, 'approved')}
                            className="text-green-600"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve Application
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openReviewDialog(application, 'rejected')}
                            className="text-destructive"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject Application
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approved' ? 'Approve' : 'Reject'} Application
            </DialogTitle>
            <DialogDescription>
              {selectedApplication && (
                <>
                  Review the application of{' '}
                  <strong>
                    {selectedApplication.applicant.first_name}{' '}
                    {selectedApplication.applicant.last_name}
                  </strong>{' '}
                  for <strong>{selectedApplication.position.title}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-notes">Review Notes</Label>
              <Textarea
                id="review-notes"
                placeholder="Provide your reasoning for this decision..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={5}
              />
              <p className="text-sm text-muted-foreground">
                Minimum 10 characters required
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={isSubmitting}
              variant={reviewAction === 'approved' ? 'default' : 'destructive'}
            >
              {isSubmitting
                ? 'Processing...'
                : reviewAction === 'approved'
                ? 'Approve'
                : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
