/**
 * Dashboard Home Page
 *
 * Main dashboard overview with key metrics and quick actions.
 */

import { Suspense } from 'react';
import { getUserProfile } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Wallet, TrendingUp, Plus } from 'lucide-react';
import Link from 'next/link';

async function WelcomeSection() {
  const profile = await getUserProfile();

  return (
    <div>
      <h1 className='text-3xl font-bold tracking-tight'>
        Welcome back
        {profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
      </h1>
      <p className='text-muted-foreground mt-1'>
        Here&apos;s what&apos;s happening with your Yi Chapter today.
      </p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className='space-y-6'>
      {/* Welcome Section */}
      <Suspense
        fallback={
          <div>
            <div className='h-9 w-64 bg-muted animate-pulse rounded mb-1' />
            <div className='h-5 w-96 bg-muted animate-pulse rounded' />
          </div>
        }
      >
        <WelcomeSection />
      </Suspense>

      {/* Quick Actions */}
      <div className='flex flex-wrap gap-3'>
        <Button asChild>
          <Link href='/events/new'>
            <Plus className='mr-2 h-4 w-4' />
            New Event
          </Link>
        </Button>
        <Button variant='outline' asChild>
          <Link href='/members/new'>
            <Plus className='mr-2 h-4 w-4' />
            Add Member
          </Link>
        </Button>
        <Button variant='outline' asChild>
          <Link href='/communications/new'>
            <Plus className='mr-2 h-4 w-4' />
            Send Announcement
          </Link>
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Suspense fallback={<MetricCardSkeleton />}>
          <MetricCard
            title='Total Members'
            value='0'
            description='+0 this month'
            icon={Users}
            trend='up'
          />
        </Suspense>
        <Suspense fallback={<MetricCardSkeleton />}>
          <MetricCard
            title='Upcoming Events'
            value='0'
            description='Next 30 days'
            icon={Calendar}
            trend='neutral'
          />
        </Suspense>
        <Suspense fallback={<MetricCardSkeleton />}>
          <MetricCard
            title='Budget Utilization'
            value='0%'
            description='of total budget'
            icon={Wallet}
            trend='neutral'
          />
        </Suspense>
        <Suspense fallback={<MetricCardSkeleton />}>
          <MetricCard
            title='Engagement Score'
            value='0%'
            description='Chapter average'
            icon={TrendingUp}
            trend='neutral'
          />
        </Suspense>
      </div>

      {/* Recent Activity & Upcoming Events */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from your chapter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-center py-8 text-muted-foreground'>
              <Calendar className='h-12 w-12 mx-auto mb-3 opacity-50' />
              <p>No recent activity</p>
              <p className='text-sm mt-1'>
                Activity will appear here once you start using the system
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>Next events on your calendar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-center py-8 text-muted-foreground'>
              <Calendar className='h-12 w-12 mx-auto mb-3 opacity-50' />
              <p>No upcoming events</p>
              <Button variant='link' asChild className='mt-2'>
                <Link href='/events/new'>Create your first event</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </CardContent>
    </Card>
  );
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className='space-y-0 pb-2'>
        <div className='h-4 w-24 bg-muted animate-pulse rounded' />
      </CardHeader>
      <CardContent>
        <div className='h-8 w-16 bg-muted animate-pulse rounded mb-2' />
        <div className='h-3 w-32 bg-muted animate-pulse rounded' />
      </CardContent>
    </Card>
  );
}
