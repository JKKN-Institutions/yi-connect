import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { CHAT_ENABLED } from "@/lib/yip/chat-config";
import { ChatModerationClient } from "./chat-moderation-client";

/**
 * Chat moderation — organiser-only oversight of the in-app community chat.
 *
 * This page is the moderators' surface (default: the chapter chair +
 * organisers from the Yi directory) (chapter organiser = getYipEventAccess(...).canManage): channel
 * freeze/unfreeze, message removal, the student-report queue, DM oversight
 * (read-only student↔YUVA threads) and mutes. It is gated by canManage —
 * view-only roles are denied (FAIL CLOSED).
 */
export default async function ChatModerationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/yip/login");

  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's chat. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="Chat moderation is restricted to chapter organisers and chairs for this event." />
    );
  }

  // Flag-off shell: show the page frame with a clear notice, never data.
  if (!CHAT_ENABLED) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[#1a1a3e]/5 bg-white py-20 text-center shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-[#FF9933]/10">
          <MessagesSquare className="size-7 text-[#FF9933]" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-[#1a1a3e]">
          Community chat is not enabled
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[#1a1a3e]/50">
          The in-app chat (and this moderation panel) is switched off. Set
          NEXT_PUBLIC_YIP_CHAT_ENABLED=true and redeploy to turn it on.
        </p>
      </div>
    );
  }

  return <ChatModerationClient eventId={id} eventName={event.name} />;
}
