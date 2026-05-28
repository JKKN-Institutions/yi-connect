"use client";

import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/yip/utils";

const navItems = [
  { label: "My Events", href: "/yip/dashboard", icon: CalendarDays },
  { label: "Topics", href: "/yip/dashboard/topics", icon: BookOpen },
  { label: "Schools", href: "/yip/dashboard/schools", icon: School },
  { label: "Zones", href: "/yip/dashboard/zones", icon: Globe },
  { label: "Admin", href: "/yip/dashboard/admin", icon: LayoutGrid },
];

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

  return (
    <div className="flex min-h-screen bg-[#FEFCF6]">
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
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
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
          <div className="relative px-5 pb-4 pt-5">
            {/* Subtle dot pattern */}
            <div
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, #1a1a3e 0.5px, transparent 0)",
                backgroundSize: "16px 16px",
              }}
            />
            <div className="relative flex items-center justify-between">
              <Link href="/yip/dashboard" className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#FF9933] to-[#E68A2E] shadow-lg shadow-[#FF9933]/25">
                  <span className="font-[family-name:var(--font-heading)] text-xl font-bold text-white">Y</span>
                  {/* Ashoka Chakra tiny overlay */}
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border border-white/20" />
                </div>
                <div>
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
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1a1a3e]/25">
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
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium transition-all",
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
                    {item.label}
                    {isActive && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#FF9933]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Account section */}
          <div className="border-t border-[#1a1a3e]/[0.04] p-3">
            <div className="relative">
              <button
                onClick={() => setAccountOpen(!accountOpen)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#1a1a3e]/[0.03]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a1a3e]/5 to-[#1a1a3e]/10">
                  <User className="size-3.5 text-[#1a1a3e]/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-xs font-medium text-[#1a1a3e]/60">
                    {userEmail}
                  </span>
                  <span className="block text-[10px] text-[#1a1a3e]/30">Organizer</span>
                </div>
                <ChevronDown
                  className={cn(
                    "size-3.5 text-[#1a1a3e]/20 transition-transform",
                    accountOpen && "rotate-180"
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
