/**
 * Government Stakeholders Data Table Columns
 *
 * Column definitions for the government stakeholders listing data table
 */

'use client'

import Link from 'next/link'
import { ColumnDef } from '@tanstack/react-table'
import { Building, MapPin, Calendar, TrendingUp, Shield } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { StakeholderStatusBadge, HealthTierBadge, MouStatusBadge } from './status-badges'
import type { GovernmentStakeholderListItem } from '@/types/stakeholder'
import { Badge } from '@/components/ui/badge'

export const governmentStakeholdersColumns: ColumnDef<GovernmentStakeholderListItem>[] = [
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
    accessorKey: 'official_name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Official Name" />,
    cell: ({ row }) => {
      const stakeholder = row.original

      return (
        <div className="flex flex-col">
          <Link
            href={`/stakeholders/government/${stakeholder.id}`}
            className="font-medium hover:underline max-w-[300px] truncate"
          >
            {stakeholder.official_name}
          </Link>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Shield className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{stakeholder.designation}</span>
          </div>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'department',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    cell: ({ row }) => {
      const department = row.getValue('department') as string
      return (
        <span className="text-sm truncate max-w-[200px] block">{department}</span>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'city',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
    cell: ({ row }) => {
      const stakeholder = row.original

      return (
        <div className="flex items-center gap-1 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>{stakeholder.city}</span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'is_elected',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => {
      const isElected = row.getValue('is_elected') as boolean

      return isElected ? (
        <Badge variant="secondary">Elected</Badge>
      ) : (
        <Badge variant="outline">Appointed</Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id) ? 'elected' : 'appointed')
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = row.getValue('status') as typeof row.original.status

      return <StakeholderStatusBadge status={status} />
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'mou_status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="MoU" />,
    cell: ({ row }) => {
      const mouStatus = row.original.mou_status

      return <MouStatusBadge status={mouStatus} />
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'health_tier',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Health" />,
    cell: ({ row }) => {
      const stakeholder = row.original

      if (!stakeholder.health_tier || !stakeholder.health_score) {
        return <span className="text-muted-foreground text-sm">No data</span>
      }

      return (
        <div className="flex flex-col gap-1">
          <HealthTierBadge tier={stakeholder.health_tier} />
          <span className="text-xs text-muted-foreground">
            Score: {stakeholder.health_score.toFixed(0)}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'contact_count',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contacts" />,
    cell: ({ row }) => {
      const count = row.getValue('contact_count') as number

      return (
        <div className="text-sm">
          <span className="font-medium">{count}</span>
          <span className="text-muted-foreground ml-1">contact{count !== 1 ? 's' : ''}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'interaction_count',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Interactions" />,
    cell: ({ row }) => {
      const count = row.getValue('interaction_count') as number

      return (
        <div className="flex items-center gap-1 text-sm">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{count}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'last_contact_date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last Contact" />,
    cell: ({ row }) => {
      const lastContact = row.getValue('last_contact_date') as string | null

      if (!lastContact) {
        return <span className="text-muted-foreground text-sm">Never</span>
      }

      const date = new Date(lastContact)
      const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))

      return (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>
            {daysAgo === 0
              ? 'Today'
              : daysAgo === 1
              ? 'Yesterday'
              : `${daysAgo} days ago`}
          </span>
        </div>
      )
    },
  },
]
