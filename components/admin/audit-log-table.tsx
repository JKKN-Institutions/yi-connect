/**
 * Audit Log Table Component
 *
 * Advanced data table for viewing impersonation audit logs with
 * expandable rows to show action details.
 */

'use client'

import { useState, useTransition, Fragment } from 'react'
import { useRouter } from 'next/navigation'
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
  getExpandedRowModel,
  useReactTable,
  Row,
} from '@tanstack/react-table'
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  User,
  Clock,
  Activity,
  Calendar,
  CheckCircle,
  XCircle,
  Timer,
  AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  ImpersonationAuditSession,
  ImpersonationActionLog,
} from '@/types/impersonation'

interface AuditLogTableProps {
  data: ImpersonationAuditSession[]
  pageCount: number
}

// Action log component for expanded rows
function ActionLogDetails({
  sessionId,
  actions,
  isLoading,
}: {
  sessionId: string
  actions: ImpersonationActionLog[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="px-6 py-4 bg-muted/30">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (actions.length === 0) {
    return (
      <div className="px-6 py-4 bg-muted/30">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span>No actions recorded during this session</span>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-4 bg-muted/30">
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Action Log ({actions.length} actions)</h4>
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Time</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[150px]">Table</TableHead>
                <TableHead className="w-[200px]">Record ID</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((action) => (
                <TableRow key={action.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(action.executed_at), 'HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        action.action_type === 'create'
                          ? 'default'
                          : action.action_type === 'update'
                          ? 'secondary'
                          : action.action_type === 'delete'
                          ? 'destructive'
                          : 'outline'
                      }
                      className="text-xs"
                    >
                      {action.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {action.table_name}
                  </TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-[200px]">
                    {action.record_id || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {action.payload_summary
                      ? JSON.stringify(action.payload_summary).substring(0, 100)
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

// Column definitions
const columns: ColumnDef<ImpersonationAuditSession>[] = [
  {
    id: 'expander',
    header: () => null,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => row.toggleExpanded()}
        aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
      >
        {row.getIsExpanded() ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'admin_name',
    header: 'Admin',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="font-medium">{row.original.admin_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.admin_email}</div>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'target_user_name',
    header: 'Target User',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.target_user_name}</div>
        <div className="text-xs text-muted-foreground">{row.original.target_user_email}</div>
      </div>
    ),
  },
  {
    accessorKey: 'target_user_role',
    header: 'Role',
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.target_user_role || 'Member'}</Badge>
    ),
  },
  {
    accessorKey: 'started_at',
    header: 'Started',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="text-sm">
            {format(new Date(row.original.started_at), 'MMM d, yyyy')}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(row.original.started_at), 'HH:mm')}
          </div>
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'duration_minutes',
    header: 'Duration',
    cell: ({ row }) => {
      const duration = row.original.duration_minutes
      const endReason = row.original.end_reason

      if (!row.original.ended_at) {
        return (
          <div className="flex items-center gap-1 text-orange-600">
            <Timer className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Active</span>
          </div>
        )
      }

      const formatDuration = (mins: number | null) => {
        if (mins === null) return '-'
        if (mins < 60) return `${mins}m`
        const hours = Math.floor(mins / 60)
        const minutes = mins % 60
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
      }

      return (
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{formatDuration(duration)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'action_count',
    header: 'Actions',
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <span
          className={`text-sm font-medium ${
            row.original.action_count > 0 ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          {row.original.action_count}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'end_reason',
    header: 'Status',
    cell: ({ row }) => {
      const endReason = row.original.end_reason
      const endedAt = row.original.ended_at

      if (!endedAt) {
        return (
          <Badge variant="default" className="bg-orange-500">
            <Timer className="mr-1 h-3 w-3" />
            Active
          </Badge>
        )
      }

      switch (endReason) {
        case 'manual':
          return (
            <Badge variant="secondary">
              <CheckCircle className="mr-1 h-3 w-3" />
              Manual
            </Badge>
          )
        case 'timeout':
          return (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
              <AlertCircle className="mr-1 h-3 w-3" />
              Timeout
            </Badge>
          )
        case 'new_session':
          return (
            <Badge variant="outline">
              <RefreshCw className="mr-1 h-3 w-3" />
              New Session
            </Badge>
          )
        case 'logout':
          return (
            <Badge variant="destructive">
              <XCircle className="mr-1 h-3 w-3" />
              Logout
            </Badge>
          )
        default:
          return <Badge variant="outline">Ended</Badge>
      }
    },
  },
]

export function AuditLogTable({ data, pageCount }: AuditLogTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [expanded, setExpanded] = useState({})
  const [isRefreshing, startRefresh] = useTransition()

  // Action logs cache
  const [actionLogs, setActionLogs] = useState<Record<string, ImpersonationActionLog[]>>({})
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({})

  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh()
    })
  }

  // Load action logs when a row is expanded
  const loadActionLogs = async (sessionId: string) => {
    if (actionLogs[sessionId] || loadingActions[sessionId]) return

    setLoadingActions((prev) => ({ ...prev, [sessionId]: true }))

    try {
      const response = await fetch(`/api/admin/impersonation/actions/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setActionLogs((prev) => ({ ...prev, [sessionId]: data.actions || [] }))
      }
    } catch (error) {
      console.error('Failed to load action logs:', error)
    } finally {
      setLoadingActions((prev) => ({ ...prev, [sessionId]: false }))
    }
  }

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      expanded,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
        <DataTableViewOptions table={table} />
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
                <Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsExpanded() ? 'expanded' : undefined}
                    className={row.getIsExpanded() ? 'border-b-0' : ''}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="p-0">
                        <ActionLogDetails
                          sessionId={row.original.id}
                          actions={actionLogs[row.original.id] || []}
                          isLoading={
                            loadingActions[row.original.id] && !actionLogs[row.original.id]
                          }
                        />
                        {/* Trigger load when expanded */}
                        {!actionLogs[row.original.id] &&
                          !loadingActions[row.original.id] &&
                          (() => {
                            loadActionLogs(row.original.id)
                            return null
                          })()}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Activity className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No impersonation sessions found.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination table={table} />
    </div>
  )
}
