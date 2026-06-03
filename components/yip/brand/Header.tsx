import Link from "next/link";
import Image from "next/image";

/**
 * YIP Brand Header — saffron bar with Yi + Thalir logos and program title.
 *
 * Used at the top of every /yip route via app/yip/layout.tsx.
 * Indian Parliament colors: saffron (#FF9933), white, green (#138808).
 */
export function YipBrandHeader(): React.JSX.Element {
  return (
    <header
      aria-label="YIP — Young Indians Parliament header"
      className="w-full border-b border-orange-200 bg-gradient-to-r from-[#FF9933] via-white to-[#138808]"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/yip"
          aria-label="YIP home"
          className="flex items-center gap-3"
        >
          <Image
            src="/yip/logos/yi-logo.png"
            alt="Young Indians"
            width={44}
            height={44}
            className="h-10 w-auto"
            priority
          />
          <div className="flex flex-col leading-tight">
            <span className="font-[var(--font-heading)] text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              YIP
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-700 sm:text-xs">
              Young Indians Parliament
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Image
            src="/yip/logos/thalir-logo.png"
            alt="Thalir — Yi's school program"
            width={56}
            height={32}
            className="hidden h-8 w-auto sm:block"
          />
          <div className="hidden flex-col items-end gap-1 sm:flex">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-700 sm:text-xs">
              By Yi · CII
            </span>
            {/* Bharat One — "One Bharat, One Spirit" (replaces the former
                "Bharat Rising" tagline). White-bg logo on a small rounded chip. */}
            <Image
              src="/yip/logos/bharat-one-logo.png"
              alt="One Bharat, One Spirit"
              width={269}
              height={187}
              className="h-8 w-auto rounded bg-white p-0.5 shadow-sm ring-1 ring-black/5"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
