'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatCurrency } from '@/types/finance';

export interface TierRevenueDatum {
  tier_level: 'platinum' | 'gold' | 'silver' | 'bronze' | 'supporter';
  tier_label: string;
  revenue: number;
  deal_count: number;
}

const TIER_COLORS: Record<TierRevenueDatum['tier_level'], string> = {
  platinum: '#6366F1',
  gold: '#EAB308',
  silver: '#94A3B8',
  bronze: '#B45309',
  supporter: '#3B82F6',
};

const chartConfig = {
  revenue: {
    label: 'Received Revenue',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export function TierRevenueCard({ data }: { data: TierRevenueDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.revenue, 0);
  const hasData = total > 0;

  return (
    <Card>
      <CardHeader>
        <div className='flex items-start justify-between gap-2'>
          <div>
            <CardTitle>Revenue by Tier</CardTitle>
            <CardDescription>
              Sponsorship payments received, grouped by tier level.
            </CardDescription>
          </div>
          <div className='text-right'>
            <p className='text-xs text-muted-foreground uppercase'>Total</p>
            <p className='text-xl font-bold'>{formatCurrency(total)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className='flex h-[220px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground'>
            No sponsorship payments recorded yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className='h-[260px] w-full'>
            <BarChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray='3 3' />
              <XAxis
                dataKey='tier_label'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 100000
                    ? `₹${(v / 100000).toFixed(1)}L`
                    : v >= 1000
                      ? `₹${(v / 1000).toFixed(0)}K`
                      : `₹${v}`
                }
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const datum = item?.payload as TierRevenueDatum | undefined;
                      return [
                        formatCurrency(Number(value)),
                        datum
                          ? `${datum.tier_label} · ${datum.deal_count} deal${
                              datum.deal_count === 1 ? '' : 's'
                            }`
                          : name,
                      ];
                    }}
                  />
                }
              />
              <Bar dataKey='revenue' radius={[6, 6, 0, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.tier_level} fill={TIER_COLORS[entry.tier_level]} />
                ))}
                <LabelList
                  dataKey='revenue'
                  position='top'
                  formatter={(v: number) =>
                    v > 0 ? (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${Math.round(v / 1000)}K`) : ''
                  }
                  className='fill-foreground text-xs'
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
