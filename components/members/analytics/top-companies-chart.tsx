'use client';

import { Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MemberAnalytics } from '@/types/member';

interface TopCompaniesChartProps {
  analytics: MemberAnalytics;
}

export function TopCompaniesChart({ analytics }: TopCompaniesChartProps) {
  const topCompanies = analytics.top_companies;
  const maxCount = topCompanies.length > 0 ? topCompanies[0].count : 0;

  return (
    <Card className='md:col-span-2'>
      <CardHeader>
        <CardTitle>Top Companies</CardTitle>
        <CardDescription>
          Companies with the most Yi members
        </CardDescription>
      </CardHeader>
      <CardContent>
        {topCompanies.length > 0 ? (
          <div className='space-y-4'>
            {topCompanies.map((company, index) => {
              const barWidth = (company.count / maxCount) * 100;
              const colors = [
                'bg-blue-500',
                'bg-purple-500',
                'bg-pink-500',
                'bg-indigo-500',
                'bg-cyan-500',
                'bg-teal-500',
                'bg-emerald-500',
                'bg-lime-500',
                'bg-amber-500',
                'bg-orange-500'
              ];

              return (
                <div key={company.company} className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-medium text-muted-foreground w-6'>
                        #{index + 1}
                      </span>
                      <Building2 className='h-4 w-4 text-muted-foreground' />
                      <span className='text-sm font-medium'>{company.company}</span>
                    </div>
                    <span className='text-sm font-medium'>
                      {company.count} member{company.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className='h-2 bg-muted rounded-full overflow-hidden'>
                    <div
                      className={`h-full ${colors[index % colors.length]} transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className='text-center text-muted-foreground py-8'>
            No company data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
