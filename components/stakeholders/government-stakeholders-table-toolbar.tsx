/**
 * Government Stakeholders Data Table Toolbar
 *
 * Toolbar with filters and actions for the government stakeholders data table
 */

'use client'

import { Table } from '@tanstack/react-table'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter'

interface GovernmentStakeholdersTableToolbarProps<TData> {
  table: Table<TData>
}

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Prospective', value: 'prospective' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Dormant', value: 'dormant' },
]

const healthTierOptions = [
  { label: 'Healthy', value: 'healthy' },
  { label: 'Needs Attention', value: 'needs_attention' },
  { label: 'At Risk', value: 'at_risk' },
]

const mouStatusOptions = [
  { label: 'No MoU', value: 'none' },
  { label: 'In Discussion', value: 'in_discussion' },
  { label: 'Draft', value: 'draft' },
  { label: 'Signed', value: 'signed' },
  { label: 'Expired', value: 'expired' },
]

const typeOptions = [
  { label: 'Elected', value: 'elected' },
  { label: 'Appointed', value: 'appointed' },
]

export function GovernmentStakeholdersTableToolbar<TData>({ table }: GovernmentStakeholdersTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search officials..."
          value={(table.getColumn('official_name')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('official_name')?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('is_elected') && (
          <DataTableFacetedFilter
            column={table.getColumn('is_elected')}
            title="Type"
            options={typeOptions}
          />
        )}
        {table.getColumn('status') && (
          <DataTableFacetedFilter
            column={table.getColumn('status')}
            title="Status"
            options={statusOptions}
          />
        )}
        {table.getColumn('health_tier') && (
          <DataTableFacetedFilter
            column={table.getColumn('health_tier')}
            title="Health"
            options={healthTierOptions}
          />
        )}
        {table.getColumn('mou_status') && (
          <DataTableFacetedFilter
            column={table.getColumn('mou_status')}
            title="MoU"
            options={mouStatusOptions}
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
