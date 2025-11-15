'use client'

/**
 * Events Table Toolbar
 *
 * Search, filters, and actions for the events data table.
 */

import { Table } from '@tanstack/react-table'
import { X, Plus, Download, Filter } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter'
import { EVENT_CATEGORIES, EVENT_STATUSES } from '@/types/event'
import type { EventListItem } from '@/types/event'

interface EventsTableToolbarProps {
  table: Table<EventListItem>
  onExport?: () => void
}

export function EventsTableToolbar({ table, onExport }: EventsTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0
  const selectedRows = table.getFilteredSelectedRowModel().rows

  // Convert EVENT_STATUSES to options array
  const statusOptions = Object.entries(EVENT_STATUSES).map(([value, label]) => ({
    label,
    value,
    icon: undefined,
  }))

  // Convert EVENT_CATEGORIES to options array
  const categoryOptions = Object.entries(EVENT_CATEGORIES).map(([value, label]) => ({
    label,
    value,
    icon: undefined,
  }))

  const locationOptions = [
    { label: 'All Locations', value: 'all' },
    { label: 'Virtual', value: 'virtual' },
    { label: 'In-Person', value: 'in-person' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Top Row: Search and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Search events..."
            value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('title')?.setFilterValue(event.target.value)
            }
            className="h-9 w-[250px] lg:w-[300px]"
          />

          {/* Status Filter */}
          {table.getColumn('status') && (
            <DataTableFacetedFilter
              column={table.getColumn('status')}
              title="Status"
              options={statusOptions}
            />
          )}

          {/* Category Filter */}
          {table.getColumn('category') && (
            <DataTableFacetedFilter
              column={table.getColumn('category')}
              title="Category"
              options={categoryOptions}
            />
          )}

          {/* Location Filter */}
          {table.getColumn('is_virtual') && (
            <DataTableFacetedFilter
              column={table.getColumn('is_virtual')}
              title="Location"
              options={locationOptions}
            />
          )}

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => table.resetColumnFilters()}
              className="h-9 px-2 lg:px-3"
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedRows.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedRows.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // TODO: Implement bulk export
                  console.log('Export selected:', selectedRows.length)
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Selected
              </Button>
            </div>
          )}

          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
            >
              <Download className="mr-2 h-4 w-4" />
              Export All
            </Button>
          )}

          <DataTableViewOptions table={table} />

          <Button size="sm" asChild>
            <Link href="/events/new">
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Summary */}
      {isFiltered && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>
            {table.getFilteredRowModel().rows.length} of {table.getCoreRowModel().rows.length} event(s) shown
          </span>
        </div>
      )}
    </div>
  )
}
