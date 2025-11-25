import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Database,
  Users,
  Calendar,
  FileText,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { getCurrentChapterId, requireRole } from '@/lib/auth';
import { SyncStatusCard } from '@/components/national/sync-status-card';
import { SyncLogsTable } from '@/components/national/sync-logs-table';
import { ConflictsTable } from '@/components/national/conflicts-table';
import { ManualSyncButton } from '@/components/national/manual-sync-button';
import type { SyncHealthStatus, NationalDataConflict } from '@/types/national-integration';

export const metadata = {
  title: 'Sync Management | Yi Connect',
  description: 'Manage data synchronization with Yi National systems'
};

async function SyncDashboardContent() {
  // Require National Admin role
  await requireRole(['Super Admin', 'National Admin']);

  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Unable to load sync data</p>
        </CardContent>
      </Card>
    );
  }

  // Mock data for demonstration
  const mockHealth: SyncHealthStatus = {
    sync_enabled: true,
    connection_status: 'connected',
    health_score: 85,
    last_successful_sync: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    pending_conflicts: 2,
    consecutive_failures: 0,
    entities_synced: 1245,
    last_24h: {
      successful_syncs: 12,
      failed_syncs: 1,
      in_progress: 0,
      records_synced: 450,
      records_failed: 3
    }
  };

  const mockLogs = [
    {
      id: '1',
      sync_type: 'members' as const,
      direction: 'push' as const,
      status: 'completed' as const,
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + 45000).toISOString(),
      records_processed: 150,
      records_succeeded: 148,
      records_failed: 2,
      error_message: null
    },
    {
      id: '2',
      sync_type: 'events' as const,
      direction: 'pull' as const,
      status: 'completed' as const,
      started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 4 * 60 * 60 * 1000 + 30000).toISOString(),
      records_processed: 25,
      records_succeeded: 25,
      records_failed: 0,
      error_message: null
    },
    {
      id: '3',
      sync_type: 'benchmarks' as const,
      direction: 'pull' as const,
      status: 'failed' as const,
      started_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 6 * 60 * 60 * 1000 + 5000).toISOString(),
      records_processed: 0,
      records_succeeded: 0,
      records_failed: 0,
      error_message: 'Connection timeout'
    }
  ];

  const mockConflicts: NationalDataConflict[] = [];

  const entityStats = [
    { name: 'Members', icon: Users, synced: 450, pending: 5 },
    { name: 'Events', icon: Calendar, synced: 120, pending: 0 },
    { name: 'Documents', icon: FileText, synced: 340, pending: 2 },
    { name: 'Metrics', icon: Activity, synced: 890, pending: 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {entityStats.map((entity) => (
          <Card key={entity.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{entity.name}</CardTitle>
              <entity.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entity.synced}</div>
              <p className="text-xs text-muted-foreground">
                {entity.pending > 0 ? (
                  <span className="text-yellow-600">{entity.pending} pending sync</span>
                ) : (
                  'All synced'
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sync Status Card */}
        <div className="lg:col-span-1">
          <SyncStatusCard health={mockHealth} />

          {/* Manual Sync Button */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Manual Sync</CardTitle>
              <CardDescription>Trigger a manual synchronization</CardDescription>
            </CardHeader>
            <CardContent>
              <ManualSyncButton chapterId={chapterId} />
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Logs and Conflicts */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="logs">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="logs">
                <Activity className="h-4 w-4 mr-2" />
                Sync Logs
              </TabsTrigger>
              <TabsTrigger value="conflicts">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Conflicts ({mockHealth.pending_conflicts})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="logs" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Sync Activity</CardTitle>
                      <CardDescription>Last 20 synchronization operations</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/national/sync/history">View All</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <SyncLogsTable logs={mockLogs} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conflicts" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Data Conflicts</CardTitle>
                      <CardDescription>
                        Resolve conflicts between local and national data
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ConflictsTable conflicts={mockConflicts} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Configuration</CardTitle>
          <CardDescription>
            Configure which data is synchronized with Yi National
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/national/settings">
                <Settings className="h-4 w-4 mr-2" />
                Sync Settings
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/national/settings#entities">
                <Database className="h-4 w-4 mr-2" />
                Entity Mapping
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/national/settings#schedule">
                <Clock className="h-4 w-4 mr-2" />
                Sync Schedule
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/national/sync/history">
                <Activity className="h-4 w-4 mr-2" />
                Full History
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SyncDashboardSkeleton() {
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
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px] lg:col-span-2" />
      </div>
    </div>
  );
}

export default function SyncManagementPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync Management</h1>
          <p className="text-muted-foreground">
            Monitor and manage data synchronization with Yi National
          </p>
        </div>
        <Badge variant="outline" className="text-green-600">
          <Activity className="h-4 w-4 mr-1" />
          Connected
        </Badge>
      </div>

      <Suspense fallback={<SyncDashboardSkeleton />}>
        <SyncDashboardContent />
      </Suspense>
    </div>
  );
}
