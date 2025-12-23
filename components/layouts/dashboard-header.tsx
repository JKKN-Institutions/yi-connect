/**
 * Dashboard Header
 *
 * Top header with user menu and notifications.
 */

import { Suspense } from 'react'
import { getUserProfile, getCurrentMemberId } from '@/lib/auth'
import { UserMenu } from '@/components/navigation/user-menu'
import { NotificationBell } from '@/components/communication/notification-bell'
import { ChapterSwitcher } from '@/components/admin/chapter-switcher'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getNotifications, getUnreadNotificationsCount } from '@/lib/data/communication'

async function UserMenuWrapper() {
  const profile = await getUserProfile()
  return <UserMenu profile={profile} />
}

async function NotificationBellWrapper() {
  const memberId = await getCurrentMemberId()

  if (!memberId) {
    // Show empty bell if not authenticated
    return (
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
      </Button>
    )
  }

  // Fetch initial notifications and unread count
  const [notificationsResult, unreadCount] = await Promise.all([
    getNotifications(memberId, undefined, 1, 20),
    getUnreadNotificationsCount(memberId)
  ])

  return (
    <NotificationBell
      memberId={memberId}
      initialNotifications={notificationsResult.data}
      initialUnreadCount={unreadCount}
    />
  )
}

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 bg-background border-b">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4">
        {/* Left side - Brand on mobile, Chapter Switcher on desktop */}
        <div className="flex items-center gap-2">
          {/* Mobile Brand */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">Yi</span>
            </div>
            <span className="text-base font-bold">Yi Connect</span>
          </div>

          {/* Desktop Chapter Switcher */}
          <div className="hidden lg:block">
            <ChapterSwitcher />
          </div>
        </div>

        {/* Right side - Notifications and User Menu */}
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Notifications with Suspense */}
          <Suspense fallback={
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>
          }>
            <NotificationBellWrapper />
          </Suspense>

          {/* User Menu with Suspense */}
          <Suspense fallback={<Skeleton className="h-10 w-10 rounded-full" />}>
            <UserMenuWrapper />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
