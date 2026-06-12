import Link from "next/link";
import Image from "next/image";

/**
 * YIP Brand Header — saffron bar with the programme logos.
 *
 * Used at the top of every /yip route via app/yip/layout.tsx.
 * Indian Parliament colors: saffron (#FF9933), white, green (#138808).
 *
 * Logo order (chair direction, 2026-06-12): Yi + the official
 * "Young Indians Parliament 2026" wordmark on the left; on the right
 * Thalir, Bharat One, and CII LAST (right-most).
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
          {/* Official YIP 2026 wordmark (from the Yi handbook) on a white
              chip so the tricolor lettering stays legible over the saffron
              end of the gradient. */}
          <Image
            src="/yip/logos/yip-2026-wordmark.png"
            alt="Young Indians Parliament 2026"
            width={416}
            height={118}
            priority
            className="h-9 w-auto rounded bg-white/90 px-1.5 py-1 shadow-sm ring-1 ring-black/5 sm:h-10"
          />
        </Link>

        <div className="hidden items-center gap-3 sm:flex">
          <Image
            src="/yip/logos/thalir-logo.png"
            alt="Thalir — Yi's school program"
            width={56}
            height={32}
            className="h-8 w-auto"
          />
          {/* Bharat One — "One Bharat, One Spirit". White-bg logo on a small
              rounded chip. */}
          <Image
            src="/yip/logos/bharat-one-logo.png"
            alt="One Bharat, One Spirit"
            width={269}
            height={187}
            className="h-8 w-auto rounded bg-white p-0.5 shadow-sm ring-1 ring-black/5"
          />
          {/* CII — last, right-most (chair direction). White chip keeps the
              purple mark legible over the green end of the gradient. */}
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
