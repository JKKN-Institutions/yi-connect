"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Check, Eye, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { InAppNotification } from "@/types/communication";
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from "@/app/actions/communication";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface NotificationBellProps {
  memberId: string;
  initialNotifications?: InAppNotification[];
  initialUnreadCount?: number;
}

export function NotificationBell({
  memberId,
  initialNotifications = [],
  initialUnreadCount = 0
}: NotificationBellProps) {
  const [notifications, setNotifications] = useState<InAppNotification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Supabase Realtime subscription for instant notifications
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    // Subscribe to new notifications for this member
    const channel = supabase
      .channel(`notifications:${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "in_app_notifications",
          filter: `member_id=eq.${memberId}`,
        },
        (payload) => {
          const newNotification = payload.new as InAppNotification;

          // Add to notification list
          setNotifications((prev) => [newNotification, ...prev]);

          // Increment unread count
          setUnreadCount((prev) => prev + 1);

          // Show toast notification
          toast.custom(
            (t) => (
              <div
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg shadow-lg bg-card border max-w-md",
                  t.visible ? "animate-in slide-in-from-top" : "animate-out slide-out-to-top"
                )}
              >
                <div className="p-2 rounded-full bg-primary/10">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{newNotification.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {newNotification.message}
                  </p>
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            ),
            {
              duration: 5000,
              position: "top-right",
            }
          );

          // Play notification sound (optional)
          if (typeof Audio !== "undefined") {
            const audio = new Audio("/notification.mp3");
            audio.volume = 0.3;
            audio.play().catch(() => {
              // Ignore audio play errors (user interaction required)
            });
          }
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId]);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    setIsLoading(true);

    try {
      const result = await markNotificationAsRead(notificationId);

      if (result.success) {
        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
          )
        );

        // Decrement unread count
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        toast.error(result.message || "Failed to mark as read");
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await markAllNotificationsAsRead(memberId);

      if (result.success) {
        // Update local state
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
        );

        // Reset unread count
        setUnreadCount(0);

        toast.success("All notifications marked as read");
      } else {
        toast.error(result.message || "Failed to mark all as read");
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  const handleDelete = useCallback(async (notificationId: string) => {
    setIsLoading(true);

    try {
      const result = await deleteNotification(notificationId);

      if (result.success) {
        // Remove from local state
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

        // Decrement unread count if it was unread
        const notification = notifications.find((n) => n.id === notificationId);
        if (notification && !notification.read_at) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        toast.success("Notification deleted");
      } else {
        toast.error(result.message || "Failed to delete notification");
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [notifications]);

  const getCategoryIcon = (category: string) => {
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
    return icons[category] || "📌";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[400px] p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold">Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isLoading}
                className="h-8 text-xs"
              >
                <Check className="mr-1 h-3 w-3" />
                Mark all read
              </Button>
            )}

            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/communication/notifications/settings">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Notification settings</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Bell className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                You're all caught up! Check back later for new updates.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-accent/50 transition-colors cursor-pointer group",
                    !notification.read_at && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="text-lg">
                        {getCategoryIcon(notification.category)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm line-clamp-1">
                          {notification.title}
                        </p>
                        {!notification.read_at && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.read_at && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                              disabled={isLoading}
                            >
                              <Eye className="h-3 w-3" />
                              <span className="sr-only">Mark as read</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(notification.id);
                            }}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-3 w-3" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </div>

                      {/* Action Button */}
                      {notification.action_url && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          asChild
                        >
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
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button variant="ghost" className="w-full text-sm" asChild>
                <Link href="/communication/notifications">
                  View All Notifications
                </Link>
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
