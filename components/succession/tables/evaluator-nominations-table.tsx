'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, CheckCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EvaluationScoringForm } from '@/components/succession/forms/evaluation-scoring-form'

interface EvaluatorNominationsTableProps {
  nominations: any[]
  evaluatorId: string
}

export function EvaluatorNominationsTable({
  nominations,
  evaluatorId,
}: EvaluatorNominationsTableProps) {
  const router = useRouter()
  const [scoringDialogOpen, setScoringDialogOpen] = useState(false)
  const [selectedNomination, setSelectedNomination] = useState<any>(null)

  const openScoringDialog = (nomination: any) => {
    setSelectedNomination(nomination)
    setScoringDialogOpen(true)
  }

  const handleScoringSuccess = () => {
    setScoringDialogOpen(false)
    setSelectedNomination(null)
    router.refresh()
  }

  if (nominations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No nominations assigned</p>
        <p className="text-sm mt-2">
          You currently have no nominations to evaluate
        </p>
      </div>
    )
  }

  const pendingNominations = nominations.filter((n) => !n.has_scored)
  const completedNominations = nominations.filter((n) => n.has_scored)

  return (
    <>
      <div className="space-y-6">
        {pendingNominations.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Pending Evaluations</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nominee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingNominations.map((nomination: any) => (
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
                        <div className="font-medium">{nomination.position.title}</div>
                        <div className="text-sm text-muted-foreground">
                          Level {nomination.position.hierarchy_level}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {nomination.nomination_type === 'self_nomination'
                            ? 'Self'
                            : nomination.nomination_type === 'peer_nomination'
                            ? 'Peer'
                            : 'Leadership'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            nomination.status === 'approved'
                              ? 'default'
                              : nomination.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {nomination.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => openScoringDialog(nomination)}
                          disabled={nomination.status !== 'approved'}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Score
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {completedNominations.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Completed Evaluations
            </h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nominee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Weighted Score</TableHead>
                    <TableHead>Completed Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedNominations.map((nomination: any) => (
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
                        <div className="font-medium">{nomination.position.title}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {nomination.nomination_type === 'self_nomination'
                            ? 'Self'
                            : nomination.nomination_type === 'peer_nomination'
                            ? 'Peer'
                            : 'Leadership'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-600">
                          {nomination.weighted_score?.toFixed(2) || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(nomination.scored_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={scoringDialogOpen} onOpenChange={setScoringDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Score Nomination</DialogTitle>
            <DialogDescription>
              {selectedNomination && (
                <>
                  Evaluate {selectedNomination.nominee.first_name}{' '}
                  {selectedNomination.nominee.last_name} for{' '}
                  {selectedNomination.position.title}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedNomination && (
            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nomination Type:</span>{' '}
                      <span className="font-medium capitalize">
                        {selectedNomination.nomination_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>{' '}
                      <span className="font-medium">
                        {new Date(selectedNomination.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedNomination.reason && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Reason:</span>
                        <p className="mt-1 text-sm">{selectedNomination.reason}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <EvaluationScoringForm
                nominationId={selectedNomination.id}
                evaluatorId={evaluatorId}
                criteria={selectedNomination.position.criteria || []}
                nominee={selectedNomination.nominee}
                position={selectedNomination.position}
                onSuccess={handleScoringSuccess}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
