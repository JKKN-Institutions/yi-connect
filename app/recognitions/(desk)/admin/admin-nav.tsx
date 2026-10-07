"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS: Array<{ href: string; label: string }> = [
  { href: "/recognitions/admin", label: "Overview" },
  { href: "/recognitions/admin/timeline", label: "Timeline" },
  { href: "/recognitions/admin/awards", label: "Awards" },
  { href: "/recognitions/admin/chapters", label: "Chapters" },
  { href: "/recognitions/admin/evaluators", label: "Evaluators" },
  { href: "/recognitions/admin/team", label: "Team" },
  { href: "/recognitions/admin/health-card", label: "Health Card" },
  { href: "/recognitions/admin/citations", label: "Citations" },
  { href: "/recognitions/admin/reports", label: "Reports" },
  { href: "/recognitions/admin/audit", label: "Audit" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="rx-ad-nav" aria-label="Control room sections">
      {SECTIONS.map((s) => {
        const current = s.href === "/recognitions/admin" ? pathname === s.href : pathname.startsWith(s.href);
        return (
          <Link key={s.href} href={s.href} aria-current={current ? "page" : undefined}>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
