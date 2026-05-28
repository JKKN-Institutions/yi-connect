import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Scale, History, LogOut } from "lucide-react";

interface JurySession {
  type: "jury";
  id: string;
  name: string;
  eventId: string;
}

function parseJurySession(raw: string | undefined): JurySession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type === "jury" && parsed.id && parsed.name && parsed.eventId) {
      return parsed as JurySession;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function JuryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("yip_session")?.value;
  const session = parseJurySession(raw);

  if (!session) {
    redirect("/yip/join");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 overflow-x-hidden">
      {/* Header -- fixed for mobile */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#FF9933]">
              <Scale className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                YIP Jury Scoring
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {session.name}
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {/* Score nav — min 44×44 touch target */}
            <Link
              href="/yip/jury"
              className="flex items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              style={{ minHeight: "44px", minWidth: "44px", display: "flex", alignItems: "center" }}
            >
              <Scale className="size-5" />
              <span className="hidden sm:inline">Score</span>
            </Link>
            {/* History nav */}
            <Link
              href="/yip/jury/history"
              className="flex items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              style={{ minHeight: "44px", minWidth: "44px", display: "flex", alignItems: "center" }}
            >
              <History className="size-5" />
              <span className="hidden sm:inline">History</span>
            </Link>
            {/* Exit — icon only, needs aria-label */}
            <Link
              href="/yip/join"
              className="flex items-center justify-center rounded-lg px-3 text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
              style={{ minHeight: "44px", minWidth: "44px" }}
              aria-label="Exit jury session"
              title="Exit"
            >
              <LogOut className="size-5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-4 mx-auto w-full max-w-lg overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
