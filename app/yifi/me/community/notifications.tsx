"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CommunityNotification } from "@/lib/yifi/community/types";
import { markNotificationRead } from "@/app/yifi/community/actions";

const KIND_LABEL: Record<CommunityNotification["kind"], string> = {
  new_reply: "New reply on your post",
  best_answer: "Your reply was marked best answer",
  helper_suggestion: "You could help with this post",
};

const KIND_EMOJI: Record<CommunityNotification["kind"], string> = {
  new_reply: "💬",
  best_answer: "✅",
  helper_suggestion: "🤝",
};

export function Notifications({
  notifications,
}: {
  notifications: CommunityNotification[];
}) {
  if (notifications.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <p className="text-white/50 text-sm">
          No notifications yet. You&apos;ll hear here when someone replies.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {notifications.map((n) => (
        <NotificationRow key={n.id} notification={n} />
      ))}
    </ul>
  );
}

function NotificationRow({ notification }: { notification: CommunityNotification }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!notification.is_read) {
      startTransition(async () => {
        await markNotificationRead(notification.id);
        if (notification.post_id) {
          router.push(`/yifi/community/${notification.post_id}`);
        } else {
          router.refresh();
        }
      });
    } else if (notification.post_id) {
      router.push(`/yifi/community/${notification.post_id}`);
    }
  }

  function handleMarkRead(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await markNotificationRead(notification.id);
      router.refresh();
    });
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`flex items-start gap-3 rounded-xl p-3 border cursor-pointer transition-colors ${
          notification.is_read
            ? "bg-white/5 border-white/10 hover:border-white/20"
            : "bg-[#FD7215]/10 border-[#FD7215]/30 hover:border-[#FD7215]/50"
        } ${isPending ? "opacity-60" : ""}`}
      >
        <span className="text-lg leading-none mt-0.5">
          {KIND_EMOJI[notification.kind]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-medium">
            {KIND_LABEL[notification.kind]}
          </p>
          {notification.post_title && (
            <p className="text-white/50 text-xs mt-0.5 truncate">
              {notification.post_title}
            </p>
          )}
        </div>
        {!notification.is_read && (
          <button
            type="button"
            onClick={handleMarkRead}
            disabled={isPending}
            className="shrink-0 text-[11px] text-white/50 hover:text-white transition-colors"
          >
            Mark read
          </button>
        )}
      </div>
    </li>
  );
}
