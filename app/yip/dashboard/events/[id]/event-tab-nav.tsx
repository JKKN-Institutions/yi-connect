"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/yip/utils";
import {
  LayoutDashboard,
  Users,
  Shuffle,
  Scale,
  MessagesSquare,
  Radio,
  Star,
  Trophy,
  Award,
  Flag,
  Gavel,
  ListChecks,
  CalendarClock,
  Shield,
  Images,
  MessageCircleHeart,
  BookOpen,
  UserCog,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { MERGED_GROUPS } from "./event-section-subtabs";

type Tab = { label: string; href: string; icon: LucideIcon };
type TabGroup = { title: string; tabs: Tab[] };

// Grouped by event lifecycle so the sidebar reads like a checklist:
// Overview (pinned, anytime) → Before the Event → Event Day → After the Event.
const GROUPS: TabGroup[] = [
  {
    // Pinned "home" — relevant before, during AND after the event, so it has no
    // phase header and sits at the very top (empty title → rendered headerless).
    title: "",
    tabs: [{ label: "Overview", href: "", icon: LayoutDashboard }],
  },
  {
    title: "Before the Event",
    tabs: [
      { label: "Team", href: "/team", icon: UserCog },
      { label: "Checklist", href: "/checklist", icon: ListChecks },
      // Pre-event agenda tailoring: which items run live on the day, in what
      // order. Drives the Control panel + projector view.
      { label: "Agenda", href: "/agenda", icon: CalendarClock },
      { label: "Participants", href: "/participants", icon: Users },
      // Committee picker (route stays /topics). Before Parties so the setup
      // order reads Committees → Parties → Allocation.
      { label: "Committees", href: "/topics", icon: BookOpen },
      { label: "Parties", href: "/parties", icon: Flag },
      { label: "Allocation", href: "/allocation", icon: Shuffle },
      { label: "Jury", href: "/jury", icon: Scale },
      // Volunteers tab also hosts YUVA Desks (sub-tabbed on the page).
      { label: "Volunteers", href: "/volunteers", icon: Shield },
    ],
  },
  {
    title: "Event Day",
    tabs: [
      { label: "Control", href: "/control", icon: Radio },
      // Proceedings = Questions / Motions / Bills (sub-tabbed on the page).
      { label: "Proceedings", href: "/questions", icon: Gavel },
      { label: "Chat", href: "/chat", icon: MessagesSquare },
      // Scoring = Scoring / Committee Scores (sub-tabbed on the page).
      { label: "Scoring", href: "/scoring", icon: Star },
      { label: "Media", href: "/media", icon: Images },
    ],
  },
  {
    title: "After the Event",
    tabs: [
      { label: "Results", href: "/results", icon: Trophy },
      { label: "Certificates", href: "/certificates", icon: Award },
      { label: "Feedback", href: "/feedback", icon: MessageCircleHeart },
    ],
  },
];

// Score-bearing tabs — visible to national / super-admins only (2026-06-13).
// "Scoring" hosts Committee Scores as a sub-tab; "Committees" (picker) is open
// setup and is NOT score-gated.
const SCORE_TABS = new Set(["Scoring", "Results"]);
const COLLAPSE_KEY = "yip-event-nav-collapsed";

function matchesHref(href: string, pathname: string, basePath: string) {
  const p = `${basePath}${href}`;
  if (href === "") return pathname === basePath;
  return pathname === p || pathname.startsWith(`${p}/`);
}

function isActive(tabHref: string, pathname: string, basePath: string) {
  if (matchesHref(tabHref, pathname, basePath)) return true;
  // A merged-group primary (e.g. Proceedings → /questions) stays active when on
  // any of its sub-tab sibling routes (/motions, /bills).
  const group = MERGED_GROUPS.find((g) => g.siblings[0].href === tabHref);
  return group
    ? group.siblings.some((s) => matchesHref(s.href, pathname, basePath))
    : false;
}

export function EventTabNav({
  eventId,
  eventStatus,
  canViewScores = false,
  setupProgress,
}: {
  eventId: string;
  eventStatus?: string;
  canViewScores?: boolean;
  /** Map of { tabHref → done } for the Before-the-Event setup checklist. Tabs
   *  not present in the map show no indicator. */
  setupProgress?: Record<string, boolean>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const basePath = `/yip/dashboard/events/${eventId}`;

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

  const visible = (tab: Tab) => {
    // Certificates only appear once results are published.
    if (tab.label === "Certificates") return eventStatus === "results_published";
    // Scoring / Committees / Results are score-bearing → super-admin only.
    if (SCORE_TABS.has(tab.label)) return canViewScores;
    return true;
  };

  const groups = GROUPS.map((g) => ({
    ...g,
    tabs: g.tabs.filter(visible),
  })).filter((g) => g.tabs.length > 0);

  // The currently active tab's full path — drives the mobile <select> value.
  const activeTab = groups
    .flatMap((g) => g.tabs)
    .find((t) => isActive(t.href, pathname, basePath));
  const activeValue = `${basePath}${activeTab?.href ?? ""}`;

  return (
    <>
      {/* Mobile (< lg): native grouped dropdown — compact, accessible, zero horizontal scroll. */}
      <div className="lg:hidden mb-4">
        <label htmlFor="event-section" className="sr-only">
          Event section
        </label>
        <select
          id="event-section"
          value={activeValue}
          onChange={(e) => router.push(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-[#1a1a3e]/15 bg-white px-3 py-2 text-sm font-medium text-[#1a1a3e] shadow-sm focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
        >
          {groups.map((g) =>
            g.title ? (
              <optgroup key={g.title} label={g.title}>
                {g.tabs.map((tab) => (
                  <option key={tab.label} value={`${basePath}${tab.href}`}>
                    {setupProgress?.[tab.href] ? "✓ " : ""}
                    {tab.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              g.tabs.map((tab) => (
                <option key={tab.label} value={`${basePath}${tab.href}`}>
                  {tab.label}
                </option>
              ))
            )
          )}
        </select>
      </div>

      {/* Desktop (≥ lg): vertical grouped sidebar, collapsible to an icon rail. */}
      <nav
        aria-label="Event sections"
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

        {groups.map((group) => (
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
                const tabPath = `${basePath}${tab.href}`;
                const active = isActive(tab.href, pathname, basePath);
                return (
                  <Link
                    key={tab.label}
                    href={tabPath}
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
                    {/* Setup checklist: green check when done, hollow circle
                        when still to-do. Only on tracked Before-the-Event tabs. */}
                    {!collapsed &&
                      setupProgress &&
                      tab.href in setupProgress &&
                      (setupProgress[tab.href] ? (
                        <CheckCircle2
                          className="size-3.5 shrink-0 text-[#138808]"
                          aria-label="done"
                        />
                      ) : (
                        <Circle
                          className="size-3.5 shrink-0 text-[#1a1a3e]/20"
                          aria-label="to do"
                        />
                      ))}
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
