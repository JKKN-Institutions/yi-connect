'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Eye, Edit, Trash2, PlayCircle } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SuccessionCycle } from '@/lib/types/succession'
import { deleteSuccessionCycle } from '@/app/actions/succession'
import { toast } from 'react-hot-toast'

interface SuccessionCyclesTableProps {
  cycles: SuccessionCycle[]
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  active: 'bg-blue-500',
  nominations_open: 'bg-green-500',
  nominations_closed: 'bg-yellow-500',
  applications_open: 'bg-green-500',
  applications_closed: 'bg-yellow-500',
  evaluations: 'bg-purple-500',
  evaluations_closed: 'bg-purple-500',
  interviews: 'bg-indigo-500',
  interviews_closed: 'bg-indigo-500',
  selection: 'bg-orange-500',
  approval_pending: 'bg-amber-500',
  completed: 'bg-emerald-500',
  archived: 'bg-gray-400',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  nominations_open: 'Nominations Open',
  nominations_closed: 'Nominations Closed',
  applications_open: 'Applications Open',
  applications_closed: 'Applications Closed',
  evaluations: 'Evaluations',
  evaluations_closed: 'Evaluations Closed',
  interviews: 'Interviews',
  interviews_closed: 'Interviews Closed',
  selection: 'Selection',
  approval_pending: 'Approval Pending',
  completed: 'Completed',
  archived: 'Archived',
}

export function SuccessionCyclesTable({ cycles }: SuccessionCyclesTableProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string, cycleName: string) => {
    if (!confirm(`Are you sure you want to delete cycle "${cycleName}"? This action cannot be undone.`)) {
      return
    }

    setDeletingId(id)
    const result = await deleteSuccessionCycle(id)

    if (result.success) {
      toast.success('Cycle deleted successfully')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to delete cycle')
    }

    setDeletingId(null)
  }

  if (cycles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No succession cycles found</p>
        <p className="text-sm mt-2">Create your first succession cycle to get started</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cycle Name</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Timeline</TableHead>
            <TableHead>Published</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cycles.map((cycle) => (
            <TableRow key={cycle.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{cycle.cycle_name}</div>
                  {cycle.description && (
                    <div className="text-sm text-muted-foreground line-clamp-1">
                      {cycle.description}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>{cycle.year}</TableCell>
              <TableCell>
                <Badge className={statusColors[cycle.status]}>
                  {statusLabels[cycle.status]}
                </Badge>
              </TableCell>
              <TableCell>
                {cycle.start_date && cycle.end_date ? (
                  <div className="text-sm">
                    <div>{new Date(cycle.start_date).toLocaleDateString()}</div>
                    <div className="text-muted-foreground">
                      to {new Date(cycle.end_date).toLocaleDateString()}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Not set</span>
                )}
              </TableCell>
              <TableCell>
                {cycle.is_published ? (
                  <Badge variant="outline" className="bg-green-50">
                    Published
                  </Badge>
                ) : (
                  <Badge variant="outline">Draft</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === cycle.id}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => router.push(`/succession/admin/cycles/${cycle.id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push(`/succession/admin/cycles/${cycle.id}/edit`)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Cycle
                    </DropdownMenuItem>
                    {cycle.status === 'draft' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(cycle.id, cycle.cycle_name)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Cycle
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
  )
}
