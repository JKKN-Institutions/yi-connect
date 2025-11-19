'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Eye, XCircle } from 'lucide-react'
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
import { withdrawApplication } from '@/app/actions/succession'
import toast from 'react-hot-toast'

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

interface MyApplicationsTableProps {
  applications: any[]
}

export function MyApplicationsTable({ applications }: MyApplicationsTableProps) {
  const router = useRouter()
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)

  const handleWithdraw = async (id: string, positionTitle: string) => {
    if (
      !confirm(
        `Are you sure you want to withdraw your application for ${positionTitle}? This action cannot be undone.`
      )
    ) {
      return
    }

    setWithdrawingId(id)
    const result = await withdrawApplication(id, 'Withdrawn by applicant')

    if (result.success) {
      toast.success('Application withdrawn successfully')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to withdraw application')
    }

    setWithdrawingId(null)
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No applications submitted yet</p>
        <p className="text-sm mt-2">
          Click &quot;Apply for Position&quot; to submit your application for a leadership role
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={withdrawingId === application.id}
                    >
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
                          onClick={() =>
                            handleWithdraw(application.id, application.position.title)
                          }
                          className="text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Withdraw Application
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
