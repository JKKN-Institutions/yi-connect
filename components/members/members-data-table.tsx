/**
 * Members Data Table Client Component
 *
 * Client-side wrapper that generates columns with user roles and renders the data table.
 * This is needed because getMemberColumns is a client function that cannot be called from server components.
 */

'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/data-table/data-table'
import { getMemberColumns } from './members-table-columns'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import type { DataTableFilterField } from '@/lib/table/types'
import type { MemberListItem } from '@/types/member'

interface MembersDataTableProps {
  data: MemberListItem[]
  userRoles: string[]
}

export function MembersDataTable({ data, userRoles }: MembersDataTableProps) {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()

  // Get columns with user role-based actions (client-side)
  const columns = getMemberColumns(userRoles)

  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh()
    })
  }

  // Define filter fields
  const filterFields: DataTableFilterField<MemberListItem>[] = [
    {
      label: 'Search',
      value: 'full_name',
      placeholder: 'Search members...',
    },
    {
      label: 'Status',
      value: 'membership_status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Alumni', value: 'alumni' },
      ],
    },
  ]

  // Export configuration - only serializable data
  const exportConfig = {
    filename: 'members-export',
    sheetName: 'Members',
    columns: [
      { key: 'full_name' as const, label: 'Full Name' },
      { key: 'email' as const, label: 'Email' },
      { key: 'company' as const, label: 'Company' },
      { key: 'designation' as const, label: 'Designation' },
      { key: 'membership_status' as const, label: 'Status' },
      { key: 'member_since' as const, label: 'Member Since' },
      { key: 'engagement_score' as const, label: 'Engagement Score' },
      { key: 'readiness_score' as const, label: 'Readiness Score' },
      { key: 'skills_count' as const, label: 'Skills Count' },
    ]
  }

  return (
    <div className="space-y-4">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data}
        filterFields={filterFields}
        exportConfig={exportConfig}
      />
    </div>
  )
}
