'use client'

import { Table } from '@tanstack/react-table'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options'
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter'
import type { SponsorshipDealListItem } from '@/types/finance'

interface DataTableToolbarProps {
  table: Table<SponsorshipDealListItem>
}

const dealStageOptions = [
  { label: 'Prospect', value: 'prospect' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Proposal Sent', value: 'proposal_sent' },
  { label: 'Negotiation', value: 'negotiation' },
  { label: 'Committed', value: 'committed' },
  { label: 'Contract Signed', value: 'contract_signed' },
  { label: 'Payment Received', value: 'payment_received' },
  { label: 'Lost', value: 'lost' },
]

export function DataTableToolbar({ table }: DataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search deals..."
          value={(table.getColumn('deal_name')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('deal_name')?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('deal_stage') && (
          <DataTableFacetedFilter
            column={table.getColumn('deal_stage')}
            title="Stage"
            options={dealStageOptions}
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
