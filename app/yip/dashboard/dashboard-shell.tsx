"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutOrganizer } from "@/app/yip/actions/auth";
import {
  CalendarDays,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  LayoutGrid,
  School,
  Globe,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/yip/utils";
import { GuideLauncher } from "@/components/yip/guide";
import { GUIDES } from "@/lib/yip/guide/content";

const navItems = [
  { label: "My Events", href: "/yip/dashboard", icon: CalendarDays },
  { label: "Topics", href: "/yip/dashboard/topics", icon: BookOpen },
  { label: "Schools", href: "/yip/dashboard/schools", icon: School },
  { label: "Zones", href: "/yip/dashboard/zones", icon: Globe },
  { label: "Admin", href: "/yip/dashboard/admin", icon: LayoutGrid },
];

const SHELL_COLLAPSE_KEY = "yip-shell-collapsed";

export function DashboardShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Desktop-only collapse to an icon rail, remembered per browser. Default
  // expanded on the server + first client render (so the default markup is
  // byte-identical to before — collapse classes are gated on `collapsed && lg:`);
  // sync the saved preference after mount.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SHELL_COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SHELL_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  // Event-scoped organiser deep links ("Open Allocation" etc.) need the current
  // event id; derive it from the URL so one launcher works on every page.
  const eventMatch = pathname.match(/\/events\/([^/]+)/);
  const eventId = eventMatch ? eventMatch[1] : null;

  return (
    <div className="flex min-h-screen bg-[#FEFCF6]">
      {/* Floating Help — organiser lane. Bottom-left (bug-reporter FAB is right). */}
      <GuideLauncher guide={GUIDES.organiser} eventId={eventId} variant="fab" />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#1a1a3e]/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col transition-all lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[76px]" : "lg:w-[272px]"
        )}
      >
        {/* Tricolor left edge */}
        <div className="absolute inset-y-0 right-0 flex w-[3px] flex-col">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#138808]" />
        </div>

        {/* Sidebar content */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-[#1a1a3e]/[0.04] bg-white">
          {/* Logo area */}
          <div className={cn("relative pb-4 pt-5", collapsed ? "px-5 lg:px-3" : "px-5")}>
            {/* Subtle dot pattern */}
            <div
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, #1a1a3e 0.5px, transparent 0)",
                backgroundSize: "16px 16px",
              }}
            />
            <div
              className={cn(
                "relative flex items-center justify-between",
                collapsed && "lg:justify-center"
              )}
            >
              {/* Logo mark removed 2026-06-16 — re-add later */}
              <Link href="/yip/dashboard" className="flex items-center gap-3">
                <div className={cn(collapsed && "lg:hidden")}>
                  <span className="block text-[13px] font-bold tracking-wide text-[#1a1a3e]">Young Indians</span>
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.25em] text-[#FF9933]">Parliament</span>
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#1a1a3e]/30 transition-colors hover:bg-[#1a1a3e]/5 lg:hidden"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Decorative divider */}
          <div className="mx-5 flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-[#FF9933]/20 via-[#1a1a3e]/5 to-transparent" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4">
            <p
              className={cn(
                "mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1a1a3e]/25",
                collapsed && "lg:hidden"
              )}
            >
              Navigation
            </p>
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/yip/dashboard"
                    ? pathname === "/yip/dashboard" || pathname.startsWith("/yip/dashboard/events")
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium transition-all",
                      collapsed && "lg:justify-center",
                      isActive
                        ? "bg-[#FF9933]/[0.08] text-[#FF9933] shadow-sm shadow-[#FF9933]/5"
                        : "text-[#1a1a3e]/50 hover:bg-[#1a1a3e]/[0.03] hover:text-[#1a1a3e]/80"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                        isActive ? "bg-[#FF9933]/10" : "bg-[#1a1a3e]/[0.03] group-hover:bg-[#1a1a3e]/[0.06]"
                      )}
                    >
                      <item.icon className="size-4" />
                    </div>
                    <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                    {isActive && (
                      <div
                        className={cn(
                          "ml-auto h-1.5 w-1.5 rounded-full bg-[#FF9933]",
                          collapsed && "lg:hidden"
                        )}
                      />
                    )}
                  </Link>
                );
              })}
              {/* Guide — opens the organiser lane drawer (not a route). */}
              <GuideLauncher
                guide={GUIDES.organiser}
                eventId={eventId}
                variant="navlink"
                className={cn(
                  "rounded-xl px-3 py-3 text-[13px] text-[#1a1a3e]/50 hover:bg-[#1a1a3e]/[0.03] hover:text-[#1a1a3e]/80",
                  collapsed && "lg:justify-center lg:[&>span]:hidden"
                )}
              />
            </div>
          </nav>

          {/* Account section */}
          <div className="border-t border-[#1a1a3e]/[0.04] p-3">
            <div className="relative">
              <button
                onClick={() => setAccountOpen(!accountOpen)}
                title={collapsed ? userEmail : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#1a1a3e]/[0.03]",
                  collapsed && "lg:justify-center"
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a1a3e]/5 to-[#1a1a3e]/10">
                  <User className="size-3.5 text-[#1a1a3e]/40" />
                </div>
                <div className={cn("flex-1 min-w-0", collapsed && "lg:hidden")}>
                  <span className="block truncate text-xs font-medium text-[#1a1a3e]/60">
                    {userEmail}
                  </span>
                  <span className="block text-[10px] text-[#1a1a3e]/30">Organizer</span>
                </div>
                <ChevronDown
                  className={cn(
                    "size-3.5 text-[#1a1a3e]/20 transition-transform",
                    accountOpen && "rotate-180",
                    collapsed && "lg:hidden"
                  )}
                />
              </button>

              {accountOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-xl shadow-[#1a1a3e]/10">
                  <form action={logoutOrganizer}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-[56px] items-center gap-4 border-b border-[#1a1a3e]/[0.04] bg-[#FEFCF6]/95 px-4 backdrop-blur-md lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#1a1a3e]/40 transition-colors hover:bg-[#1a1a3e]/5 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          {/* Desktop sidebar collapse toggle */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-10 w-10 items-center justify-center rounded-xl text-[#1a1a3e]/40 transition-colors hover:bg-[#1a1a3e]/5 lg:flex"
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>

          {/* Breadcrumb-style title */}
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-heading)] text-[15px] font-semibold text-[#1a1a3e]">
              YIP Platform
            </span>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[11px] font-medium text-[#1a1a3e]/30 sm:block">
              {userEmail}
            </span>
            {/* Tricolor dot */}
            <div className="flex gap-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#FF9933]" />
              <div className="h-1.5 w-1.5 rounded-full bg-white border border-[#1a1a3e]/10" />
              <div className="h-1.5 w-1.5 rounded-full bg-[#138808]" />
            </div>
            {/* Visible Sign Out — universal pattern. The sidebar account
                panel keeps a logout button too, but this is the discoverable one. */}
            <form action={logoutOrganizer}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg border border-[#1a1a3e]/10 px-3 py-1.5 text-xs font-medium text-[#1a1a3e]/70 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                title="Sign out"
              >
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
