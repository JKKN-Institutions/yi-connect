import { Suspense } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Send, Copy, Ban, Trash2, Calendar, Clock, Users, Eye, MousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge, ChannelBadge, PriorityBadge } from "@/components/communication/status-badges";
import { getAnnouncementById, getAnnouncementRecipients } from "@/lib/data/communication";
import { format } from "date-fns";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const announcement = await getAnnouncementById(params.id);

  if (!announcement) {
    return {
      title: "Announcement Not Found",
    };
  }

  return {
    title: `${announcement.title} | Announcements`,
    description: announcement.content.substring(0, 160),
  };
}

export default async function AnnouncementDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const announcement = await getAnnouncementById(params.id);

  if (!announcement) {
    notFound();
  }

  const canEdit = announcement.status === "draft";
  const canSend = announcement.status === "draft" || announcement.status === "scheduled";
  const canCancel = announcement.status === "scheduled";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/communication/announcements">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to announcements</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{announcement.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={announcement.status} />
              <PriorityBadge priority={announcement.priority} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" asChild>
              <Link href={`/communication/announcements/${announcement.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}

          <Button variant="outline">
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>

          {canSend && (
            <Button>
              <Send className="mr-2 h-4 w-4" />
              Send Now
            </Button>
          )}

          {canCancel && (
            <Button variant="outline" className="text-orange-600">
              <Ban className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}

          {announcement.status === "draft" && (
            <Button variant="outline" className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Message Content */}
          <Card>
            <CardHeader>
              <CardTitle>Message Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap">{announcement.content}</p>
              </div>
            </CardContent>
          </Card>

          {/* Analytics (only for sent announcements) */}
          {announcement.status === "sent" && announcement.recipients_summary && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Analytics</CardTitle>
                <CardDescription>
                  Delivery and engagement metrics for this announcement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Send className="h-4 w-4" />
                      <span className="text-sm">Delivered</span>
                    </div>
                    <p className="text-2xl font-bold">{announcement.recipients_summary.delivered}</p>
                    <p className="text-xs text-muted-foreground">
                      of {announcement.recipients_summary.total} sent
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Eye className="h-4 w-4" />
                      <span className="text-sm">Opened</span>
                    </div>
                    <p className="text-2xl font-bold">{announcement.recipients_summary.opened}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((announcement.recipients_summary.opened / announcement.recipients_summary.delivered) * 100) || 0}% open rate
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MousePointer className="h-4 w-4" />
                      <span className="text-sm">Clicked</span>
                    </div>
                    <p className="text-2xl font-bold">{announcement.recipients_summary.clicked}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((announcement.recipients_summary.clicked / announcement.recipients_summary.delivered) * 100) || 0}% click rate
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">Engagement</span>
                    </div>
                    <p className="text-2xl font-bold">{Math.round(((announcement.recipients_summary.opened + announcement.recipients_summary.clicked) / announcement.recipients_summary.total) * 100) || 0}%</p>
                    <p className="text-xs text-muted-foreground">
                      overall engagement
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recipient List (for sent announcements) */}
          {announcement.status === "sent" && (
            <Card>
              <CardHeader>
                <CardTitle>Recipients</CardTitle>
                <CardDescription>
                  Delivery status for all recipients
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<RecipientsSkeleton />}>
                  <RecipientsListWrapper announcementId={announcement.id} />
                </Suspense>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Channels */}
              <div>
                <p className="text-sm font-medium mb-2">Channels</p>
                <div className="flex flex-wrap gap-2">
                  {announcement.channels.map((channel) => (
                    <ChannelBadge key={channel} channel={channel} />
                  ))}
                </div>
              </div>

              <Separator />

              {/* Audience */}
              <div>
                <p className="text-sm font-medium mb-2">Target Audience</p>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {announcement.segment?.name || "All Active Members"}
                  </span>
                </div>
                {announcement.segment?.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {announcement.segment.description}
                  </p>
                )}
              </div>

              <Separator />

              {/* Dates */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(announcement.created_at), "PPP 'at' p")}
                    </p>
                  </div>
                </div>

                {announcement.scheduled_at && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Scheduled For</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(announcement.scheduled_at), "PPP 'at' p")}
                      </p>
                    </div>
                  </div>
                )}

                {announcement.sent_at && (
                  <div className="flex items-start gap-2">
                    <Send className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Sent</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(announcement.sent_at), "PPP 'at' p")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Creator */}
              {announcement.creator && (
                <div>
                  <p className="text-sm font-medium mb-2">Created By</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={announcement.creator.avatar_url} />
                      <AvatarFallback>
                        {`${announcement.creator.first_name?.[0] || ""}${announcement.creator.last_name?.[0] || ""}`.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {announcement.creator.first_name} {announcement.creator.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {announcement.creator.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

async function RecipientsListWrapper({ announcementId }: { announcementId: string }) {
  const recipients = await getAnnouncementRecipients(announcementId);

  if (recipients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No recipient data available
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {recipients.slice(0, 10).map((recipient) => (
        <div key={recipient.id} className="flex items-center justify-between p-2 rounded-lg border">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {recipient.member?.first_name?.[0]}{recipient.member?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">
                {recipient.member?.first_name} {recipient.member?.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {recipient.channel}
              </p>
            </div>
          </div>
          <Badge variant={recipient.status === "delivered" ? "default" : "secondary"}>
            {recipient.status}
          </Badge>
        </div>
      ))}
      {recipients.length > 10 && (
        <p className="text-sm text-muted-foreground text-center pt-2">
          and {recipients.length - 10} more recipients...
        </p>
      )}
    </div>
  );
}

function RecipientsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
