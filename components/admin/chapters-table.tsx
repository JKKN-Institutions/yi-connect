/**
 * Chapters Data Table
 *
 * Server-driven data table for chapters. Filtering, sorting, and pagination
 * are reflected in the URL as searchParams, so the server refetches on change.
 */

'use client';

import { useTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from '@tanstack/react-table';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
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
import { deleteChapter } from '@/app/actions/chapters';
import type { ChapterListItem } from '@/types/chapter';

interface ChaptersTableProps {
  data: ChapterListItem[];
  pageCount: number;
  page: number;
  pageSize: number;
  total: number;
  search: string;
  sortField: string | null;
  sortDirection: 'asc' | 'desc' | null;
}

const SORTABLE_FIELDS = new Set([
  'name',
  'location',
  'region',
  'established_date'
]);

export function ChaptersTable({
  data,
  pageCount,
  page,
  pageSize,
  total,
  search,
  sortField,
  sortDirection
}: ChaptersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);

  // Sync local search input when the URL changes (e.g. after browser back)
  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  const updateParams = (mutator: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (sortField) params.set('sort_field', sortField);
    if (sortDirection) params.set('sort_direction', sortDirection);
    if (page > 1) params.set('page', String(page));
    if (pageSize !== 10) params.set('pageSize', String(pageSize));

    mutator(params);

    startTransition(() => {
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    updateParams((p) => {
      if (value) p.set('search', value);
      else p.delete('search');
      p.delete('page');
    });
  };

  const handleSort = (field: string) => {
    if (!SORTABLE_FIELDS.has(field)) return;

    let nextDirection: 'asc' | 'desc' | null = 'asc';
    if (sortField === field) {
      if (sortDirection === 'asc') nextDirection = 'desc';
      else if (sortDirection === 'desc') nextDirection = null;
    }

    updateParams((p) => {
      if (nextDirection) {
        p.set('sort_field', field);
        p.set('sort_direction', nextDirection);
      } else {
        p.delete('sort_field');
        p.delete('sort_direction');
      }
      p.delete('page');
    });
  };

  const goToPage = (targetPage: number) => {
    const clamped = Math.max(1, Math.min(pageCount, targetPage));
    updateParams((p) => {
      if (clamped <= 1) p.delete('page');
      else p.set('page', String(clamped));
    });
  };

  const SortHeader = ({ field, title }: { field: string; title: string }) => {
    const isActive = sortField === field;
    return (
      <Button
        variant='ghost'
        size='sm'
        className='-ml-3 h-8 data-[state=open]:bg-accent'
        onClick={() => handleSort(field)}
      >
        <span>{title}</span>
        {isActive && sortDirection === 'desc' ? (
          <ArrowDown className='ml-2 h-4 w-4' />
        ) : isActive && sortDirection === 'asc' ? (
          <ArrowUp className='ml-2 h-4 w-4' />
        ) : (
          <ChevronsUpDown className='ml-2 h-4 w-4' />
        )}
      </Button>
    );
  };

  const columns: ColumnDef<ChapterListItem>[] = [
    {
      id: 's.no',
      header: () => <span className='font-medium'>S.No</span>,
      cell: ({ row }) => (
        <span className='text-center p-2'>
          {(page - 1) * pageSize + row.index + 1}
        </span>
      ),
      size: 40
    },
    {
      accessorKey: 'name',
      header: () => <SortHeader field='name' title='Chapter Name' />,
      cell: ({ row }) => (
        <div className='flex flex-col'>
          <span className='font-medium'>{row.getValue('name')}</span>
        </div>
      )
    },
    {
      accessorKey: 'location',
      header: () => <SortHeader field='location' title='Location' />,
      cell: ({ row }) => <span>{row.getValue('location')}</span>
    },
    {
      accessorKey: 'region',
      header: () => <SortHeader field='region' title='Region' />,
      cell: ({ row }) => {
        const region = row.getValue('region') as string | null;
        return region ? (
          <Badge variant='outline'>{region}</Badge>
        ) : (
          <span className='text-muted-foreground'>-</span>
        );
      }
    },
    {
      accessorKey: 'established_date',
      header: () => <SortHeader field='established_date' title='Established' />,
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
      header: () => <span className='font-medium'>Members</span>,
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
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel()
  });

  const canPreviousPage = page > 1;
  const canNextPage = page < pageCount;

  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      <div className='flex items-center justify-between'>
        <div className='flex flex-1 items-center space-x-2'>
          <Input
            placeholder='Search chapters...'
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
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
                <TableRow key={row.id}>
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
      <div className='flex items-center justify-between px-2'>
        <div className='flex-1 text-sm text-muted-foreground'>
          {total} chapter{total === 1 ? '' : 's'} total
        </div>
        <div className='flex items-center space-x-6 lg:space-x-8'>
          <div className='flex w-[120px] items-center justify-center text-sm font-medium'>
            Page {page} of {pageCount}
          </div>
          <div className='flex items-center space-x-2'>
            <Button
              variant='outline'
              className='hidden h-8 w-8 p-0 lg:flex'
              onClick={() => goToPage(1)}
              disabled={!canPreviousPage || isPending}
            >
              <span className='sr-only'>Go to first page</span>
              <ChevronsLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              className='h-8 w-8 p-0'
              onClick={() => goToPage(page - 1)}
              disabled={!canPreviousPage || isPending}
            >
              <span className='sr-only'>Previous page</span>
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              className='h-8 w-8 p-0'
              onClick={() => goToPage(page + 1)}
              disabled={!canNextPage || isPending}
            >
              <span className='sr-only'>Next page</span>
              <ChevronRight className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              className='hidden h-8 w-8 p-0 lg:flex'
              onClick={() => goToPage(pageCount)}
              disabled={!canNextPage || isPending}
            >
              <span className='sr-only'>Go to last page</span>
              <ChevronsRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
