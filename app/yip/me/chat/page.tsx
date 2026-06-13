import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { MessageSquare } from "lucide-react";
import { CHAT_ENABLED } from "@/lib/yip/chat-config";
import { ChatClient } from "./chat-client";

// ─── Session parsing (matches app/yip/me/layout.tsx) ────────────

interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

function parseSession(raw: string | undefined): ParticipantSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed.type === "participant" &&
      parsed.id &&
      parsed.name &&
      parsed.eventId
    ) {
      return parsed as ParticipantSession;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function CommunityChatPage() {
  const session = await getYipSession();

  // The layout already gates this, but be defensive.
  if (!session || session.type !== "participant") redirect("/yip/join");

  // When the flag is off, students see a placeholder only.
  if (!CHAT_ENABLED) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF9933]/15 to-[#138808]/15">
          <MessageSquare className="size-8 text-[#FF9933]" />
        </div>
        <h1 className="mt-5 text-lg font-semibold text-gray-900">
          Community chat is coming soon
        </h1>
        <p className="mt-2 max-w-xs text-sm text-gray-500">
          Connect with your party, committee and YUVA mentors. We&apos;re
          getting it ready — check back during your event.
        </p>
      </div>
    );
  }

  return (
    <ChatClient
      eventId={session.eventId}
      participantId={session.id}
      participantName={session.name}
    />
  );
}
