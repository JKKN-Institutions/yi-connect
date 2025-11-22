/**
 * Mobile Dashboard Page
 *
 * The main mobile dashboard with personalized stats,
 * quick actions, and upcoming events.
 */

import { Suspense } from 'react'
import { getUserProfile } from '@/lib/auth'
import { getMemberAnalytics } from '@/lib/data/members'
import { MobileHomeHeader } from '@/components/mobile/mobile-header'
import { StatWidget, StatWidgetGrid, StatWidgetSkeleton } from '@/components/mobile/stat-widget'
import { QuickActionGrid } from '@/components/mobile/quick-action-grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, ChevronRight } from 'lucide-react'
import Link from 'next/link'

// Welcome section with user greeting
async function WelcomeSection() {
  const profile = await getUserProfile()
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()

  let greeting = 'Good morning'
  if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon'
  } else if (hour >= 17) {
    greeting = 'Good evening'
  }

  return (
    <div className='px-4 pt-4'>
      <h1 className='text-xl font-bold'>
        {greeting}, {firstName}!
      </h1>
      <p className='text-sm text-muted-foreground'>
        Here&apos;s your Yi chapter summary
      </p>
    </div>
  )
}

// Stats section with key metrics
async function StatsSection() {
  const profile = await getUserProfile()
  const analytics = await getMemberAnalytics(profile?.chapter_id || undefined)

  return (
    <div className='px-4'>
      <StatWidgetGrid>
        <StatWidget
          id='events'
          label='Upcoming Events'
          value={analytics.new_members_this_month || 0}
          icon='calendar'
          href='/m/events'
        />
        <StatWidget
          id='members'
          label='Total Members'
          value={analytics.total_members}
          change={analytics.new_members_this_month > 0 ? Math.round((analytics.new_members_this_month / analytics.total_members) * 100) : 0}
          changeType={analytics.new_members_this_month > 0 ? 'positive' : 'neutral'}
          icon='users'
          href='/members'
        />
        <StatWidget
          id='engagement'
          label='Engagement'
          value={`${analytics.avg_engagement_score || 0}%`}
          icon='trending-up'
        />
        <StatWidget
          id='notifications'
          label='Alerts'
          value={0}
          icon='bell'
          href='/m/notifications'
        />
      </StatWidgetGrid>
    </div>
  )
}

// Upcoming events preview
function UpcomingEventsSection() {
  return (
    <Card className='mx-4 border-0 shadow-none bg-card/50'>
      <CardHeader className='px-0 pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-base font-semibold'>Upcoming Events</CardTitle>
          <Link
            href='/m/events'
            className='flex items-center text-xs text-primary font-medium'
          >
            View all
            <ChevronRight className='h-4 w-4' />
          </Link>
        </div>
      </CardHeader>
      <CardContent className='px-0'>
        <div className='text-center py-8 text-muted-foreground'>
          <Calendar className='h-10 w-10 mx-auto mb-2 opacity-50' />
          <p className='text-sm'>No upcoming events</p>
          <p className='text-xs mt-1'>Check back later for new events</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MobileDashboardPage() {
  return (
    <div className='min-h-screen bg-background'>
      {/* Header */}
      <MobileHomeHeader />

      {/* Main Content */}
      <div className='space-y-6 pb-6'>
        {/* Welcome Section */}
        <Suspense
          fallback={
            <div className='px-4 pt-4'>
              <div className='h-6 w-48 bg-muted animate-pulse rounded mb-1' />
              <div className='h-4 w-64 bg-muted animate-pulse rounded' />
            </div>
          }
        >
          <WelcomeSection />
        </Suspense>

        {/* Quick Actions */}
        <div className='px-4'>
          <h2 className='text-sm font-semibold mb-3 text-muted-foreground'>
            Quick Actions
          </h2>
          <QuickActionGrid />
        </div>

        {/* Stats */}
        <div>
          <h2 className='text-sm font-semibold mb-3 px-4 text-muted-foreground'>
            Your Stats
          </h2>
          <Suspense
            fallback={
              <div className='px-4'>
                <StatWidgetGrid>
                  <StatWidgetSkeleton />
                  <StatWidgetSkeleton />
                  <StatWidgetSkeleton />
                  <StatWidgetSkeleton />
                </StatWidgetGrid>
              </div>
            }
          >
            <StatsSection />
          </Suspense>
        </div>

        {/* Upcoming Events */}
        <UpcomingEventsSection />
      </div>
    </div>
  )
}
