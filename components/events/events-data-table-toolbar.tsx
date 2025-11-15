'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Table } from '@tanstack/react-table';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  ExportDialog,
  type ExportFormat,
  type ExportScope
} from '@/components/ui/export-dialog';
import { exportToCSV, exportToExcel, exportToJSON, formatDateTimeForExport } from '@/lib/utils/export';
import { EVENT_CATEGORIES, EVENT_STATUSES } from '@/types/event';
import type { EventListItem } from '@/types/event';
import toast from 'react-hot-toast';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  allData?: EventListItem[];
  totalCount: number;
}

export function DataTableToolbar<TData>({
  table,
  allData = [],
  totalCount
}: DataTableToolbarProps<TData>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const category = searchParams.get('category') || '';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1'); // Reset to first page
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push('/events/table');
  };

  const handleExport = async (format: ExportFormat, scope: ExportScope) => {
    try {
      // Get data to export
      let dataToExport: EventListItem[];

      if (scope === 'selected') {
        const selectedRows = table.getFilteredSelectedRowModel().rows;
        dataToExport = selectedRows.map(row => row.original as EventListItem);
      } else {
        // Fetch all filtered data from API
        toast.loading('Fetching data for export...');
        const params = new URLSearchParams(searchParams.toString());
        params.delete('page');
        params.delete('pageSize');
        params.delete('sort');
        params.delete('order');

        const response = await fetch(`/api/events/export?${params.toString()}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          toast.dismiss();
          toast.error('Failed to fetch data for export');
          return;
        }

        dataToExport = result.data;
        toast.dismiss();
      }

      if (dataToExport.length === 0) {
        toast.error('No data to export');
        return;
      }

      // Define columns for export
      const columns = [
        { key: 'title' as const, label: 'Event Name' },
        { key: 'category' as const, label: 'Category' },
        { key: 'status' as const, label: 'Status' },
        { key: 'start_date' as const, label: 'Start Date' },
        { key: 'end_date' as const, label: 'End Date' },
        { key: 'is_virtual' as const, label: 'Virtual' },
        { key: 'venue_id' as const, label: 'Venue' },
        { key: 'venue_address' as const, label: 'Address' },
        { key: 'max_capacity' as const, label: 'Max Capacity' },
        { key: 'current_registrations' as const, label: 'Current RSVPs' }
      ];

      // Transform data for export
      const transformedData = dataToExport.map(event => ({
        title: event.title,
        category: event.category || '',
        status: event.status,
        start_date: formatDateTimeForExport(event.start_date),
        end_date: formatDateTimeForExport(event.end_date),
        is_virtual: event.is_virtual ? 'Yes' : 'No',
        venue_id: event.venue?.name || (event.is_virtual ? 'Virtual' : 'TBD'),
        venue_address: event.venue_address || '',
        max_capacity: event.max_capacity || 'Unlimited',
        current_registrations: event.current_registrations
      }));

      const filename = `events-export-${new Date().toISOString().split('T')[0]}`;

      // Export based on format
      switch (format) {
        case 'csv':
          exportToCSV(transformedData, filename, columns);
          break;
        case 'xlsx':
          exportToExcel(transformedData, filename, 'Events', columns);
          break;
        case 'json':
          exportToJSON(transformedData, filename, columns);
          break;
      }

      toast.success(`Exported ${dataToExport.length} events to ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const hasFilters = search || status || category;
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  return (
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex flex-1 flex-col gap-2 sm:flex-row sm:items-center'>
        {/* Search */}
        <Input
          placeholder='Search events...'
          value={search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className='h-10 w-full sm:w-64'
        />

        {/* Status Filter */}
        <Select value={status} onValueChange={(value) => updateFilter('status', value)}>
          <SelectTrigger className='h-10 w-full sm:w-40'>
            <SelectValue placeholder='Status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Statuses</SelectItem>
            {Object.entries(EVENT_STATUSES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select value={category} onValueChange={(value) => updateFilter('category', value)}>
          <SelectTrigger className='h-10 w-full sm:w-40'>
            <SelectValue placeholder='Category' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Categories</SelectItem>
            {Object.entries(EVENT_CATEGORIES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasFilters && (
          <Button
            variant='ghost'
            onClick={clearFilters}
            className='h-10 px-2 lg:px-3'
          >
            Reset
            <X className='ml-2 h-4 w-4' />
          </Button>
        )}
      </div>

      {/* Export Dialog */}
      <ExportDialog
        onExport={handleExport}
        selectedCount={selectedCount}
        totalCount={totalCount}
      />
    </div>
  );
}
