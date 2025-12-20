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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { getIVAnalytics, getIndustryPerformance } from '@/lib/data/industrial-visits';
import { getCurrentUserChapter } from '@/lib/data/members';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Star, StarHalf } from 'lucide-react';
import type { IndustryPerformance } from '@/types/industrial-visit';

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

  const supabase = await createClient();

  // Get analytics
  const analytics = await getIVAnalytics(chapter.id);

  // Get list of industries that have hosted IVs for this chapter
  const { data: ivIndustries } = await supabase
    .from('events')
    .select('industry_id')
    .eq('chapter_id', chapter.id)
    .eq('category', 'industrial_visit')
    .not('industry_id', 'is', null);

  // Get unique industry IDs
  const uniqueIndustryIds = [...new Set(
    (ivIndustries || [])
      .map(iv => iv.industry_id)
      .filter(Boolean)
  )] as string[];

  // Fetch performance data for each industry
  const industryPerformance: IndustryPerformance[] = [];
  for (const industryId of uniqueIndustryIds.slice(0, 10)) { // Limit to top 10
    const performance = await getIndustryPerformance(industryId);
    if (performance) {
      industryPerformance.push(performance);
    }
  }

  // Sort by total IVs hosted
  industryPerformance.sort((a, b) => b.total_ivs_hosted - a.total_ivs_hosted);

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
          <Card>
            <CardHeader>
              <CardTitle>Industry Performance</CardTitle>
              <CardDescription>
                Top performing industry partners and host ratings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {industryPerformance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No industry performance data available yet</p>
                  <p className="text-xs mt-2">
                    Industry performance metrics will appear once you have completed industrial visits.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{industryPerformance.length}</div>
                      <p className="text-sm text-muted-foreground">Partner Industries</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">
                        {industryPerformance.reduce((sum, ip) => sum + ip.total_ivs_hosted, 0)}
                      </div>
                      <p className="text-sm text-muted-foreground">Total Visits</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">
                        {industryPerformance.reduce((sum, ip) => sum + ip.total_participants, 0)}
                      </div>
                      <p className="text-sm text-muted-foreground">Total Participants</p>
                    </div>
                  </div>

                  {/* Industry Performance Table */}
                  <div className="border rounded-lg">
                    <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 text-sm font-medium border-b">
                      <div className="col-span-4">Industry</div>
                      <div className="col-span-2 text-center">IVs Hosted</div>
                      <div className="col-span-2 text-center">Participants</div>
                      <div className="col-span-2 text-center">Rating</div>
                      <div className="col-span-2 text-center">Last Visit</div>
                    </div>
                    {industryPerformance.map((industry, index) => (
                      <div
                        key={industry.industry_id}
                        className="grid grid-cols-12 gap-4 p-4 items-center border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                      >
                        <div className="col-span-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{industry.company_name}</p>
                              <p className="text-xs text-muted-foreground">
                                Avg {(industry.total_participants / (industry.total_ivs_hosted || 1)).toFixed(0)} participants/visit
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <Badge variant="secondary">{industry.total_ivs_hosted}</Badge>
                        </div>
                        <div className="col-span-2 text-center font-medium">
                          {industry.total_participants}
                        </div>
                        <div className="col-span-2 text-center">
                          {industry.avg_rating ? (
                            <div className="flex items-center justify-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              <span className="font-medium">{industry.avg_rating.toFixed(1)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </div>
                        <div className="col-span-2 text-center text-sm text-muted-foreground">
                          {industry.last_iv_date
                            ? new Date(industry.last_iv_date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'N/A'
                          }
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Host Willingness Summary */}
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="text-base">Host Willingness Summary</CardTitle>
                      <CardDescription>
                        Industries rated by willingness to host future visits
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3">
                        {(() => {
                          const rated = industryPerformance.filter(ip => ip.willingness_to_host_again !== null);
                          const highlyWilling = rated.filter(ip => (ip.willingness_to_host_again || 0) >= 4).length;
                          const moderatelyWilling = rated.filter(ip => (ip.willingness_to_host_again || 0) >= 3 && (ip.willingness_to_host_again || 0) < 4).length;
                          const lowWilling = rated.filter(ip => (ip.willingness_to_host_again || 0) < 3).length;

                          return (
                            <>
                              <div className="p-4 border rounded-lg text-center">
                                <div className="flex items-center justify-center gap-1 mb-2">
                                  <Star className="h-5 w-5 text-green-500 fill-green-500" />
                                  <Star className="h-5 w-5 text-green-500 fill-green-500" />
                                </div>
                                <div className="text-2xl font-bold text-green-600">{highlyWilling}</div>
                                <p className="text-sm text-muted-foreground">Highly Willing (4-5)</p>
                              </div>
                              <div className="p-4 border rounded-lg text-center">
                                <div className="flex items-center justify-center gap-1 mb-2">
                                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                                </div>
                                <div className="text-2xl font-bold text-yellow-600">{moderatelyWilling}</div>
                                <p className="text-sm text-muted-foreground">Moderate (3-4)</p>
                              </div>
                              <div className="p-4 border rounded-lg text-center">
                                <div className="flex items-center justify-center gap-1 mb-2">
                                  <StarHalf className="h-5 w-5 text-red-500" />
                                </div>
                                <div className="text-2xl font-bold text-red-600">{lowWilling}</div>
                                <p className="text-sm text-muted-foreground">Needs Attention (&lt;3)</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
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
