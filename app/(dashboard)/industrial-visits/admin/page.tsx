/**
 * Industrial Visits Admin Dashboard
 * Chapter leaders can manage all IV operations
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { BarChart3, Calendar, Users, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { getIVs, getIVAnalytics } from '@/lib/data/industrial-visits';
import { getCurrentUserChapter } from '@/lib/data/members';
import { IVDataTable } from '@/components/industrial-visits/iv-data-table/iv-data-table';
import { ivColumns } from '@/components/industrial-visits/iv-data-table/columns';
import { requireRole } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'IV Admin Dashboard | Yi Connect',
  description: 'Manage industrial visits for your chapter',
};

async function IVAdminContent() {
  // Only executive leadership can access admin dashboard
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']);

  const chapter = await getCurrentUserChapter();

  if (!chapter) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          You need to be a member of a chapter to access this page.
        </p>
      </div>
    );
  }

  const [ivsResult, analytics] = await Promise.all([
    getIVs(chapter.id, undefined, 1, 1000), // Get all IVs without pagination for admin view
    getIVAnalytics(chapter.id),
  ]);

  const ivs = ivsResult.data;

  // Calculate stats
  const publishedIVs = ivs.filter((iv: any) => iv.status === 'published');
  const upcomingIVs = publishedIVs.filter(
    (iv: any) => new Date(iv.start_date) > new Date()
  );
  const selfServiceIVs = ivs.filter((iv: any) => iv.entry_method === 'self_service');
  const pendingApprovalIVs = ivs.filter((iv: any) => iv.status === 'draft' && iv.entry_method === 'self_service');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            IV Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage all industrial visits for {chapter.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/industrial-visits/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              View Analytics
            </Link>
          </Button>
          <Button asChild>
            <Link href="/events/new?category=industrial_visit">
              <Calendar className="mr-2 h-4 w-4" />
              Create IV
            </Link>
          </Button>
        </div>
      </div>

      {/* Pending Approvals Alert */}
      {pendingApprovalIVs.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Pending Approvals</AlertTitle>
          <AlertDescription>
            You have {pendingApprovalIVs.length} industry-created slot
            {pendingApprovalIVs.length > 1 ? 's' : ''} awaiting review and approval.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total IVs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_ivs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {upcomingIVs.length} upcoming
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_participants}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.avg_attendance_rate}% attendance rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Carpool Seats Shared</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.total_carpool_seats_shared}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sustainability impact
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Industries</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.unique_industries_visited}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Industry partnerships
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Self-Service IVs */}
        <Card>
          <CardHeader>
            <CardTitle>Industry-Created Slots</CardTitle>
            <CardDescription>
              Slots created by industry partners (self-service)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-medium">{selfServiceIVs.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pending Approval</span>
                <Badge variant={pendingApprovalIVs.length > 0 ? 'default' : 'outline'}>
                  {pendingApprovalIVs.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Published</span>
                <span className="font-medium">
                  {selfServiceIVs.filter((iv) => iv.status === 'published').length}
                </span>
              </div>
            </div>
            {pendingApprovalIVs.length > 0 && (
              <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                <Link href="#pending-approvals">
                  Review Pending ({pendingApprovalIVs.length})
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>
              Overview of current industrial visit activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Upcoming Events</span>
                <span className="font-medium">{analytics.upcoming_ivs}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Completed</span>
                <span className="font-medium">{analytics.completed_ivs}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Attendance</span>
                <span className="font-medium">{analytics.avg_attendance_rate}%</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4" asChild>
              <Link href="/industrial-visits/analytics">
                <BarChart3 className="mr-2 h-4 w-4" />
                Full Analytics
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Different Views */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All IVs
            <Badge variant="secondary" className="ml-2">
              {ivs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending Approval
            {pendingApprovalIVs.length > 0 && (
              <Badge variant="default" className="ml-2">
                {pendingApprovalIVs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="self-service">Industry-Created</TabsTrigger>
        </TabsList>

        {/* All IVs */}
        <TabsContent value="all" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Industrial Visits</CardTitle>
              <CardDescription>
                Complete list of all industrial visits for your chapter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IVDataTable
                columns={ivColumns}
                data={ivs as any}
                industrySectors={Array.from(
                  new Set(
                    ivs
                      .map((iv: any) => iv.industry_sector)
                      .filter((s: any): s is string => s !== null)
                  )
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Approval */}
        <TabsContent value="pending" id="pending-approvals" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approval</CardTitle>
              <CardDescription>
                Industry-created slots awaiting admin review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingApprovalIVs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending approvals</p>
                </div>
              ) : (
                <IVDataTable
                  columns={ivColumns}
                  data={pendingApprovalIVs as any}
                  industrySectors={Array.from(
                    new Set(
                      pendingApprovalIVs
                        .map((iv: any) => iv.industry_sector)
                        .filter((s: any): s is string => s !== null)
                    )
                  )}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upcoming */}
        <TabsContent value="upcoming" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Industrial Visits</CardTitle>
              <CardDescription>
                All scheduled future industrial visits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IVDataTable
                columns={ivColumns}
                data={upcomingIVs as any}
                industrySectors={Array.from(
                  new Set(
                    upcomingIVs
                      .map((iv: any) => iv.industry_sector)
                      .filter((s: any): s is string => s !== null)
                  )
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Self-Service */}
        <TabsContent value="self-service" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Industry-Created Slots</CardTitle>
              <CardDescription>
                Slots created by industry partners through self-service portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IVDataTable
                columns={ivColumns}
                data={selfServiceIVs as any}
                industrySectors={Array.from(
                  new Set(
                    selfServiceIVs
                      .map((iv: any) => iv.industry_sector)
                      .filter((s: any): s is string => s !== null)
                  )
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IVAdminLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
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

export default function IVAdminPage() {
  return (
    <Suspense fallback={<IVAdminLoading />}>
      <IVAdminContent />
    </Suspense>
  );
}
