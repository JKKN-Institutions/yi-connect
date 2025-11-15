'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MemberAnalytics } from '@/types/member';

interface LeadershipPipelineChartProps {
  analytics: MemberAnalytics;
}

export function LeadershipPipelineChart({ analytics }: LeadershipPipelineChartProps) {
  const pipeline = analytics.leadership_pipeline;
  const total = Object.values(pipeline).reduce((sum, count) => sum + count, 0);

  const stages = [
    { key: 'highly_ready', label: 'Highly Ready', color: 'bg-green-500', textColor: 'text-green-600' },
    { key: 'ready', label: 'Ready', color: 'bg-blue-500', textColor: 'text-blue-600' },
    { key: 'developing', label: 'Developing', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
    { key: 'not_ready', label: 'Not Ready', color: 'bg-gray-400', textColor: 'text-gray-600' }
  ];

  const maxCount = Math.max(...Object.values(pipeline));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leadership Pipeline</CardTitle>
        <CardDescription>
          Leadership readiness distribution across all members
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total > 0 ? (
          <div className='space-y-6'>
            {/* Summary Bar */}
            <div className='flex h-8 rounded-full overflow-hidden'>
              {stages.map((stage) => {
                const count = pipeline[stage.key as keyof typeof pipeline];
                const percentage = (count / total) * 100;

                if (percentage === 0) return null;

                return (
                  <div
                    key={stage.key}
                    className={`${stage.color} flex items-center justify-center text-xs font-medium text-white transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                    title={`${stage.label}: ${count} (${percentage.toFixed(1)}%)`}
                  >
                    {percentage > 10 && count}
                  </div>
                );
              })}
            </div>

            {/* Detailed Breakdown */}
            <div className='space-y-4'>
              {stages.map((stage) => {
                const count = pipeline[stage.key as keyof typeof pipeline];
                const percentage = (count / total) * 100;
                const barWidth = (count / maxCount) * 100;

                return (
                  <div key={stage.key} className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                        <span className='text-sm font-medium'>{stage.label}</span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <span className='text-sm font-medium'>{count}</span>
                        <span className='text-sm text-muted-foreground'>
                          ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className='h-2 bg-muted rounded-full overflow-hidden'>
                      <div
                        className={`h-full ${stage.color} transition-all duration-500`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Key Insights */}
            <div className='grid grid-cols-2 gap-4 pt-4 border-t'>
              <div className='text-center'>
                <div className='text-2xl font-bold text-green-600'>
                  {pipeline.highly_ready + pipeline.ready}
                </div>
                <div className='text-xs text-muted-foreground'>Ready for Leadership</div>
              </div>
              <div className='text-center'>
                <div className='text-2xl font-bold text-yellow-600'>
                  {pipeline.developing}
                </div>
                <div className='text-xs text-muted-foreground'>In Development</div>
              </div>
            </div>
          </div>
        ) : (
          <div className='text-center text-muted-foreground py-8'>
            No leadership pipeline data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
