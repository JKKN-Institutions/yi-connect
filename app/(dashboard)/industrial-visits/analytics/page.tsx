/**
 * Industrial Visits Analytics Page
 * Comprehensive analytics and reports for IV performance
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  Building2,
  Car,
  Download,
  ArrowUp,
  ArrowDown,
  Star,
  Trophy,
  Factory,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  getIVAnalytics,
  getChapterIndustriesPerformance,
  getIndustryCategoriesDistribution,
  getMonthlyIVTrends,
} from '@/lib/data/industrial-visits';
import { getCurrentUserChapter } from '@/lib/data/members';
import { requireRole } from '@/lib/auth';
import { IndustryPerformanceCharts } from './industry-performance-charts';

export const metadata: Metadata = {
  title: 'IV Analytics | Yi Connect',
  description: 'Analytics and insights for industrial visits',
};

async function IVAnalyticsContent() {
  // Leadership roles can view analytics
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  const chapter = await getCurrentUserChapter();

  if (!chapter) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          You need to be a member of a chapter to view analytics.
        </p>
      </div>
    );
  }

  const [analytics, industryPerformance, categoryDistribution, monthlyTrends] = await Promise.all([
    getIVAnalytics(chapter.id),
    getChapterIndustriesPerformance(chapter.id),
    getIndustryCategoriesDistribution(chapter.id),
    getMonthlyIVTrends(chapter.id, 12),
  ]);

  const participationTrend =
    analytics.total_ivs > 0
      ? ((analytics.total_participants / analytics.total_ivs) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            IV Analytics & Insights
          </h1>
          <p className="text-muted-foreground mt-1">
            Performance metrics and trends for {chapter.name}
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total IVs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_ivs}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <ArrowUp className="h-3 w-3 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">
                {analytics.upcoming_ivs}
              </span>
              <span className="ml-1">upcoming</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_participants}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <span>Avg {participationTrend} per event</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avg_attendance_rate}%</div>
            <Progress value={analytics.avg_attendance_rate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Industry Partners</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.unique_industries_visited}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active partnerships
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Different Analytics Views */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="participation">Participation</TabsTrigger>
          <TabsTrigger value="carpool">Carpool Impact</TabsTrigger>
          <TabsTrigger value="industries">Industry Performance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Event Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Event Status Distribution</CardTitle>
                <CardDescription>
                  Breakdown of IV events by current status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Upcoming</span>
                    <Badge variant="default">{analytics.upcoming_ivs}</Badge>
                  </div>
                  <Progress
                    value={
                      analytics.total_ivs > 0
                        ? (analytics.upcoming_ivs / analytics.total_ivs) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Completed</span>
                    <Badge variant="secondary">{analytics.completed_ivs}</Badge>
                  </div>
                  <Progress
                    value={
                      analytics.total_ivs > 0
                        ? (analytics.completed_ivs / analytics.total_ivs) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Events</span>
                    <span className="font-medium">{analytics.total_ivs}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Participation Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Participation Metrics</CardTitle>
                <CardDescription>
                  Member engagement and attendance statistics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total Participants
                  </span>
                  <span className="text-2xl font-bold">
                    {analytics.total_participants}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Average Attendance Rate
                  </span>
                  <span className="text-lg font-medium text-green-600">
                    {analytics.avg_attendance_rate}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Avg Participants/Event
                  </span>
                  <span className="text-lg font-medium">{participationTrend}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Industry Partnerships */}
          <Card>
            <CardHeader>
              <CardTitle>Industry Partnerships</CardTitle>
              <CardDescription>
                Collaboration with industry partners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold">
                    {analytics.unique_industries_visited}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Unique Industries
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold">{analytics.total_ivs}</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Total Visits Hosted
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold">
                    {analytics.unique_industries_visited > 0
                      ? (analytics.total_ivs / analytics.unique_industries_visited).toFixed(1)
                      : '0'}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Avg Visits/Industry
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Participation Tab */}
        <TabsContent value="participation" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Participation Trends</CardTitle>
              <CardDescription>
                Member engagement and registration patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Total Participants</span>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold">
                      {analytics.total_participants}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Across all industrial visits
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Attendance Rate</span>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {analytics.avg_attendance_rate}%
                    </div>
                    <Progress
                      value={analytics.avg_attendance_rate}
                      className="mt-2 h-1.5"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Participation data helps identify popular industries, optimal event
                    timing, and member engagement patterns.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Carpool Impact Tab */}
        <TabsContent value="carpool" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Carpool & Sustainability Impact</CardTitle>
              <CardDescription>
                Environmental and social benefits from carpooling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Car className="h-5 w-5 text-green-600" />
                    <h4 className="font-semibold">Carpool Statistics</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm">Total Seats Shared</span>
                      <span className="text-lg font-bold text-green-600">
                        {analytics.total_carpool_seats_shared}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Members coordinating rides have saved approximately{' '}
                      {analytics.total_carpool_seats_shared * 15} km of driving,
                      reducing carbon emissions.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Impact Metrics</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">
                        Estimated CO₂ Saved
                      </div>
                      <div className="text-xl font-bold">
                        {(analytics.total_carpool_seats_shared * 2.3).toFixed(1)} kg
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">
                        Community Building
                      </div>
                      <div className="text-xl font-bold">
                        Enhanced networking
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Industry Performance Tab */}
        <TabsContent value="industries" className="mt-6 space-y-6">
          {industryPerformance.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Industry Performance</CardTitle>
                <CardDescription>
                  Top performing industry partners and host ratings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No industry performance data available yet</p>
                  <p className="text-sm mt-2">
                    Start hosting industrial visits to see performance metrics here.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Stats Row */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Industries</CardTitle>
                    <Factory className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{industryPerformance.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Active industry partners
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {industryPerformance.reduce((sum, i) => sum + i.total_ivs_hosted, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Across all industries
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Attendees</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {industryPerformance.reduce((sum, i) => sum + i.total_participants, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Members participated
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(() => {
                        const rated = industryPerformance.filter(i => i.avg_rating !== null);
                        if (rated.length === 0) return 'N/A';
                        const avg = rated.reduce((sum, i) => sum + (i.avg_rating || 0), 0) / rated.length;
                        return avg.toFixed(1);
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Host satisfaction (1-5)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Section */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Top Industries Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      Top 5 Industries by Visits
                    </CardTitle>
                    <CardDescription>
                      Industries with the most industrial visits hosted
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <IndustryPerformanceCharts
                      type="top-industries"
                      data={industryPerformance.slice(0, 5)}
                    />
                  </CardContent>
                </Card>

                {/* Industry Categories Pie Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-500" />
                      Industry Categories
                    </CardTitle>
                    <CardDescription>
                      Distribution of visits by industry sector
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <IndustryPerformanceCharts
                      type="categories"
                      data={categoryDistribution}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Trends Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Monthly Trends
                  </CardTitle>
                  <CardDescription>
                    Industrial visits and participants over the last 12 months
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <IndustryPerformanceCharts
                    type="trends"
                    data={monthlyTrends}
                  />
                </CardContent>
              </Card>

              {/* Industry Performance Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Industry Performance Details</CardTitle>
                  <CardDescription>
                    Comprehensive breakdown of all industry partner performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Industry Name</TableHead>
                          <TableHead className="text-center">Total Visits</TableHead>
                          <TableHead className="text-center">Total Attendees</TableHead>
                          <TableHead className="text-center">Avg Rating</TableHead>
                          <TableHead className="text-center">Satisfaction</TableHead>
                          <TableHead>Last Visit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {industryPerformance.map((industry) => (
                          <TableRow key={industry.industry_id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                {industry.company_name}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">
                                {industry.total_ivs_hosted}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {industry.total_participants}
                            </TableCell>
                            <TableCell className="text-center">
                              {industry.avg_rating ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                  <span>{industry.avg_rating}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {industry.willingness_to_host_again ? (
                                <div className="w-full max-w-[100px] mx-auto">
                                  <Progress
                                    value={(industry.willingness_to_host_again / 5) * 100}
                                    className="h-2"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {Math.round((industry.willingness_to_host_again / 5) * 100)}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {industry.last_iv_date ? (
                                new Date(industry.last_iv_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IVAnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>

      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

export default function IVAnalyticsPage() {
  return (
    <Suspense fallback={<IVAnalyticsLoading />}>
      <IVAnalyticsContent />
    </Suspense>
  );
}
