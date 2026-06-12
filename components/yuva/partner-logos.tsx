import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Partner logo strip — Yi · YUVA · CII, in that order. Used on the public
 * Youth Academy pages. `onDark` wraps the row in a white pill so the dark
 * marks read on the navy hero; `onLight` shows them directly.
 * Assets: public/youth-academy/{yi,yuva,cii}-logo.png.
 */
const LOGOS = [
  { src: "/youth-academy/yi-logo.png", alt: "Young Indians", w: 187, h: 151 },
  { src: "/youth-academy/yuva-logo.png", alt: "Yi YUVA", w: 600, h: 373 },
  {
    src: "/youth-academy/cii-logo.png",
    alt: "Confederation of Indian Industry",
    w: 2329,
    h: 709,
  },
] as const;

export function PartnerLogos({
  variant = "onLight",
  className,
}: {
  variant?: "onLight" | "onDark";
  className?: string;
}) {
  const row = (
    <div className="flex items-center gap-5 sm:gap-7">
      {LOGOS.map((l) => (
        <Image
          key={l.src}
          src={l.src}
          alt={l.alt}
          width={l.w}
          height={l.h}
          unoptimized
          className="h-7 w-auto object-contain sm:h-9"
        />
      ))}
    </div>
  );

  if (variant === "onDark") {
    return (
      <div
        className={cn(
          "inline-flex rounded-xl bg-white px-4 py-3 shadow-sm",
          className
        )}
      >
        {row}
      </div>
    );
  }
  return <div className={className}>{row}</div>;
}
