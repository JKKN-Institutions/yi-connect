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
import { BulkMemberDeleteDialog, BulkMemberDeactivateDialog } from './member-actions-dialog'
import { Button } from '@/components/ui/button'
import { RefreshCw, Trash2, UserX } from 'lucide-react'
import type { DataTableFilterField } from '@/lib/table/types'
import type { BulkAction } from '@/components/data-table/data-table-toolbar'
import type { MemberListItem, MemberCategoryTab } from '@/types/member'

interface MembersDataTableProps {
  data: MemberListItem[]
  userRoles: string[]
}

export function MembersDataTable({ data, userRoles }: MembersDataTableProps) {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  const [activeTab, setActiveTab] = useState<MemberCategoryTab>('all')

  // Bulk action dialog states
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])

  // Get columns with user role-based actions (client-side)
  const columns = getMemberColumns(userRoles)

  // Check user permissions for bulk actions
  const canDelete = userRoles.some(role => ['Super Admin', 'National Admin'].includes(role))
  const canDeactivate = userRoles.some(role => ['Super Admin', 'National Admin', 'Chair', 'Co-Chair'].includes(role))

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
      { key: 'is_trainer' as const, label: 'Is Trainer' },
      { key: 'engagement_score' as const, label: 'Engagement Score' },
      { key: 'readiness_score' as const, label: 'Readiness Score' },
      { key: 'skills_count' as const, label: 'Skills Count' },
    ]
  }

  // Define bulk actions based on user permissions
  const bulkActions: BulkAction[] = useMemo(() => {
    const actions: BulkAction[] = []

    if (canDeactivate) {
      actions.push({
        id: 'deactivate',
        label: 'Deactivate',
        icon: <UserX className="mr-2 h-4 w-4" />,
        variant: 'outline',
        onClick: (ids) => {
          setSelectedMemberIds(ids)
          setBulkDeactivateOpen(true)
        }
      })
    }

    if (canDelete) {
      actions.push({
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 className="mr-2 h-4 w-4" />,
        variant: 'destructive',
        onClick: (ids) => {
          setSelectedMemberIds(ids)
          setBulkDeleteOpen(true)
        }
      })
    }

    return actions
  }, [canDelete, canDeactivate])

  // Clear selection after successful bulk action
  const handleBulkActionSuccess = () => {
    setSelectedMemberIds([])
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
        bulkActions={bulkActions}
        getRowId={(row) => row.id}
      />

      {/* Bulk Action Dialogs */}
      <BulkMemberDeactivateDialog
        open={bulkDeactivateOpen}
        onOpenChange={setBulkDeactivateOpen}
        memberIds={selectedMemberIds}
        onSuccess={handleBulkActionSuccess}
      />
      <BulkMemberDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        memberIds={selectedMemberIds}
        onSuccess={handleBulkActionSuccess}
      />
    </div>
  )
}
