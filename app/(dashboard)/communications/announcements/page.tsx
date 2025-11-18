import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { Plus, Send, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnnouncementsTable } from "@/components/communication/announcements-table";
import { announcementsTableColumns } from "@/components/communication/announcements-table-columns";
import {
  getAnnouncements,
  getCommunicationAnalytics
} from "@/lib/data/communication";

export const metadata: Metadata = {
  title: "Announcements | Communication Hub",
  description: "Manage chapter announcements and communications",
};

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Await searchParams (Next.js 16+)
  const params = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage chapter communications
          </p>
        </div>
        <Button asChild>
          <Link href="/communications/announcements/new">
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsCards />
      </Suspense>

      {/* Announcements Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Announcements</CardTitle>
          <CardDescription>
            View and manage all your chapter announcements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TableSkeleton />}>
            <AnnouncementsTableWrapper searchParams={params} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function StatsCards() {
  const analytics = await getCommunicationAnalytics();

  const stats = [
    {
      title: "Total Announcements",
      value: analytics.overview.total_announcements,
      icon: Send,
      description: "All-time announcements",
      color: "text-blue-600"
    },
    {
      title: "Total Sent",
      value: analytics.overview.total_sent,
      icon: Clock,
      description: "Messages delivered",
      color: "text-orange-600"
    },
    {
      title: "Avg. Engagement",
      value: `${Math.round(analytics.overview.average_engagement_rate)}%`,
      icon: CheckCircle2,
      description: "Average engagement",
      color: "text-green-600"
    },
    {
      title: "Avg. Click Rate",
      value: `${Math.round(analytics.overview.average_click_through_rate)}%`,
      icon: TrendingUp,
      description: "Members reached",
      color: "text-purple-600"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

async function AnnouncementsTableWrapper({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Parse search params
  const page = Number(searchParams.page) || 1;
  const pageSize = Number(searchParams.pageSize) || 20;
  const status = searchParams.status as string | undefined;
  const search = searchParams.search as string | undefined;

  // Fetch announcements
  const { data, total, totalPages } = await getAnnouncements(
    undefined, // chapter_id (will use current chapter from context)
    {
      status: status as any,
      search: search,
    },
    page,
    pageSize
  );

  return (
    <AnnouncementsTable
      columns={announcementsTableColumns}
      data={data}
      pageCount={totalPages}
      totalCount={total}
    />
  );
}

function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-[300px]" />
        <Skeleton className="h-9 w-[120px]" />
        <Skeleton className="h-9 w-[120px]" />
      </div>
      <div className="rounded-md border">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
