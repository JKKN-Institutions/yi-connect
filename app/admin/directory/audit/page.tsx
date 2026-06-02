/**
 * Directory Admin — Audit Log page (2026-06-02)
 *
 * Platform-super-admin-only view of who changed what in the directory, when.
 */
import { isCurrentUserPlatformSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getDirectoryAuditLog } from "../actions/audit-reads";
import { DirectoryAuditClient } from "./audit-client";

export const dynamic = "force-dynamic";

export default async function DirectoryAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string; page?: string }>;
}) {
  const isSuper = await isCurrentUserPlatformSuperAdmin();
  if (!isSuper) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">403 · Forbidden</h1>
        <p className="mt-2 text-sm text-red-800">
          Only the platform super-admin (director) can view the directory audit
          log.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const result = await getDirectoryAuditLog({
    action: sp.action,
    search: sp.q,
    page,
  });

  return (
    <DirectoryAuditClient
      result={result}
      initialFilters={{ action: sp.action ?? "all", q: sp.q ?? "" }}
    />
  );
}
