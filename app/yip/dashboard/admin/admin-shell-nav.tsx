"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Globe2,
  Landmark,
  Table2,
  Trophy,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";

type Tab = { label: string; href: string; icon: LucideIcon; exact?: boolean };
type TabGroup = { title: string; tabs: Tab[] };

// Grouped to read like the per-event sidebar (event-tab-nav.tsx): a pinned
// headerless "Overview" on top, then themed sections. Same labels/links/icons
// as before — only the grouping + chrome changed.
const GROUPS: TabGroup[] = [
  {
    title: "",
    tabs: [
      { label: "Pipeline", href: "/yip/dashboard/admin", icon: GitBranch, exact: true },
      { label: "Coverage", href: "/yip/dashboard/admin/coverage", icon: Globe },
      { label: "National", href: "/yip/dashboard/admin/national", icon: Globe2 },
    ],
  },
  {
    title: "People & Access",
    tabs: [
      { label: "People", href: "/yip/dashboard/admin/people", icon: UserCircle },
      { label: "National Team", href: "/yip/dashboard/admin/team", icon: Users },
      { label: "Chapter Admins", href: "/yip/dashboard/admin/chapter-admins", icon: KeyRound },
    ],
  },
  {
    title: "Scoring",
    tabs: [
      { label: "Rubrics", href: "/yip/dashboard/admin/rubrics", icon: Ruler },
      { label: "Session Scoring", href: "/yip/dashboard/admin/session-parameters", icon: SlidersHorizontal },
      { label: "Scoring Rules", href: "/yip/dashboard/admin/scoring-rules", icon: Scale },
      { label: "Scoring Framework", href: "/yip/dashboard/admin/scoring-framework", icon: Table2 },
      { label: "Scoring Configuration", href: "/yip/dashboard/admin/scoring-config", icon: Settings2 },
      { label: "Awards", href: "/yip/dashboard/admin/awards", icon: Trophy },
    ],
  },
  {
    title: "Templates & Setup",
    tabs: [
      { label: "Topics", href: "/yip/dashboard/admin/topics", icon: BookOpen },
      { label: "Taxonomy", href: "/yip/dashboard/admin/taxonomy", icon: Landmark },
      { label: "Agenda Template", href: "/yip/dashboard/admin/agenda", icon: CalendarClock },
      { label: "Checklist Template", href: "/yip/dashboard/admin/checklist", icon: ListChecks },
      { label: "Seasons", href: "/yip/dashboard/admin/seasons", icon: CalendarRange },
      { label: "Branding Rules", href: "/yip/dashboard/admin/branding-rules", icon: ShieldCheck },
    ],
  },
  {
    title: "System",
    tabs: [
      { label: "Mock Data", href: "/yip/dashboard/admin/mock-data", icon: Database },
      { label: "Data Privacy", href: "/yip/dashboard/admin/privacy", icon: Lock },
      { label: "Audit Log", href: "/yip/dashboard/admin/audit-log", icon: ScrollText },
    ],
  },
];

const COLLAPSE_KEY = "yip-admin-nav-collapsed";

function isActive(tab: Tab, pathname: string) {
  return tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
}

export function AdminShellNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Collapsed icon-rail state, remembered per browser. Default expanded on the
  // server + first client render to avoid a hydration mismatch; sync from
  // localStorage after mount.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  const activeTab = GROUPS.flatMap((g) => g.tabs).find((t) =>
    isActive(t, pathname)
  );

  return (
    <>
      {/* Mobile (< lg): native grouped dropdown — compact, zero horizontal scroll. */}
      <div className="lg:hidden mb-4">
        <label htmlFor="admin-section" className="sr-only">
          Admin section
        </label>
        <select
          id="admin-section"
          value={activeTab?.href ?? GROUPS[0].tabs[0].href}
          onChange={(e) => router.push(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-[#1a1a3e]/15 bg-white px-3 py-2 text-sm font-medium text-[#1a1a3e] shadow-sm focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
        >
          {GROUPS.map((g) =>
            g.title ? (
              <optgroup key={g.title} label={g.title}>
                {g.tabs.map((tab) => (
                  <option key={tab.href} value={tab.href}>
                    {tab.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              g.tabs.map((tab) => (
                <option key={tab.href} value={tab.href}>
                  {tab.label}
                </option>
              ))
            )
          )}
        </select>
      </div>

      {/* Desktop (≥ lg): vertical grouped sidebar, collapsible to an icon rail. */}
      <nav
        aria-label="Admin sections"
        className={cn(
          "hidden lg:flex lg:flex-col lg:shrink-0 lg:self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overflow-x-hidden scrollbar-hide transition-[width] duration-200",
          collapsed ? "lg:w-14" : "lg:w-44 lg:pr-2"
        )}
      >
        {/* Collapse / expand toggle */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
          className={cn(
            "mb-1 flex h-9 w-9 items-center justify-center rounded-md text-[#1a1a3e]/40 transition-colors hover:bg-[#1a1a3e]/5 hover:text-[#1a1a3e]",
            collapsed ? "mx-auto" : "ml-auto"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>

        {GROUPS.map((group) => (
          <div
            key={group.title}
            className={cn(
              "mb-1.5",
              collapsed &&
                "mt-1.5 border-t border-[#1a1a3e]/8 pt-1.5 first:mt-0 first:border-t-0 first:pt-0"
            )}
          >
            {!collapsed && group.title && (
              <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/35">
                {group.title}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.tabs.map((tab) => {
                const active = isActive(tab, pathname);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? tab.label : undefined}
                    className={cn(
                      "flex min-h-[40px] items-center rounded-md text-sm transition-colors",
                      collapsed ? "justify-center px-0" : "gap-2.5 px-3 py-2",
                      active
                        ? "bg-[#FF9933]/10 font-semibold text-[#FF9933]"
                        : "font-medium text-[#1a1a3e]/55 hover:bg-[#1a1a3e]/5 hover:text-[#1a1a3e]"
                    )}
                  >
                    <tab.icon className="size-4 shrink-0" />
                    {!collapsed && <span className="flex-1">{tab.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
