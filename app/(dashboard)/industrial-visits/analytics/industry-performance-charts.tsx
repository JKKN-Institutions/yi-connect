'use client';

/**
 * Industry Performance Charts Component
 * Client-side chart visualizations for industry performance metrics
 */

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { IndustryPerformance } from '@/types/industrial-visit';

// Chart color palette
const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const FALLBACK_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

type ChartType = 'top-industries' | 'categories' | 'trends';

interface TopIndustriesData extends IndustryPerformance {}

interface CategoryData {
  sector: string;
  count: number;
  participants: number;
}

interface TrendsData {
  month: string;
  visits: number;
  participants: number;
}

type ChartData = TopIndustriesData[] | CategoryData[] | TrendsData[];

interface IndustryPerformanceChartsProps {
  type: ChartType;
  data: ChartData;
}

// Chart configs
const topIndustriesConfig: ChartConfig = {
  visits: {
    label: 'Total Visits',
    color: 'hsl(var(--chart-1))',
  },
  participants: {
    label: 'Participants',
    color: 'hsl(var(--chart-2))',
  },
};

const categoriesConfig: ChartConfig = {
  count: {
    label: 'Visits',
    color: 'hsl(var(--chart-1))',
  },
};

const trendsConfig: ChartConfig = {
  visits: {
    label: 'Visits',
    color: 'hsl(var(--chart-1))',
  },
  participants: {
    label: 'Participants',
    color: 'hsl(var(--chart-2))',
  },
};

export function IndustryPerformanceCharts({ type, data }: IndustryPerformanceChartsProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No data available
      </div>
    );
  }

  switch (type) {
    case 'top-industries':
      return <TopIndustriesChart data={data as TopIndustriesData[]} />;
    case 'categories':
      return <CategoriesChart data={data as CategoryData[]} />;
    case 'trends':
      return <TrendsChart data={data as TrendsData[]} />;
    default:
      return null;
  }
}

function TopIndustriesChart({ data }: { data: TopIndustriesData[] }) {
  const chartData = data.map((item) => ({
    name: item.company_name.length > 15
      ? item.company_name.substring(0, 15) + '...'
      : item.company_name,
    fullName: item.company_name,
    visits: item.total_ivs_hosted,
    participants: item.total_participants,
    rating: item.avg_rating || 0,
  }));

  return (
    <ChartContainer config={topIndustriesConfig} className="h-[300px] w-full">
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={100}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                return item?.fullName || '';
              }}
            />
          }
        />
        <Legend />
        <Bar
          dataKey="visits"
          name="Total Visits"
          fill="var(--color-visits)"
          radius={[0, 4, 4, 0]}
        />
        <Bar
          dataKey="participants"
          name="Participants"
          fill="var(--color-participants)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

function CategoriesChart({ data }: { data: CategoryData[] }) {
  const chartData = data.map((item, index) => ({
    name: item.sector,
    value: item.count,
    participants: item.participants,
    fill: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

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
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="font-medium">{data.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Visits: {data.value} ({((data.value / total) * 100).toFixed(1)}%)
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Participants: {data.participants}
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
            formatter={(value, entry: any) => (
              <span className="text-sm">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendsChart({ data }: { data: TrendsData[] }) {
  return (
    <ChartContainer config={trendsConfig} className="h-[300px] w-full">
      <ComposedChart data={data} margin={{ left: 10, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="visits"
          name="Visits"
          fill="var(--color-visits)"
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="participants"
          name="Participants"
          stroke="var(--color-participants)"
          strokeWidth={2}
          dot={{ fill: 'var(--color-participants)', r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
