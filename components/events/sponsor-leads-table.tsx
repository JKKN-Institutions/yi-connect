/**
 * Sponsor Leads Table (Stutzee Feature 3D)
 *
 * TanStack Table with filters (sponsor, interest level), CSV/XLSX export.
 * Uses the shared DataTable primitives from components/data-table/*.
 */

'use client'

import { useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Mail, Phone, Building2, FlagTriangleRight } from 'lucide-react'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import type { ExportConfig } from '@/components/data-table/data-table-toolbar'
import type { DataTableFilterField } from '@/lib/table/types'

import {
  INTEREST_LEVEL_COLORS,
  INTEREST_LEVEL_LABELS,
  type InterestLevel,
  type SponsorLeadWithRelations,
} from '@/types/sponsor-lead'

interface SponsorLeadsTableProps {
  leads: SponsorLeadWithRelations[]
  /** Optional sponsor filter options for the toolbar. */
  sponsorOptions?: { label: string; value: string }[]
  /** Show event column (used for cross-event sponsor views). */
  showEventColumn?: boolean
}

/**
 * Flattened shape used by the table (keeps column filter ids simple).
 */
type LeadRow = {
  id: string
  full_name: string
  company: string | null
  email: string | null
  phone: string | null
  designation: string | null
  interest_level: InterestLevel
  interest_areas: string | null
  sponsor_id: string
  sponsor_name: string
  event_id: string
  event_title: string
  follow_up_requested: string // 'Yes' | 'No' — stringified for faceted filter
  follow_up_by: string | null
  notes: string | null
  captured_at: string
}

const flatten = (l: SponsorLeadWithRelations): LeadRow => ({
  id: l.id,
  full_name: l.full_name,
  company: l.company,
  email: l.email,
  phone: l.phone,
  designation: l.designation,
  interest_level: l.interest_level,
  interest_areas:
    l.interest_areas && l.interest_areas.length > 0
      ? l.interest_areas.join(', ')
      : null,
  sponsor_id: l.sponsor_id,
  sponsor_name: l.sponsor?.organization_name ?? '—',
  event_id: l.event_id,
  event_title: l.event?.title ?? '—',
  follow_up_requested: l.follow_up_requested ? 'Yes' : 'No',
  follow_up_by: l.follow_up_by,
  notes: l.notes,
  captured_at: l.created_at,
})

export function SponsorLeadsTable({
  leads,
  sponsorOptions,
  showEventColumn = false,
}: SponsorLeadsTableProps) {
  const rows = useMemo(() => leads.map(flatten), [leads])

  const columns = useMemo<ColumnDef<LeadRow>[]>(() => {
    const cols: ColumnDef<LeadRow>[] = [
      {
        accessorKey: 'full_name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Name' />
        ),
        cell: ({ row }) => (
          <div className='flex flex-col'>
            <span className='font-medium'>{row.original.full_name}</span>
            {row.original.designation && (
              <span className='text-xs text-muted-foreground'>
                {row.original.designation}
              </span>
            )}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'company',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Company' />
        ),
        cell: ({ row }) => (
          <div className='flex items-center gap-1.5 text-sm'>
            <Building2 className='h-3.5 w-3.5 text-muted-foreground' />
            {row.original.company || '—'}
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: ({ row }) => (
          <div className='flex flex-col gap-0.5 text-xs'>
            {row.original.email && (
              <span className='inline-flex items-center gap-1'>
                <Mail className='h-3 w-3' />
                {row.original.email}
              </span>
            )}
            {row.original.phone && (
              <span className='inline-flex items-center gap-1'>
                <Phone className='h-3 w-3' />
                {row.original.phone}
              </span>
            )}
            {!row.original.email && !row.original.phone && (
              <span className='text-muted-foreground'>—</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'sponsor_name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Sponsor' />
        ),
        filterFn: (row, id, value) => {
          if (!Array.isArray(value) || value.length === 0) return true
          return value.includes(row.original.sponsor_id)
        },
        cell: ({ row }) => (
          <span className='text-sm'>{row.original.sponsor_name}</span>
        ),
      },
      {
        accessorKey: 'interest_level',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Interest' />
        ),
        filterFn: (row, id, value) => {
          if (!Array.isArray(value) || value.length === 0) return true
          return value.includes(row.getValue(id) as string)
        },
        cell: ({ row }) => {
          const level = row.original.interest_level
          return (
            <Badge
              variant='outline'
              className={INTEREST_LEVEL_COLORS[level] + ' font-medium'}
            >
              {INTEREST_LEVEL_LABELS[level]}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'follow_up_requested',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Follow-up' />
        ),
        filterFn: (row, id, value) => {
          if (!Array.isArray(value) || value.length === 0) return true
          return value.includes(row.getValue(id) as string)
        },
        cell: ({ row }) =>
          row.original.follow_up_requested === 'Yes' ? (
            <div className='flex items-center gap-1 text-sm text-amber-700'>
              <FlagTriangleRight className='h-3.5 w-3.5' />
              <span>
                {row.original.follow_up_by
                  ? format(new Date(row.original.follow_up_by), 'MMM d')
                  : 'Yes'}
              </span>
            </div>
          ) : (
            <span className='text-xs text-muted-foreground'>—</span>
          ),
      },
      {
        accessorKey: 'captured_at',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Captured' />
        ),
        cell: ({ row }) => (
          <span className='text-sm text-muted-foreground'>
            {format(new Date(row.original.captured_at), 'MMM d, h:mm a')}
          </span>
        ),
      },
    ]

    if (showEventColumn) {
      cols.splice(4, 0, {
        accessorKey: 'event_title',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Event' />
        ),
        cell: ({ row }) => (
          <span className='text-sm'>{row.original.event_title}</span>
        ),
      })
    }

    return cols
  }, [showEventColumn])

  const filterFields = useMemo<DataTableFilterField<LeadRow>[]>(() => {
    const fields: DataTableFilterField<LeadRow>[] = [
      {
        label: 'Name or company',
        value: 'full_name',
        placeholder: 'Search by name…',
      },
      {
        label: 'Interest level',
        value: 'interest_level',
        options: (Object.keys(INTEREST_LEVEL_LABELS) as InterestLevel[]).map(
          l => ({
            label: INTEREST_LEVEL_LABELS[l],
            value: l,
          })
        ),
      },
      {
        label: 'Follow-up',
        value: 'follow_up_requested',
        options: [
          { label: 'Requested', value: 'Yes' },
          { label: 'None', value: 'No' },
        ],
      },
    ]

    if (sponsorOptions && sponsorOptions.length > 0) {
      fields.push({
        label: 'Sponsor',
        value: 'sponsor_name',
        options: sponsorOptions,
      })
    }

    return fields
  }, [sponsorOptions])

  const exportConfig: ExportConfig<LeadRow> = {
    filename: `sponsor-leads-${format(new Date(), 'yyyy-MM-dd')}`,
    sheetName: 'Sponsor Leads',
    columns: [
      { key: 'full_name', label: 'Name' },
      { key: 'designation', label: 'Designation' },
      { key: 'company', label: 'Company' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'sponsor_name', label: 'Sponsor' },
      { key: 'event_title', label: 'Event' },
      { key: 'interest_level', label: 'Interest Level' },
      { key: 'interest_areas', label: 'Interest Areas' },
      { key: 'follow_up_requested', label: 'Follow-up Requested' },
      { key: 'follow_up_by', label: 'Follow-up By' },
      { key: 'notes', label: 'Notes' },
      { key: 'captured_at', label: 'Captured At' },
    ],
  }

  return (
    <DataTable
      columns={columns}
      data={rows}
      filterFields={filterFields}
      exportConfig={exportConfig}
      getRowId={row => row.id}
    />
  )
}
