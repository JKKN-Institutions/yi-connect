'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { ReimbursementStatusBadge } from '@/components/finance/status-badges'
import { formatCurrency } from '@/types/finance'
import type { ReimbursementRequestListItem } from '@/types/finance'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, CheckCircle, XCircle, Clock, User } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export const reimbursementsColumns: ColumnDef<ReimbursementRequestListItem>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'title',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Request" />
    ),
    cell: ({ row }) => {
      const request = row.original
      return (
        <div className="flex flex-col">
          <Link
            href={`/finance/reimbursements/${request.id}`}
            className="font-medium hover:underline max-w-[250px] truncate"
          >
            {request.title}
          </Link>
          <div className="flex items-center gap-1 mt-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{request.requester_name}</span>
          </div>
        </div>
      )
    },
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">{formatCurrency(row.getValue('amount'))}</div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <ReimbursementStatusBadge status={row.getValue('status')} />,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    enableSorting: false,
  },
  {
    accessorKey: 'expense_date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expense Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('expense_date'))
      return <div className="text-sm">{date.toLocaleDateString()}</div>
    },
    enableSorting: true,
  },
  {
    accessorKey: 'submitted_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Submitted" />
    ),
    cell: ({ row }) => {
      const submittedAt = row.getValue('submitted_at')
      if (!submittedAt) return <span className="text-muted-foreground">Not submitted</span>

      const date = new Date(submittedAt as string)
      return (
        <div className="text-sm">
          <div>{date.toLocaleDateString()}</div>
          {row.original.pending_days !== undefined && row.original.pending_days > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              {row.original.pending_days} days pending
            </div>
          )}
        </div>
      )
    },
    enableSorting: true,
  },
  {
    accessorKey: 'current_approver',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Current Approver" />
    ),
    cell: ({ row }) => {
      const approver = row.original.current_approver
      if (!approver) {
        return <span className="text-muted-foreground text-sm">-</span>
      }
      return (
        <div className="flex items-center gap-1">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{approver.full_name}</span>
        </div>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'event',
    header: 'Event',
    cell: ({ row }) => {
      const event = row.original.event
      if (!event) return <span className="text-muted-foreground text-sm">-</span>
      return (
        <Badge variant="outline" className="text-xs">
          {event.title}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const request = row.original
      const canApprove = request.status === 'pending_approval' || request.status === 'submitted'

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/finance/reimbursements/${request.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            {canApprove && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-green-600">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
