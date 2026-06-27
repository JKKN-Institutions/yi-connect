import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import Link from "next/link";
import { LogOut, MessageSquare, Home } from "lucide-react";
import { CHAT_ENABLED } from "@/lib/yip/chat-config";
import { GuideLauncher } from "@/components/yip/guide";
import { GUIDES } from "@/lib/yip/guide/content";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getPrimaryDesk } from "@/lib/yip/participant-desk";
import { ParticipantBottomNav } from "@/app/yip/me/_components/participant-bottom-nav";

interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

function parseParticipantSession(
  raw: string | undefined
): ParticipantSession | null {
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

export default async function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getYipSession();

  if (!session || session.type !== "participant") {
    redirect("/yip/join");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#FFF8F0] via-white to-[#F0FFF4]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#FF9933]/20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Home affordance — tapping the mark/title returns to /yip/me from ANY
              sub-page (every leadership desk, vote, motion, questions, bill, etc.)
              for EVERY role. Critical because YIP is an installed standalone PWA
              (manifest display:'standalone') with no browser back button, so
              without this a participant who opens a desk is otherwise stranded. */}
          <Link
            href="/yip/me"
            aria-label="Back to my dashboard"
            title="Back to my dashboard"
            className="flex items-center gap-2.5 min-w-0 -ml-1 rounded-lg px-1.5 py-1 hover:bg-[#FF9933]/10 transition-colors"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#FF9933]/10 text-[#FF9933]">
              <Home className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                Young Indians Parliament
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {session.name}
              </p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            {/* Chat entry point — only rendered when the chat flag is ON.
                Flag off (the default) → no link, nothing changes for students. */}
            {CHAT_ENABLED && (
              <Link
                href="/yip/me/chat"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#FF9933] hover:bg-[#FF9933]/10 transition-colors"
                title="Community chat"
              >
                <MessageSquare className="size-4" />
                <span className="hidden sm:inline">Chat</span>
              </Link>
            )}
            <GuideLauncher
              guide={GUIDES.student}
              variant="navlink"
              className="w-auto rounded-lg px-3 py-2 text-[#FF9933] hover:bg-[#FF9933]/10 hover:text-[#FF9933]"
            />
            <Link
              href="/yip/join"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              title="Exit"
            >
              <LogOut className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-5 mx-auto w-full max-w-lg">
        {children}
      </main>

      {/* Floating Help — student lane */}
      <GuideLauncher guide={GUIDES.student} variant="fab" />

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white/50 py-4 text-center">
        <p className="text-[11px] text-gray-400">
          Young Indians Parliament
        </p>
      </footer>
    </div>
  );
}
