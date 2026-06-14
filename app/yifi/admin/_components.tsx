import Link from "next/link";
import { LogoutButton } from "./logout-button";

/**
 * Sticky page chrome shared by every /yifi/admin/* sub-page.
 * Mirrors the styling of the admin hub (app/yifi/admin/page.tsx).
 */
export function AdminHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-white/10 bg-black/30 px-4 py-3 sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="text-[#FD7215] font-bold text-lg">
            YiFi
          </Link>
          <span className="text-white/30">·</span>
          <Link href="/yifi/admin" className="text-white/50 text-sm hover:text-white/70">
            Admin
          </Link>
          <span className="text-white/30">·</span>
          <span className="text-white text-sm">{title}</span>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}

/**
 * Explicit access-denied surface (rule #27 — never silently redirect a
 * permission failure). Tells the organiser exactly which permission is missing.
 */
export function AccessDenied({ permission }: { permission: string }) {
  return (
    <main className="min-h-screen bg-[#000066] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-white/50 text-sm mb-4">
          Your organiser role doesn&apos;t include the{" "}
          <span className="text-[#FD7215] font-medium">{permission}</span> permission.
          Contact the event architect if you need access.
        </p>
        <Link href="/yifi/admin" className="text-[#FD7215] hover:underline text-sm">
          ← Back to Admin
        </Link>
      </div>
    </main>
  );
}

/** Empty-state row for tables with no data yet. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
      <p className="text-white/40 text-sm">{message}</p>
    </div>
  );
}

/** Compact stat tile (matches the admin hub StatCard). */
export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
      <p className="text-2xl font-bold text-[#FD7215]">{value}</p>
      <p className="text-xs text-white/50 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}
