/**
 * Dashboard Home Page
 *
 * Main dashboard overview with key metrics and quick actions.
 * Features role-based access control and chapter-aware content.
 */

import { Suspense } from 'react';
import { getUserProfile } from '@/lib/auth';
import { getMemberAnalytics } from '@/lib/data/members';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Calendar,
  Wallet,
  TrendingUp,
  Plus,
  UserPlus,
  Send,
  Award,
  Building2,
  BookOpen,
  AlertCircle,
  MapPin,
  Sparkles,
  Target,
  MessageCircle
} from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { WhatsAppGroupButton } from '@/components/whatsapp';

async function WelcomeSection() {
  const profile = await getUserProfile();
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  // Get chapter info
  const supabase = await createServerSupabaseClient();
  let chapterName = null;

  if (profile?.chapter_id) {
    const { data: chapter } = await supabase
      .from('chapters')
      .select('name')
      .eq('id', profile.chapter_id)
      .single();

    chapterName = chapter?.name;
  }

  const roles = profile?.roles?.map((r: any) => r.role_name) || [];
  const primaryRole = roles[0] || 'Member';

  return (
    <div className='space-y-3'>
      <div className='flex items-start justify-between flex-wrap gap-4'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight flex items-center gap-3'>
            <Sparkles className='h-8 w-8 text-primary' />
            Welcome back, {firstName}!
          </h1>
          <div className='flex items-center gap-2 mt-2 flex-wrap'>
            {chapterName ? (
              <p className='text-muted-foreground flex items-center gap-2'>
                <MapPin className='h-4 w-4' />
                <span className='font-medium'>{chapterName}</span>
              </p>
            ) : (
              <div className='flex items-center gap-2 text-amber-600'>
                <AlertCircle className='h-4 w-4' />
                <span className='text-sm'>No chapter assigned yet</span>
              </div>
            )}
            <span className='text-muted-foreground'>•</span>
            <Badge variant='secondary' className='font-normal'>
              {primaryRole}
            </Badge>
          </div>
        </div>

        {!chapterName && (
          <Button variant='outline' asChild>
            <Link href='/settings/profile'>
              Complete Your Profile
            </Link>
          </Button>
        )}
      </div>

      <p className='text-muted-foreground'>
        {chapterName
          ? "Here's what's happening with your chapter today."
          : 'Complete your profile to access all features.'}
      </p>
    </div>
  );
}

// Role-based Quick Actions Component
async function QuickActions() {
  const profile = await getUserProfile();
  const roles = profile?.roles?.map((r: any) => r.role_name) || [];

  const hasAdminAccess = roles.some((role: string) =>
    ['Super Admin', 'National Admin', 'Executive Member', 'Chair', 'Co-Chair', 'EC Member'].includes(role)
  );

  const hasLeadershipAccess = roles.some((role: string) =>
    ['Super Admin', 'National Admin', 'Executive Member', 'Chair', 'Co-Chair'].includes(role)
  );

  return (
    <div className='flex flex-wrap gap-3'>
      <Button asChild size='lg'>
        <Link href='/events/new'>
          <Plus className='mr-2 h-4 w-4' />
          New Event
        </Link>
      </Button>

      {hasLeadershipAccess && (
        <>
          <Button variant='outline' asChild size='lg'>
            <Link href='/members/new'>
              <UserPlus className='mr-2 h-4 w-4' />
              Add Member
            </Link>
          </Button>
          <Button variant='outline' asChild size='lg'>
            <Link href='/communications/announcements/new'>
              <Send className='mr-2 h-4 w-4' />
              Send Announcement
            </Link>
          </Button>
        </>
      )}

      {hasAdminAccess && (
        <Button variant='outline' asChild size='lg'>
          <Link href='/awards/nominate'>
            <Award className='mr-2 h-4 w-4' />
            Nominate for Award
          </Link>
        </Button>
      )}

      <Button variant='ghost' asChild size='lg'>
        <Link href='/knowledge/documents'>
          <BookOpen className='mr-2 h-4 w-4' />
          Browse Knowledge Base
        </Link>
      </Button>

      {hasLeadershipAccess && (
        <WhatsAppGroupButton
          label="Message Yi Group"
          variant="outline"
          size="lg"
          className="border-green-200 hover:bg-green-50"
        />
      )}
    </div>
  );
}

async function TotalMembersCard() {
  const profile = await getUserProfile();
  if (!profile?.chapter_id) {
    return (
      <MetricCard
        title='Total Members'
        value='—'
        description='Chapter not assigned'
        icon={Users}
        trend='neutral'
      />
    );
  }

  const analytics = await getMemberAnalytics(profile.chapter_id);

  return (
    <MetricCard
      title='Total Members'
      value={analytics.total_members.toString()}
      description={`+${analytics.new_members_this_month} this month`}
      icon={Users}
      trend={analytics.new_members_this_month > 0 ? 'up' : 'neutral'}
      href='/members'
    />
  );
}

async function UpcomingEventsCard() {
  const profile = await getUserProfile();
  const supabase = await createServerSupabaseClient();

  if (!profile?.chapter_id) {
    return (
      <MetricCard
        title='Upcoming Events'
        value='—'
        description='Chapter not assigned'
        icon={Calendar}
        trend='neutral'
      />
    );
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('chapter_id', profile.chapter_id)
    .gte('start_datetime', now.toISOString())
    .lte('start_datetime', thirtyDaysFromNow.toISOString());

  return (
    <MetricCard
      title='Upcoming Events'
      value={count?.toString() || '0'}
      description='Next 30 days'
      icon={Calendar}
      trend='neutral'
      href='/events'
    />
  );
}

async function BudgetUtilizationCard() {
  const profile = await getUserProfile();
  const supabase = await createServerSupabaseClient();

  if (!profile?.chapter_id) {
    return (
      <MetricCard
        title='Budget Utilization'
        value='—'
        description='Chapter not assigned'
        icon={Wallet}
        trend='neutral'
      />
    );
  }

  const { data: budgetData } = await supabase
    .from('budgets')
    .select('amount, spent_amount')
    .eq('chapter_id', profile.chapter_id)
    .gte('fiscal_year', new Date().getFullYear());

  const totalBudget = budgetData?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
  const totalSpent = budgetData?.reduce((sum, b) => sum + Number(b.spent_amount || 0), 0) || 0;
  const utilization = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <MetricCard
      title='Budget Utilization'
      value={`${utilization}%`}
      description={`₹${totalSpent.toLocaleString('en-IN')} of ₹${totalBudget.toLocaleString('en-IN')}`}
      icon={Wallet}
      trend={utilization > 80 ? 'up' : 'neutral'}
      href='/finance'
    />
  );
}

async function EngagementScoreCard() {
  const profile = await getUserProfile();
  const supabase = await createServerSupabaseClient();

  if (!profile?.chapter_id) {
    return (
      <MetricCard
        title='Engagement Score'
        value='—'
        description='Chapter not assigned'
        icon={TrendingUp}
        trend='neutral'
      />
    );
  }

  const { data } = await supabase
    .from('engagement_metrics')
    .select('overall_engagement_score')
    .eq('chapter_id', profile.chapter_id);

  const avgEngagement =
    data && data.length > 0
      ? Math.round(data.reduce((sum, m) => sum + (m.overall_engagement_score || 0), 0) / data.length)
      : 0;

  return (
    <MetricCard
      title='Engagement Score'
      value={`${avgEngagement}%`}
      description='Chapter average'
      icon={TrendingUp}
      trend={avgEngagement > 70 ? 'up' : avgEngagement > 40 ? 'neutral' : 'down'}
      href='/members/analytics'
    />
  );
}

export default function DashboardPage() {
  return (
    <div className='space-y-6'>
      {/* Welcome Section */}
      <Suspense
        fallback={
          <div className='space-y-3'>
            <div className='h-10 w-96 bg-muted animate-pulse rounded' />
            <div className='h-6 w-64 bg-muted animate-pulse rounded' />
          </div>
        }
      >
        <WelcomeSection />
      </Suspense>

      {/* Role-Based Quick Actions */}
      <Suspense
        fallback={
          <div className='flex gap-3'>
            <div className='h-12 w-32 bg-muted animate-pulse rounded' />
            <div className='h-12 w-32 bg-muted animate-pulse rounded' />
          </div>
        }
      >
        <QuickActions />
      </Suspense>

      {/* Metrics Grid */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Suspense fallback={<MetricCardSkeleton />}>
          <TotalMembersCard />
        </Suspense>
        <Suspense fallback={<MetricCardSkeleton />}>
          <UpcomingEventsCard />
        </Suspense>
        <Suspense fallback={<MetricCardSkeleton />}>
          <BudgetUtilizationCard />
        </Suspense>
        <Suspense fallback={<MetricCardSkeleton />}>
          <EngagementScoreCard />
        </Suspense>
      </div>

      {/* Module Overview Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <ModuleCard
          title='Stakeholder CRM'
          description='Manage relationships with schools, colleges, and partners'
          icon={Building2}
          href='/stakeholders'
          stats='Track engagement & health scores'
        />
        <ModuleCard
          title='Knowledge Base'
          description='Access documents, wiki pages, and best practices'
          icon={BookOpen}
          href='/knowledge'
          stats='Centralized repository'
        />
        <ModuleCard
          title='Verticals'
          description='Track vertical performance and rankings'
          icon={Target}
          href='/verticals'
          stats='Real-time KPI tracking'
        />
      </div>

      {/* Recent Activity & Upcoming Events */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Suspense fallback={<CardSkeleton />}>
          <RecentActivityCard />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <UpcomingEventsListCard />
        </Suspense>
      </div>
    </div>
  );
}

async function RecentActivityCard() {
  const profile = await getUserProfile();
  const supabase = await createServerSupabaseClient();

  if (!profile?.chapter_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates from your chapter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='text-center py-8 text-muted-foreground'>
            <AlertCircle className='h-12 w-12 mx-auto mb-3 opacity-50' />
            <p className='text-sm'>Chapter not assigned yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get recent events
  const { data: recentEvents } = await supabase
    .from('events')
    .select('name, start_datetime, category')
    .eq('chapter_id', profile.chapter_id)
    .order('created_at', { ascending: false })
    .limit(3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates from your chapter</CardDescription>
      </CardHeader>
      <CardContent>
        {recentEvents && recentEvents.length > 0 ? (
          <div className='space-y-4'>
            {recentEvents.map((event, i) => (
              <div key={i} className='flex items-start gap-3 pb-3 border-b last:border-0'>
                <Calendar className='h-5 w-5 text-muted-foreground mt-0.5' />
                <div className='flex-1 space-y-1'>
                  <p className='text-sm font-medium leading-none'>{event.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {new Date(event.start_datetime).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <Badge variant='outline'>{event.category}</Badge>
              </div>
            ))}
            <Button variant='link' asChild className='w-full mt-2'>
              <Link href='/events'>View all events</Link>
            </Button>
          </div>
        ) : (
          <div className='text-center py-8 text-muted-foreground'>
            <Calendar className='h-12 w-12 mx-auto mb-3 opacity-50' />
            <p>No recent activity</p>
            <p className='text-sm mt-1'>Activity will appear here once you start using the system</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function UpcomingEventsListCard() {
  const profile = await getUserProfile();
  const supabase = await createServerSupabaseClient();

  if (!profile?.chapter_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
          <CardDescription>Next events on your calendar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='text-center py-8 text-muted-foreground'>
            <AlertCircle className='h-12 w-12 mx-auto mb-3 opacity-50' />
            <p className='text-sm'>Chapter not assigned yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('id, name, start_datetime, location')
    .eq('chapter_id', profile.chapter_id)
    .gte('start_datetime', new Date().toISOString())
    .order('start_datetime', { ascending: true })
    .limit(3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Events</CardTitle>
        <CardDescription>Next events on your calendar</CardDescription>
      </CardHeader>
      <CardContent>
        {upcomingEvents && upcomingEvents.length > 0 ? (
          <div className='space-y-4'>
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className='flex items-start gap-3 pb-3 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors'
              >
                <Calendar className='h-5 w-5 text-primary mt-0.5' />
                <div className='flex-1 space-y-1'>
                  <p className='text-sm font-medium leading-none'>{event.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {new Date(event.start_datetime).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {event.location && (
                    <p className='text-xs text-muted-foreground flex items-center gap-1'>
                      <MapPin className='h-3 w-3' />
                      {event.location}
                    </p>
                  )}
                </div>
              </Link>
            ))}
            <Button variant='link' asChild className='w-full mt-2'>
              <Link href='/events'>View all events</Link>
            </Button>
          </div>
        ) : (
          <div className='text-center py-8 text-muted-foreground'>
            <Calendar className='h-12 w-12 mx-auto mb-3 opacity-50' />
            <p>No upcoming events</p>
            <Button variant='link' asChild className='mt-2'>
              <Link href='/events/new'>Create your first event</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  href
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
  href?: string;
}) {
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground';

  const content = (
    <>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        <p className={`text-xs ${trendColor}`}>{description}</p>
      </CardContent>
    </>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className='hover:bg-muted/50 transition-colors cursor-pointer'>{content}</Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}

function ModuleCard({
  title,
  description,
  icon: Icon,
  href,
  stats
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  stats: string;
}) {
  return (
    <Link href={href}>
      <Card className='hover:shadow-md hover:border-primary/50 transition-all cursor-pointer h-full'>
        <CardHeader>
          <div className='flex items-start justify-between'>
            <div className='space-y-1 flex-1'>
              <CardTitle className='text-base'>{title}</CardTitle>
              <CardDescription className='text-sm'>{description}</CardDescription>
            </div>
            <div className='h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center'>
              <Icon className='h-5 w-5 text-primary' />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className='text-xs text-muted-foreground'>{stats}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className='h-6 w-32 bg-muted animate-pulse rounded' />
        <div className='h-4 w-48 bg-muted animate-pulse rounded' />
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          <div className='h-4 w-full bg-muted animate-pulse rounded' />
          <div className='h-4 w-3/4 bg-muted animate-pulse rounded' />
          <div className='h-4 w-5/6 bg-muted animate-pulse rounded' />
        </div>
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
