import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { MessageSquare } from "lucide-react";
import { CHAT_ENABLED } from "@/lib/yip/chat-config";
import { ChatClient } from "./chat-client";
import {
  SectionShell,
  INK,
  SAFFRON,
  SERIF,
  inkA,
} from "../credential-ui";

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

export default async function CommunityChatPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const session = await getYipSession();

  // The layout already gates this, but be defensive.
  if (!session || session.type !== "participant") redirect("/yip/join");

  // Deep-link target (e.g. ?channel=announcement from the /yip/me news strip).
  const { channel } = await searchParams;
  const openChannelKind =
    channel === "announcement" || channel === "party" || channel === "committee"
      ? channel
      : undefined;

  // When the flag is off, students see a placeholder only.
  if (!CHAT_ENABLED) {
    return (
      <div className="mx-auto max-w-md py-10">
        <SectionShell accent={SAFFRON}>
          <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF9933]/15 to-[#138808]/15">
              <MessageSquare className="size-8 text-[#FF9933]" />
            </div>
            <p
              className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: SAFFRON }}
            >
              The House Floor
            </p>
            <h1
              className="mt-0.5 text-lg font-semibold"
              style={{ ...SERIF, color: INK }}
            >
              Community chat is coming soon
            </h1>
            <p className="mt-2 max-w-xs text-sm" style={{ color: inkA(0.6) }}>
              Connect with your party, committee and YUVA mentors. We&apos;re
              getting it ready — check back during your event.
            </p>
          </div>
        </SectionShell>
      </div>
    );
  }

  return (
    <ChatClient
      eventId={session.eventId}
      participantId={session.id}
      participantName={session.name}
      openChannelKind={openChannelKind}
    />
  );
}
