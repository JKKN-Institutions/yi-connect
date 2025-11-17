/**
 * Speakers Table Column Definitions
 */

'use client'

import { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { Mic2, DollarSign, CalendarCheck } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { StakeholderStatusBadge, HealthTierBadge } from './status-badges'
import type { SpeakerListItem, StakeholderStatus, HealthTier } from '@/types/stakeholder'

export const speakersColumns: ColumnDef<SpeakerListItem>[] = [
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
    accessorKey: 'speaker_name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Speaker Name" />,
    cell: ({ row }) => {
      const speaker = row.original
      return (
        <div className="flex flex-col">
          <Link
            href={`/stakeholders/speakers/${speaker.id}`}
            className="font-medium hover:underline"
          >
            {speaker.speaker_name}
          </Link>
          {speaker.professional_title && (
            <span className="text-xs text-muted-foreground mt-1">
              {speaker.professional_title}
            </span>
          )}
        </div>
      )
    },
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: 'expertise_areas',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Expertise" />,
    cell: ({ row }) => {
      const expertiseAreas = row.getValue('expertise_areas') as string[] | null
      if (!expertiseAreas || expertiseAreas.length === 0) {
        return <span className="text-muted-foreground">-</span>
      }
      return (
        <div className="flex flex-wrap gap-1">
          {expertiseAreas.slice(0, 2).map((area) => (
            <Badge key={area} variant="outline" className="text-xs">
              {area}
            </Badge>
          ))}
          {expertiseAreas.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{expertiseAreas.length - 2}
            </Badge>
          )}
        </div>
      )
    },
    filterFn: (row, id, value) => {
      const expertiseAreas = row.getValue(id) as string[] | null
      if (!expertiseAreas) return false
      return value.some((v: string) => expertiseAreas.includes(v))
    },
  },
  {
    accessorKey: 'session_formats',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Session Formats" />,
    cell: ({ row }) => {
      const formats = row.getValue('session_formats') as string[] | null
      if (!formats || formats.length === 0) {
        return <span className="text-muted-foreground">-</span>
      }
      return (
        <div className="flex items-center gap-1">
          <Mic2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{formats.slice(0, 2).join(', ')}</span>
          {formats.length > 2 && (
            <Badge variant="secondary" className="text-xs ml-1">
              +{formats.length - 2}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'charges_fee',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fee Status" />,
    cell: ({ row }) => {
      const chargesFee = row.getValue('charges_fee') as boolean | null
      const feeRange = row.original.fee_range

      if (chargesFee) {
        return (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-green-600" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Paid</span>
              {feeRange && <span className="text-xs text-muted-foreground">{feeRange}</span>}
            </div>
          </div>
        )
      }
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <DollarSign className="h-3 w-3" />
          <span className="text-sm">Pro Bono</span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'availability_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Availability" />,
    cell: ({ row }) => {
      const status = row.getValue('availability_status') as string
      const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
        available: 'default',
        limited: 'secondary',
        unavailable: 'outline',
      }
      return (
        <div className="flex items-center gap-1">
          <CalendarCheck className="h-3 w-3" />
          <Badge variant={variants[status] || 'outline'} className="capitalize">
            {status?.replace('_', ' ')}
          </Badge>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = row.getValue('status') as StakeholderStatus
      return <StakeholderStatusBadge status={status} />
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'health_tier',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Health" />,
    cell: ({ row }) => {
      const tier = row.getValue('health_tier') as HealthTier | null
      if (!tier) return <span className="text-muted-foreground">-</span>
      return <HealthTierBadge tier={tier} />
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'last_contact_date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last Contact" />,
    cell: ({ row }) => {
      const date = row.getValue('last_contact_date') as string | null
      if (!date) return <span className="text-muted-foreground">Never</span>
      return (
        <span className="text-sm">
          {new Date(date).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      )
    },
    enableSorting: true,
  },
]
