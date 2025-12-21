/**
 * WhatsApp Dashboard Page
 *
 * Central hub for WhatsApp communications.
 * Shows connection status, quick actions, recent messages, and stats.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  Send,
  Users2,
  FileText,
  Settings,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { requireRole } from '@/lib/auth';
import {
  getWhatsAppConnection,
  getWhatsAppDashboardStats,
  getRecentMessages,
  getWhatsAppGroups
} from '@/lib/data/whatsapp';
import { getCurrentChapterId } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default async function WhatsAppDashboardPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'EC Member']);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <DashboardHeader />
      </Suspense>

      {/* Quick Actions + Connection Status */}
      <div className="grid gap-6 md:grid-cols-3">
        <Suspense fallback={<ConnectionCardSkeleton />}>
          <ConnectionStatusCard />
        </Suspense>
        <div className="md:col-span-2">
          <QuickActions />
        </div>
      </div>

      {/* Stats */}
      <Suspense fallback={<StatsSkeleton />}>
        <MessagingStats />
      </Suspense>

      {/* Recent Activity + Groups */}
      <div className="grid gap-6 md:grid-cols-2">
        <Suspense fallback={<RecentMessagesSkeleton />}>
          <RecentMessagesCard />
        </Suspense>
        <Suspense fallback={<GroupsSkeleton />}>
          <QuickGroupsCard />
        </Suspense>
      </div>
    </div>
  );
}

async function DashboardHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-green-100 p-2">
          <MessageCircle className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp</h1>
          <p className="text-muted-foreground">
            Manage communications with members and groups
          </p>
        </div>
      </div>
      <Button asChild>
        <Link href="/communications/whatsapp/compose">
          <Send className="mr-2 h-4 w-4" />
          Compose Message
        </Link>
      </Button>
    </div>
  );
}

async function ConnectionStatusCard() {
  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-muted-foreground">No chapter selected</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const connection = await getWhatsAppConnection(chapterId);
  const isConnected = connection?.status === 'connected';

  return (
    <Card className={cn(
      "border-2",
      isConnected ? "border-green-200 bg-green-50/50" : "border-gray-200"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
          <Badge variant={isConnected ? 'default' : 'secondary'} className={cn(
            isConnected && "bg-green-100 text-green-800 border-green-200"
          )}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : connection?.status === 'connecting' ? (
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          ) : (
            <XCircle className="h-5 w-5 text-gray-400" />
          )}
          <span className="text-sm">
            {isConnected
              ? `Connected: ${connection.connected_phone || 'Unknown'}`
              : connection?.status === 'connecting'
              ? 'Connecting...'
              : 'Not connected'}
          </span>
        </div>
        {connection?.last_active_at && (
          <p className="text-xs text-muted-foreground">
            Last active: {new Date(connection.last_active_at).toLocaleString()}
          </p>
        )}
        <Button variant="outline" size="sm" asChild className="w-full">
          <Link href="/settings/whatsapp">
            <Settings className="mr-2 h-3 w-3" />
            {isConnected ? 'Manage Connection' : 'Connect WhatsApp'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  const actions = [
    {
      title: 'Compose Message',
      description: 'Send to individuals or groups',
      href: '/communications/whatsapp/compose',
      icon: Send,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Manage Groups',
      description: 'View and manage chapter groups',
      href: '/communications/whatsapp/groups',
      icon: Users2,
      color: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Message Templates',
      description: 'Create reusable templates',
      href: '/communications/templates',
      icon: FileText,
      color: 'bg-orange-100 text-orange-600'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
            >
              <div className={cn("rounded-lg p-2", action.color)}>
                <action.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{action.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

async function MessagingStats() {
  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return null;
  }

  const stats = await getWhatsAppDashboardStats(chapterId);

  const statCards = [
    {
      title: 'Messages Today',
      value: stats.messages_today,
      icon: Clock,
      description: 'Sent in last 24 hours'
    },
    {
      title: 'This Week',
      value: stats.messages_this_week,
      icon: BarChart3,
      description: 'Last 7 days'
    },
    {
      title: 'This Month',
      value: stats.messages_this_month,
      icon: TrendingUp,
      description: 'Last 30 days'
    },
    {
      title: 'Groups',
      value: stats.groups_count,
      icon: Users2,
      description: 'Active groups'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function RecentMessagesCard() {
  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Messages</CardTitle>
          <CardDescription>No chapter selected</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const messages = await getRecentMessages(chapterId, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Messages</CardTitle>
            <CardDescription>Latest sent messages</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/communications/whatsapp/history">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No messages sent yet</p>
            <Button variant="link" size="sm" asChild className="mt-2">
              <Link href="/communications/whatsapp/compose">Send your first message</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <div className={cn(
                  "rounded-full p-1.5",
                  message.status === 'sent' || message.status === 'delivered' || message.status === 'read'
                    ? "bg-green-100"
                    : message.status === 'failed'
                    ? "bg-red-100"
                    : "bg-gray-100"
                )}>
                  <MessageCircle className={cn(
                    "h-3 w-3",
                    message.status === 'sent' || message.status === 'delivered' || message.status === 'read'
                      ? "text-green-600"
                      : message.status === 'failed'
                      ? "text-red-600"
                      : "text-gray-600"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {message.recipient_name || 'Unknown'}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {message.recipient_type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {message.message_preview}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(message.sent_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant={
                  message.status === 'sent' || message.status === 'delivered' || message.status === 'read'
                    ? 'default'
                    : message.status === 'failed'
                    ? 'destructive'
                    : 'secondary'
                } className="text-xs">
                  {message.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function QuickGroupsCard() {
  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quick Groups</CardTitle>
          <CardDescription>No chapter selected</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const groups = await getWhatsAppGroups(chapterId, { is_active: true });
  const displayGroups = groups.slice(0, 5);

  const groupTypeColors: Record<string, string> = {
    chapter: 'bg-blue-100 text-blue-600',
    leadership: 'bg-purple-100 text-purple-600',
    ec_team: 'bg-orange-100 text-orange-600',
    yuva: 'bg-green-100 text-green-600',
    thalir: 'bg-cyan-100 text-cyan-600',
    fun: 'bg-pink-100 text-pink-600',
    core: 'bg-red-100 text-red-600',
    other: 'bg-gray-100 text-gray-600'
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Quick Groups</CardTitle>
            <CardDescription>Send to a group with one click</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/communications/whatsapp/groups">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {displayGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No groups configured</p>
            <Button variant="link" size="sm" asChild className="mt-2">
              <Link href="/communications/whatsapp/groups/new">Add your first group</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayGroups.map((group) => (
              <Link
                key={group.id}
                href={`/communications/whatsapp/compose?group=${group.jid}`}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <div className={cn(
                  "rounded-lg p-2",
                  groupTypeColors[group.group_type || 'other'] || groupTypeColors.other
                )}>
                  <Users2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{group.name}</p>
                  {group.member_count && (
                    <p className="text-xs text-muted-foreground">
                      {group.member_count} members
                    </p>
                  )}
                </div>
                <Send className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Skeleton components
function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div>
          <Skeleton className="h-9 w-32 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
      </div>
      <Skeleton className="h-10 w-40" />
    </div>
  );
}

function ConnectionCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
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

function RecentMessagesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function GroupsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
