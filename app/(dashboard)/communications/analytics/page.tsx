import { Suspense } from "react";
import { Metadata } from "next";
import {
  Send,
  TrendingUp,
  Eye,
  MousePointer,
  Users,
  Mail,
  MessageCircle,
  Bell
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCommunicationAnalytics } from "@/lib/data/communication";
import { requireRole } from "@/lib/auth";
import {
  EngagementOverTimeChart,
  DeliverySuccessRateChart,
} from "./communication-analytics-charts";

export const metadata: Metadata = {
  title: "Analytics | Communication Hub",
  description: "Communication performance metrics and insights",
};


export default async function AnalyticsPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member']);
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Communication Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Track performance and engagement across all communication channels
        </p>
      </div>

      {/* Time Period Selector */}
      <Tabs defaultValue="30d" className="w-full">
        <TabsList>
          <TabsTrigger value="7d">Last 7 Days</TabsTrigger>
          <TabsTrigger value="30d">Last 30 Days</TabsTrigger>
          <TabsTrigger value="90d">Last 90 Days</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>

        <TabsContent value="30d" className="space-y-6 mt-6">
          {/* Overview Stats */}
          <Suspense fallback={<OverviewStatsSkeleton />}>
            <OverviewStats />
          </Suspense>

          {/* Channel Performance */}
          <Suspense fallback={<ChannelPerformanceSkeleton />}>
            <ChannelPerformance />
          </Suspense>

          {/* Engagement Metrics */}
          <Suspense fallback={<ChartsSkeleton />}>
            <EngagementChartsSection />
          </Suspense>

          {/* Top Performing Announcements */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Announcements</CardTitle>
              <CardDescription>
                Announcements with highest engagement rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium">Sample announcement data will appear here</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Based on actual announcements from the database
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">--%</p>
                    <p className="text-xs text-muted-foreground">engagement</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function OverviewStats() {
  const analytics = await getCommunicationAnalytics();

  const stats = [
    {
      title: "Total Announcements",
      value: analytics.overview.total_announcements.toLocaleString(),
      change: "+12% from last period",
      icon: Send,
      trend: "up",
      color: "text-blue-600"
    },
    {
      title: "Total Reach",
      value: analytics.overview.total_sent.toLocaleString(),
      change: "Members reached",
      icon: Users,
      trend: "up",
      color: "text-purple-600"
    },
    {
      title: "Avg. Open Rate",
      value: `${Math.round(analytics.overview.average_engagement_rate)}%`,
      change: "+5% from last period",
      icon: Eye,
      trend: "up",
      color: "text-green-600"
    },
    {
      title: "Avg. Click Rate",
      value: `${Math.round(analytics.overview.average_click_through_rate)}%`,
      change: "+2% from last period",
      icon: MousePointer,
      trend: "up",
      color: "text-orange-600"
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
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {stat.trend === "up" && <TrendingUp className="h-3 w-3 text-green-600" />}
                {stat.change}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

async function ChannelPerformance() {
  const analytics = await getCommunicationAnalytics();

  const channelIcons: Record<string, any> = {
    email: Mail,
    whatsapp: MessageCircle,
    in_app: Bell,
  };

  const channelColors: Record<string, string> = {
    email: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    whatsapp: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    in_app: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  };

  const channelNames: Record<string, string> = {
    email: "Email",
    whatsapp: "WhatsApp",
    in_app: "In-App",
  };

  const channels = analytics.by_channel.map((channelData) => ({
    name: channelNames[channelData.channel] || channelData.channel,
    icon: channelIcons[channelData.channel],
    sent: channelData.total_sent,
    delivered: channelData.delivered,
    opened: channelData.opened,
    clicked: channelData.clicked,
    deliveryRate: Math.round((channelData.delivered / channelData.total_sent) * 100) || 0,
    openRate: Math.round(channelData.open_rate),
    clickRate: Math.round(channelData.click_rate),
    color: channelColors[channelData.channel] || "bg-gray-100 text-gray-700",
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel Performance</CardTitle>
        <CardDescription>
          Breakdown of performance by communication channel
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div key={channel.name} className="flex items-center gap-4 p-4 rounded-lg border">
                <div className={`p-3 rounded-lg ${channel.color}`}>
                  <Icon className="h-6 w-6" />
                </div>

                <div className="flex-1 grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium">{channel.name}</p>
                    <p className="text-2xl font-bold mt-1">{channel.sent}</p>
                    <p className="text-xs text-muted-foreground">sent</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Delivery</p>
                    <p className="text-xl font-semibold mt-1">{channel.deliveryRate}%</p>
                    <p className="text-xs text-muted-foreground">{channel.delivered} delivered</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Open Rate</p>
                    <p className="text-xl font-semibold mt-1">{channel.openRate}%</p>
                    <p className="text-xs text-muted-foreground">{channel.opened} opened</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Click Rate</p>
                    <p className="text-xl font-semibold mt-1">{channel.clickRate}%</p>
                    <p className="text-xs text-muted-foreground">{channel.clicked} clicked</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-4 rounded" />
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

function ChannelPerformanceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

async function EngagementChartsSection() {
  const analytics = await getCommunicationAnalytics();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Engagement Over Time</CardTitle>
          <CardDescription>
            Open and click rates for the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EngagementOverTimeChart data={analytics.trends} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Success Rate</CardTitle>
          <CardDescription>
            Successful vs failed deliveries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeliverySuccessRateChart data={analytics.by_channel} />
        </CardContent>
      </Card>
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
