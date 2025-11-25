/**
 * Bulk Upload Preview Component
 *
 * Displays parsed Excel data with validation errors and warnings.
 */

'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ParseResult, ParsedMemberRow } from '@/lib/utils/excel-parser'

interface BulkUploadPreviewProps {
  parseResult: ParseResult
  onRowSelect?: (rowNumbers: number[]) => void
  selectedRows?: number[]
}

const DISPLAY_COLUMNS = [
  { key: 'email', label: 'Email', width: 'min-w-[200px]' },
  { key: 'full_name', label: 'Full Name', width: 'min-w-[150px]' },
  { key: 'phone', label: 'Phone', width: 'min-w-[130px]' },
  { key: 'company', label: 'Company', width: 'min-w-[150px]' },
  { key: 'designation', label: 'Designation', width: 'min-w-[130px]' },
  { key: 'city', label: 'City', width: 'min-w-[100px]' },
  { key: 'state', label: 'State', width: 'min-w-[100px]' }
]

type FilterType = 'all' | 'valid' | 'errors' | 'warnings'

export function BulkUploadPreview({
  parseResult,
  onRowSelect,
  selectedRows = []
}: BulkUploadPreviewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Filter and search data
  const filteredData = useMemo(() => {
    let data = parseResult.data

    // Apply filter
    if (filterType === 'valid') {
      data = data.filter(row => row.isValid && row.warnings.length === 0)
    } else if (filterType === 'errors') {
      data = data.filter(row => !row.isValid)
    } else if (filterType === 'warnings') {
      data = data.filter(row => row.warnings.length > 0)
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      data = data.filter(
        row =>
          row.data.email?.toLowerCase().includes(query) ||
          row.data.full_name?.toLowerCase().includes(query) ||
          row.data.company?.toLowerCase().includes(query)
      )
    }

    return data
  }, [parseResult.data, filterType, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize)
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  // Stats
  const stats = useMemo(() => {
    const valid = parseResult.data.filter(r => r.isValid && r.warnings.length === 0).length
    const withWarnings = parseResult.data.filter(r => r.isValid && r.warnings.length > 0).length
    const invalid = parseResult.data.filter(r => !r.isValid).length

    return { valid, withWarnings, invalid }
  }, [parseResult.data])

  const getRowStatus = (row: ParsedMemberRow) => {
    if (!row.isValid) return 'error'
    if (row.warnings.length > 0) return 'warning'
    return 'valid'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{parseResult.totalRows}</div>
            <p className="text-xs text-muted-foreground">Total Rows</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
            <p className="text-xs text-muted-foreground">Valid</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.withWarnings}</div>
            <p className="text-xs text-muted-foreground">With Warnings</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive">{stats.invalid}</div>
            <p className="text-xs text-muted-foreground">Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Unmapped Headers Warning */}
      {parseResult.unmappedHeaders.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Unrecognized Columns
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  The following columns were not recognized and will be ignored:{' '}
                  <span className="font-mono">
                    {parseResult.unmappedHeaders.join(', ')}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or company..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={filterType}
          onValueChange={(value: FilterType) => {
            setFilterType(value)
            setCurrentPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rows ({parseResult.totalRows})</SelectItem>
            <SelectItem value="valid">Valid Only ({stats.valid})</SelectItem>
            <SelectItem value="warnings">With Warnings ({stats.withWarnings})</SelectItem>
            <SelectItem value="errors">Errors Only ({stats.invalid})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <Card>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] sticky left-0 bg-background">Row</TableHead>
                <TableHead className="w-[60px]">Status</TableHead>
                {DISPLAY_COLUMNS.map((col) => (
                  <TableHead key={col.key} className={col.width}>
                    {col.label}
                  </TableHead>
                ))}
                <TableHead className="min-w-[300px]">Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={DISPLAY_COLUMNS.length + 3} className="text-center py-8">
                    <p className="text-muted-foreground">No rows match your filter</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row) => {
                  const status = getRowStatus(row)
                  return (
                    <TableRow
                      key={row.rowNumber}
                      className={cn(
                        status === 'error' && 'bg-destructive/5',
                        status === 'warning' && 'bg-yellow-50 dark:bg-yellow-900/10'
                      )}
                    >
                      <TableCell className="font-mono text-xs sticky left-0 bg-inherit">
                        {row.rowNumber}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              {getStatusIcon(status)}
                            </TooltipTrigger>
                            <TooltipContent>
                              {status === 'valid' && 'Ready to import'}
                              {status === 'warning' && 'Has warnings but can be imported'}
                              {status === 'error' && 'Has errors - will not be imported'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      {DISPLAY_COLUMNS.map((col) => (
                        <TableCell key={col.key} className="max-w-[200px] truncate">
                          {row.data[col.key] || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.errors.map((error, idx) => (
                            <Badge key={`e-${idx}`} variant="destructive" className="text-xs">
                              {error}
                            </Badge>
                          ))}
                          {row.warnings.map((warning, idx) => (
                            <Badge
                              key={`w-${idx}`}
                              variant="outline"
                              className="text-xs border-yellow-500 text-yellow-700 dark:text-yellow-300"
                            >
                              {warning}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredData.length)} of{' '}
              {filteredData.length} rows
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
