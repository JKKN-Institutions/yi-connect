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
import { reviewNomination } from '@/app/actions/succession'
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

interface AdminNominationsTableProps {
  nominations: any[]
}

export function AdminNominationsTable({ nominations }: AdminNominationsTableProps) {
  const router = useRouter()
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [selectedNomination, setSelectedNomination] = useState<any>(null)
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved')
  const [reviewNotes, setReviewNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openReviewDialog = (nomination: any, action: 'approved' | 'rejected') => {
    setSelectedNomination(nomination)
    setReviewAction(action)
    setReviewNotes('')
    setReviewDialogOpen(true)
  }

  const handleReview = async () => {
    if (!selectedNomination) return

    if (reviewNotes.length < 10) {
      toast.error('Please provide review notes (at least 10 characters)')
      return
    }

    setIsSubmitting(true)
    const result = await reviewNomination(
      selectedNomination.id,
      reviewAction,
      reviewNotes
    )

    if (result.success) {
      toast.success(`Nomination ${reviewAction} successfully`)
      setReviewDialogOpen(false)
      setSelectedNomination(null)
      setReviewNotes('')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to review nomination')
    }

    setIsSubmitting(false)
  }

  if (nominations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No nominations found</p>
        <p className="text-sm mt-2">
          Nominations will appear here when members submit them
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
              <TableHead>Nominee</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Nominated By</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nominations.map((nomination: any) => (
              <TableRow key={nomination.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {nomination.nominee.first_name} {nomination.nominee.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {nomination.nominee.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{nomination.position.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Level {nomination.position.hierarchy_level}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {nomination.nominator.first_name} {nomination.nominator.last_name}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="text-sm">{nomination.cycle.cycle_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {nomination.cycle.year}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[nomination.status]}>
                    {statusLabels[nomination.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {nomination.submitted_at ? (
                    <div className="text-sm">
                      {new Date(nomination.submitted_at).toLocaleDateString()}
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
                          router.push(`/succession/nominations/${nomination.id}`)
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {nomination.status === 'submitted' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openReviewDialog(nomination, 'approved')}
                            className="text-green-600"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve Nomination
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openReviewDialog(nomination, 'rejected')}
                            className="text-destructive"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject Nomination
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
              {reviewAction === 'approved' ? 'Approve' : 'Reject'} Nomination
            </DialogTitle>
            <DialogDescription>
              {selectedNomination && (
                <>
                  Review the nomination of{' '}
                  <strong>
                    {selectedNomination.nominee.first_name}{' '}
                    {selectedNomination.nominee.last_name}
                  </strong>{' '}
                  for <strong>{selectedNomination.position.title}</strong>
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
              {isSubmitting ? 'Processing...' : reviewAction === 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
