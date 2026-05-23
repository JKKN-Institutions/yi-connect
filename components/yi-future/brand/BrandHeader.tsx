import Link from "next/link";
import Image from "next/image";

/**
 * Shared Future 6.0 brand strip used on public pages.
 * Uses the official Future 6.0 logo (gradient YUVA emblem + wordmark).
 */
export function BrandStrip({
  className = "",
}: {
  className?: string;
}): React.JSX.Element {
  return (
    <div
      aria-label="Future 6.0 by Yi YUVA"
      className={`flex items-center justify-center ${className}`}
    >
      <Image
        src="/yi-future/future-6-logo.png"
        alt="Future 6.0 by Yi YUVA"
        width={130}
        height={100}
        className="h-auto w-auto"
        priority
      />
    </div>
  );
}

export function ProgramWordmark(): React.JSX.Element {
  return (
    <Link
      href="/"
      aria-label="Future 6.0 by Yi YUVA"
      className="inline-flex items-center"
    >
      <Image
        src="/yi-future/future-6-logo.png"
        alt="Future 6.0 by Yi YUVA"
        width={36}
        height={28}
        className="h-auto w-auto"
        priority
      />
    </Link>
  );
}
