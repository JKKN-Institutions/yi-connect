'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MemberAnalytics } from '@/types/member';

interface MemberDistributionChartsProps {
  analytics: MemberAnalytics;
}

export function MemberDistributionCharts({ analytics }: MemberDistributionChartsProps) {
  const statusEntries = Object.entries(analytics.members_by_status)
    .sort(([, a], [, b]) => b - a);

  const cityEntries = Object.entries(analytics.members_by_city)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-gray-400';
      case 'suspended':
        return 'bg-red-500';
      case 'alumni':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const maxStatusCount = Math.max(...statusEntries.map(([, count]) => count));
  const maxCityCount = Math.max(...cityEntries.map(([, count]) => count));

  return (
    <>
      {/* Members by Status */}
      <Card>
        <CardHeader>
          <CardTitle>Members by Status</CardTitle>
          <CardDescription>
            Distribution of members across different membership statuses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {statusEntries.map(([status, count]) => {
              const percentage = (count / analytics.total_members) * 100;
              const barWidth = (count / maxStatusCount) * 100;

              return (
                <div key={status} className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline' className='capitalize'>
                        {status}
                      </Badge>
                    </div>
                    <div className='text-sm font-medium'>
                      {count} ({percentage.toFixed(1)}%)
                    </div>
                  </div>
                  <div className='h-2 bg-muted rounded-full overflow-hidden'>
                    <div
                      className={`h-full ${getStatusColor(status)} transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Members by City */}
      <Card>
        <CardHeader>
          <CardTitle>Members by City</CardTitle>
          <CardDescription>
            Top 10 cities with the most members
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cityEntries.length > 0 ? (
            <div className='space-y-4'>
              {cityEntries.map(([city, count]) => {
                const percentage = (count / analytics.total_members) * 100;
                const barWidth = (count / maxCityCount) * 100;

                return (
                  <div key={city} className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm font-medium'>{city}</span>
                      <span className='text-sm text-muted-foreground'>
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className='h-2 bg-muted rounded-full overflow-hidden'>
                      <div
                        className='h-full bg-blue-500 transition-all duration-500'
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className='text-center text-muted-foreground py-8'>
              No city data available
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
