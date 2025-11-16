/**
 * Industrial Visit Data Table - Column Definitions
 * Defines columns for the IV marketplace table
 */

'use client';

import { ColumnDef } from '@tanstack/react-table';
import { IVMarketplaceItem } from '@/types/industrial-visit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { format } from 'date-fns';
import { Building2, Calendar, Users, Car, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

export const ivColumns: ColumnDef<IVMarketplaceItem>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'title',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Industrial Visit" />
    ),
    cell: ({ row }) => {
      const iv = row.original;
      return (
        <div className="flex flex-col gap-1 max-w-[300px]">
          <Link
            href={`/industrial-visits/${iv.id}`}
            className="font-medium hover:underline line-clamp-1"
          >
            {iv.title}
          </Link>
          {iv.industry_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="line-clamp-1">{iv.industry_name}</span>
            </div>
          )}
          {iv.tags && iv.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {iv.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'start_date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date & Time" />
    ),
    cell: ({ row }) => {
      const startDate = new Date(row.original.start_date);
      const endDate = new Date(row.original.end_date);
      return (
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{format(startDate, 'MMM d, yyyy')}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
          </div>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'industry_sector',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Industry Sector" />
    ),
    cell: ({ row }) => {
      const sector = row.original.industry_sector;
      return sector ? (
        <Badge variant="secondary" className="text-xs">
          {sector}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      );
    },
    enableSorting: true,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'capacity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Capacity" />
    ),
    cell: ({ row }) => {
      const iv = row.original;
      const spotsRemaining = iv.max_capacity
        ? iv.max_capacity - iv.current_registrations
        : null;
      const percentage = iv.capacity_percentage;

      return (
        <div className="flex flex-col gap-1 min-w-[120px]">
          <div className="flex items-center gap-1 text-sm">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span>
              {iv.current_registrations}
              {iv.max_capacity ? ` / ${iv.max_capacity}` : ''}
            </span>
          </div>
          {iv.max_capacity && (
            <>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    percentage >= 100
                      ? 'bg-destructive'
                      : percentage >= 80
                      ? 'bg-orange-500'
                      : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {spotsRemaining !== null && spotsRemaining > 0 ? (
                  <span className="text-primary font-medium">
                    {spotsRemaining} spots left
                  </span>
                ) : (
                  <span className="text-destructive font-medium">Full</span>
                )}
              </div>
            </>
          )}
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const iv = row.original;
      const isFull = !iv.has_capacity;
      const isAlmostFull = iv.capacity_percentage >= 80;
      const hasWaitlist = iv.waitlist_count > 0;

      return (
        <div className="flex flex-col gap-1">
          <Badge
            variant={
              isFull
                ? 'destructive'
                : isAlmostFull
                ? 'secondary'
                : 'default'
            }
            className="w-fit"
          >
            {isFull ? 'Full' : isAlmostFull ? 'Almost Full' : 'Available'}
          </Badge>
          {hasWaitlist && (
            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <Clock className="h-3 w-3" />
              <span>{iv.waitlist_count} waitlisted</span>
            </div>
          )}
          {iv.carpool_drivers_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Car className="h-3 w-3" />
              <span>{iv.carpool_drivers_count} carpool{iv.carpool_drivers_count > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      );
    },
    enableSorting: false,
    filterFn: (row, id, value) => {
      const iv = row.original;
      if (value.includes('available')) return iv.has_capacity;
      if (value.includes('full')) return !iv.has_capacity;
      if (value.includes('waitlist')) return iv.waitlist_count > 0;
      if (value.includes('carpool')) return iv.carpool_drivers_count > 0;
      return true;
    },
  },
  {
    accessorKey: 'entry_method',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Entry Method" />
    ),
    cell: ({ row }) => {
      const method = row.original.entry_method;
      return (
        <Badge variant={method === 'self_service' ? 'default' : 'secondary'}>
          {method === 'self_service' ? 'Industry Hosted' : 'Chapter Organized'}
        </Badge>
      );
    },
    enableSorting: true,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const iv = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/industrial-visits/${iv.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {iv.has_capacity ? (
              <DropdownMenuItem asChild>
                <Link href={`/industrial-visits/${iv.id}/book`}>
                  Book Now
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link href={`/industrial-visits/${iv.id}/waitlist`}>
                  Join Waitlist
                </Link>
              </DropdownMenuItem>
            )}
            {iv.carpool_drivers_count > 0 && (
              <DropdownMenuItem asChild>
                <Link href={`/industrial-visits/${iv.id}/carpool`}>
                  View Carpool Options
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
