import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  Users,
  Calendar,
  DollarSign,
  Heart
} from 'lucide-react';
import { getCurrentChapterId, requireRole } from '@/lib/auth';
import { BenchmarkChart } from '@/components/national/benchmark-chart';
import type { NationalBenchmark, BenchmarkSummary } from '@/types/national-integration';

export const metadata = {
  title: 'National Benchmarks | Yi Connect',
  description: 'Compare chapter performance against regional and national averages'
};

async function BenchmarkDashboardContent() {
  // Require National Admin role
  await requireRole(['Super Admin', 'National Admin']);

  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Unable to load benchmark data</p>
        </CardContent>
      </Card>
    );
  }

  // Mock data for demonstration
  const mockBenchmarks: NationalBenchmark[] = [
    {
      id: '1',
      chapter_id: chapterId,
      metric_type: 'event_count',
      metric_name: 'Events Organized',
      metric_description: 'Number of events organized this period',
      period_type: 'quarterly',
      period_start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      period_end: new Date().toISOString(),
      calendar_year: 2024,
      quarter: 4,
      chapter_value: 24,
      regional_avg: 18,
      national_avg: 15,
      regional_rank: 3,
      regional_total: 15,
      national_rank: 25,
      national_total: 120,
      percentile_rank: 78,
      trend: 'improving',
      change_percentage: 12.5,
      previous_value: 21,
      performance_tier: 'above_average',
      synced_from_national_at: null,
      national_benchmark_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      chapter_id: chapterId,
      metric_type: 'member_engagement',
      metric_name: 'Member Engagement',
      metric_description: 'Member engagement score',
      period_type: 'quarterly',
      period_start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      period_end: new Date().toISOString(),
      calendar_year: 2024,
      quarter: 4,
      chapter_value: 72,
      regional_avg: 65,
      national_avg: 60,
      regional_rank: 2,
      regional_total: 15,
      national_rank: 12,
      national_total: 120,
      percentile_rank: 85,
      trend: 'improving',
      change_percentage: 8.2,
      previous_value: 66,
      performance_tier: 'top_10',
      synced_from_national_at: null,
      national_benchmark_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const mockSummary: BenchmarkSummary = {
    benchmarks: mockBenchmarks,
    average_percentile: 76.7,
    overall_tier: 'above_average',
    top_performing_metrics: ['member_engagement', 'volunteer_hours'],
    improvement_areas: ['membership_growth']
  };

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

  const tierColors: Record<string, string> = {
    top_10: 'bg-green-500',
    above_average: 'bg-blue-500',
    average: 'bg-yellow-500',
    below_average: 'bg-orange-500',
    bottom_10: 'bg-red-500'
  };

  const metricIcons: Record<string, React.ReactNode> = {
    event_count: <Calendar className="h-5 w-5" />,
    member_engagement: <Users className="h-5 w-5" />,
    csr_value: <Heart className="h-5 w-5" />,
    membership_growth: <TrendingUp className="h-5 w-5" />,
    volunteer_hours: <Users className="h-5 w-5" />,
    sponsorship_raised: <DollarSign className="h-5 w-5" />
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Ranking</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockSummary.average_percentile.toFixed(0)}%
            </div>
            <Badge className={tierColors[mockSummary.overall_tier]}>
              {mockSummary.overall_tier.replace('_', ' ')}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Metrics Tracked</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockBenchmarks.length}</div>
            <p className="text-xs text-muted-foreground">Active benchmarks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockBenchmarks.filter((b) => b.performance_tier === 'top_10').length}
            </div>
            <p className="text-xs text-muted-foreground">Metrics in top 10%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Improving</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockBenchmarks.filter((b) => b.trend === 'improving').length}
            </div>
            <p className="text-xs text-muted-foreground">Metrics trending up</p>
          </CardContent>
        </Card>
      </div>

      {/* Benchmark Charts */}
      <BenchmarkChart benchmarks={mockBenchmarks} summary={mockSummary} />

      {/* Individual Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockBenchmarks.map((benchmark) => (
          <Card key={benchmark.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {metricIcons[benchmark.metric_type]}
                {benchmark.metric_name}
              </CardTitle>
              {getTrendIcon(benchmark.trend)}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">
                    {benchmark.chapter_value.toLocaleString()}
                  </span>
                  {benchmark.change_percentage !== null && (
                    <span
                      className={`text-sm ${
                        benchmark.change_percentage > 0
                          ? 'text-green-500'
                          : benchmark.change_percentage < 0
                            ? 'text-red-500'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {benchmark.change_percentage > 0 ? '+' : ''}
                      {benchmark.change_percentage.toFixed(1)}%
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Regional Avg</p>
                    <p className="font-medium">
                      {benchmark.regional_avg?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">National Avg</p>
                    <p className="font-medium">
                      {benchmark.national_avg?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Percentile</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{benchmark.percentile_rank}%</span>
                    {benchmark.performance_tier && (
                      <Badge
                        variant="outline"
                        className={`${tierColors[benchmark.performance_tier]} text-white text-xs`}
                      >
                        {benchmark.performance_tier.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BenchmarkDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-5 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px]" />
      </div>
    </div>
  );
}

export default function BenchmarksPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">National Benchmarks</h1>
          <p className="text-muted-foreground">
            Compare your chapter's performance against regional and national averages
          </p>
        </div>
        <Badge variant="outline" className="text-blue-600">
          <BarChart3 className="h-4 w-4 mr-1" />
          Q4 2024
        </Badge>
      </div>

      <Suspense fallback={<BenchmarkDashboardSkeleton />}>
        <BenchmarkDashboardContent />
      </Suspense>
    </div>
  );
}
