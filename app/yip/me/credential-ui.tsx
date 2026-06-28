import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Shared visual language for the redesigned /yip/me ("Member's Credential").
 *
 * The YIP brand tokens (bg-ivory/text-navy/text-saffron/font-heading) are dead —
 * app/yip/globals.css is imported nowhere — so we use literal hex everywhere and
 * apply the Playfair serif through the one live variable next/font sets on the
 * layout wrapper (--font-heading). These primitives keep every section quiet and
 * consistent so the credential hero stays the one bold thing on the page.
 */
export const INK = "#1a1a3e"; // navy ink
export const SAFFRON = "#C2691A"; // readable saffron on light paper
export const GREEN = "#138808";
export const GOLD = "#C9A24E";
export const SERIF = {
  fontFamily: "var(--font-heading), ui-serif, Georgia, serif",
} as const;

/** Opacity helper → 8-digit hex (e.g. inkA(0.1) = "#1a1a3e1a"). */
export function inkA(alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${INK}${a}`;
}

/** Standard section card — white paper, hairline ink border, optional accent rule. */
export function SectionShell({
  children,
  accent,
  className,
}: {
  children: ReactNode;
  /** A CSS background for a 3px top rule (e.g. a brand color or gradient). */
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl ${className ?? ""}`}
      style={{ background: "#ffffff", border: `1px solid ${inkA(0.08)}` }}
    >
      {accent && <div className="h-[3px] w-full" style={{ background: accent }} />}
      {children}
    </div>
  );
}

/** Eyebrow + serif title + optional icon chip — the consistent section header. */
export function SectionHeading({
  eyebrow,
  title,
  icon: Icon,
  accent = SAFFRON,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  icon?: LucideIcon;
  accent?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {Icon && (
          <div
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${accent}1f` }}
          >
            <Icon className="size-4" style={{ color: accent }} />
          </div>
        )}
        <div>
          {eyebrow && (
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: accent }}
            >
              {eyebrow}
            </p>
          )}
          <h2
            className="text-[16px] font-semibold leading-snug"
            style={{ ...SERIF, color: INK }}
          >
            {title}
          </h2>
        </div>
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
