/**
 * Users Table Column Definitions
 *
 * Column definitions for the advanced users table
 */

'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { MoreHorizontal, Pencil, Shield, UserX, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import type { UserListItem } from '@/types/user'

// Helper function to get role badge variant
function getRoleBadgeVariant(hierarchyLevel: number) {
  if (hierarchyLevel >= 7) return 'destructive' // Super Admin
  if (hierarchyLevel >= 6) return 'default' // National Admin
  if (hierarchyLevel >= 5) return 'secondary' // Executive
  if (hierarchyLevel >= 3) return 'outline' // Co-Chair, Chair
  return 'outline' // Regular members
}

export const usersTableColumns: ColumnDef<UserListItem>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
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
    accessorKey: 'full_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='User' />
    ),
    cell: ({ row }) => {
      const user = row.original
      const initials = user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()

      return (
        <Link
          href={`/admin/users/${user.id}`}
          className='flex items-center gap-3 hover:underline'
        >
          <Avatar className='h-10 w-10'>
            <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className='flex flex-col'>
            <span className='font-medium'>{user.full_name}</span>
            <span className='text-sm text-muted-foreground'>{user.email}</span>
          </div>
        </Link>
      )
    }
  },
  {
    accessorKey: 'roles',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Roles' />
    ),
    cell: ({ row }) => {
      const roles = row.original.roles

      if (roles.length === 0) {
        return <Badge variant='outline'>No Role</Badge>
      }

      return (
        <div className='flex flex-wrap gap-1'>
          {roles.slice(0, 2).map((role) => (
            <Badge
              key={role.id}
              variant={getRoleBadgeVariant(role.hierarchy_level)}
            >
              {role.role_name}
            </Badge>
          ))}
          {roles.length > 2 && (
            <Badge variant='outline'>+{roles.length - 2}</Badge>
          )}
        </div>
      )
    },
    enableSorting: false
  },
  {
    accessorKey: 'chapter',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Chapter' />
    ),
    cell: ({ row }) => {
      const chapter = row.original.chapter
      return chapter ? (
        <div className='flex flex-col'>
          <span className='font-medium'>{chapter.name}</span>
          <span className='text-sm text-muted-foreground'>{chapter.location}</span>
        </div>
      ) : (
        <span className='text-muted-foreground'>No Chapter</span>
      )
    }
  },
  {
    accessorKey: 'phone',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Phone' />
    ),
    cell: ({ row }) => {
      const phone = row.getValue('phone') as string | null
      return phone ? (
        <span>{phone}</span>
      ) : (
        <span className='text-muted-foreground'>-</span>
      )
    }
  },
  {
    accessorKey: 'is_active',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const isActive = row.getValue('is_active') as boolean
      return (
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    }
  },
  {
    accessorKey: 'has_member_record',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Member' />
    ),
    cell: ({ row }) => {
      const hasMember = row.getValue('has_member_record') as boolean
      return hasMember ? (
        <Badge variant='outline' className='gap-1'>
          <UserCheck className='h-3 w-3' />
          Yes
        </Badge>
      ) : (
        <Badge variant='outline' className='gap-1 text-muted-foreground'>
          <UserX className='h-3 w-3' />
          No
        </Badge>
      )
    }
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Joined' />
    ),
    cell: ({ row }) => {
      const date = row.getValue('created_at') as string
      return (
        <span className='text-sm'>
          {format(new Date(date), 'MMM dd, yyyy')}
        </span>
      )
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original

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
              <Link href={`/admin/users/${user.id}`}>
                <Pencil className='mr-2 h-4 w-4' />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${user.id}/edit`}>
                <Pencil className='mr-2 h-4 w-4' />
                Edit Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Shield className='mr-2 h-4 w-4' />
              Manage Roles
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  }
]
