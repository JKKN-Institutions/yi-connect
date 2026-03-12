import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Megaphone,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { getCurrentMemberId, requireRole } from '@/lib/auth';
import { BroadcastCenter } from '@/components/national/broadcast-center';
import { getBroadcasts } from '@/lib/data/national-integration';
import type { BroadcastWithReceipt } from '@/types/national-integration';

export const metadata = {
  title: 'National Broadcasts | Yi Connect',
  description: 'View announcements and communications from Yi National'
};

async function BroadcastsContent() {
  // Require National Admin role
  await requireRole(['Super Admin', 'National Admin']);

  const memberId = await getCurrentMemberId();

  if (!memberId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Bell className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Unable to load broadcasts</p>
        </CardContent>
      </Card>
    );
  }

  // Fetch real broadcasts from the database
  const allBroadcasts = await getBroadcasts(undefined, memberId);

  // Handle empty state
  if (allBroadcasts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Bell className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No broadcasts yet</h3>
          <p className="text-muted-foreground text-center max-w-md">
            National broadcasts and announcements will appear here once they are published.
          </p>
        </CardContent>
      </Card>
    );
  }

  const unreadCount = allBroadcasts.filter((b) => !b.receipt?.read_at).length;
  const pendingAckCount = allBroadcasts.filter(
    (b) => b.requires_acknowledgment && !b.receipt?.acknowledged_at
  ).length;

  const unreadBroadcasts = allBroadcasts.filter((b) => !b.receipt?.read_at);
  const pendingAckBroadcasts = allBroadcasts.filter(
    (b) => b.requires_acknowledgment && !b.receipt?.acknowledged_at
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allBroadcasts.length}</div>
            <p className="text-xs text-muted-foreground">Active broadcasts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">New messages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAckCount}</div>
            <p className="text-xs text-muted-foreground">Need acknowledgment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allBroadcasts.filter((b) => b.receipt?.acknowledged_at).length}
            </div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Broadcasts by Tab */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All ({allBroadcasts.length})
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Needs Action ({pendingAckCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <BroadcastCenter broadcasts={allBroadcasts} />
        </TabsContent>

        <TabsContent value="unread" className="mt-4">
          {unreadBroadcasts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-muted-foreground">All caught up!</p>
              </CardContent>
            </Card>
          ) : (
            <BroadcastCenter broadcasts={unreadBroadcasts} />
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {pendingAckBroadcasts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-muted-foreground">No pending acknowledgments</p>
              </CardContent>
            </Card>
          ) : (
            <BroadcastCenter broadcasts={pendingAckBroadcasts} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BroadcastsSkeleton() {
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
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">National Broadcasts</h1>
          <p className="text-muted-foreground">
            Announcements and communications from Yi National
          </p>
        </div>
      </div>

      <Suspense fallback={<BroadcastsSkeleton />}>
        <BroadcastsContent />
      </Suspense>
    </div>
  );
}
