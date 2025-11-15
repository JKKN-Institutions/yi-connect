/**
 * Data Table Toolbar
 *
 * Search, filters, and view options for data tables.
 */

'use client'

import { Cross2Icon } from '@radix-ui/react-icons'
import { Table } from '@tanstack/react-table'
import toast from 'react-hot-toast'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from './data-table-view-options'
import { DataTableFacetedFilter } from './data-table-faceted-filter'
import { ExportDialog, type ExportFormat, type ExportScope } from '@/components/ui/export-dialog'
import { exportToCSV, exportToExcel, exportToJSON } from '@/lib/utils/export'
import type { DataTableFilterField } from '@/lib/table/types'

export interface ExportConfig<TData> {
  filename: string
  sheetName?: string
  columns?: { key: keyof TData; label: string }[]
  transformRow?: (row: TData) => Record<string, any>
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  filterFields?: DataTableFilterField<TData>[]
  exportConfig?: ExportConfig<TData>
}

export function DataTableToolbar<TData>({
  table,
  filterFields = [],
  exportConfig,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  // Find the primary search field (first field without options)
  const searchField = filterFields.find((field) => !field.options)

  const handleExport = (format: ExportFormat, scope: ExportScope) => {
    if (!exportConfig) return

    try {
      // Get data to export
      const dataToExport = scope === 'selected'
        ? table.getFilteredSelectedRowModel().rows.map(row => row.original)
        : table.getFilteredRowModel().rows.map(row => row.original)

      if (dataToExport.length === 0) {
        toast.error('No data to export')
        return
      }

      // Transform data if transformer provided, otherwise use as is
      const transformedData = exportConfig.transformRow
        ? dataToExport.map(exportConfig.transformRow)
        : (dataToExport as unknown as Record<string, any>[])

      const filename = `${exportConfig.filename}-${new Date().toISOString().split('T')[0]}`

      // Export based on format
      switch (format) {
        case 'csv':
          exportToCSV(transformedData as Record<string, any>[], filename, exportConfig.columns as any)
          break
        case 'xlsx':
          exportToExcel(transformedData as Record<string, any>[], filename, exportConfig.sheetName || 'Data', exportConfig.columns as any)
          break
        case 'json':
          exportToJSON(transformedData as Record<string, any>[], filename, exportConfig.columns as any)
          break
      }

      toast.success(`Exported ${dataToExport.length} rows to ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export data')
    }
  }

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
      <div className="flex items-center gap-2">
        {exportConfig && (
          <ExportDialog
            onExport={handleExport}
            selectedCount={table.getFilteredSelectedRowModel().rows.length}
            totalCount={table.getFilteredRowModel().rows.length}
          />
        )}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}
