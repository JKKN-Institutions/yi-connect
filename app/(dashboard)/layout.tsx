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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Opt out of static prerendering and caching for authenticated routes
  noStore()

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <Suspense fallback={<div className="w-64 bg-background border-r" />}>
        <DashboardSidebar />
      </Suspense>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Header */}
        <Suspense fallback={<div className="h-16 bg-background border-b" />}>
          <DashboardHeader />
        </Suspense>

        {/* Page Content */}
        <main className="flex-1 p-6 bg-muted/10">
          {children}
        </main>
      </div>
    </div>
  )
}
