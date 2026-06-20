"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/yip/utils";

type Sibling = { href: string; label: string };

// Merged sidebar sections: each group shows a sub-tab strip on its member
// routes, so several related pages read as one tabbed section while staying
// separate routes (no page surgery). The sidebar shows only the first sibling
// of each group as a single nav item.
export const MERGED_GROUPS: { siblings: Sibling[]; scoreGated?: boolean }[] = [
  {
    siblings: [
      { href: "/participants", label: "Participants" },
      { href: "/registrations", label: "Registrations" },
    ],
  },
  {
    siblings: [
      { href: "/volunteers", label: "Volunteers" },
      { href: "/yuva", label: "YUVA Desks" },
    ],
  },
  {
    // Score-bearing — hidden for roles that can't view scores (the pages also
    // gate themselves; this just avoids dangling sub-tabs).
    scoreGated: true,
    siblings: [
      { href: "/scoring", label: "Scoring" },
      { href: "/committee-scoring", label: "Committee Scores" },
    ],
  },
  {
    siblings: [
      { href: "/questions", label: "Questions" },
      { href: "/motions", label: "Motions" },
      { href: "/bills", label: "Bills" },
    ],
  },
];

export function EventSectionSubTabs({
  eventId,
  canViewScores = false,
  privacyMode = false,
}: {
  eventId: string;
  canViewScores?: boolean;
  /** DPDP: privacy-mode events hide the full-PII Registrations sub-tab. */
  privacyMode?: boolean;
}) {
  const pathname = usePathname();
  const base = `/yip/dashboard/events/${eventId}`;
  const isOn = (href: string) =>
    pathname === `${base}${href}` || pathname.startsWith(`${base}${href}/`);

  const group = MERGED_GROUPS.find((g) => g.siblings.some((s) => isOn(s.href)));
  if (!group) return null;
  if (group.scoreGated && !canViewScores) return null;

  // Privacy mode: drop the bulk-PII Registrations tab (minimal registration
  // happens on the Participants tab instead).
  const siblings = privacyMode
    ? group.siblings.filter((s) => s.href !== "/registrations")
    : group.siblings;
  if (siblings.length === 0) return null;

  return (
    <nav
      aria-label="Section tabs"
      className="mb-4 flex flex-wrap gap-1 border-b border-[#1a1a3e]/10"
    >
      {siblings.map((s) => {
        const href = `${base}${s.href}`;
        const active = isOn(s.href);
        return (
          <Link
            key={s.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-[#FF9933] text-[#FF9933]"
                : "border-transparent text-[#1a1a3e]/55 hover:text-[#1a1a3e]"
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
