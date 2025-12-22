/**
 * Dashboard Layout
 *
 * Protected layout for authenticated users.
 * Includes sidebar navigation and header.
 *
 * Note: Authentication is handled by middleware.ts
 */

import { Suspense } from 'react'
import { unstable_noStore as noStore } from 'next/cache'
import { DashboardHeader } from '@/components/layouts/dashboard-header'
import { DashboardSidebar } from '@/components/layouts/dashboard-sidebar'
import { BugReporterWrapper } from '@/components/bug-reporter-wrapper'
import { AdminChapterProvider } from '@/contexts/admin-chapter-context'
import { getCurrentUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function SidebarWrapper() {
  const user = await getCurrentUser()

  if (!user) {
    return <div className="w-64 bg-background border-r" />
  }

  // Fetch user roles on the server
  const supabase = await createServerSupabaseClient()
  const { data: userRoles } = await supabase.rpc('get_user_roles', {
    p_user_id: user.id
  })

  const roles = userRoles?.map((ur: { role_name: string }) => ur.role_name) || []

  return <DashboardSidebar userRoles={roles} />
}

async function getUserProfileForBugReporter() {
  const user = await getCurrentUser()

  if (!user) return null

  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', user.id)
    .single()

  if (profile) {
    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name
    }
  }

  // Fallback to auth user data
  return {
    id: user.id,
    email: user.email || null,
    full_name: (user.user_metadata?.full_name as string) || null
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Opt out of static prerendering and caching for authenticated routes
  noStore()

  // Fetch user profile for bug reporter on the server
  const userProfile = await getUserProfileForBugReporter()

  return (
    <BugReporterWrapper userProfile={userProfile}>
      <AdminChapterProvider>
        <div className="min-h-screen flex overflow-hidden">
          {/* Sidebar */}
          <Suspense fallback={<div className="w-64 bg-background border-r" />}>
            <SidebarWrapper />
          </Suspense>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col lg:ml-64 min-w-0 overflow-hidden">
            {/* Header */}
            <Suspense fallback={<div className="h-16 bg-background border-b" />}>
              <DashboardHeader />
            </Suspense>

            {/* Page Content */}
            <main className="flex-1 p-6 bg-muted/10 overflow-x-hidden overflow-y-auto min-w-0">
              {children}
            </main>
          </div>
        </div>
      </AdminChapterProvider>
    </BugReporterWrapper>
  )
}
