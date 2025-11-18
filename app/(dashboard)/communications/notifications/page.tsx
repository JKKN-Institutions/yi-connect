import { Suspense } from "react";
import { Metadata } from "next";
import { Bell, Check, Filter, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getUnreadNotificationsCount } from "@/lib/data/communication";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Notifications | Communication Hub",
  description: "View and manage your notifications",
};

interface NotificationsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function NotificationsPageContent({ searchParams }: NotificationsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return <div>Please log in to view notifications</div>;
  }

  // Await searchParams (Next.js 16+)
  const params = await searchParams;
  const category = params.category as string | undefined;
  const showUnreadOnly = params.unread === "true";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Stay updated with chapter activities and announcements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Check className="mr-2 h-4 w-4" />
            Mark All Read
          </Button>
          <Button variant="outline">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Suspense fallback={<StatsSkeleton />}>
        <NotificationStats memberId={user.id} />
      </Suspense>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
          <CardDescription>
            View and manage your notification history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-9">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
              <TabsTrigger value="awards">Awards</TabsTrigger>
              <TabsTrigger value="reminders">Reminders</TabsTrigger>
              <TabsTrigger value="finance">Finance</TabsTrigger>
              <TabsTrigger value="system">System</TabsTrigger>
              <TabsTrigger value="stakeholders">Stakeholders</TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <Suspense fallback={<NotificationsListSkeleton />}>
                <NotificationsList
                  memberId={user.id}
                  category={category}
                  unreadOnly={showUnreadOnly}
                />
              </Suspense>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NotificationsPage({ searchParams }: NotificationsPageProps) {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full" /></div>}>
      <NotificationsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NotificationStats({ memberId }: { memberId: string }) {
  const unreadCount = await getUnreadNotificationsCount(memberId);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unread</CardTitle>
          <Bell className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{unreadCount}</div>
          <p className="text-xs text-muted-foreground">
            Notifications to review
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <Bell className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">-</div>
          <p className="text-xs text-muted-foreground">
            Received this week
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total</CardTitle>
          <Bell className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">-</div>
          <p className="text-xs text-muted-foreground">
            All-time notifications
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

async function NotificationsList({
  memberId,
  category,
  unreadOnly = false
}: {
  memberId: string;
  category?: string;
  unreadOnly?: boolean;
}) {
  const notifications = await getNotifications(
    memberId,
    {
      category: category as any,
      read: unreadOnly ? false : undefined,
    },
    1,
    50
  );

  const getCategoryIcon = (cat: string) => {
    const icons: Record<string, string> = {
      events: "📅",
      announcements: "📢",
      awards: "🏆",
      reminders: "⏰",
      finance: "💰",
      system: "⚙️",
      stakeholders: "🤝",
      knowledge: "📚",
    };
    return icons[cat] || "📌";
  };

  if (notifications.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Bell className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No notifications</h3>
        <p className="text-sm text-muted-foreground text-center">
          {category
            ? `No ${category} notifications found`
            : unreadOnly
            ? "All caught up! No unread notifications."
            : "You don't have any notifications yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.data.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "flex items-start gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors",
            !notification.read_at && "bg-primary/5 border-primary/20"
          )}
        >
          {/* Icon */}
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="text-lg">
              {getCategoryIcon(notification.category)}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{notification.title}</p>
                  {!notification.read_at && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {notification.message}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs shrink-0">
                  {notification.category}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notification.created_at), {
                  addSuffix: true,
                })}
              </p>

              {notification.action_url && (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                  <Link href={notification.action_url}>
                    View Details
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
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

function NotificationsListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 p-4 rounded-lg border">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
