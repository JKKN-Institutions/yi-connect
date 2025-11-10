# Advanced Filtering and Actions

This reference contains patterns for implementing advanced filtering UI, bulk operations, and export functionality.

## Pattern 4: Advanced Filtering UI

Build a comprehensive filtering system with multiple filter types and visual feedback.

```tsx
// components/data-table/data-table-advanced-filter.tsx
'use client'

import * as React from 'react'
import { Plus, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { Slider } from '@/components/ui/slider'

interface DataTableAdvancedFilterProps<TData> {
  table: Table<TData>
  filterableColumns: DataTableFilterableColumn<TData>[]
}

export function DataTableAdvancedFilter<TData>({
  table,
  filterableColumns,
}: DataTableAdvancedFilterProps<TData>) {
  const [filters, setFilters] = React.useState<FilterItem[]>([])
  const [addFilterOpen, setAddFilterOpen] = React.useState(false)

  // Build filter UI based on variant
  const renderFilterInput = (filter: FilterItem) => {
    const column = filterableColumns.find(c => c.id === filter.columnId)
    if (!column) return null

    switch (column.filterVariant) {
      case 'text':
        return (
          <div className="flex items-center gap-2">
            <Select
              value={filter.operator}
              onValueChange={(value) => updateFilter(filter.id, { operator: value })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="starts">Starts with</SelectItem>
                <SelectItem value="ends">Ends with</SelectItem>
                <SelectItem value="empty">Is empty</SelectItem>
                <SelectItem value="notEmpty">Is not empty</SelectItem>
              </SelectContent>
            </Select>
            {!['empty', 'notEmpty'].includes(filter.operator) && (
              <Input
                placeholder="Enter value..."
                value={filter.value as string}
                onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                className="flex-1"
              />
            )}
          </div>
        )

      case 'select':
        return (
          <DataTableFacetedFilter
            column={table.getColumn(filter.columnId)}
            title={column.label}
            options={column.options || []}
            onFilterChange={(values) => updateFilter(filter.id, { value: values })}
          />
        )

      case 'dateRange':
        return (
          <DatePickerWithRange
            date={filter.value as DateRange}
            onDateChange={(date) => updateFilter(filter.id, { value: date })}
          />
        )

      case 'slider':
        return (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {column.min}
            </span>
            <Slider
              value={filter.value as number[]}
              onValueChange={(value) => updateFilter(filter.id, { value })}
              min={column.min}
              max={column.max}
              step={column.step}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">
              {column.max}
            </span>
            <Badge variant="secondary">
              {filter.value?.[0]} - {filter.value?.[1]}
            </Badge>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {/* Active filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const column = filterableColumns.find(c => c.id === filter.columnId)
          return (
            <Badge key={filter.id} variant="secondary" className="pr-1">
              <span className="mr-1">{column?.label}:</span>
              <span className="font-normal">{formatFilterValue(filter)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-4 w-4"
                onClick={() => removeFilter(filter.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )
        })}
      </div>

      {/* Add filter button */}
      <Popover open={addFilterOpen} onOpenChange={setAddFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Filter
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96">
          {/* Filter builder UI */}
          ...
        </PopoverContent>
      </Popover>
    </div>
  )
}
```

**Filter Types:**
- **Text filters**: Supports contains, equals, starts with, ends with, is empty, is not empty
- **Select filters**: Multi-select with predefined options
- **Date range filters**: Calendar-based range selection
- **Slider filters**: Numeric range with visual feedback

**Key Features:**
- Visual filter badges showing active filters
- Easy filter removal with X button
- Appropriate UI for each filter type
- Formatted filter values in badges
- Popover for adding new filters

## Pattern 5: Action Bar for Bulk Operations

Floating action bar that appears when rows are selected, enabling bulk operations.

```tsx
// components/data-table/data-table-action-bar.tsx
'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Trash2, Download, Archive, Tag, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DataTableActionBarProps<TData> {
  table: Table<TData>
  onDelete?: (rows: TData[]) => Promise<void>
  onExport?: (rows: TData[]) => void
  onArchive?: (rows: TData[]) => Promise<void>
  onTag?: (rows: TData[], tag: string) => Promise<void>
}

export function DataTableActionBar<TData>({
  table,
  onDelete,
  onExport,
  onArchive,
  onTag,
}: DataTableActionBarProps<TData>) {
  const [isDeleting, setIsDeleting] = React.useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length

  if (selectedCount === 0) return null

  const handleDelete = async () => {
    if (!onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(selectedRows.map(row => row.original))
      table.toggleAllRowsSelected(false)
      toast.success(`Deleted ${selectedCount} items`)
    } catch (error) {
      toast.error('Failed to delete items')
    } finally {
      setIsDeleting(false)
    }
  }

  const actionBar = (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-lg border bg-background p-2 shadow-lg">
            <div className="flex h-7 items-center rounded-md border px-3">
              <span className="text-xs font-medium">
                {selectedCount} selected
              </span>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => table.toggleAllRowsSelected(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            {onExport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onExport(selectedRows.map(r => r.original))}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}

            {onArchive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArchive(selectedRows.map(r => r.original))}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
            )}

            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onTag?.(selectedRows.map(r => r.original), 'important')}>
                  <Tag className="mr-2 h-4 w-4" />
                  Tag as Important
                </DropdownMenuItem>
                {/* More actions */}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // Portal to body
  return typeof document !== 'undefined'
    ? createPortal(actionBar, document.body)
    : null
}
```

**Key Features:**
- Floating bar that appears when rows are selected
- Smooth animations with Framer Motion
- Portal rendering for proper z-index layering
- Common bulk actions: Export, Archive, Delete
- More actions dropdown for additional operations
- Loading states during async operations
- Toast notifications for feedback
- Clear selection button

**Bulk Operation Best Practices:**
- Show loading state during operations
- Provide clear feedback with toasts
- Clear selection after successful operation
- Handle errors gracefully
- Confirm destructive actions
- Support keyboard shortcuts (Cmd+A for select all)

## Pattern 6: Export Functionality

Export table data to CSV, XLSX, or JSON with support for large datasets.

```typescript
// lib/table/export.ts
import { type Table } from '@tanstack/react-table'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

interface ExportOptions {
  filename?: string
  format?: 'csv' | 'xlsx' | 'json'
  excludeColumns?: string[]
  onlySelected?: boolean
  includeHeaders?: boolean
}

export function exportTableToCSV<TData>(
  table: Table<TData>,
  options: ExportOptions = {}
) {
  const {
    filename = 'export',
    format = 'csv',
    excludeColumns = [],
    onlySelected = false,
    includeHeaders = true,
  } = options

  // Get rows to export
  const rows = onlySelected
    ? table.getFilteredSelectedRowModel().rows
    : table.getFilteredRowModel().rows

  // Get columns to export
  const columns = table
    .getAllColumns()
    .filter(
      column =>
        column.getIsVisible() &&
        !excludeColumns.includes(column.id)
    )

  // Build export data
  const exportData = rows.map(row => {
    const rowData: Record<string, any> = {}
    columns.forEach(column => {
      const value = row.getValue(column.id)
      rowData[column.id] = formatExportValue(value)
    })
    return rowData
  })

  // Add headers if needed
  const headers = includeHeaders
    ? columns.map(col => col.columnDef.header || col.id)
    : undefined

  // Export based on format
  switch (format) {
    case 'csv':
      const csv = Papa.unparse(exportData, { header: includeHeaders })
      const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      saveAs(csvBlob, `${filename}.csv`)
      break

    case 'xlsx':
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Data')
      XLSX.writeFile(wb, `${filename}.xlsx`)
      break

    case 'json':
      const json = JSON.stringify(exportData, null, 2)
      const jsonBlob = new Blob([json], { type: 'application/json' })
      saveAs(jsonBlob, `${filename}.json`)
      break
  }
}

// Server-side export for large datasets
export async function exportLargeDataset(
  query: SupabaseQuery,
  format: 'csv' | 'xlsx',
  chunkSize = 1000
) {
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Stream data in chunks
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await query
      .range(offset, offset + chunkSize - 1)
      .csv() // Get as CSV for efficiency

    if (error) throw error

    if (data) {
      await writer.write(data)
      offset += chunkSize
      hasMore = data.length === chunkSize
    } else {
      hasMore = false
    }
  }

  await writer.close()
  return stream.readable
}
```

**Export Options:**
- **filename**: Custom filename (default: 'export')
- **format**: 'csv', 'xlsx', or 'json'
- **excludeColumns**: Array of column IDs to exclude (e.g., ['select', 'actions'])
- **onlySelected**: Export only selected rows (default: false)
- **includeHeaders**: Include header row (default: true)

**Client-Side Export:**
- Use for datasets < 10,000 rows
- Supports CSV, XLSX, and JSON formats
- Respects column visibility
- Formats values appropriately (dates, currency, etc.)

**Server-Side Export:**
- Use for datasets > 10,000 rows
- Streams data in chunks to avoid memory issues
- Returns readable stream for download
- More efficient for large datasets

**Implementation Example:**

```tsx
// In your table component
<Button
  variant="outline"
  size="sm"
  onClick={() => exportTableToCSV(table, {
    filename: 'inventory-export',
    format: 'xlsx',
    excludeColumns: ['select', 'actions'],
    onlySelected: true,
  })}
>
  <Download className="mr-2 h-4 w-4" />
  Export Selected
</Button>
```

**Value Formatting:**

```typescript
function formatExportValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
```

**Key Features:**
- Multiple format support (CSV, XLSX, JSON)
- Client-side and server-side strategies
- Column filtering and visibility respect
- Value formatting for different data types
- Selected rows or all rows export
- Streaming for large datasets
