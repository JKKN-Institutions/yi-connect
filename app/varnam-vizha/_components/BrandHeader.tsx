import Link from "next/link";

/** Varnam Vizha brand header (bilingual wordmark + minimal nav). */
export function VarnamHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#3B0A45]/10 bg-[#FFF9F0]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/varnam-vizha" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-7 w-7 rounded-full bg-gradient-to-br from-[#F4A300] via-[#D6336C] to-[#3B0A45]"
          />
          <span className="font-[family-name:var(--font-vv-display)] text-lg font-bold leading-none text-[#3B0A45]">
            Varnam Vizha{" "}
            <span className="text-[#D6336C]">·</span>{" "}
            <span lang="ta">வர்ணம் விழா</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-[#2B0A33]/80">
          <Link href="/varnam-vizha" className="hover:text-[#D6336C]">
            Home
          </Link>
          <Link href="/varnam-vizha/events" className="hover:text-[#D6336C]">
            Events
          </Link>
          <Link
            href="/varnam-vizha/dashboard"
            className="rounded-full bg-[#3B0A45] px-4 py-1.5 text-white transition-colors hover:bg-[#2B0A33]"
          >
            Committee
          </Link>
        </nav>
      </div>
    </header>
  );
}
