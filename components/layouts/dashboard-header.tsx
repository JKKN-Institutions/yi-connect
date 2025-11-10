/**
 * Dashboard Header
 *
 * Top header with user menu and notifications.
 */

import { Suspense } from 'react'
import { getUserProfile } from '@/lib/auth'
import { UserMenu } from '@/components/navigation/user-menu'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

async function UserMenuWrapper() {
  const profile = await getUserProfile()
  return <UserMenu profile={profile} />
}

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 bg-background border-b">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side - could add breadcrumbs here */}
        <div className="lg:hidden" />

        {/* Right side - Notifications and User Menu */}
        <div className="ml-auto flex items-center gap-4">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          </Button>

          {/* User Menu with Suspense */}
          <Suspense fallback={<Skeleton className="h-10 w-10 rounded-full" />}>
            <UserMenuWrapper />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
