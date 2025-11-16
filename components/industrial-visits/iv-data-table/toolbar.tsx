/**
 * Industrial Visit Data Table - Toolbar
 * Filter and search controls for IV listing
 */

'use client';

import { Table } from '@tanstack/react-table';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter';
import { IVMarketplaceItem } from '@/types/industrial-visit';

interface IVDataTableToolbarProps {
  table: Table<IVMarketplaceItem>;
  industrySectors?: string[];
}

export function IVDataTableToolbar({
  table,
  industrySectors = [],
}: IVDataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  // Convert industry sectors to options for faceted filter
  const industrySectorOptions = industrySectors.map((sector) => ({
    label: sector,
    value: sector,
  }));

  const statusOptions = [
    { label: 'Available', value: 'available' },
    { label: 'Full', value: 'full' },
    { label: 'Has Waitlist', value: 'waitlist' },
    { label: 'Carpool Available', value: 'carpool' },
  ];

  const entryMethodOptions = [
    { label: 'Industry Hosted', value: 'self_service' },
    { label: 'Chapter Organized', value: 'manual' },
  ];

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search industrial visits..."
          value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('title')?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('industry_sector') && industrySectorOptions.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn('industry_sector')}
            title="Industry Sector"
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
        {table.getColumn('entry_method') && (
          <DataTableFacetedFilter
            column={table.getColumn('entry_method')}
            title="Entry Method"
            options={entryMethodOptions}
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
  );
}
