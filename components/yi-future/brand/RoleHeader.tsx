import Link from "next/link";
import { ProgramWordmark } from "./BrandHeader";
import { signOutDelegate } from "@/app/yi-future/actions/sign-out";

export function RoleHeader({
  sessionName,
  roleLabel,
  notif,
}: {
  sessionName?: string;
  roleLabel: string;
  /** Optional notification badge (e.g. unread announcements) for the viewer. */
  notif?: { href: string; count: number };
}): React.JSX.Element {
  return (
    <header className="bg-white border-b border-navy/10 sticky top-0 z-20 safe-top">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ProgramWordmark href="/yi-future/me" />
        </div>
        <div className="flex items-center gap-3">
          {notif && notif.count > 0 && (
            <Link
              href={notif.href}
              aria-label={`${notif.count} unread announcements`}
              className="relative inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-navy/5"
              title={`${notif.count} unread`}
            >
              <span className="text-base leading-none">🔔</span>
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                style={{ background: "#F5A623" }}
              >
                {notif.count > 9 ? "9+" : notif.count}
              </span>
            </Link>
          )}
          <span className="hidden sm:inline text-[10px] font-semibold tracking-widest text-navy/50 uppercase">
            {roleLabel}
          </span>
          {sessionName && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-navy/5 text-navy text-xs font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-yi-green" />
              <span className="max-w-[150px] truncate">{sessionName}</span>
            </div>
          )}
          <form action={signOutDelegate}>
            <button
              type="submit"
              className="text-xs text-navy/50 hover:text-navy transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
