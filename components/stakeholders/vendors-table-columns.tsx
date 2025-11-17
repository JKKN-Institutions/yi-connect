/**
 * Vendors Data Table Columns
 */

'use client'

import Link from 'next/link'
import { ColumnDef } from '@tanstack/react-table'
import { Store, MapPin, Star, Calendar, TrendingUp } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { StakeholderStatusBadge, HealthTierBadge } from './status-badges'
import type { VendorListItem } from '@/types/stakeholder'

export const vendorsColumns: ColumnDef<VendorListItem>[] = [
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
    accessorKey: 'vendor_name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vendor Name" />,
    cell: ({ row }) => {
      const vendor = row.original
      return (
        <div className="flex flex-col">
          <Link
            href={`/stakeholders/vendors/${vendor.id}`}
            className="font-medium hover:underline max-w-[300px] truncate"
          >
            {vendor.vendor_name}
          </Link>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Store className="h-3 w-3" />
            <span className="capitalize">{vendor.vendor_category.replace('_', ' ')}</span>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'city',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
    cell: ({ row }) => {
      const vendor = row.original
      return (
        <div className="flex items-center gap-1 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>{vendor.city}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'quality_rating',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Rating" />,
    cell: ({ row }) => {
      const rating = row.getValue('quality_rating') as number | null
      if (!rating) return <span className="text-muted-foreground text-sm">-</span>
      return (
        <div className="flex items-center gap-1 text-sm">
          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          <span>{rating.toFixed(1)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <StakeholderStatusBadge status={row.getValue('status')} />,
  },
  {
    accessorKey: 'has_gst_certificate',
    header: ({ column }) => <DataTableColumnHeader column={column} title="GST" />,
    cell: ({ row }) => {
      const hasGST = row.getValue('has_gst_certificate') as boolean
      return hasGST ? (
        <Badge variant="secondary">GST Registered</Badge>
      ) : (
        <Badge variant="outline">No GST</Badge>
      )
    },
  },
  {
    accessorKey: 'health_tier',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Health" />,
    cell: ({ row }) => {
      const vendor = row.original
      if (!vendor.health_tier || !vendor.health_score) {
        return <span className="text-muted-foreground text-sm">No data</span>
      }
      return (
        <div className="flex flex-col gap-1">
          <HealthTierBadge tier={vendor.health_tier} />
          <span className="text-xs text-muted-foreground">
            Score: {vendor.health_score.toFixed(0)}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'last_contact_date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last Contact" />,
    cell: ({ row }) => {
      const lastContact = row.getValue('last_contact_date') as string | null
      if (!lastContact) return <span className="text-muted-foreground text-sm">Never</span>
      const date = new Date(lastContact)
      const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
      return (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span>
            {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
          </span>
        </div>
      )
    },
  },
]
