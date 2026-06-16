import Link from "next/link";

/**
 * YIP Brand Header — tricolor bar.
 *
 * LOGOS REMOVED 2026-06-16 (Yi / Bharat One / YIP wordmark / CII) — to be
 * re-added later with the finalised logo set. The previous version is in git
 * history; re-add the <Image> cluster inside the home <Link> to restore.
 * The tricolor bar + a plain-text home link are kept so layout/nav are intact.
 */
export function YipBrandHeader({
  homeHref = "/yip",
}: { homeHref?: string } = {}): React.JSX.Element {
  return (
    <header
      aria-label="YIP — Young Indians Parliament header"
      className="w-full border-b border-orange-200 bg-gradient-to-r from-[#FF9933] via-white to-[#138808]"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href={homeHref}
          aria-label="YIP home"
          className="text-sm font-semibold text-[#1a1a3e]"
        >
          Young Indians Parliament
        </Link>
      </div>
    </header>
  );
}
