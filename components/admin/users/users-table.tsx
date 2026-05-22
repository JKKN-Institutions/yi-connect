/**
 * Users Table Component
 *
 * Advanced data table for user management with server-side operations,
 * advanced filtering, bulk actions, and export functionality.
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import { Download, Shield, UserCog, Building2, X, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { DataTablePagination } from '@/components/data-table/data-table-pagination'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import { getUsersTableColumns } from './users-table-columns'
import { BulkActionsBar } from './bulk-actions-bar'
import { exportUsers } from '@/app/actions/users'
import type { UserListItem } from '@/types/user'
import type { Role } from '@/types/user'

interface UsersTableProps {
  data: UserListItem[]
  pageCount: number
  roles: Role[]
  chapters: Array<{ id: string; name: string; location: string }>
}

export function UsersTable({ data, pageCount, roles, chapters }: UsersTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [isRefreshing, startRefresh] = useTransition()

  // Handle refresh
  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh()
    })
  }

  const table = useReactTable({
    data,
    columns: getUsersTableColumns(roles),
    pageCount,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true
  })

  const selectedUsers = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original)

  const handleExport = async (format: 'csv' | 'xlsx' | 'json') => {
    const toastId = toast.loading(`Exporting to ${format.toUpperCase()}...`)

    try {
      // Get current filters from table state
      const filters: any = {}
      const nameFilter = table.getColumn('full_name')?.getFilterValue()
      const roleFilter = table.getColumn('roles')?.getFilterValue()
      const chapterFilter = table.getColumn('chapter')?.getFilterValue()
      const statusFilter = table.getColumn('is_active')?.getFilterValue()

      if (nameFilter) filters.search = nameFilter as string
      if (roleFilter) filters.role_id = roleFilter as string
      if (chapterFilter) filters.chapter_id = chapterFilter as string
      if (statusFilter) filters.is_active = statusFilter === 'true'

      const result = await exportUsers(format, filters)

      if (!result.success || !result.data) {
        toast.error(result.message || 'Failed to export data', { id: toastId })
        return
      }

      // Create blob and download
      const blob = new Blob([result.data], {
        type: format === 'json'
          ? 'application/json'
          : format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename || `export.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success(result.message || `Exported users to ${format.toUpperCase()}`, { id: toastId })
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export data', { id: toastId })
    }
  }

  // Get unique values for filters
  const roleOptions = Array.from(
    new Set(data.flatMap((user) => user.role_names))
  ).map((name) => ({ label: name, value: name }))

  const chapterOptions = chapters.map((chapter) => ({
    label: chapter.name,
    value: chapter.id
  }))

  const statusOptions = [
    { label: 'Active', value: 'true' },
    { label: 'Inactive', value: 'false' }
  ]

  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div className='flex flex-1 flex-col gap-4 md:flex-row md:items-center'>
          {/* Search */}
          <Input
            placeholder='Search users by name or email...'
            value={(table.getColumn('full_name')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('full_name')?.setFilterValue(event.target.value)
            }
            className='h-9 w-full md:w-[300px]'
          />

          {/* Role Filter */}
          <Select
            value={(table.getColumn('roles')?.getFilterValue() as string) ?? 'all'}
            onValueChange={(value) =>
              table.getColumn('roles')?.setFilterValue(value === 'all' ? '' : value)
            }
          >
            <SelectTrigger className='h-9 w-full md:w-[180px]'>
              <SelectValue placeholder='Filter by role' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Roles</SelectItem>
              {roleOptions.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Chapter Filter */}
          <Select
            value={(table.getColumn('chapter')?.getFilterValue() as string) ?? 'all'}
            onValueChange={(value) =>
              table.getColumn('chapter')?.setFilterValue(value === 'all' ? '' : value)
            }
          >
            <SelectTrigger className='h-9 w-full md:w-[180px]'>
              <SelectValue placeholder='Filter by chapter' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Chapters</SelectItem>
              {chapterOptions.map((chapter) => (
                <SelectItem key={chapter.value} value={chapter.value}>
                  {chapter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={
              (table.getColumn('is_active')?.getFilterValue() as string) ?? 'all'
            }
            onValueChange={(value) =>
              table.getColumn('is_active')?.setFilterValue(value === 'all' ? '' : value)
            }
          >
            <SelectTrigger className='h-9 w-full md:w-[140px]'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {(table.getState().columnFilters.length > 0 ||
            table.getState().globalFilter) && (
            <Button
              variant='ghost'
              onClick={() => {
                table.resetColumnFilters()
                table.resetGlobalFilter()
              }}
              className='h-9 px-2 lg:px-3'
            >
              Clear
              <X className='ml-2 h-4 w-4' />
            </Button>
          )}
        </div>

        <div className='flex items-center gap-2'>
          {/* Refresh Button */}
          <Button
            variant='outline'
            size='sm'
            className='h-9'
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='sm' className='h-9'>
                <Download className='mr-2 h-4 w-4' />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem onClick={() => handleExport('csv')}>
                CSV
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem onClick={() => handleExport('xlsx')}>
                Excel (XLSX)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem onClick={() => handleExport('json')}>
                JSON
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column Visibility */}
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Bulk Actions Bar (shows when rows are selected) */}
      {selectedUsers.length > 0 && (
        <BulkActionsBar
          selectedUsers={selectedUsers}
          roles={roles}
          chapters={chapters}
          onClearSelection={() => table.resetRowSelection()}
          onSuccess={() => {
            table.resetRowSelection()
            router.refresh()
          }}
        />
      )}

      {/* Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
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
                <TableCell colSpan={table.getAllColumns().length} className='h-24 text-center'>
                  No users found.
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
