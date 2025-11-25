import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Megaphone,
  FileText,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { getCurrentMemberId, requireRole } from '@/lib/auth';
import { BroadcastCenter } from '@/components/national/broadcast-center';
import type { BroadcastWithReceipt, NationalBroadcast } from '@/types/national-integration';

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

  // Mock data for demonstration
  const now = new Date();
  const mockBroadcasts: BroadcastWithReceipt[] = [
    {
      id: '1',
      national_broadcast_id: 'nat-1',
      title: 'Yi National Summit 2025 - Early Bird Registration Open',
      content: 'We are excited to announce that early bird registration for the Yi National Summit 2025 is now open!',
      content_html: null,
      summary: 'Early bird registration for Yi National Summit 2025 is now open.',
      broadcast_type: 'announcement',
      priority: 'high',
      target_audience: { type: 'all_chapters' },
      target_roles: [],
      target_regions: [],
      published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      attachments: [{ name: 'Summit_Brochure.pdf', url: '#', type: 'application/pdf' }],
      requires_acknowledgment: true,
      acknowledgment_deadline: null,
      allows_comments: false,
      original_language: 'en',
      translations: {},
      received_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now.toISOString()
    },
    {
      id: '2',
      national_broadcast_id: 'nat-2',
      title: 'Updated Guidelines for Chapter Financial Reporting',
      content: 'Please note the following updates to our financial reporting guidelines effective January 1, 2025.',
      content_html: null,
      summary: 'Important updates to chapter financial reporting guidelines effective January 2025.',
      broadcast_type: 'directive',
      priority: 'urgent',
      target_audience: { type: 'all_chapters' },
      target_roles: [],
      target_regions: [],
      published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: null,
      attachments: [],
      requires_acknowledgment: true,
      acknowledgment_deadline: null,
      allows_comments: true,
      original_language: 'en',
      translations: {},
      received_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now.toISOString(),
      receipt: {
        id: 'r1',
        chapter_id: 'ch1',
        broadcast_id: '2',
        member_id: memberId,
        received_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        read_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        acknowledged_at: null,
        response_text: null,
        created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      }
    },
    {
      id: '3',
      national_broadcast_id: 'nat-3',
      title: 'Monthly Newsletter - December 2024',
      content: 'Yi Connect Monthly Newsletter - December 2024. In this issue: Year in Review.',
      content_html: null,
      summary: 'December 2024 edition of the Yi Connect monthly newsletter.',
      broadcast_type: 'newsletter',
      priority: 'normal',
      target_audience: { type: 'all_chapters' },
      target_roles: [],
      target_regions: [],
      published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: null,
      attachments: [],
      requires_acknowledgment: false,
      acknowledgment_deadline: null,
      allows_comments: false,
      original_language: 'en',
      translations: {},
      received_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now.toISOString(),
      receipt: {
        id: 'r2',
        chapter_id: 'ch1',
        broadcast_id: '3',
        member_id: memberId,
        received_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        read_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        acknowledged_at: null,
        response_text: null,
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      }
    }
  ];

  const unreadCount = mockBroadcasts.filter((b) => !b.receipt?.read_at).length;
  const pendingAckCount = mockBroadcasts.filter(
    (b) => b.requires_acknowledgment && !b.receipt?.acknowledged_at
  ).length;

  const allBroadcasts = mockBroadcasts;
  const unreadBroadcasts = mockBroadcasts.filter((b) => !b.receipt?.read_at);
  const pendingAckBroadcasts = mockBroadcasts.filter(
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
            <div className="text-2xl font-bold">{mockBroadcasts.length}</div>
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
              {mockBroadcasts.filter((b) => b.receipt?.acknowledged_at).length}
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
