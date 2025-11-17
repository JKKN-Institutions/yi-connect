/**
 * Speakers Data Table Toolbar
 */

'use client'

import { Table } from '@tanstack/react-table'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter'

interface SpeakersTableToolbarProps<TData> {
  table: Table<TData>
}

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Prospective', value: 'prospective' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Dormant', value: 'dormant' },
]

const availabilityOptions = [
  { label: 'Available', value: 'available' },
  { label: 'Limited', value: 'limited' },
  { label: 'Unavailable', value: 'unavailable' },
]

const feeOptions = [
  { label: 'Paid', value: 'true' },
  { label: 'Pro Bono', value: 'false' },
]

const healthTierOptions = [
  { label: 'Healthy', value: 'healthy' },
  { label: 'Needs Attention', value: 'needs_attention' },
  { label: 'At Risk', value: 'at_risk' },
]

export function SpeakersTableToolbar<TData>({ table }: SpeakersTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search speakers..."
          value={(table.getColumn('speaker_name')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('speaker_name')?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('status') && (
          <DataTableFacetedFilter
            column={table.getColumn('status')}
            title="Status"
            options={statusOptions}
          />
        )}
        {table.getColumn('availability_status') && (
          <DataTableFacetedFilter
            column={table.getColumn('availability_status')}
            title="Availability"
            options={availabilityOptions}
          />
        )}
        {table.getColumn('charges_fee') && (
          <DataTableFacetedFilter
            column={table.getColumn('charges_fee')}
            title="Fee Type"
            options={feeOptions}
          />
        )}
        {table.getColumn('health_tier') && (
          <DataTableFacetedFilter
            column={table.getColumn('health_tier')}
            title="Health"
            options={healthTierOptions}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
