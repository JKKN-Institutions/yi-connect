import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  BarChart3,
  Calendar,
  Bell,
  AlertTriangle,
  ArrowRight,
  Globe,
  TrendingUp,
  Users,
  Building
} from 'lucide-react';
import Link from 'next/link';
import { getNationalDashboardData, getUpcomingNationalEvents } from '@/lib/data/national-integration';
import { getCurrentChapterId, getCurrentMemberId, requireRole } from '@/lib/auth';
import { SyncStatusCard } from '@/components/national/sync-status-card';
import { NationalEventsList } from '@/components/national/national-events-list';
import { ChaptersStatusGrid, PendingInvitationsCard } from '@/components/national/multi-chapter-overview';

export const metadata = {
  title: 'National Integration | Yi Connect',
  description: 'Yi National integration dashboard'
};

async function DashboardContent() {
  // Require National Admin role
  await requireRole(['Super Admin', 'National Admin']);

  const [chapterId, memberId] = await Promise.all([
    getCurrentChapterId(),
    getCurrentMemberId()
  ]);

  const dashboardData = await getNationalDashboardData(chapterId!, memberId!);

  if (!dashboardData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Globe className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            National integration not configured
          </p>
          <Button asChild className="mt-4">
            <Link href="/national/settings">Configure Integration</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Multi-Chapter Overview (New) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChaptersStatusGrid />
        <PendingInvitationsCard />
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.sync_health.health_score}%
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.sync_health.sync_enabled
                ? `${dashboardData.sync_health.entities_synced} entities synced`
                : 'Sync disabled'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Benchmark Ranking
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.benchmark_summary.average_percentile.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.benchmark_summary.overall_tier.replace('_', ' ')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Event Registrations
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.event_stats.total_registrations}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.event_stats.upcoming_events} upcoming events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread Broadcasts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.unread_broadcasts}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.pending_conflicts > 0 && (
                <span className="text-yellow-600">
                  {dashboardData.pending_conflicts} conflicts pending
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sync Status */}
        <div className="lg:col-span-1">
          <SyncStatusCard health={dashboardData.sync_health} />
        </div>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Sync Activity</CardTitle>
                <CardDescription>Last 10 sync operations</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/national/sync">
                  View All
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dashboardData.recent_sync_logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No sync activity yet
              </p>
            ) : (
              <div className="space-y-3">
                {dashboardData.recent_sync_logs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          log.status === 'completed'
                            ? 'default'
                            : log.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {log.status}
                      </Badge>
                      <span className="capitalize">{log.sync_type}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {log.records_succeeded} synced
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming National Events
              </CardTitle>
              <CardDescription>
                Register for RCMs, Summits, and Conclaves
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/national/events">
                View All Events
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <NationalEventsList
            events={dashboardData.upcoming_events}
            showActions={true}
          />
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:bg-muted/50 transition-colors">
          <Link href="/national/benchmarks">
            <CardContent className="flex items-center gap-4 p-6">
              <BarChart3 className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Benchmarks</h3>
                <p className="text-sm text-muted-foreground">
                  Compare chapter performance
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:bg-muted/50 transition-colors">
          <Link href="/national/broadcasts">
            <CardContent className="flex items-center gap-4 p-6">
              <Bell className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Broadcasts</h3>
                <p className="text-sm text-muted-foreground">
                  National communications
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:bg-muted/50 transition-colors">
          <Link href="/national/settings">
            <CardContent className="flex items-center gap-4 p-6">
              <Globe className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Configure integration
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px] lg:col-span-2" />
      </div>
    </div>
  );
}

export default function NationalIntegrationPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            National Integration
          </h1>
          <p className="text-muted-foreground">
            Connect with Yi National systems and benchmarks
          </p>
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
