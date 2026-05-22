import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";

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
  const cookieStore = await cookies();
  const raw = cookieStore.get("yip_session")?.value;
  const session = parseParticipantSession(raw);

  if (!session) {
    redirect("/yip/join");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#FFF8F0] via-white to-[#F0FFF4]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#FF9933]/20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF9933] to-[#E68A2E]">
              <span className="text-sm font-bold text-white">YI</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                Young Indians Parliament
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {session.name}
              </p>
            </div>
          </div>

          <Link
            href="/yip/join"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            title="Exit"
          >
            <LogOut className="size-4" />
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-5 mx-auto w-full max-w-lg">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white/50 py-4 text-center">
        <p className="text-[11px] text-gray-400">
          Young Indians (Yi) &middot; Confederation of Indian Industry
        </p>
      </footer>
    </div>
  );
}
