/**
 * Industry Portal Dashboard
 * Main dashboard for industry users to manage their IV slots
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import {
  CalendarPlus,
  Users,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import {
  getIndustryDashboardStats,
  getIndustryUpcomingSlots
} from '@/lib/data/industrial-visits';

export const metadata: Metadata = {
  title: 'Industry Portal Dashboard | Yi Connect',
  description: 'Manage your industrial visit slots and view analytics'
};

// Temporary helper to get industry ID from auth
// TODO: Replace with proper industry authentication
async function getCurrentIndustryId(): Promise<string | null> {
  // For now, return a placeholder
  // In production, this would check auth.uid() and get the industry_id from industry_portal_users table
  return 'placeholder-industry-id';
}

async function IndustryDashboardContent() {
  const industryId = await getCurrentIndustryId();

  if (!industryId) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <p className='text-muted-foreground'>
          You need to be authenticated as an industry user to access this
          portal.
        </p>
      </div>
    );
  }

  const [stats, upcomingSlots] = await Promise.all([
    getIndustryDashboardStats(industryId),
    getIndustryUpcomingSlots(industryId)
  ]);

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Industry Portal</h1>
          <p className='text-muted-foreground mt-1'>
            Manage your industrial visit slots and track engagement
          </p>
        </div>
        <Button asChild>
          <Link href='/industry-portal/slots/new'>
            <CalendarPlus className='mr-2 h-4 w-4' />
            Create New Slot
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Slots</CardTitle>
            <Calendar className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.total_slots}</div>
            <p className='text-xs text-muted-foreground mt-1'>
              {stats.upcoming_slots} upcoming
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Participants
            </CardTitle>
            <Users className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.total_participants}</div>
            <p className='text-xs text-muted-foreground mt-1'>
              Across all slots
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Avg. Utilization
            </CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats.avg_capacity_utilization}%
            </div>
            <Progress
              value={stats.avg_capacity_utilization}
              className='mt-2 h-2'
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Pending Bookings
            </CardTitle>
            <Clock className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.pending_bookings}</div>
            <p className='text-xs text-muted-foreground mt-1'>
              Awaiting confirmation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks to manage your industrial visits
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-3'>
          <Button
            asChild
            variant='outline'
            className='h-auto flex-col items-start p-4'
          >
            <Link href='/industry-portal/slots/new'>
              <CalendarPlus className='h-5 w-5 mb-2' />
              <div className='text-left'>
                <div className='font-medium'>Create New Slot</div>
                <div className='text-xs text-muted-foreground mt-1'>
                  Add a new industrial visit opportunity
                </div>
              </div>
            </Link>
          </Button>

          <Button
            asChild
            variant='outline'
            className='h-auto flex-col items-start p-4'
          >
            <Link href='/industry-portal/slots'>
              <Calendar className='h-5 w-5 mb-2' />
              <div className='text-left'>
                <div className='font-medium'>Manage Slots</div>
                <div className='text-xs text-muted-foreground mt-1'>
                  View and edit your existing slots
                </div>
              </div>
            </Link>
          </Button>

          <Button
            asChild
            variant='outline'
            className='h-auto flex-col items-start p-4'
          >
            <Link href='/industry-portal/attendees'>
              <Users className='h-5 w-5 mb-2' />
              <div className='text-left'>
                <div className='font-medium'>View Attendees</div>
                <div className='text-xs text-muted-foreground mt-1'>
                  See who&apos;s registered for your slots
                </div>
              </div>
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Upcoming Slots */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Upcoming Slots</CardTitle>
              <CardDescription>
                Your next industrial visit opportunities
              </CardDescription>
            </div>
            <Button asChild variant='outline' size='sm'>
              <Link href='/industry-portal/slots'>View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingSlots.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              <Calendar className='h-12 w-12 mx-auto mb-4 opacity-50' />
              <p className='font-medium mb-2'>No upcoming slots</p>
              <p className='text-sm mb-4'>
                Create your first industrial visit slot to get started
              </p>
              <Button asChild>
                <Link href='/industry-portal/slots/new'>
                  <CalendarPlus className='mr-2 h-4 w-4' />
                  Create New Slot
                </Link>
              </Button>
            </div>
          ) : (
            <div className='space-y-4'>
              {upcomingSlots.slice(0, 5).map((slot) => {
                const capacityPercentage = Math.round(
                  (slot.current_registrations / slot.max_capacity) * 100
                );
                const spotsRemaining =
                  slot.max_capacity - slot.current_registrations;

                return (
                  <div
                    key={slot.id}
                    className='flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors'
                  >
                    <div className='flex-1'>
                      <div className='flex items-center gap-2 mb-1'>
                        <h4 className='font-medium'>{slot.title}</h4>
                        <Badge
                          variant={
                            slot.status === 'published'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {slot.status}
                        </Badge>
                      </div>
                      <div className='flex items-center gap-4 text-sm text-muted-foreground'>
                        <div className='flex items-center gap-1'>
                          <Calendar className='h-3 w-3' />
                          {format(new Date(slot.start_date), 'MMM d, yyyy')}
                        </div>
                        <div className='flex items-center gap-1'>
                          <Users className='h-3 w-3' />
                          {slot.current_registrations} / {slot.max_capacity}
                        </div>
                      </div>
                      <Progress
                        value={capacityPercentage}
                        className='mt-2 h-1.5'
                      />
                    </div>
                    <div className='flex items-center gap-2 ml-4'>
                      {spotsRemaining > 0 ? (
                        <Badge variant='outline' className='text-xs'>
                          <CheckCircle2 className='mr-1 h-3 w-3' />
                          {spotsRemaining} spots left
                        </Badge>
                      ) : (
                        <Badge variant='secondary' className='text-xs'>
                          <XCircle className='mr-1 h-3 w-3' />
                          Full
                        </Badge>
                      )}
                      <Button asChild variant='ghost' size='sm'>
                        <Link href={`/industry-portal/slots/${slot.id}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips & Help */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Tips for managing your industrial visits
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex gap-3'>
            <div className='h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5'>
              <span className='text-xs font-medium text-primary'>1</span>
            </div>
            <div>
              <p className='font-medium text-sm'>Create Your First Slot</p>
              <p className='text-xs text-muted-foreground'>
                Set up an industrial visit opportunity with date, capacity, and
                details
              </p>
            </div>
          </div>
          <div className='flex gap-3'>
            <div className='h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5'>
              <span className='text-xs font-medium text-primary'>2</span>
            </div>
            <div>
              <p className='font-medium text-sm'>
                Yi Chapter Members Will Book
              </p>
              <p className='text-xs text-muted-foreground'>
                Members can view and book your slots from the marketplace
              </p>
            </div>
          </div>
          <div className='flex gap-3'>
            <div className='h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5'>
              <span className='text-xs font-medium text-primary'>3</span>
            </div>
            <div>
              <p className='font-medium text-sm'>Manage Attendees</p>
              <p className='text-xs text-muted-foreground'>
                View registrations, export attendee lists, and increase capacity
                if needed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IndustryDashboardLoading() {
  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <Skeleton className='h-9 w-64' />
          <Skeleton className='h-4 w-96 mt-2' />
        </div>
        <Skeleton className='h-10 w-40' />
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className='h-28 rounded-lg' />
        ))}
      </div>

      <Skeleton className='h-64 rounded-lg' />
      <Skeleton className='h-96 rounded-lg' />
    </div>
  );
}

export default function IndustryPortalDashboardPage() {
  return (
    <Suspense fallback={<IndustryDashboardLoading />}>
      <IndustryDashboardContent />
    </Suspense>
  );
}
