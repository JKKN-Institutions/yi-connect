import { AnnouncementListItem } from "@/types/communication";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, ChannelBadge } from "./status-badges";
import {
  Calendar,
  Clock,
  Users,
  Eye,
  MousePointer,
  MoreVertical,
  Edit,
  Copy,
  Send,
  Trash2,
  Ban
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AnnouncementCardProps {
  announcement: AnnouncementListItem;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onSend?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function AnnouncementCard({
  announcement,
  onEdit,
  onDuplicate,
  onSend,
  onCancel,
  onDelete,
  className
}: AnnouncementCardProps) {
  const canEdit = announcement.status === "draft";
  const canSend = announcement.status === "draft" || announcement.status === "scheduled";
  const canCancel = announcement.status === "scheduled";

  // Get creator initials
  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "?";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  // Truncate content
  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link
              href={`/communication/announcements/${announcement.id}`}
              className="block group"
            >
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">
                {announcement.title}
              </h3>
            </Link>

            {/* Meta info */}
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={announcement.creator?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {getInitials(
                      announcement.creator?.first_name,
                      announcement.creator?.last_name
                    )}
                  </AvatarFallback>
                </Avatar>
                <span>
                  {announcement.creator?.first_name} {announcement.creator?.last_name}
                </span>
              </div>

              <span>•</span>

              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(announcement.created_at), "MMM d, yyyy")}</span>
              </div>

              {announcement.scheduled_at && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      Scheduled for {format(new Date(announcement.scheduled_at), "MMM d, p")}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && onEdit && (
                <DropdownMenuItem onClick={() => onEdit(announcement.id)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(announcement.id)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
              )}
              {canSend && onSend && (
                <DropdownMenuItem onClick={() => onSend(announcement.id)}>
                  <Send className="mr-2 h-4 w-4" />
                  Send Now
                </DropdownMenuItem>
              )}
              {canCancel && onCancel && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onCancel(announcement.id)}
                    className="text-orange-600"
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Cancel Schedule
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && announcement.status === "draft" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(announcement.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Content Preview */}
        <p className="text-sm text-muted-foreground mb-3">
          {truncateContent(announcement.content)}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <StatusBadge status={announcement.status} />
          {announcement.channels.map((channel) => (
            <ChannelBadge key={channel} channel={channel} />
          ))}
        </div>

        {/* Target Audience */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {announcement.segment_name ? (
              <>Segment: {announcement.segment_name}</>
            ) : (
              <>All Members</>
            )}
          </span>
        </div>
      </CardContent>

      {/* Analytics Footer (only for sent announcements) */}
      {announcement.status === "sent" && announcement.analytics && (
        <CardFooter className="pt-3 border-t bg-muted/30">
          <div className="grid grid-cols-4 gap-4 w-full text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Send className="h-3 w-3" />
                <span className="text-xs">Sent</span>
              </div>
              <p className="text-lg font-semibold">
                {announcement.analytics.total_recipients}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Eye className="h-3 w-3" />
                <span className="text-xs">Opened</span>
              </div>
              <p className="text-lg font-semibold">
                {announcement.analytics.opened}
              </p>
              <p className="text-xs text-muted-foreground">
                {announcement.analytics.open_rate}%
              </p>
            </div>

            <div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <MousePointer className="h-3 w-3" />
                <span className="text-xs">Clicked</span>
              </div>
              <p className="text-lg font-semibold">
                {announcement.analytics.clicked}
              </p>
              <p className="text-xs text-muted-foreground">
                {announcement.analytics.click_rate}%
              </p>
            </div>

            <div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Users className="h-3 w-3" />
                <span className="text-xs">Engagement</span>
              </div>
              <p className="text-lg font-semibold">
                {announcement.analytics.engagement_rate}%
              </p>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

// Grid variant for list views
export function AnnouncementCardGrid({
  announcements,
  ...props
}: {
  announcements: AnnouncementListItem[];
} & Omit<AnnouncementCardProps, "announcement">) {
  if (announcements.length === 0) {
    return (
      <div className="text-center py-12">
        <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No announcements yet</h3>
        <p className="text-sm text-muted-foreground">
          Create your first announcement to start communicating with your members
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {announcements.map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          {...props}
        />
      ))}
    </div>
  );
}
