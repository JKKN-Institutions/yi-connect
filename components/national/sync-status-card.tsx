'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock
} from 'lucide-react';
import type { SyncHealthStatus } from '@/types/national-integration';
import { formatDistanceToNow } from 'date-fns';

interface SyncStatusCardProps {
  health: SyncHealthStatus;
  onRefresh?: () => void;
}

export function SyncStatusCard({ health, onRefresh }: SyncStatusCardProps) {
  const getStatusIcon = () => {
    if (!health.sync_enabled) {
      return <WifiOff className="h-5 w-5 text-muted-foreground" />;
    }
    switch (health.connection_status) {
      case 'connected':
        return <Wifi className="h-5 w-5 text-green-500" />;
      case 'unstable':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <WifiOff className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getHealthColor = () => {
    if (health.health_score >= 80) return 'text-green-500';
    if (health.health_score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthLabel = () => {
    if (health.health_score >= 80) return 'Healthy';
    if (health.health_score >= 50) return 'Warning';
    return 'Critical';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {onRefresh && (
            <Button variant="ghost" size="icon" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Health Score */}
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{health.health_score}%</span>
            <Badge
              variant={
                health.health_score >= 80
                  ? 'default'
                  : health.health_score >= 50
                    ? 'secondary'
                    : 'destructive'
              }
            >
              {getHealthLabel()}
            </Badge>
          </div>
          <Progress value={health.health_score} className="h-2" />

          {/* Status Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">Connection</p>
              <p className="font-medium capitalize">
                {health.connection_status}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Sync Status</p>
              <p className="font-medium">
                {health.sync_enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>

          {/* Last 24h Stats */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Last 24 Hours</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mb-1" />
                <p className="text-lg font-semibold">
                  {health.last_24h.successful_syncs}
                </p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-lg p-2">
                <XCircle className="h-4 w-4 text-red-500 mx-auto mb-1" />
                <p className="text-lg font-semibold">
                  {health.last_24h.failed_syncs}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-2">
                <Activity className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-semibold">
                  {health.last_24h.in_progress}
                </p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </div>

          {/* Last Sync Time */}
          {health.last_successful_sync && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Last sync:{' '}
                {formatDistanceToNow(new Date(health.last_successful_sync), {
                  addSuffix: true
                })}
              </span>
            </div>
          )}

          {/* Alerts */}
          {health.pending_conflicts > 0 && (
            <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950 p-2 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span>{health.pending_conflicts} conflicts need resolution</span>
            </div>
          )}

          {health.consecutive_failures > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded-lg">
              <XCircle className="h-4 w-4" />
              <span>{health.consecutive_failures} consecutive failures</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
