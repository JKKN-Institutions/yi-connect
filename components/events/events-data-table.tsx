'use client';

/**
 * Events Data Table Component
 *
 * Advanced data table with server-side operations.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable
} from '@tanstack/react-table';
import { format } from 'date-fns';
import {
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  Edit,
  Trash,
  Calendar,
  MapPin,
  Users,
  Download
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { EventsTablePagination } from './events-table-pagination';
import { DataTableToolbar } from './events-data-table-toolbar';
import type { EventListItem } from '@/types/event';
import Link from 'next/link';

interface EventsDataTableProps {
  data: EventListItem[];
  pageCount: number;
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export function EventsDataTable({
  data,
  pageCount,
  totalCount,
  currentPage,
  pageSize
}: EventsDataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateSort = (field: string, direction: 'asc' | 'desc') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', field);
    params.set('order', direction);
    params.set('page', '1'); // Reset to first page
    router.push(`?${params.toString()}`);
  };

  // Table columns
  const columns: ColumnDef<EventListItem>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      ),
      enableSorting: false,
      enableHiding: false
    },
    {
      accessorKey: 'title',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => {
              const isSorted = column.getIsSorted();
              updateSort('title', isSorted === 'asc' ? 'desc' : 'asc');
            }}
          >
            Event Name
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const event = row.original;
        return (
          <div className='flex flex-col'>
            <Link
              href={`/events/${event.id}`}
              className='font-medium hover:underline'
            >
              {event.title}
            </Link>
            {event.category && (
              <Badge variant='outline' className='mt-1 w-fit text-xs'>
                {event.category}
              </Badge>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'start_date',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => {
              const isSorted = column.getIsSorted();
              updateSort('start_date', isSorted === 'asc' ? 'desc' : 'asc');
            }}
          >
            <Calendar className='mr-2 h-4 w-4' />
            Date & Time
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const event = row.original;
        return (
          <div className='flex flex-col text-sm'>
            <span className='font-medium'>
              {format(new Date(event.start_date), 'MMM dd, yyyy')}
            </span>
            <span className='text-muted-foreground'>
              {format(new Date(event.start_date), 'h:mm a')}
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: 'venue',
      header: () => (
        <div className='flex items-center'>
          <MapPin className='mr-2 h-4 w-4' />
          Venue
        </div>
      ),
      cell: ({ row }) => {
        const event = row.original;
        return (
          <div className='text-sm'>
            {event.venue?.name || (
              <span className='text-muted-foreground'>
                {event.is_virtual ? 'Virtual' : 'TBD'}
              </span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'current_registrations',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            onClick={() => {
              const isSorted = column.getIsSorted();
              updateSort(
                'current_registrations',
                isSorted === 'asc' ? 'desc' : 'asc'
              );
            }}
          >
            <Users className='mr-2 h-4 w-4' />
            RSVPs
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        );
      },
      cell: ({ row }) => {
        const event = row.original;
        const percentage = event.max_capacity
          ? Math.round(
              (event.current_registrations / event.max_capacity) * 100
            )
          : 0;

        return (
          <div className='flex flex-col text-sm'>
            <span className='font-medium'>
              {event.current_registrations}
              {event.max_capacity && ` / ${event.max_capacity}`}
            </span>
            {event.max_capacity && (
              <span className='text-xs text-muted-foreground'>
                {percentage}% full
              </span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const variants: Record<string, any> = {
          draft: 'secondary',
          published: 'default',
          ongoing: 'default',
          completed: 'outline',
          cancelled: 'destructive'
        };

        return (
          <Badge variant={variants[status] || 'default'}>
            {status}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'organizer',
      header: 'Organizer',
      cell: ({ row }) => {
        const event = row.original;
        return (
          <div className='text-sm'>
            {event.organizer?.profile?.full_name || 'Unknown'}
          </div>
        );
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const event = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='h-8 w-8 p-0'>
                <span className='sr-only'>Open menu</span>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/events/${event.id}`}>
                  <Eye className='mr-2 h-4 w-4' />
                  View Event
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/events/${event.id}/edit`}>
                  <Edit className='mr-2 h-4 w-4' />
                  Edit Event
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-destructive'
                onClick={() => {
                  // Handle delete
                  console.log('Delete event:', event.id);
                }}
              >
                <Trash className='mr-2 h-4 w-4' />
                Delete Event
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    }
  ];

  const table = useReactTable({
    data,
    columns,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true
  });

  return (
    <div className='space-y-4'>
      <DataTableToolbar table={table} allData={data} totalCount={totalCount} />

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No events found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <EventsTablePagination
        currentPage={currentPage}
        totalPages={pageCount}
        totalCount={totalCount}
        pageSize={pageSize}
        selectedRowsCount={table.getFilteredSelectedRowModel().rows.length}
      />
    </div>
  );
}
