"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/yip/utils";
import {
  GitBranch,
  Ruler,
  BookOpen,
  ListChecks,
  Users,
  CalendarRange,
  CalendarClock,
  ShieldCheck,
  UserCircle,
  Database,
  KeyRound,
  Lock,
  ScrollText,
  SlidersHorizontal,
  Scale,
  Globe,
  Table2,
  Trophy,
  Settings2,
} from "lucide-react";

const NAV = [
  { label: "Pipeline", href: "/yip/dashboard/admin", icon: GitBranch, exact: true },
  { label: "Coverage", href: "/yip/dashboard/admin/coverage", icon: Globe },
  { label: "People", href: "/yip/dashboard/admin/people", icon: UserCircle },
  { label: "Rubrics", href: "/yip/dashboard/admin/rubrics", icon: Ruler },
  { label: "Session Scoring", href: "/yip/dashboard/admin/session-parameters", icon: SlidersHorizontal },
  { label: "Scoring Rules", href: "/yip/dashboard/admin/scoring-rules", icon: Scale },
  { label: "Scoring Framework", href: "/yip/dashboard/admin/scoring-framework", icon: Table2 },
  { label: "Awards", href: "/yip/dashboard/admin/awards", icon: Trophy },
  { label: "Scoring Configuration", href: "/yip/dashboard/admin/scoring-config", icon: Settings2 },
  { label: "Topics", href: "/yip/dashboard/admin/topics", icon: BookOpen },
  { label: "Agenda Template", href: "/yip/dashboard/admin/agenda", icon: CalendarClock },
  { label: "Checklist Template", href: "/yip/dashboard/admin/checklist", icon: ListChecks },
  { label: "National Team", href: "/yip/dashboard/admin/team", icon: Users },
  { label: "Chapter Admins", href: "/yip/dashboard/admin/chapter-admins", icon: KeyRound },
  { label: "Seasons", href: "/yip/dashboard/admin/seasons", icon: CalendarRange },
  { label: "Branding Rules", href: "/yip/dashboard/admin/branding-rules", icon: ShieldCheck },
  { label: "Mock Data", href: "/yip/dashboard/admin/mock-data", icon: Database },
  { label: "Data Privacy", href: "/yip/dashboard/admin/privacy", icon: Lock },
  { label: "Audit Log", href: "/yip/dashboard/admin/audit-log", icon: ScrollText },
];

export function AdminShellNav() {
  const pathname = usePathname();

  return (
    // Mobile: horizontal scroller (a 19-item vertical list would eat a phone
    // screen). md+: vertical sidebar — self-start + sticky so it stays in view
    // while the page content scrolls, and scrolls internally if the list is
    // taller than the viewport (56px = the dashboard top bar height).
    <nav className="border-b border-[#1a1a3e]/5 bg-white shadow-[0_1px_3px_0_rgba(26,26,62,0.04)] md:w-56 md:shrink-0 md:self-start md:sticky md:top-0 md:max-h-[calc(100vh-56px)] md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="flex gap-0 overflow-x-auto scrollbar-hide md:flex-col md:overflow-x-visible md:py-2">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors min-h-[44px] md:border-b-0 md:border-l-2",
                active
                  ? "border-[#FF9933] text-[#FF9933] md:bg-[#FF9933]/[0.06]"
                  : "border-transparent text-[#1a1a3e]/50 hover:border-[#1a1a3e]/10 hover:text-[#1a1a3e]/80 md:hover:border-transparent md:hover:bg-[#1a1a3e]/[0.03]"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
