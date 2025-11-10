/**
 * Table Utilities
 *
 * Helper functions for data tables.
 */

import type { Table } from '@tanstack/react-table'

/**
 * Get common pinning styles for a column
 */
export function getCommonPinningStyles<TData>(
  column: any,
  withBorder = true
): React.CSSProperties {
  const isPinned = column.getIsPinned()
  const isLastLeftPinnedColumn =
    isPinned === 'left' && column.getIsLastColumn('left')
  const isFirstRightPinnedColumn =
    isPinned === 'right' && column.getIsFirstColumn('right')

  return {
    boxShadow: withBorder
      ? isLastLeftPinnedColumn
        ? '-4px 0 4px -4px hsl(var(--border)) inset'
        : isFirstRightPinnedColumn
          ? '4px 0 4px -4px hsl(var(--border)) inset'
          : undefined
      : undefined,
    left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? 'sticky' : 'relative',
    background: isPinned ? 'hsl(var(--background))' : 'hsl(var(--background))',
    width: column.getSize(),
    zIndex: isPinned ? 1 : 0,
  }
}

/**
 * Export table data to CSV
 */
export function exportTableToCSV<TData>(
  table: Table<TData>,
  opts: {
    filename?: string
    excludeColumns?: string[]
    onlySelected?: boolean
  } = {}
): void {
  const { filename = 'table', excludeColumns = [], onlySelected = false } = opts

  // Get headers
  const headers = table
    .getAllLeafColumns()
    .filter((column) => !excludeColumns.includes(column.id) && column.getIsVisible())
    .map((column) => column.id)

  // Get rows
  const rows = onlySelected
    ? table.getFilteredSelectedRowModel().rows
    : table.getFilteredRowModel().rows

  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const cellValue = row.getValue(header)
          // Handle values that might contain commas or quotes
          const stringValue = cellValue?.toString() || ''
          return stringValue.includes(',') || stringValue.includes('"')
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue
        })
        .join(',')
    ),
  ].join('\n')

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export table data to JSON
 */
export function exportTableToJSON<TData>(
  table: Table<TData>,
  opts: {
    filename?: string
    excludeColumns?: string[]
    onlySelected?: boolean
  } = {}
): void {
  const { filename = 'table', excludeColumns = [], onlySelected = false } = opts

  // Get visible columns
  const columns = table
    .getAllLeafColumns()
    .filter((column) => !excludeColumns.includes(column.id) && column.getIsVisible())
    .map((column) => column.id)

  // Get rows
  const rows = onlySelected
    ? table.getFilteredSelectedRowModel().rows
    : table.getFilteredRowModel().rows

  // Build JSON array
  const data = rows.map((row) => {
    const obj: Record<string, any> = {}
    columns.forEach((column) => {
      obj[column] = row.getValue(column)
    })
    return obj
  })

  // Create and download file
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8;',
  })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.json`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Format number with commas
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/**
 * Format date to locale string
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', options).format(new Date(date))
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}
