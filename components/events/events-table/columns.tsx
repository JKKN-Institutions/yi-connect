'use client';

/**
 * Events Table Column Definitions
 *
 * Column configuration for the advanced events data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import {
  MoreHorizontal,
  Calendar,
  MapPin,
  Users,
  Video,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import type { EventListItem } from '@/types/event';
import {
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  getEventStatusVariant
} from '@/types/event';
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
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

export const columns: ColumnDef<EventListItem>[] = [
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
        className='translate-y-[2px]'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: 'title',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Event Title' />
    ),
    cell: ({ row }) => {
      const event = row.original;
      return (
        <div className='flex items-start gap-3 max-w-md'>
          {event.banner_image_url && (
            <img
              src={event.banner_image_url}
              alt={event.title}
              className='w-12 h-12 rounded object-cover shrink-0'
            />
          )}
          <div className='min-w-0 flex-1'>
            <Link
              href={`/events/${event.id}`}
              className='font-medium hover:underline line-clamp-2'
            >
              {event.title}
            </Link>
            {event.description && (
              <p className='text-sm text-muted-foreground line-clamp-1 mt-1'>
                {event.description}
              </p>
            )}
          </div>
        </div>
      );
    },
    enableSorting: true,
    enableHiding: false
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as keyof typeof EVENT_STATUSES;
      const variant = getEventStatusVariant(status);
      return <Badge variant={variant as any}>{EVENT_STATUSES[status]}</Badge>;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
    enableSorting: true
  },
  {
    accessorKey: 'category',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Category' />
    ),
    cell: ({ row }) => {
      const category = row.getValue(
        'category'
      ) as keyof typeof EVENT_CATEGORIES;
      return <Badge variant='outline'>{EVENT_CATEGORIES[category]}</Badge>;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
    enableSorting: true
  },
  {
    accessorKey: 'start_date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Date' />
    ),
    cell: ({ row }) => {
      const startDate = new Date(row.getValue('start_date'));
      const endDate = new Date(row.original.end_date);
      const isMultiDay =
        format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');

      return (
        <div className='flex items-start gap-2'>
          <Calendar className='h-4 w-4 text-muted-foreground shrink-0 mt-0.5' />
          <div className='text-sm'>
            <div className='font-medium'>
              {format(startDate, 'MMM d, yyyy')}
            </div>
            <div className='text-muted-foreground'>
              {format(startDate, 'h:mm a')}
              {isMultiDay && <> - {format(endDate, 'MMM d')}</>}
            </div>
          </div>
        </div>
      );
    },
    enableSorting: true
  },
  {
    accessorKey: 'is_virtual',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Location' />
    ),
    cell: ({ row }) => {
      const isVirtual = row.getValue('is_virtual');
      const venue = row.original.venue;
      const venueAddress = row.original.venue_address;

      return (
        <div className='flex items-start gap-2 max-w-[200px]'>
          {isVirtual ? (
            <>
              <Video className='h-4 w-4 text-muted-foreground shrink-0 mt-0.5' />
              <span className='text-sm'>Virtual</span>
            </>
          ) : (
            <>
              <MapPin className='h-4 w-4 text-muted-foreground shrink-0 mt-0.5' />
              <div className='text-sm min-w-0'>
                {venue ? (
                  <>
                    <div className='font-medium truncate'>{venue.name}</div>
                    {venue.city && (
                      <div className='text-muted-foreground'>{venue.city}</div>
                    )}
                  </>
                ) : venueAddress ? (
                  <div className='text-muted-foreground line-clamp-2'>
                    {venueAddress}
                  </div>
                ) : (
                  <div className='text-muted-foreground'>TBD</div>
                )}
              </div>
            </>
          )}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      if (value === 'all') return true;
      return value === 'virtual' ? row.getValue(id) : !row.getValue(id);
    }
  },
  {
    accessorKey: 'current_registrations',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Registrations' />
    ),
    cell: ({ row }) => {
      const current = row.getValue('current_registrations') as number;
      const max = row.original.max_capacity;

      if (!max) {
        return (
          <div className='flex items-center gap-2'>
            <Users className='h-4 w-4 text-muted-foreground' />
            <span className='font-medium'>{current}</span>
          </div>
        );
      }

      const percentage = (current / max) * 100;
      const isFull = current >= max;

      return (
        <div className='space-y-1 min-w-[120px]'>
          <div className='flex items-center justify-between text-sm'>
            <span
              className={
                isFull ? 'text-destructive font-medium' : 'font-medium'
              }
            >
              {current} / {max}
            </span>
            <span className='text-muted-foreground'>
              {Math.round(percentage)}%
            </span>
          </div>
          <Progress value={percentage} className='h-1' />
        </div>
      );
    },
    enableSorting: true
  },
  {
    accessorKey: 'organizer',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Organizer' />
    ),
    cell: ({ row }) => {
      const organizer = row.original.organizer;

      if (!organizer?.profile) return <span className='text-muted-foreground'>—</span>;

      return (
        <div className='flex items-center gap-2'>
          <Avatar className='h-6 w-6'>
            <AvatarImage src={organizer.profile.avatar_url || undefined} />
            <AvatarFallback className='text-xs'>
              {organizer.profile.full_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className='text-sm truncate max-w-[120px]'>
            {organizer.profile.full_name}
          </span>
        </div>
      );
    },
    enableSorting: false
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Created' />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('created_at'));
      return (
        <div className='text-sm text-muted-foreground'>
          {format(date, 'MMM d, yyyy')}
        </div>
      );
    },
    enableSorting: true
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
                View Details
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
                // TODO: Implement delete action
                console.log('Delete event:', event.id);
              }}
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
