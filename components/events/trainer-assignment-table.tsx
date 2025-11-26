'use client'

/**
 * Trainer Assignment Table Component
 *
 * TanStack Table for trainer selection and management.
 * Supports sorting, selection, and bulk actions.
 */

import { useState, useMemo } from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  MoreHorizontal,
  Star,
  Calendar,
  MapPin,
  Trophy,
  Users,
  Send,
  UserCheck,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { TrainerRecommendation } from '@/types/event'

interface TrainerAssignmentTableProps {
  trainers: TrainerRecommendation[]
  selectedTrainers: string[]
  onSelectionChange: (selected: string[]) => void
  trainersNeeded: number
  onInviteSelected?: (trainerIds: string[]) => void
  isLoading?: boolean
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-blue-600 dark:text-blue-400'
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function ScoreBreakdownTooltip({ trainer }: { trainer: TrainerRecommendation }) {
  return (
    <div className="space-y-2 p-2 min-w-[200px]">
      <div className="font-medium border-b pb-2">Score Breakdown</div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> Location
          </span>
          <span>{trainer.score_breakdown.location_score}/30</span>
        </div>
        <div className="flex justify-between">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" /> Distribution
          </span>
          <span>{trainer.score_breakdown.distribution_score}/30</span>
        </div>
        <div className="flex justify-between">
          <span className="flex items-center gap-1.5">
            <Star className="h-3 w-3" /> Performance
          </span>
          <span>{trainer.score_breakdown.performance_score}/25</span>
        </div>
        <div className="flex justify-between">
          <span className="flex items-center gap-1.5">
            <Trophy className="h-3 w-3" /> Engagement
          </span>
          <span>{trainer.score_breakdown.engagement_score}/15</span>
        </div>
      </div>
    </div>
  )
}

export function TrainerAssignmentTable({
  trainers,
  selectedTrainers,
  onSelectionChange,
  trainersNeeded,
  onInviteSelected,
  isLoading = false,
}: TrainerAssignmentTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'match_score', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>(() => {
    // Initialize from selectedTrainers
    const initial: Record<string, boolean> = {}
    selectedTrainers.forEach((id) => {
      initial[id] = true
    })
    return initial
  })

  const columns: ColumnDef<TrainerRecommendation>[] = useMemo(
    () => [
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
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            disabled={!row.original.is_available}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'full_name',
        header: 'Trainer',
        cell: ({ row }) => {
          const trainer = row.original
          const initials = trainer.full_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={trainer.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{trainer.full_name}</div>
                <div className="text-xs text-muted-foreground">{trainer.email}</div>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'match_score',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Match Score
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const score = row.original.match_score
          const trainer = row.original

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <span className={cn('text-lg font-bold', getScoreColor(score))}>
                      {score}
                    </span>
                    <Progress value={score} className="w-16 h-2" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <ScoreBreakdownTooltip trainer={trainer} />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
      },
      {
        accessorKey: 'trainer_stats.average_rating',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Rating
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const rating = row.original.trainer_stats.average_rating

          return rating !== null ? (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{rating.toFixed(1)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">N/A</span>
          )
        },
      },
      {
        accessorKey: 'trainer_stats.total_sessions',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Sessions
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const stats = row.original.trainer_stats

          return (
            <div className="flex flex-col">
              <span>{stats.total_sessions} total</span>
              <span className="text-xs text-muted-foreground">
                {stats.sessions_this_month} this month
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'trainer_stats.days_since_last_session',
        header: 'Last Session',
        cell: ({ row }) => {
          const days = row.original.trainer_stats.days_since_last_session

          if (days === null) {
            return <span className="text-muted-foreground">Never</span>
          }

          return (
            <span className={cn(days < 7 && 'text-yellow-600')}>
              {days === 0 ? 'Today' : `${days}d ago`}
            </span>
          )
        },
      },
      {
        accessorKey: 'certifications_count',
        header: 'Certifications',
        cell: ({ row }) => {
          const count = row.original.certifications_count
          const types = row.original.eligible_session_types

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span>{count}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <div className="font-medium">Certified for:</div>
                    {types.length > 0 ? (
                      <ul className="text-sm">
                        {types.map((type) => (
                          <li key={type}>{type}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No certifications
                      </span>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
      },
      {
        accessorKey: 'is_available',
        header: 'Status',
        cell: ({ row }) => {
          const available = row.original.is_available

          return available ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Available
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              Unavailable
            </Badge>
          )
        },
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => {
          const trainer = row.original

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(trainer.email)}
                >
                  Copy email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>View profile</DropdownMenuItem>
                <DropdownMenuItem>View session history</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: trainers,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater
      setRowSelection(newSelection)

      // Convert row selection to trainer IDs
      const selectedIds = Object.entries(newSelection)
        .filter(([_, selected]) => selected)
        .map(([id]) => {
          const trainer = trainers.find((t) => t.trainer_profile_id === id)
          return trainer?.trainer_profile_id
        })
        .filter(Boolean) as string[]

      onSelectionChange(selectedIds)
    },
    getRowId: (row) => row.trainer_profile_id,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  const selectedCount = Object.values(rowSelection).filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter trainers..."
            value={(table.getColumn('full_name')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('full_name')?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Selection Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {selectedCount} of {trainersNeeded} selected
            </span>
            {selectedCount < trainersNeeded && (
              <Badge variant="outline" className="text-yellow-600">
                Need {trainersNeeded - selectedCount} more
              </Badge>
            )}
            {selectedCount > trainersNeeded && (
              <Badge variant="outline" className="text-yellow-600">
                {selectedCount - trainersNeeded} extra
              </Badge>
            )}
            {selectedCount === trainersNeeded && (
              <Badge variant="outline" className="text-green-600">
                <Check className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedCount > 0 && onInviteSelected && (
            <Button
              size="sm"
              onClick={() => {
                const selected = Object.entries(rowSelection)
                  .filter(([_, selected]) => selected)
                  .map(([id]) => id)
                onInviteSelected(selected)
              }}
              disabled={isLoading}
            >
              <Send className="h-4 w-4 mr-2" />
              Send Invites ({selectedCount})
            </Button>
          )}

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id.replace(/_/g, ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(!row.original.is_available && 'opacity-60')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No trainers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

export default TrainerAssignmentTable
