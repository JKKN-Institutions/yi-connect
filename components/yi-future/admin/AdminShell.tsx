"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";

export type NavItem = {
  label: string;
  href: string;
};

export function AdminShell({
  title,
  roleLabel,
  items,
  children,
}: {
  title: string;
  roleLabel: string;
  items: NavItem[];
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      <div className="px-4 py-5 border-b border-ivory/10 flex items-start justify-between gap-2">
        <div>
          <ProgramWordmark />
          <div className="mt-2 text-[10px] font-semibold tracking-widest uppercase text-yi-gold">
            {roleLabel}
          </div>
        </div>
        {/* Close button (mobile only) */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="md:hidden -mr-1 -mt-1 p-2 text-ivory/60 hover:text-ivory"
          aria-label="Close menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-yi-gold/20 text-yi-gold font-semibold border-l-2 border-yi-gold"
                      : "text-ivory/70 hover:bg-ivory/5 hover:text-ivory border-l-2 border-transparent"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-4 py-3 border-t border-ivory/10 text-[10px] text-ivory/40">
        Future 6.0 · 2026
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-ivory flex">
      {/* ─── Desktop Sidebar (≥ md) ──────────────────────────────── */}
      <aside className="hidden md:flex w-60 bg-navy text-ivory flex-shrink-0 flex-col">
        {sidebarContent}
      </aside>

      {/* ─── Mobile Drawer (< md) ────────────────────────────────── */}
      {/* Backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        data-open={mobileOpen}
        className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 opacity-0 pointer-events-none data-[open=true]:opacity-100 data-[open=true]:pointer-events-auto"
      />
      {/* Drawer */}
      <aside
        data-open={mobileOpen}
        className="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-navy text-ivory flex flex-col transition-transform duration-200 -translate-x-full data-[open=true]:translate-x-0"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {sidebarContent}
      </aside>

      {/* ─── Main ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="bg-white border-b border-navy/10 px-4 md:px-6 py-3 flex items-center justify-between gap-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger (mobile only) */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden -ml-1 p-2 text-navy hover:bg-navy/5 rounded"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="text-base md:text-lg font-bold text-navy truncate">
              {title}
            </h1>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              formAction="/api/auth/signout"
              className="text-xs text-navy/50 hover:text-navy transition-colors whitespace-nowrap"
            >
              Sign out
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
