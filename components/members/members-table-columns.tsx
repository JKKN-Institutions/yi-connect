/**
 * Members Table Columns
 *
 * Column definitions for members data table.
 */

'use client'

import { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { MoreHorizontal, Eye, Edit, Trash } from 'lucide-react'
import type { MemberListItem } from '@/types/member'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-700 dark:text-green-400',
    inactive: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
    suspended: 'bg-red-500/10 text-red-700 dark:text-red-400',
    alumni: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  }
  return colors[status] || colors.active
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-blue-600 dark:text-blue-400'
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

export const memberColumns: ColumnDef<MemberListItem>[] = [
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
    accessorKey: 'full_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Member" />
    ),
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.original.avatar_url || undefined} alt={row.original.full_name} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(row.original.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <Link
              href={`/members/${row.original.id}`}
              className="font-medium hover:text-primary transition-colors"
            >
              {row.original.full_name}
            </Link>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {row.original.email}
            </span>
          </div>
        </div>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'membership_status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue('membership_status') as string
      return (
        <Badge variant="secondary" className={getStatusColor(status)}>
          {status}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'company',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Company" />
    ),
    cell: ({ row }) => {
      const company = row.getValue('company') as string | null
      const designation = row.original.designation

      return (
        <div className="flex flex-col">
          {company && <span className="font-medium">{company}</span>}
          {designation && (
            <span className="text-xs text-muted-foreground">{designation}</span>
          )}
          {!company && !designation && (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'skills_count',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Skills" />
    ),
    cell: ({ row }) => {
      const count = row.getValue('skills_count') as number
      const topSkills = row.original.top_skills

      return (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{count} skill{count !== 1 ? 's' : ''}</span>
          {topSkills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {topSkills.slice(0, 2).map((skill, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {skill.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'engagement_score',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Engagement" />
    ),
    cell: ({ row }) => {
      const score = row.getValue('engagement_score') as number
      return (
        <div className="flex flex-col gap-1 w-[100px]">
          <div className="flex items-center justify-between text-sm">
            <span className={getScoreColor(score)}>{score}</span>
            <span className="text-muted-foreground">/100</span>
          </div>
          <Progress value={score} className="h-1.5" />
        </div>
      )
    },
  },
  {
    accessorKey: 'readiness_score',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Readiness" />
    ),
    cell: ({ row }) => {
      const score = row.getValue('readiness_score') as number
      return (
        <div className="flex flex-col gap-1 w-[100px]">
          <div className="flex items-center justify-between text-sm">
            <span className={getScoreColor(score)}>{score}</span>
            <span className="text-muted-foreground">/100</span>
          </div>
          <Progress value={score} className="h-1.5" />
        </div>
      )
    },
  },
  {
    accessorKey: 'member_since',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Member Since" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('member_since'))
      return (
        <span className="text-sm text-muted-foreground">
          {date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const member = row.original

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
            <DropdownMenuItem asChild>
              <Link href={`/members/${member.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/members/${member.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
