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
  ShieldCheck,
  UserCircle,
  Database,
  KeyRound,
} from "lucide-react";

const NAV = [
  { label: "Pipeline", href: "/dashboard/admin", icon: GitBranch, exact: true },
  { label: "People", href: "/dashboard/admin/people", icon: UserCircle },
  { label: "Rubrics", href: "/dashboard/admin/rubrics", icon: Ruler },
  { label: "Topics", href: "/dashboard/admin/topics", icon: BookOpen },
  { label: "Checklist Template", href: "/dashboard/admin/checklist", icon: ListChecks },
  { label: "National Team", href: "/dashboard/admin/team", icon: Users },
  { label: "Chapter Admins", href: "/dashboard/admin/chapter-admins", icon: KeyRound },
  { label: "Seasons", href: "/dashboard/admin/seasons", icon: CalendarRange },
  { label: "Branding Rules", href: "/dashboard/admin/branding-rules", icon: ShieldCheck },
  { label: "Mock Data", href: "/dashboard/admin/mock-data", icon: Database },
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
