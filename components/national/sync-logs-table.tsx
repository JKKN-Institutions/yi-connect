'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface SyncLog {
  id: string;
  sync_type: string;
  direction: 'push' | 'pull' | 'bidirectional';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
  started_at: string;
  completed_at: string | null;
  records_processed: number;
  records_succeeded: number;
  records_failed: number;
  error_message: string | null;
}

interface SyncLogsTableProps {
  logs: SyncLog[];
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  partial: <AlertTriangle className="h-4 w-4 text-yellow-500" />
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  partial: 'bg-yellow-100 text-yellow-800'
};

const directionIcons: Record<string, React.ReactNode> = {
  push: <ArrowUp className="h-4 w-4" />,
  pull: <ArrowDown className="h-4 w-4" />,
  bidirectional: (
    <div className="flex flex-col">
      <ArrowUp className="h-3 w-3" />
      <ArrowDown className="h-3 w-3" />
    </div>
  )
};

const syncTypeLabels: Record<string, string> = {
  members: 'Members',
  events: 'Events',
  benchmarks: 'Benchmarks',
  leadership: 'Leadership',
  broadcasts: 'Broadcasts',
  documents: 'Documents',
  all: 'Full Sync'
};

export function SyncLogsTable({ logs }: SyncLogsTableProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No sync logs available
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Direction</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Records</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="font-medium">
              {syncTypeLabels[log.sync_type] || log.sync_type}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {directionIcons[log.direction]}
                <span className="capitalize text-sm text-muted-foreground">
                  {log.direction}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {statusIcons[log.status]}
                <Badge className={statusColors[log.status]}>
                  {log.status}
                </Badge>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-col items-end">
                <span className="text-green-600">{log.records_succeeded} ok</span>
                {log.records_failed > 0 && (
                  <span className="text-red-600 text-xs">
                    {log.records_failed} failed
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-sm">
                  {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
                </span>
                {log.completed_at && (
                  <span className="text-xs text-muted-foreground">
                    Duration:{' '}
                    {Math.round(
                      (new Date(log.completed_at).getTime() -
                        new Date(log.started_at).getTime()) /
                        1000
                    )}s
                  </span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
