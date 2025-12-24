/**
 * Industry Attendees Table
 * Table showing all attendees for industry slots with export functionality
 */

'use client';

import { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Download, Mail, Phone, Users, Car, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CARPOOL_STATUS_LABELS } from '@/types/industrial-visit';

type AttendeeRecord = {
  id: string;
  member_name: string;
  member_email: string;
  member_phone: string | null;
  event_title?: string;
  event_date?: string;
  family_count: number;
  family_names: string[] | null;
  carpool_status: 'not_needed' | 'need_ride' | 'offering_ride';
  seats_available: number | null;
  dietary_restrictions: string | null;
  special_requirements: string | null;
  status: string;
  created_at: string;
};

interface IndustryAttendeesTableProps {
  slotId?: string;
  attendees: AttendeeRecord[];
  slots: Array<{ id: string; title: string; start_date: string }>;
}

export function IndustryAttendeesTable({ slotId, attendees, slots }: IndustryAttendeesTableProps) {
  const [selectedSlot, setSelectedSlot] = useState<string>(slotId || 'all');
  const [filteredAttendees, setFilteredAttendees] = useState<AttendeeRecord[]>(attendees);

  // Filter attendees when selection changes
  useEffect(() => {
    if (selectedSlot === 'all') {
      setFilteredAttendees(attendees);
    } else {
      // Filter would be done based on actual data structure
      setFilteredAttendees(attendees);
    }
  }, [selectedSlot, attendees]);

  const columns: ColumnDef<AttendeeRecord>[] = [
    {
      accessorKey: 'member_name',
      header: 'Participant',
      cell: ({ row }) => {
        const attendee = row.original;
        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium">{attendee.member_name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {attendee.member_email}
            </div>
            {attendee.member_phone && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {attendee.member_phone}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'event_title',
      header: 'Event',
      cell: ({ row }) => {
        const attendee = row.original;
        return (
          <div className="flex flex-col gap-1">
            <div className="font-medium">{attendee.event_title}</div>
            <div className="text-xs text-muted-foreground">
              {attendee.event_date && format(new Date(attendee.event_date), 'MMM d, yyyy')}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'family_count',
      header: 'Family',
      cell: ({ row }) => {
        const attendee = row.original;
        if (attendee.family_count === 0) {
          return <span className="text-muted-foreground text-sm">None</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-sm">
              <Users className="h-3 w-3" />
              <span>+{attendee.family_count}</span>
            </div>
            {attendee.family_names && attendee.family_names.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {attendee.family_names.join(', ')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'carpool_status',
      header: 'Carpool',
      cell: ({ row }) => {
        const attendee = row.original;
        return (
          <div className="flex flex-col gap-1">
            <Badge
              variant={
                attendee.carpool_status === 'offering_ride'
                  ? 'default'
                  : attendee.carpool_status === 'need_ride'
                  ? 'secondary'
                  : 'outline'
              }
              className="w-fit"
            >
              <Car className="mr-1 h-3 w-3" />
              {CARPOOL_STATUS_LABELS[attendee.carpool_status]}
            </Badge>
            {attendee.carpool_status === 'offering_ride' &&
              attendee.seats_available && (
                <span className="text-xs text-muted-foreground">
                  {attendee.seats_available} seats
                </span>
              )}
          </div>
        );
      },
    },
    {
      accessorKey: 'dietary_restrictions',
      header: 'Special Info',
      cell: ({ row }) => {
        const attendee = row.original;
        const hasDietary = attendee.dietary_restrictions;
        const hasSpecial = attendee.special_requirements;

        if (!hasDietary && !hasSpecial) {
          return <span className="text-muted-foreground text-sm">None</span>;
        }

        return (
          <div className="text-xs space-y-1 max-w-[200px]">
            {hasDietary && (
              <div>
                <span className="font-medium">Dietary:</span>{' '}
                <span className="text-muted-foreground line-clamp-1">
                  {attendee.dietary_restrictions}
                </span>
              </div>
            )}
            {hasSpecial && (
              <div>
                <span className="font-medium">Special:</span>{' '}
                <span className="text-muted-foreground line-clamp-1">
                  {attendee.special_requirements}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant={
              status === 'confirmed'
                ? 'default'
                : status === 'cancelled'
                ? 'destructive'
                : 'secondary'
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const attendee = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={`mailto:${attendee.member_email}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </a>
              </DropdownMenuItem>
              {attendee.member_phone && (
                <DropdownMenuItem asChild>
                  <a href={`tel:${attendee.member_phone}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const handleExport = async (format: 'csv' | 'xlsx' | 'json') => {
    if (selectedSlot === 'all') {
      toast.error('Please select a specific slot to export');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('event_id', selectedSlot);
      formData.append('format', format);
      formData.append('include_family', 'true');
      formData.append('include_carpool', 'true');

      // Import the action dynamically
      const { exportIVAttendees } = await import('@/app/actions/industrial-visits');
      const result = await exportIVAttendees(formData);

      if (result.success && result.data) {
        // Create and download file
        let blob: Blob;

        if (format === 'xlsx') {
          // XLSX is returned as base64, need to decode it
          const binaryStr = atob(result.data.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        } else {
          blob = new Blob([result.data.data], {
            type: format === 'json' ? 'application/json' : 'text/csv',
          });
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success(result.message || 'Export completed successfully');
      } else {
        toast.error(result.error || 'Export failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to export data');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Export */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Select value={selectedSlot} onValueChange={setSelectedSlot}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select slot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Slots</SelectItem>
              {slots.length === 0 && (
                <SelectItem value="none" disabled>
                  No slots found
                </SelectItem>
              )}
              {slots.map((slot) => (
                <SelectItem key={slot.id} value={slot.id}>
                  {slot.title} - {new Date(slot.start_date).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Export Format</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('xlsx')}>
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('json')}>
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredAttendees}
        filterFields={[
          {
            value: 'member_name',
            label: 'Participant',
            placeholder: 'Search participants...',
          },
        ]}
      />

      {filteredAttendees.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium mb-2">No attendees yet</p>
          <p className="text-sm">
            {selectedSlot === 'all'
              ? 'No one has registered for your slots yet'
              : 'No registrations for this slot yet'}
          </p>
        </div>
      )}
    </div>
  );
}
