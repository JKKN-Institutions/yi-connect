import Link from "next/link";
import { HelpCircle } from "lucide-react";

/**
 * Always-visible "? Help" FAB → opens the persona guide, which auto-detects the
 * viewer's lane. Mounted in the Youth Academy root layout so it rides along on
 * every screen (the single biggest discoverability lever — help one tap away).
 *
 * Bottom-right is safe here: unlike the other verticals, the youth-academy area
 * carries no Bug Reporter FAB, so there's nothing to stack with.
 */
export function GuideHelpFab() {
  return (
    <Link
      href="/youth-academy/guide"
      aria-label="How to use the platform — open the guide"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#0f2557] px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-black/5 transition-colors hover:bg-[#0f2557]/90"
    >
      <HelpCircle className="size-5" />
      <span className="hidden sm:inline">Help</span>
    </Link>
  );
}
