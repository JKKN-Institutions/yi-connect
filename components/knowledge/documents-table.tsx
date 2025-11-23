'use client';

import * as React from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { DocumentListItem } from '@/types/knowledge';
import {
  ArrowUpDown,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { deleteDocument } from '@/app/actions/knowledge';

const VISIBILITY_COLORS: Record<string, string> = {
  public: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  chapter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  ec_only:
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  chair_only: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

// Separate component for row actions to enable state for AlertDialog
function DocumentRowActions({ doc }: { doc: DocumentListItem }) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDeleting(true);
    try {
      const result = await deleteDocument(doc.id);
      if (result.success) {
        toast.success(result.message || 'Document deleted successfully');
        setShowDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || 'Failed to delete document');
        setIsDeleting(false);
      }
    } catch {
      toast.error('Failed to delete document');
      setIsDeleting(false);
    }
  };

  return (
    <>
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
            <Link href={`/knowledge/documents/${doc.id}`}>
              <Eye className='mr-2 h-4 w-4' />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/knowledge/documents/${doc.id}/edit`}>
              <Pencil className='mr-2 h-4 w-4' />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className='text-destructive focus:text-destructive'
          >
            <Trash2 className='mr-2 h-4 w-4' />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{doc.title}&quot;? This
              action cannot be undone. The file will be permanently removed from
              storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className='bg-destructive text-white hover:bg-destructive/90'
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const columns: ColumnDef<DocumentListItem>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
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
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Title
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      );
    },
    cell: ({ row }) => {
      const doc = row.original;
      return (
        <div className='flex flex-col gap-1'>
          <Link
            href={`/knowledge/documents/${doc.id}`}
            className='font-medium hover:underline line-clamp-1'
          >
            {doc.title}
          </Link>
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <FileText className='h-3 w-3' />
            {doc.file_name}
          </div>
        </div>
      );
    }
  },
  {
    accessorKey: 'category_name',
    header: 'Category',
    cell: ({ row }) => {
      const category = row.getValue('category_name') as string | null;
      return category ? (
        <Badge variant='outline'>{category}</Badge>
      ) : (
        <span className='text-muted-foreground text-sm'>—</span>
      );
    }
  },
  {
    accessorKey: 'visibility',
    header: 'Visibility',
    cell: ({ row }) => {
      const visibility = row.getValue('visibility') as string;
      return (
        <Badge className={VISIBILITY_COLORS[visibility]}>
          {visibility.replace('_', ' ')}
        </Badge>
      );
    }
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tags = row.getValue('tags') as string[] | null;
      if (!tags || tags.length === 0) {
        return <span className='text-muted-foreground text-sm'>—</span>;
      }
      return (
        <div className='flex flex-wrap gap-1'>
          {tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant='secondary' className='text-xs'>
              {tag}
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge variant='secondary' className='text-xs'>
              +{tags.length - 2}
            </Badge>
          )}
        </div>
      );
    }
  },
  {
    accessorKey: 'view_count',
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <Eye className='mr-2 h-4 w-4' />
          Views
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      );
    },
    cell: ({ row }) => {
      return <div className='text-center'>{row.getValue('view_count')}</div>;
    }
  },
  {
    accessorKey: 'download_count',
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          <Download className='mr-2 h-4 w-4' />
          Downloads
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className='text-center'>{row.getValue('download_count')}</div>
      );
    }
  },
  {
    accessorKey: 'file_size_kb',
    header: 'Size',
    cell: ({ row }) => {
      const sizeKb = row.getValue('file_size_kb') as number;
      return <div className='text-sm'>{sizeKb} KB</div>;
    }
  },
  {
    accessorKey: 'uploaded_by_name',
    header: 'Uploaded By',
    cell: ({ row }) => {
      return <div className='text-sm'>{row.getValue('uploaded_by_name')}</div>;
    }
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => {
      return (
        <Button
          variant='ghost'
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Created
          <ArrowUpDown className='ml-2 h-4 w-4' />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue('created_at'));
      return (
        <div className='text-sm'>
          {formatDistanceToNow(date, { addSuffix: true })}
        </div>
      );
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const doc = row.original;
      return <DocumentRowActions doc={doc} />;
    }
  }
];

interface DocumentsTableProps {
  data: DocumentListItem[];
}

export function DocumentsTable({ data }: DocumentsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'created_at', desc: true }
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection
    }
  });

  return (
    <div className='space-y-4'>
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
                  No documents found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between'>
        <div className='flex-1 text-sm text-muted-foreground'>
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className='flex items-center space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
