import Image from "next/image";

/**
 * /join-only brand lockup: Yi + Yi YUVA + Bharat 2026 + CII (top row, CII far right),
 * Future 6.0 centered below. Per Yi 2026 brand standards.
 */
export function JoinHeader(): React.JSX.Element {
  return (
    <div
      aria-label="Yi YUVA Future 6.0 brand lockup"
      className="flex flex-col items-center gap-5 py-5"
    >
      <div className="flex items-center justify-center flex-wrap gap-x-8 gap-y-4 sm:gap-x-10">
        <Image
          src="/yi-future/yi-logo.png"
          alt="Young Indians (Yi)"
          width={90}
          height={70}
          className="h-12 sm:h-14 w-auto object-contain"
          priority
        />
        <Image
          src="/yi-future/yuva-logo.png"
          alt="Yi YUVA — Learning Beyond Education"
          width={160}
          height={100}
          className="h-14 sm:h-16 w-auto object-contain"
          priority
        />
        <Image
          src="/yi-future/bharat-2026-logo.svg"
          alt="One Bharat One Spirit — Yi 2026 Theme"
          width={120}
          height={82}
          className="h-12 sm:h-14 w-auto object-contain"
          priority
        />
        <Image
          src="/cii-logo.png"
          alt="Confederation of Indian Industry (CII)"
          width={140}
          height={50}
          className="h-10 sm:h-12 w-auto object-contain"
          priority
        />
      </div>
      <Image
        src="/future-6-logo.png"
        alt="Future 6.0"
        width={180}
        height={140}
        className="h-20 sm:h-24 w-auto object-contain"
        priority
      />
    </div>
  );
}
