'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Badge } from '@/components/ui/badge'
import { removeEvaluator } from '@/app/actions/succession'
import { toast } from 'react-hot-toast'

interface EvaluatorsTableProps {
  evaluators: any[]
}

export function EvaluatorsTable({ evaluators }: EvaluatorsTableProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedEvaluator, setSelectedEvaluator] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const openDeleteDialog = (evaluator: any) => {
    setSelectedEvaluator(evaluator)
    setDeleteDialogOpen(true)
  }

  const handleRemove = async () => {
    if (!selectedEvaluator) return

    setIsDeleting(true)
    const result = await removeEvaluator(selectedEvaluator.id)

    if (result.success) {
      toast.success('Evaluator removed successfully')
      setDeleteDialogOpen(false)
      setSelectedEvaluator(null)
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to remove evaluator')
    }

    setIsDeleting(false)
  }

  if (evaluators.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No evaluators assigned</p>
        <p className="text-sm mt-2">
          Click "Assign Evaluator" to add members as evaluators for this cycle
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
              <TableHead>Evaluator</TableHead>
              <TableHead>Assigned By</TableHead>
              <TableHead>Assigned Date</TableHead>
              <TableHead>Evaluations</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {evaluators.map((evaluator: any) => (
              <TableRow key={evaluator.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {evaluator.evaluator.first_name} {evaluator.evaluator.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {evaluator.evaluator.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {evaluator.assigned_by ? (
                    <div className="text-sm">
                      {evaluator.assigned_by.first_name} {evaluator.assigned_by.last_name}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">System</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {new Date(evaluator.assigned_at).toLocaleDateString()}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {evaluator.scored_nominations || 0} / {evaluator.total_nominations || 0}
                    </Badge>
                    {evaluator.total_nominations > 0 &&
                      evaluator.scored_nominations === evaluator.total_nominations && (
                        <Badge className="bg-green-500">Complete</Badge>
                      )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteDialog(evaluator)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Evaluator</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedEvaluator && (
                <>
                  Are you sure you want to remove{' '}
                  <strong>
                    {selectedEvaluator.evaluator.first_name}{' '}
                    {selectedEvaluator.evaluator.last_name}
                  </strong>{' '}
                  as an evaluator? This action cannot be undone and will remove all their
                  evaluation scores.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Removing...' : 'Remove Evaluator'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
