import Link from "next/link";
import { ProgramWordmark } from "./BrandHeader";

export function RoleHeader({
  sessionName,
  roleLabel,
}: {
  sessionName?: string;
  roleLabel: string;
}): React.JSX.Element {
  return (
    <header className="bg-white border-b border-navy/10 sticky top-0 z-20 safe-top">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ProgramWordmark />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[10px] font-semibold tracking-widest text-navy/50 uppercase">
            {roleLabel}
          </span>
          {sessionName && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-navy/5 text-navy text-xs font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-yi-green" />
              <span className="max-w-[150px] truncate">{sessionName}</span>
            </div>
          )}
          <Link
            href="/yi-future/join"
            className="text-xs text-navy/50 hover:text-navy transition-colors"
          >
            Sign out
          </Link>
        </div>
      </div>
    </header>
  );
}
