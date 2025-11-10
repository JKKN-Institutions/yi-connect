/**
 * Chapters Data Table
 *
 * Advanced data table for chapters with server-side filtering, sorting, and pagination.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { deleteChapter } from '@/app/actions/chapters';
import type { ChapterListItem } from '@/types/chapter';

interface ChaptersTableProps {
  data: ChapterListItem[];
  pageCount: number;
}

export function ChaptersTable({ data, pageCount }: ChaptersTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  // Define columns
  const columns: ColumnDef<ChapterListItem>[] = [
    {
      id: 's.no',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='S.No' />
      ),
      cell: ({ row }) => {
        return <span className='text-center p-2'>{row.index + 1}</span>;
      },

      size: 40
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Chapter Name' />
      ),
      cell: ({ row }) => {
        return (
          <div className='flex flex-col'>
            <span className='font-medium'>{row.getValue('name')}</span>
          </div>
        );
      }
    },
    {
      accessorKey: 'location',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Location' />
      ),
      cell: ({ row }) => {
        return <span>{row.getValue('location')}</span>;
      }
    },
    {
      accessorKey: 'region',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Region' />
      ),
      cell: ({ row }) => {
        const region = row.getValue('region') as string | null;
        return region ? (
          <Badge variant='outline'>{region}</Badge>
        ) : (
          <span className='text-muted-foreground'>-</span>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      }
    },
    {
      accessorKey: 'established_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Established' />
      ),
      cell: ({ row }) => {
        const date = row.getValue('established_date') as string | null;
        return date ? (
          format(new Date(date), 'MMM dd, yyyy')
        ) : (
          <span className='text-muted-foreground'>-</span>
        );
      }
    },
    {
      accessorKey: 'member_count',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Members' />
      ),
      cell: ({ row }) => {
        const count = row.getValue('member_count') as number;
        return (
          <div className='flex items-center'>
            <Badge variant='secondary'>{count}</Badge>
          </div>
        );
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const chapter = row.original;

        const handleDelete = async () => {
          if (!confirm(`Are you sure you want to delete "${chapter.name}"?`)) {
            return;
          }

          const result = await deleteChapter(chapter.id);
          if (result.success) {
            toast.success(result.message);
            router.refresh();
          } else {
            toast.error(result.message);
          }
        };

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
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/admin/chapters/${chapter.id}/edit`}>
                  <Pencil className='mr-2 h-4 w-4' />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className='text-destructive focus:text-destructive'
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Delete
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
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true
  });

  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      <div className='flex items-center justify-between'>
        <div className='flex flex-1 items-center space-x-2'>
          <Input
            placeholder='Search chapters...'
            value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('name')?.setFilterValue(event.target.value)
            }
            className='h-8 w-[150px] lg:w-[250px]'
          />
        </div>
        <Button asChild size='sm'>
          <Link href='/admin/chapters/new'>
            <Plus className='mr-2 h-4 w-4' />
            Add Chapter
          </Link>
        </Button>
      </div>

      {/* Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
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
                  No chapters found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination table={table} />
    </div>
  );
}
