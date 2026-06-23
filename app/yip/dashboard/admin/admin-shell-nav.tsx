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
    <nav className="border-b border-[#1a1a3e]/5 bg-white shadow-[0_1px_3px_0_rgba(26,26,62,0.04)]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="-mb-px flex gap-0 overflow-x-auto scrollbar-hide">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors min-h-[44px]",
                  active
                    ? "border-[#FF9933] text-[#FF9933]"
                    : "border-transparent text-[#1a1a3e]/50 hover:border-[#1a1a3e]/10 hover:text-[#1a1a3e]/80"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
