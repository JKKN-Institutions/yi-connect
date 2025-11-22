'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';
import type { NationalBenchmark, BenchmarkSummary } from '@/types/national-integration';

interface BenchmarkChartProps {
  benchmarks: NationalBenchmark[];
  summary?: BenchmarkSummary | null;
}

const metricLabels: Record<string, string> = {
  event_count: 'Events',
  member_engagement: 'Engagement',
  csr_value: 'CSR Value',
  vertical_impact: 'Vertical Impact',
  membership_growth: 'Growth',
  volunteer_hours: 'Volunteer Hrs',
  sponsorship_raised: 'Sponsorship',
  awards_won: 'Awards'
};

const tierColors: Record<string, string> = {
  top_10: 'bg-green-500',
  above_average: 'bg-blue-500',
  average: 'bg-yellow-500',
  below_average: 'bg-orange-500',
  bottom_10: 'bg-red-500'
};

const tierLabels: Record<string, string> = {
  top_10: 'Top 10%',
  above_average: 'Above Average',
  average: 'Average',
  below_average: 'Below Average',
  bottom_10: 'Bottom 10%'
};

export function BenchmarkChart({ benchmarks, summary }: BenchmarkChartProps) {
  // Prepare data for bar chart
  const barChartData = benchmarks.map((b) => ({
    metric: metricLabels[b.metric_type] || b.metric_type,
    chapter: b.chapter_value,
    regional: b.regional_avg || 0,
    national: b.national_avg || 0
  }));

  // Prepare data for radar chart
  const radarData = benchmarks.map((b) => ({
    metric: metricLabels[b.metric_type] || b.metric_type,
    percentile: b.percentile_rank || 0,
    fullMark: 100
  }));

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      {summary && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Overall Performance
                </CardTitle>
                <CardDescription>
                  Your chapter's position compared to others
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {summary.average_percentile.toFixed(0)}%
                </div>
                <Badge className={tierColors[summary.overall_tier]}>
                  {tierLabels[summary.overall_tier]}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Top Performing Areas
                </p>
                <div className="flex flex-wrap gap-2">
                  {summary.top_performing_metrics.map((metric) => (
                    <Badge key={metric} variant="outline" className="bg-green-50">
                      {metricLabels[metric] || metric}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Areas for Improvement
                </p>
                <div className="flex flex-wrap gap-2">
                  {summary.improvement_areas.map((metric) => (
                    <Badge key={metric} variant="outline" className="bg-orange-50">
                      {metricLabels[metric] || metric}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Value Comparison</CardTitle>
            <CardDescription>
              Chapter vs Regional vs National averages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="chapter" name="Chapter" fill="#3b82f6" />
                  <Bar dataKey="regional" name="Regional" fill="#10b981" />
                  <Bar dataKey="national" name="National" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Percentile Rankings</CardTitle>
            <CardDescription>Your position across all metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" fontSize={12} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar
                    name="Percentile"
                    dataKey="percentile"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
          <CardDescription>
            Individual metric breakdown with trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Metric</th>
                  <th className="text-right py-2">Chapter</th>
                  <th className="text-right py-2">Regional Avg</th>
                  <th className="text-right py-2">National Avg</th>
                  <th className="text-right py-2">Percentile</th>
                  <th className="text-center py-2">Trend</th>
                  <th className="text-center py-2">Tier</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((b) => (
                  <tr key={b.id} className="border-b">
                    <td className="py-2 font-medium">
                      {metricLabels[b.metric_type] || b.metric_name}
                    </td>
                    <td className="text-right py-2">
                      {b.chapter_value.toLocaleString()}
                    </td>
                    <td className="text-right py-2 text-muted-foreground">
                      {b.regional_avg?.toLocaleString() || '-'}
                    </td>
                    <td className="text-right py-2 text-muted-foreground">
                      {b.national_avg?.toLocaleString() || '-'}
                    </td>
                    <td className="text-right py-2">
                      {b.percentile_rank?.toFixed(0)}%
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-center gap-1">
                        {getTrendIcon(b.trend)}
                        {b.change_percentage !== null && (
                          <span
                            className={
                              b.change_percentage > 0
                                ? 'text-green-500'
                                : b.change_percentage < 0
                                  ? 'text-red-500'
                                  : ''
                            }
                          >
                            {b.change_percentage > 0 ? '+' : ''}
                            {b.change_percentage?.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex justify-center">
                        {b.performance_tier && (
                          <Badge
                            variant="outline"
                            className={`${tierColors[b.performance_tier]} text-white text-xs`}
                          >
                            {tierLabels[b.performance_tier]}
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
