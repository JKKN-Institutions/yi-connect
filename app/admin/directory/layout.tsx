/**
 * Directory Admin — Layout (Phase A, 2026-05-28)
 *
 * Top-level shell for the cross-app Directory Admin UI. Neutral palette
 * (NOT YIP saffron) because this is a Yi-National-level view that spans every
 * app (yip / future / yuva / yifi / thalir / masoom / ...).
 */
import Link from "next/link";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default function DirectoryAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/admin/directory" className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-700" />
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Yi Directory · Admin
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/directory/access-review"
              className="text-xs font-medium text-slate-700 hover:text-slate-900"
            >
              Access review
            </Link>
            <Link
              href="/admin/directory/audit"
              className="text-xs font-medium text-slate-700 hover:text-slate-900"
            >
              Audit log
            </Link>
            <Link
              href="/admin/directory/sync-status"
              className="text-xs font-medium text-slate-700 hover:text-slate-900"
            >
              Sync Status
            </Link>
            <span className="text-xs text-slate-500">
              All apps · read-only
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
