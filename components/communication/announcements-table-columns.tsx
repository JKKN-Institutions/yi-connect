"use client";

import { ColumnDef } from "@tanstack/react-table";
import { AnnouncementListItem } from "@/types/communication";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge, ChannelBadge } from "./status-badges";
import {
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  Edit,
  Copy,
  Send,
  Ban,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const announcementsTableColumns: ColumnDef<AnnouncementListItem>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Title
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const announcement = row.original;
      return (
        <div className="flex flex-col gap-1 max-w-md">
          <Link
            href={`/communication/announcements/${announcement.id}`}
            className="font-medium hover:text-primary transition-colors truncate"
          >
            {announcement.title}
          </Link>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {announcement.content}
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return <StatusBadge status={row.getValue("status")} />;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "channels",
    header: "Channels",
    cell: ({ row }) => {
      const channels = row.getValue("channels") as string[];
      return (
        <div className="flex flex-wrap gap-1">
          {channels.map((channel) => (
            <ChannelBadge
              key={channel}
              channel={channel as "email" | "whatsapp" | "in_app"}
            />
          ))}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const channels = row.getValue(id) as string[];
      return value.some((v: string) => channels.includes(v));
    },
  },
  {
    id: "creator",
    header: "Created By",
    cell: ({ row }) => {
      const creator = row.original.creator;
      if (!creator) return <span className="text-muted-foreground">Unknown</span>;

      const initials = `${creator.first_name?.[0] || ""}${creator.last_name?.[0] || ""}`.toUpperCase();

      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={creator.avatar_url} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm">
            {creator.first_name} {creator.last_name}
          </span>
        </div>
      );
    },
  },
  {
    id: "audience",
    header: "Audience",
    cell: ({ row }) => {
      const segmentName = row.original.segment_name;
      return (
        <span className="text-sm">
          {segmentName || "All Members"}
        </span>
      );
    },
  },
  {
    accessorKey: "scheduled_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Scheduled
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const scheduledAt = row.getValue("scheduled_at");
      if (!scheduledAt) return <span className="text-muted-foreground">-</span>;

      return (
        <div className="text-sm">
          {format(new Date(scheduledAt as string), "MMM d, yyyy")}
          <br />
          <span className="text-xs text-muted-foreground">
            {format(new Date(scheduledAt as string), "h:mm a")}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="text-sm">
          {format(new Date(row.getValue("created_at")), "MMM d, yyyy")}
        </div>
      );
    },
  },
  {
    id: "analytics",
    header: "Performance",
    cell: ({ row }) => {
      const announcement = row.original;

      if (announcement.status !== "sent" || !announcement.analytics) {
        return <span className="text-muted-foreground text-sm">-</span>;
      }

      return (
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{announcement.analytics.total_recipients}</span>
            <span className="text-muted-foreground">sent</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{announcement.analytics.open_rate}% opened</span>
            <span>•</span>
            <span>{announcement.analytics.click_rate}% clicked</span>
          </div>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const announcement = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/communication/announcements/${announcement.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>

            {announcement.status === "draft" && (
              <DropdownMenuItem asChild>
                <Link href={`/communication/announcements/${announcement.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>

            {(announcement.status === "draft" || announcement.status === "scheduled") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Send className="mr-2 h-4 w-4" />
                  Send Now
                </DropdownMenuItem>
              </>
            )}

            {announcement.status === "scheduled" && (
              <DropdownMenuItem className="text-orange-600">
                <Ban className="mr-2 h-4 w-4" />
                Cancel Schedule
              </DropdownMenuItem>
            )}

            {announcement.status === "draft" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
