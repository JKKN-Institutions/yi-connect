import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import {
  Send,
  Bell,
  FileText,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AnnouncementCard } from "@/components/communication/announcement-card";
import {
  getAnnouncements,
  getCommunicationAnalytics,
  getRecentNotifications
} from "@/lib/data/communication";

export const metadata: Metadata = {
  title: "Communication Hub | Yi Connect",
  description: "Manage chapter communications, announcements, and notifications",
};

export default function CommunicationDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Communication Hub</h1>
          <p className="text-muted-foreground mt-1">
            Manage announcements, notifications, and member communications
          </p>
        </div>
        <Button asChild>
          <Link href="/communications/announcements/new">
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsCards />
      </Suspense>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Announcements */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Announcements</h2>
            <Button variant="ghost" asChild>
              <Link href="/communications/announcements">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <Suspense fallback={<AnnouncementsSkeleton />}>
            <RecentAnnouncementsList />
          </Suspense>
        </div>

        {/* Quick Actions & Notifications */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/communications/announcements/new">
                  <Send className="mr-2 h-4 w-4" />
                  New Announcement
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/communications/templates">
                  <FileText className="mr-2 h-4 w-4" />
                  Manage Templates
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/communications/segments">
                  <Users className="mr-2 h-4 w-4" />
                  Audience Segments
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/communications/analytics">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Analytics
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Notifications</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/communications/notifications">
                    View All
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<NotificationsSkeleton />}>
                <RecentNotificationsList />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

async function StatsCards() {
  const analytics = await getCommunicationAnalytics();

  const stats = [
    {
      title: "Total Announcements",
      value: analytics.overview.total_announcements,
      change: "+12% from last month",
      icon: Send,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900",
    },
    {
      title: "Total Sent",
      value: analytics.overview.total_sent,
      change: "Messages delivered",
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900",
    },
    {
      title: "Avg. Engagement",
      value: `${Math.round(analytics.overview.average_engagement_rate)}%`,
      change: "+5% from last month",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900",
    },
    {
      title: "Avg. Click Rate",
      value: `${Math.round(analytics.overview.average_click_through_rate)}%`,
      change: "Click-through performance",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900",
    },
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
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

async function RecentAnnouncementsList() {
  const { data } = await getAnnouncements(undefined, {}, 1, 5);

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Send className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No announcements yet</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Create your first announcement to start communicating with your members
          </p>
          <Button asChild>
            <Link href="/communications/announcements/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Announcement
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((announcement) => (
        <AnnouncementCard key={announcement.id} announcement={announcement} />
      ))}
    </div>
  );
}

async function RecentNotificationsList() {
  const notifications = await getRecentNotifications(undefined, 5);

  if (notifications.length === 0) {
    return (
      <div className="text-center py-6">
        <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No recent notifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
        >
          <div className="mt-0.5">
            <div className="p-2 rounded-full bg-primary/10">
              <Bell className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-1">
              {notification.title}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {notification.message}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {notification.category}
              </Badge>
              {!notification.read_at && (
                <Badge variant="default" className="text-xs">
                  Unread
                </Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-36" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AnnouncementsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
