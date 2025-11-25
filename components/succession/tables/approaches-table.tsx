'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Eye, Edit, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ApproachResponseBadge } from '../displays/succession-status-badges'
import { updateApproachResponse, deleteApproach } from '@/app/actions/succession'
import { toast } from 'react-hot-toast'

interface ApproachesTableProps {
  approaches: any[]
}

export function ApproachesTable({ approaches }: ApproachesTableProps) {
  const router = useRouter()
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedApproach, setSelectedApproach] = useState<any>(null)
  const [responseStatus, setResponseStatus] = useState<'pending' | 'accepted' | 'declined' | 'conditional'>('pending')
  const [conditionsText, setConditionsText] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openUpdateDialog = (approach: any) => {
    setSelectedApproach(approach)
    setResponseStatus(approach.response_status || 'pending')
    setConditionsText(approach.conditions_text || '')
    setNotes(approach.notes || '')
    setUpdateDialogOpen(true)
  }

  const openDeleteDialog = (approach: any) => {
    setSelectedApproach(approach)
    setDeleteDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!selectedApproach) return

    setIsSubmitting(true)
    const result = await updateApproachResponse(
      selectedApproach.id,
      responseStatus,
      conditionsText,
      notes
    )

    if (result.success) {
      toast.success('Approach updated successfully')
      setUpdateDialogOpen(false)
      setSelectedApproach(null)
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to update approach')
    }

    setIsSubmitting(false)
  }

  const handleDelete = async () => {
    if (!selectedApproach) return

    setIsSubmitting(true)
    const result = await deleteApproach(selectedApproach.id)

    if (result.success) {
      toast.success('Approach deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedApproach(null)
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to delete approach')
    }

    setIsSubmitting(false)
  }

  const getResponseIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'declined':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'conditional':
        return <AlertCircle className="h-4 w-4 text-orange-600" />
      default:
        return null
    }
  }

  if (approaches.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No approach records found</p>
        <p className="text-sm mt-2">
          Approach records will appear here when candidates are contacted
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
              <TableHead>Candidate</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Approached By</TableHead>
              <TableHead>Approached On</TableHead>
              <TableHead>Response Status</TableHead>
              <TableHead>Response Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approaches.map((approach: any) => (
              <TableRow key={approach.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {approach.nominee.first_name} {approach.nominee.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {approach.nominee.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{approach.position.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Level {approach.position.hierarchy_level}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {approach.approached_by_member.first_name}{' '}
                    {approach.approached_by_member.last_name}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {new Date(approach.approached_at).toLocaleDateString()}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getResponseIcon(approach.response_status)}
                    <ApproachResponseBadge status={approach.response_status} />
                  </div>
                </TableCell>
                <TableCell>
                  {approach.response_date ? (
                    <div className="text-sm">
                      {new Date(approach.response_date).toLocaleDateString()}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Pending</span>
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
                        onClick={() => openUpdateDialog(approach)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Update Response
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(approach)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Update Response Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Update Approach Response</DialogTitle>
            <DialogDescription>
              Update the response status for{' '}
              {selectedApproach &&
                `${selectedApproach.nominee.first_name} ${selectedApproach.nominee.last_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="response_status">Response Status</Label>
              <Select
                value={responseStatus}
                onValueChange={(value: any) => setResponseStatus(value)}
              >
                <SelectTrigger id="response_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="conditional">Conditional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {responseStatus === 'conditional' && (
              <div className="space-y-2">
                <Label htmlFor="conditions">Conditions</Label>
                <Textarea
                  id="conditions"
                  value={conditionsText}
                  onChange={(e) => setConditionsText(e.target.value)}
                  placeholder="Enter conditions specified by the candidate..."
                  className="min-h-[100px]"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any relevant notes..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUpdateDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Response'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Approach Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this approach record? This action cannot
              be undone.
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
