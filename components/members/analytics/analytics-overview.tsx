'use client';

import { Users, UserCheck, UserPlus, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MemberAnalytics } from '@/types/member';

interface AnalyticsOverviewProps {
  analytics: MemberAnalytics;
}

export function AnalyticsOverview({ analytics }: AnalyticsOverviewProps) {
  const stats = [
    {
      title: 'Total Members',
      value: analytics.total_members,
      description: `${analytics.active_members} active`,
      icon: Users,
      color: 'text-blue-600'
    },
    {
      title: 'Active Members',
      value: analytics.active_members,
      description: `${Math.round((analytics.active_members / analytics.total_members) * 100)}% of total`,
      icon: UserCheck,
      color: 'text-green-600'
    },
    {
      title: 'New This Month',
      value: analytics.new_members_this_month,
      description: 'Joined in last 30 days',
      icon: UserPlus,
      color: 'text-purple-600'
    },
    {
      title: 'Avg Engagement',
      value: analytics.avg_engagement_score > 0 ? analytics.avg_engagement_score.toFixed(1) : 'N/A',
      description: 'Member engagement score',
      icon: TrendingUp,
      color: 'text-orange-600'
    }
  ];

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stat.value}</div>
              <p className='text-xs text-muted-foreground'>
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
