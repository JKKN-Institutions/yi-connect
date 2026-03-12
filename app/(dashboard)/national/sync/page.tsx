import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  AlertTriangle,
  Database,
  Users,
  Calendar,
  FileText,
  Clock,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { getCurrentChapterId, requireRole } from '@/lib/auth';
import { getSyncHealth, getSyncLogs, getDataConflicts } from '@/lib/data/national-integration';
import { SyncStatusCard } from '@/components/national/sync-status-card';
import { SyncLogsTable } from '@/components/national/sync-logs-table';
import { ConflictsTable } from '@/components/national/conflicts-table';
import { ManualSyncButton } from '@/components/national/manual-sync-button';
import type { SyncHealthStatus } from '@/types/national-integration';

export const metadata = {
  title: 'Sync Management | Yi Connect',
  description: 'Manage data synchronization with Yi National systems'
};

// Default health when no sync config exists yet
const defaultHealth: SyncHealthStatus = {
  sync_enabled: false,
  connection_status: 'disconnected',
  last_successful_sync: null,
  consecutive_failures: 0,
  last_24h: {
    successful_syncs: 0,
    failed_syncs: 0,
    in_progress: 0,
    records_synced: 0,
    records_failed: 0
  },
  pending_conflicts: 0,
  entities_synced: 0,
  health_score: 0
};

// Map data layer sync direction values to what the SyncLogsTable component expects
function mapDirection(direction: string): 'push' | 'pull' | 'bidirectional' {
  switch (direction) {
    case 'outbound':
      return 'push';
    case 'inbound':
      return 'pull';
    case 'bidirectional':
      return 'bidirectional';
    default:
      return 'push';
  }
}

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

  // Fetch real data from the database
  const [healthData, syncLogsData, conflictsData] = await Promise.all([
    getSyncHealth(chapterId),
    getSyncLogs(undefined, 1, 20, chapterId),
    getDataConflicts(undefined, chapterId)
  ]);

  const health = healthData || defaultHealth;
  const syncLogs = syncLogsData.data;
  const conflicts = conflictsData;

  // Transform sync logs to match the SyncLogsTable component interface
  const logsForTable = syncLogs.map((log) => ({
    id: log.id,
    sync_type: log.sync_type,
    direction: mapDirection(log.sync_direction),
    status: log.status as 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial',
    started_at: log.started_at,
    completed_at: log.completed_at,
    records_processed: log.records_processed,
    records_succeeded: log.records_succeeded,
    records_failed: log.records_failed,
    error_message: log.error_message
  }));

  // Compute entity stats from sync logs
  const entityStats = [
    {
      name: 'Members',
      icon: Users,
      synced: syncLogs
        .filter((l) => l.sync_type === 'members' && l.status === 'completed')
        .reduce((sum, l) => sum + l.records_succeeded, 0),
      pending: syncLogs
        .filter((l) => l.sync_type === 'members' && (l.status === 'pending' || l.status === 'in_progress'))
        .length
    },
    {
      name: 'Events',
      icon: Calendar,
      synced: syncLogs
        .filter((l) => l.sync_type === 'events' && l.status === 'completed')
        .reduce((sum, l) => sum + l.records_succeeded, 0),
      pending: syncLogs
        .filter((l) => l.sync_type === 'events' && (l.status === 'pending' || l.status === 'in_progress'))
        .length
    },
    {
      name: 'Documents',
      icon: FileText,
      synced: syncLogs
        .filter((l) => l.sync_type === 'projects' && l.status === 'completed')
        .reduce((sum, l) => sum + l.records_succeeded, 0),
      pending: syncLogs
        .filter((l) => l.sync_type === 'projects' && (l.status === 'pending' || l.status === 'in_progress'))
        .length
    },
    {
      name: 'Metrics',
      icon: Activity,
      synced: health.entities_synced,
      pending: 0
    }
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
          <SyncStatusCard health={health} />

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
                Conflicts ({health.pending_conflicts})
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
                  <SyncLogsTable logs={logsForTable} />
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
                  <ConflictsTable conflicts={conflicts} />
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
      </div>

      <Suspense fallback={<SyncDashboardSkeleton />}>
        <SyncDashboardContent />
      </Suspense>
    </div>
  );
}
