'use client';

import { useState, useTransition } from 'react';
import { Zap, CheckCircle2, AlertTriangle, Loader2, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { completeEventAndTriggerAutopilot, triggerEventAutoPilot } from '@/app/actions/autopilot';
import type { EventAutopilotRun, AutopilotStatus } from '@/types/autopilot';

interface AutoPilotPanelProps {
  eventId: string;
  eventStatus: string;
  featureEnabled: boolean;
  latestRun: EventAutopilotRun | null;
  canManage: boolean;
}

function statusBadgeVariant(
  status: AutopilotStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'partial':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

const STEP_LABELS: Record<string, string> = {
  feedback_reminder_sent: 'Feedback reminder',
  stats_computed: 'Stats computed',
  health_card_created: 'AAA health card draft',
  points_awarded: 'Engagement points',
  summary_emailed: 'Chair summary email',
  report_flagged: 'Flagged for report',
};

export function AutoPilotPanel({
  eventId,
  eventStatus,
  featureEnabled,
  latestRun,
  canManage,
}: AutoPilotPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [runResult, setRunResult] = useState<EventAutopilotRun | null>(latestRun);

  if (!canManage) return null;

  const isCompleted = eventStatus === 'completed';

  const handleRunNow = () => {
    startTransition(async () => {
      const result = isCompleted
        ? await triggerEventAutoPilot(eventId)
        : await completeEventAndTriggerAutopilot(eventId);
      if (!result.success) {
        toast.error(result.error || 'Auto-Pilot run failed');
        return;
      }
      toast.success(
        result.status === 'completed'
          ? 'Auto-Pilot finished all steps'
          : result.status === 'partial'
          ? 'Auto-Pilot completed with some issues — check the log'
          : 'Auto-Pilot triggered'
      );
      if (result.run_id && result.status) {
        setRunResult({
          id: result.run_id,
          event_id: eventId,
          chapter_id: '',
          triggered_at: new Date().toISOString(),
          triggered_by: null,
          status: result.status,
          steps_completed: result.steps_completed || {},
          error_log: null,
          completed_at: new Date().toISOString(),
        });
      }
    });
  };

  return (
    <Card className='border-0 shadow-sm overflow-hidden'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-lg flex items-center gap-2'>
          <div className='w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center'>
            <Zap className='h-4 w-4 text-amber-600 dark:text-amber-400' />
          </div>
          Event Auto-Pilot
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {!featureEnabled && (
          <div className='flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm'>
            <AlertTriangle className='h-4 w-4 text-amber-600 mt-0.5 shrink-0' />
            <div>
              <div className='font-medium'>Auto-Pilot is off for this chapter</div>
              <div className='text-muted-foreground text-xs mt-0.5'>
                A Chair can enable it in{' '}
                <a href='/settings/event-autopilot' className='underline'>
                  Settings → Event Auto-Pilot
                </a>
                .
              </div>
            </div>
          </div>
        )}

        {featureEnabled && (
          <>
            <p className='text-sm text-muted-foreground'>
              Marks this event complete, sends feedback reminders, drafts a health
              card entry, awards attendance points, and emails you a summary.
            </p>

            {runResult && (
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs uppercase tracking-wider text-muted-foreground font-medium'>
                    Last run
                  </span>
                  <Badge variant={statusBadgeVariant(runResult.status)}>
                    {runResult.status}
                  </Badge>
                </div>
                <div className='text-xs text-muted-foreground'>
                  {new Date(runResult.triggered_at).toLocaleString('en-IN')}
                </div>
                <div className='grid gap-1.5 mt-2'>
                  {Object.keys(STEP_LABELS).map((key) => {
                    const done =
                      (runResult.steps_completed as Record<string, boolean | undefined>)[
                        key
                      ] === true;
                    return (
                      <div
                        key={key}
                        className='flex items-center gap-2 text-xs'
                      >
                        {done ? (
                          <CheckCircle2 className='h-3.5 w-3.5 text-green-600' />
                        ) : (
                          <span className='h-3.5 w-3.5 rounded-full border border-muted-foreground/30 inline-block' />
                        )}
                        <span className={done ? '' : 'text-muted-foreground'}>
                          {STEP_LABELS[key]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {runResult.error_log && (
                  <div className='text-xs text-red-600 bg-red-50 dark:bg-red-950/30 p-2 rounded mt-2'>
                    {runResult.error_log}
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleRunNow}
              disabled={isPending}
              className='w-full'
              variant={runResult ? 'outline' : 'default'}
            >
              {isPending ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Running…
                </>
              ) : (
                <>
                  <PlayCircle className='h-4 w-4 mr-2' />
                  {isCompleted ? 'Run Auto-Pilot again' : 'Complete & run Auto-Pilot'}
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
