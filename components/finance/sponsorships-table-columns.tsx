'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { DealStageBadge, PriorityBadge } from '@/components/finance/status-badges'
import { formatCurrency } from '@/types/finance'
import type { SponsorshipDealListItem } from '@/types/finance'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Edit, Trash, TrendingUp, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

export const sponsorshipsColumns: ColumnDef<SponsorshipDealListItem>[] = [
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
    accessorKey: 'deal_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Deal Name" />
    ),
    cell: ({ row }) => {
      const deal = row.original
      return (
        <div className="flex flex-col">
          <Link
            href={`/finance/sponsorships/${deal.id}`}
            className="font-medium hover:underline max-w-[250px] truncate"
          >
            {deal.deal_name}
          </Link>
          <div className="text-xs text-muted-foreground mt-1">
            {deal.sponsor.organization_name}
          </div>
        </div>
      )
    },
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: 'deal_stage',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Stage" />
    ),
    cell: ({ row }) => <DealStageBadge stage={row.getValue('deal_stage')} />,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    enableSorting: false,
  },
  {
    accessorKey: 'proposed_amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Proposed Value" />
    ),
    cell: ({ row }) => {
      const deal = row.original
      return (
        <div className="flex flex-col">
          <div className="font-medium">{formatCurrency(deal.proposed_amount)}</div>
          {deal.tier && (
            <Badge variant="outline" className="text-xs mt-1 w-fit">
              {deal.tier.name}
            </Badge>
          )}
        </div>
      )
    },
    enableSorting: true,
  },
  {
    accessorKey: 'weighted_value',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Weighted Value" />
    ),
    cell: ({ row }) => {
      const deal = row.original
      return (
        <div className="flex flex-col">
          <div className="font-medium">{formatCurrency(deal.weighted_value)}</div>
          <div className="text-xs text-muted-foreground">
            {deal.probability_percentage}% probability
          </div>
        </div>
      )
    },
    enableSorting: true,
  },
  {
    accessorKey: 'received_amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Received" />
    ),
    cell: ({ row }) => {
      const deal = row.original
      const receivedPercentage = deal.committed_amount
        ? Math.round((deal.received_amount / deal.committed_amount) * 100)
        : 0

      return (
        <div className="flex flex-col gap-1 min-w-[150px]">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{formatCurrency(deal.received_amount)}</span>
            {deal.committed_amount && (
              <span className="text-muted-foreground text-xs">
                / {formatCurrency(deal.committed_amount)}
              </span>
            )}
          </div>
          {deal.committed_amount && deal.committed_amount > 0 && (
            <Progress value={receivedPercentage} className="h-1" />
          )}
        </div>
      )
    },
    enableSorting: true,
  },
  {
    accessorKey: 'expected_closure_date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expected Closure" />
    ),
    cell: ({ row }) => {
      const date = row.getValue('expected_closure_date')
      if (!date) return <span className="text-muted-foreground">-</span>

      const closureDate = new Date(date as string)
      const isOverdue = closureDate < new Date() && !['payment_received', 'lost'].includes(row.original.deal_stage)

      return (
        <div className={`text-sm ${isOverdue ? 'text-destructive font-medium' : ''}`}>
          {closureDate.toLocaleDateString()}
        </div>
      )
    },
    enableSorting: true,
  },
  {
    accessorKey: 'assigned_to',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assigned To" />
    ),
    cell: ({ row }) => {
      const assignedTo = row.original.assigned_to
      if (!assignedTo) return <span className="text-muted-foreground">-</span>
      return <div className="text-sm">{assignedTo.full_name}</div>
    },
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const deal = row.original

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
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/finance/sponsorships/${deal.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/finance/sponsorships/${deal.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Deal
              </Link>
            </DropdownMenuItem>
            {deal.deal_stage === 'committed' && (
              <DropdownMenuItem>
                <DollarSign className="mr-2 h-4 w-4" />
                Record Payment
              </DropdownMenuItem>
            )}
            {['prospect', 'contacted', 'proposal_sent'].includes(deal.deal_stage) && (
              <DropdownMenuItem>
                <TrendingUp className="mr-2 h-4 w-4" />
                Advance Stage
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
