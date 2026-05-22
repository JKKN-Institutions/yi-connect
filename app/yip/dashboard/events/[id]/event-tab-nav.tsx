"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/yip/utils";
import {
  LayoutDashboard,
  Users,
  Shuffle,
  Scale,
  MessageSquare,
  FileText,
  Radio,
  Star,
  Trophy,
  Award,
  Flag,
  Gavel,
  ListChecks,
  IndianRupee,
  Shield,
  ShieldCheck,
  ClipboardPaste,
  Images,
  MessageCircleHeart,
} from "lucide-react";

const TABS = [
  { label: "Overview", href: "", icon: LayoutDashboard },
  { label: "Checklist", href: "/checklist", icon: ListChecks },
  { label: "Registrations", href: "/registrations", icon: ClipboardPaste },
  { label: "Participants", href: "/participants", icon: Users },
  { label: "Fees", href: "/fees", icon: IndianRupee },
  { label: "Parties", href: "/parties", icon: Flag },
  { label: "Allocation", href: "/allocation", icon: Shuffle },
  { label: "Jury", href: "/jury", icon: Scale },
  { label: "Volunteers", href: "/volunteers", icon: Shield },
  { label: "Branding", href: "/branding", icon: ShieldCheck },
  { label: "Questions", href: "/questions", icon: MessageSquare },
  { label: "Motions", href: "/motions", icon: Gavel },
  { label: "Bills", href: "/bills", icon: FileText },
  { label: "Control", href: "/control", icon: Radio },
  { label: "Media", href: "/media", icon: Images },
  { label: "Scoring", href: "/scoring", icon: Star },
  { label: "Results", href: "/results", icon: Trophy },
  { label: "Feedback", href: "/feedback", icon: MessageCircleHeart },
  { label: "Certificates", href: "/certificates", icon: Award },
] as const;

export function EventTabNav({
  eventId,
  eventStatus,
}: {
  eventId: string;
  eventStatus?: string;
}) {
  const pathname = usePathname();
  const basePath = `/dashboard/events/${eventId}`;

  const visibleTabs = TABS.filter((tab) => {
    if (tab.label === "Certificates") {
      return eventStatus === "results_published";
    }
    return true;
  });

  return (
    <nav className="border-b border-[#1a1a3e]/5 shadow-[0_1px_3px_0_rgba(26,26,62,0.04)]">
      <div className="-mb-px flex gap-0 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
        {visibleTabs.map((tab) => {
          const tabPath = `${basePath}${tab.href}`;
          const isActive =
            tab.href === ""
              ? pathname === basePath
              : pathname.startsWith(tabPath);

          return (
            <Link
              key={tab.label}
              href={tabPath}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                isActive
                  ? "border-[#FF9933] text-[#FF9933]"
                  : "border-transparent text-[#1a1a3e]/40 hover:border-[#1a1a3e]/10 hover:text-[#1a1a3e]/70"
              )}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
