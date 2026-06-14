import Link from "next/link";
import Image from "next/image";

/**
 * YIP Brand Header — saffron bar with the programme logos.
 *
 * Used at the top of every /yip route via app/yip/layout.tsx.
 * Indian Parliament colors: saffron (#FF9933), white, green (#138808).
 *
 * Logo order (national team direction — Pradeep, national call
 * 2026-06-12), left → right: Yi → Bharat One → YIP 2026 wordmark →
 * CII LAST (right-most). The Thalir logo was REMOVED from the header
 * per the same direction (it named exactly these four logos).
 * Below the `sm` breakpoint only Yi + the wordmark show to avoid
 * overflow; Bharat One and CII are hidden.
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
          {/* Bharat One — "One Bharat, One Spirit". White-bg logo on a small
              rounded chip. Hidden below sm to avoid overflow. */}
          <Image
            src="/yip/logos/bharat-one-logo.png"
            alt="One Bharat, One Spirit"
            width={269}
            height={187}
            className="hidden h-8 w-auto rounded bg-white p-0.5 shadow-sm ring-1 ring-black/5 sm:block"
          />
          {/* Official YIP 2026 wordmark (from the Yi handbook) — transparent
              PNG sitting directly on the tricolor gradient (chip removed per
              national-team direction). */}
          <Image
            src="/yip/logos/yip-2026-wordmark.png"
            alt="Young Indians Parliament 2026"
            width={416}
            height={118}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <div className="hidden items-center gap-3 sm:flex">
          {/* CII — last, right-most (national-team direction). White chip
              keeps the purple mark legible over the green end of the
              gradient. */}
          <Image
            src="/yip/logos/cii-logo.png"
            alt="CII — Confederation of Indian Industry"
            width={2329}
            height={709}
            className="h-8 w-auto rounded bg-white px-1.5 py-1 shadow-sm ring-1 ring-black/5"
          />
        </div>
      </div>
    </header>
  );
}
