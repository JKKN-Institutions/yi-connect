/**
 * Industries Data Table Toolbar
 *
 * Toolbar with filters and actions for the industries data table
 */

'use client'

import { Table } from '@tanstack/react-table'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter'

interface IndustriesTableToolbarProps<TData> {
  table: Table<TData>
}

const industrySectorOptions = [
  { label: 'Manufacturing', value: 'manufacturing' },
  { label: 'IT & Software', value: 'it_software' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Education', value: 'education' },
  { label: 'Finance', value: 'finance' },
  { label: 'Retail', value: 'retail' },
  { label: 'Hospitality', value: 'hospitality' },
  { label: 'Automotive', value: 'automotive' },
  { label: 'Construction', value: 'construction' },
  { label: 'Agriculture', value: 'agriculture' },
  { label: 'Textiles', value: 'textiles' },
  { label: 'Pharmaceutical', value: 'pharma' },
  { label: 'Other', value: 'other' },
]

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

export function IndustriesTableToolbar<TData>({ table }: IndustriesTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search industries..."
          value={(table.getColumn('organization_name')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('organization_name')?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('industry_sector') && (
          <DataTableFacetedFilter
            column={table.getColumn('industry_sector')}
            title="Sector"
            options={industrySectorOptions}
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
