'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { BudgetStatusBadge, BudgetPeriodBadge } from '@/components/finance/status-badges'
import { BudgetUtilization } from '@/components/finance/budget-utilization'
import { formatCurrency } from '@/types/finance'
import type { BudgetListItem } from '@/types/finance'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Edit, Trash, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export const budgetsColumns: ColumnDef<BudgetListItem>[] = [
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
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Budget Name" />
    ),
    cell: ({ row }) => {
      const budget = row.original
      return (
        <div className="flex flex-col">
          <Link
            href={`/finance/budgets/${budget.id}`}
            className="font-medium hover:underline"
          >
            {budget.name}
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <BudgetPeriodBadge period={budget.period} quarter={budget.quarter} />
            <span className="text-xs text-muted-foreground">FY {budget.fiscal_year}</span>
          </div>
        </div>
      )
    },
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: 'total_amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Budget" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">{formatCurrency(row.getValue('total_amount'))}</div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'utilization_percentage',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Utilization" />
    ),
    cell: ({ row }) => {
      const budget = row.original
      return (
        <div className="min-w-[200px]">
          <BudgetUtilization
            totalAmount={budget.total_amount}
            spentAmount={budget.spent_amount}
            allocatedAmount={budget.allocated_amount}
            showDetails={false}
          />
        </div>
      )
    },
    enableSorting: true,
  },
  {
    accessorKey: 'spent_amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Spent" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">{formatCurrency(row.getValue('spent_amount'))}</div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <BudgetStatusBadge status={row.getValue('status')} />,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    enableSorting: false,
  },
  {
    accessorKey: 'start_date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Period" />
    ),
    cell: ({ row }) => {
      const startDate = new Date(row.getValue('start_date'))
      const endDate = new Date(row.original.end_date)
      return (
        <div className="text-sm">
          <div>{startDate.toLocaleDateString()}</div>
          <div className="text-muted-foreground">{endDate.toLocaleDateString()}</div>
        </div>
      )
    },
    enableSorting: true,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const budget = row.original

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
              <Link href={`/finance/budgets/${budget.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/finance/budgets/${budget.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            {budget.status === 'draft' && (
              <DropdownMenuItem>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
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
