'use client';

/**
 * Communication Analytics Charts Component
 * Client-side chart visualizations for communication performance metrics
 */

import {
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Cell,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { EngagementTrend, ChannelPerformance } from '@/types/communication';

// Chart color palette
const COLORS = {
  sent: '#3b82f6', // blue
  delivered: '#10b981', // green
  opened: '#f59e0b', // amber
  clicked: '#8b5cf6', // purple
  failed: '#ef4444', // red
  pending: '#6b7280', // gray
  bounced: '#ec4899', // pink
};

// Pie chart colors
const PIE_COLORS = [
  '#10b981', // green - delivered
  '#f59e0b', // amber - pending/sending
  '#ef4444', // red - failed
  '#6b7280', // gray - bounced
];

// Chart configs
const engagementConfig: ChartConfig = {
  sent: {
    label: 'Sent',
    color: COLORS.sent,
  },
  delivered: {
    label: 'Delivered',
    color: COLORS.delivered,
  },
  opened: {
    label: 'Opened',
    color: COLORS.opened,
  },
  clicked: {
    label: 'Clicked',
    color: COLORS.clicked,
  },
};

const deliveryConfig: ChartConfig = {
  delivered: {
    label: 'Delivered',
    color: COLORS.delivered,
  },
  failed: {
    label: 'Failed',
    color: COLORS.failed,
  },
  pending: {
    label: 'Pending',
    color: COLORS.pending,
  },
  bounced: {
    label: 'Bounced',
    color: COLORS.bounced,
  },
};

interface EngagementOverTimeChartProps {
  data: EngagementTrend[];
}

interface DeliverySuccessRateChartProps {
  data: ChannelPerformance[];
}

/**
 * Engagement Over Time Chart
 * Line chart showing sent, delivered, opened, clicked metrics over time
 */
export function EngagementOverTimeChart({ data }: EngagementOverTimeChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No engagement data available
      </div>
    );
  }

  // Format data for chart - ensure dates are formatted nicely
  const chartData = data.map((item) => ({
    date: formatDateLabel(item.date),
    fullDate: item.date,
    sent: item.sent,
    delivered: item.delivered,
    opened: item.opened,
    clicked: item.clicked,
    engagementRate: item.engagement_rate,
  }));

  return (
    <ChartContainer config={engagementConfig} className="h-[300px] w-full">
      <AreaChart data={chartData} margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
        <defs>
          <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.sent} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.sent} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="deliveredGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.delivered} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.delivered} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="openedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.opened} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.opened} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="clickedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.clicked} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.clicked} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                return item?.fullDate
                  ? new Date(item.fullDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '';
              }}
            />
          }
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="sent"
          name="Sent"
          stroke={COLORS.sent}
          strokeWidth={2}
          fill="url(#sentGradient)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="delivered"
          name="Delivered"
          stroke={COLORS.delivered}
          strokeWidth={2}
          fill="url(#deliveredGradient)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="opened"
          name="Opened"
          stroke={COLORS.opened}
          strokeWidth={2}
          fill="url(#openedGradient)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="clicked"
          name="Clicked"
          stroke={COLORS.clicked}
          strokeWidth={2}
          fill="url(#clickedGradient)"
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/**
 * Delivery Success Rate Chart
 * Donut chart showing delivery breakdown across all channels
 */
export function DeliverySuccessRateChart({ data }: DeliverySuccessRateChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No delivery data available
      </div>
    );
  }

  // Aggregate totals across all channels
  const totals = data.reduce(
    (acc, channel) => {
      acc.delivered += channel.delivered;
      acc.failed += channel.failed;
      acc.total_sent += channel.total_sent;
      return acc;
    },
    { delivered: 0, failed: 0, total_sent: 0 }
  );

  // Calculate pending (sent but not delivered or failed)
  const pending = totals.total_sent - totals.delivered - totals.failed;

  const chartData = [
    {
      name: 'Delivered',
      value: totals.delivered,
      fill: COLORS.delivered,
    },
    {
      name: 'Pending',
      value: pending > 0 ? pending : 0,
      fill: COLORS.pending,
    },
    {
      name: 'Failed',
      value: totals.failed,
      fill: COLORS.failed,
    },
  ].filter((item) => item.value > 0); // Only show segments with values

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  // If no data to show
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No delivery data available
      </div>
    );
  }

  // Calculate delivery rate
  const deliveryRate =
    totals.total_sent > 0
      ? Math.round((totals.delivered / totals.total_sent) * 100)
      : 0;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            labelLine={true}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <ChartTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Count: {item.value.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {((item.value / total) * 100).toFixed(1)}% of total
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => <span className="text-sm">{value}</span>}
          />
          {/* Center text showing delivery rate */}
          <text
            x="50%"
            y="48%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-2xl font-bold"
          >
            {deliveryRate}%
          </text>
          <text
            x="50%"
            y="56%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-xs"
          >
            Delivery Rate
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Helper function to format date labels for the chart
 */
function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
}
