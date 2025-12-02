/**
 * Members Data Table Client Component
 *
 * Client-side wrapper that generates columns with user roles and renders the data table.
 * This is needed because getMemberColumns is a client function that cannot be called from server components.
 */

'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/data-table/data-table'
import { getMemberColumns } from './members-table-columns'
import { MemberCategoryTabs } from './member-category-tabs'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import type { DataTableFilterField } from '@/lib/table/types'
import type { MemberListItem, MemberCategoryTab } from '@/types/member'

interface MembersDataTableProps {
  data: MemberListItem[]
  userRoles: string[]
}

export function MembersDataTable({ data, userRoles }: MembersDataTableProps) {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  const [activeTab, setActiveTab] = useState<MemberCategoryTab>('all')

  // Get columns with user role-based actions (client-side)
  const columns = getMemberColumns(userRoles)

  const handleRefresh = () => {
    startRefresh(() => {
      router.refresh()
    })
  }

  // Filter data based on active tab
  const filteredData = useMemo(() => {
    switch (activeTab) {
      case 'trainers':
        return data.filter(m => m.is_trainer)
      case 'star':
        return data.filter(m => m.skill_will_category === 'star')
      case 'enthusiast':
        return data.filter(m => m.skill_will_category === 'enthusiast')
      case 'cynic':
        return data.filter(m => m.skill_will_category === 'cynic')
      case 'dead_wood':
        return data.filter(m => m.skill_will_category === 'dead_wood')
      default:
        return data
    }
  }, [data, activeTab])

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
    {
      label: 'Category',
      value: 'skill_will_category',
      options: [
        { label: 'Star', value: 'star' },
        { label: 'Enthusiast', value: 'enthusiast' },
        { label: 'Cynic', value: 'cynic' },
        { label: 'Needs Attention', value: 'dead_wood' },
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
      { key: 'skill_will_category' as const, label: 'Category' },
      { key: 'is_trainer' as const, label: 'Is Trainer' },
      { key: 'engagement_score' as const, label: 'Engagement Score' },
      { key: 'readiness_score' as const, label: 'Readiness Score' },
      { key: 'skills_count' as const, label: 'Skills Count' },
    ]
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Category Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <MemberCategoryTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          members={data}
        />

        {/* Refresh Button */}
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
        data={filteredData}
        filterFields={filterFields}
        exportConfig={exportConfig}
      />
    </div>
  )
}
