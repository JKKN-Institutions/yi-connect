/**
 * Data Table Toolbar
 *
 * Search, filters, and view options for data tables.
 */

'use client'

import { Cross2Icon } from '@radix-ui/react-icons'
import { Table } from '@tanstack/react-table'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from './data-table-view-options'
import { DataTableFacetedFilter } from './data-table-faceted-filter'
import type { DataTableFilterField } from '@/lib/table/types'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  filterFields?: DataTableFilterField<TData>[]
}

export function DataTableToolbar<TData>({
  table,
  filterFields = [],
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  // Find the primary search field (first field without options)
  const searchField = filterFields.find((field) => !field.options)

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {searchField && (
          <Input
            placeholder={searchField.placeholder}
            value={
              (table
                .getColumn(String(searchField.value))
                ?.getFilterValue() as string) ?? ''
            }
            onChange={(event) =>
              table
                .getColumn(String(searchField.value))
                ?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        )}
        {filterFields
          .filter((field) => field.options)
          .map((field) => {
            const column = table.getColumn(String(field.value))
            if (!column) return null

            return (
              <DataTableFacetedFilter
                key={String(field.value)}
                column={column}
                title={field.label}
                options={field.options!}
              />
            )
          })}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
