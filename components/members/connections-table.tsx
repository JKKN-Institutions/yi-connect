'use client';

/**
 * ConnectionsTable — TanStack Table view of my connections with CSV / XLSX
 * export. Paired alternative to the card view in /connections.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Linkedin,
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '@/lib/utils/export';
import type { ConnectionWithMember } from '@/types/connection';
import toast from 'react-hot-toast';

interface Props {
  connections: ConnectionWithMember[];
}

export function ConnectionsTable({ connections }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'created_at', desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<ConnectionWithMember>[]>(
    () => [
      {
        id: 'full_name',
        accessorFn: (row) => row.to_member.full_name,
        header: ({ column }) => (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className='h-8 -ml-2'
          >
            Name
            <ArrowUpDown className='ml-1 h-3 w-3' />
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/members/${row.original.to_member.id}`}
            className='font-medium hover:underline'
          >
            {row.original.to_member.full_name}
          </Link>
        ),
      },
      {
        id: 'designation',
        accessorFn: (row) =>
          [row.to_member.designation, row.to_member.company]
            .filter(Boolean)
            .join(' at '),
        header: 'Role / Company',
      },
      {
        id: 'chapter',
        accessorFn: (row) => row.to_member.chapter_name ?? '—',
        header: 'Chapter',
      },
      {
        id: 'event',
        accessorFn: (row) => row.event?.title ?? '—',
        header: 'Connected at',
      },
      {
        id: 'mutual',
        accessorFn: (row) => (row.is_mutual ? 'Yes' : 'No'),
        header: 'Mutual',
        cell: ({ row }) =>
          row.original.is_mutual ? (
            <Badge variant='secondary'>Mutual</Badge>
          ) : (
            <span className='text-xs text-muted-foreground'>—</span>
          ),
      },
      {
        id: 'note',
        accessorFn: (row) => row.note ?? '',
        header: 'Note',
        cell: ({ row }) => (
          <span className='line-clamp-2 text-xs text-muted-foreground'>
            {row.original.note ?? '—'}
          </span>
        ),
      },
      {
        id: 'created_at',
        accessorFn: (row) => row.created_at,
        header: ({ column }) => (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className='h-8 -ml-2'
          >
            Added
            <ArrowUpDown className='ml-1 h-3 w-3' />
          </Button>
        ),
        cell: ({ row }) =>
          new Date(row.original.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className='flex items-center justify-end gap-1'>
            {row.original.to_member.linkedin_url && (
              <a
                href={row.original.to_member.linkedin_url}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Open LinkedIn'
                className='text-muted-foreground hover:text-primary'
              >
                <Linkedin className='h-4 w-4' />
              </a>
            )}
            <Link
              href={`/members/${row.original.to_member.id}`}
              aria-label='Open profile'
              className='text-muted-foreground hover:text-primary'
            >
              <ExternalLink className='h-4 w-4' />
            </Link>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: connections,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const rowsToExport = () => {
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    return rows.map((c) => ({
      name: c.to_member.full_name,
      designation: c.to_member.designation ?? '',
      company: c.to_member.company ?? '',
      chapter: c.to_member.chapter_name ?? '',
      linkedin: c.to_member.linkedin_url ?? '',
      event: c.event?.title ?? '',
      mutual: c.is_mutual ? 'Yes' : 'No',
      note: c.note ?? '',
      added_on: new Date(c.created_at).toISOString().split('T')[0],
    }));
  };

  const handleCsv = () => {
    const data = rowsToExport();
    if (data.length === 0) return toast.error('Nothing to export');
    try {
      exportToCSV(
        data,
        `yi-connections-${new Date().toISOString().split('T')[0]}`,
        [
          { key: 'name', label: 'Name' },
          { key: 'designation', label: 'Designation' },
          { key: 'company', label: 'Company' },
          { key: 'chapter', label: 'Chapter' },
          { key: 'linkedin', label: 'LinkedIn' },
          { key: 'event', label: 'Event' },
          { key: 'mutual', label: 'Mutual' },
          { key: 'note', label: 'Note' },
          { key: 'added_on', label: 'Added on' },
        ]
      );
      toast.success(`Exported ${data.length} rows`);
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  const handleXlsx = () => {
    const data = rowsToExport();
    if (data.length === 0) return toast.error('Nothing to export');
    try {
      exportToExcel(
        data,
        `yi-connections-${new Date().toISOString().split('T')[0]}`,
        'Connections',
        [
          { key: 'name', label: 'Name' },
          { key: 'designation', label: 'Designation' },
          { key: 'company', label: 'Company' },
          { key: 'chapter', label: 'Chapter' },
          { key: 'linkedin', label: 'LinkedIn' },
          { key: 'event', label: 'Event' },
          { key: 'mutual', label: 'Mutual' },
          { key: 'note', label: 'Note' },
          { key: 'added_on', label: 'Added on' },
        ]
      );
      toast.success(`Exported ${data.length} rows`);
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Input
          placeholder='Search name, company, event…'
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className='max-w-sm'
        />
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={handleCsv}>
            <Download className='mr-2 h-4 w-4' />
            CSV
          </Button>
          <Button variant='outline' size='sm' onClick={handleXlsx}>
            <Download className='mr-2 h-4 w-4' />
            Excel
          </Button>
        </div>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='py-10 text-center text-sm text-muted-foreground'
                >
                  No connections yet. Scan a member&apos;s QR at your next event.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className='flex items-center justify-between'>
          <p className='text-xs text-muted-foreground'>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}{' '}
            · {table.getFilteredRowModel().rows.length} connections
          </p>
          <div className='flex gap-1'>
            <Button
              size='sm'
              variant='outline'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
