/**
 * Member Category Tabs
 *
 * Filter tabs for members list to quickly filter by category.
 */

'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  GraduationCap,
  Star,
  Sparkles,
  Frown,
  AlertTriangle
} from 'lucide-react'
import { MEMBER_CATEGORY_TABS, type MemberCategoryTab, type MemberListItem } from '@/types/member'

interface MemberCategoryTabsProps {
  activeTab: MemberCategoryTab
  onTabChange: (tab: MemberCategoryTab) => void
  members: MemberListItem[]
}

// Count members by category
function getCategoryCounts(members: MemberListItem[]) {
  return {
    all: members.length,
    trainers: members.filter(m => m.is_trainer).length,
    star: members.filter(m => m.skill_will_category === 'star').length,
    enthusiast: members.filter(m => m.skill_will_category === 'enthusiast').length,
    cynic: members.filter(m => m.skill_will_category === 'cynic').length,
    dead_wood: members.filter(m => m.skill_will_category === 'dead_wood').length,
  }
}

const tabIcons: Record<MemberCategoryTab, React.ReactNode> = {
  all: <Users className="h-4 w-4" />,
  trainers: <GraduationCap className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
  enthusiast: <Sparkles className="h-4 w-4" />,
  cynic: <Frown className="h-4 w-4" />,
  dead_wood: <AlertTriangle className="h-4 w-4" />,
}

const tabColors: Record<MemberCategoryTab, string> = {
  all: '',
  trainers: 'data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400',
  star: 'data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-700 dark:data-[state=active]:text-yellow-400',
  enthusiast: 'data-[state=active]:bg-green-500/10 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400',
  cynic: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-400',
  dead_wood: 'data-[state=active]:bg-red-500/10 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-400',
}

export function MemberCategoryTabs({
  activeTab,
  onTabChange,
  members
}: MemberCategoryTabsProps) {
  const counts = getCategoryCounts(members)

  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as MemberCategoryTab)}>
      <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
        {MEMBER_CATEGORY_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={`
              gap-2 rounded-lg border border-transparent px-3 py-2
              data-[state=active]:border-border data-[state=active]:shadow-sm
              ${tabColors[tab.value as MemberCategoryTab]}
            `}
            title={tab.description}
          >
            {tabIcons[tab.value as MemberCategoryTab]}
            <span className="hidden sm:inline">{tab.label}</span>
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-[20px] px-1.5 text-xs"
            >
              {counts[tab.value as MemberCategoryTab]}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
