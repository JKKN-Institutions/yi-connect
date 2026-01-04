/**
 * Audit Log Filters Component
 *
 * Filter controls for the impersonation audit log viewer.
 * Supports date range and search by admin/target user.
 */

'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface AuditLogFiltersProps {
  defaultFilters?: {
    search?: string
    startDate?: string
    endDate?: string
  }
}

export function AuditLogFilters({ defaultFilters }: AuditLogFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(defaultFilters?.search || '')
  const [startDate, setStartDate] = useState<Date | undefined>(
    defaultFilters?.startDate ? new Date(defaultFilters.startDate) : undefined
  )
  const [endDate, setEndDate] = useState<Date | undefined>(
    defaultFilters?.endDate ? new Date(defaultFilters.endDate) : undefined
  )

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())

    if (search) {
      params.set('search', search)
    } else {
      params.delete('search')
    }

    if (startDate) {
      params.set('start_date', format(startDate, 'yyyy-MM-dd'))
    } else {
      params.delete('start_date')
    }

    if (endDate) {
      params.set('end_date', format(endDate, 'yyyy-MM-dd'))
    } else {
      params.delete('end_date')
    }

    // Reset to page 1 when filters change
    params.set('page', '1')

    router.push(`/admin/impersonation-audit?${params.toString()}`)
  }

  const clearFilters = () => {
    setSearch('')
    setStartDate(undefined)
    setEndDate(undefined)
    router.push('/admin/impersonation-audit')
  }

  const hasActiveFilters = search || startDate || endDate

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end">
      {/* Search Input */}
      <div className="flex-1 space-y-2">
        <label className="text-sm font-medium" htmlFor="search">
          Search by name or email
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search admin or target user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="pl-9"
          />
        </div>
      </div>

      {/* Date Range */}
      <div className="flex gap-2">
        {/* Start Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[180px] justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
                disabled={(date) =>
                  date > new Date() || (endDate ? date > endDate : false)
                }
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[180px] justify-start text-left font-normal',
                  !endDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
                disabled={(date) =>
                  date > new Date() || (startDate ? date < startDate : false)
                }
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={applyFilters}>Apply Filters</Button>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
