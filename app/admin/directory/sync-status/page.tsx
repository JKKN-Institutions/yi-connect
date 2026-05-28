/**
 * Directory Admin — Sync-Status Dashboard (Phase C, 2026-05-28)
 *
 * Surfaces drift between legacy auth tables and the canonical
 * `yi_directory.role_assignments`. READ-ONLY. No auto-sync.
 *
 * Three independent gaps:
 *   1) yi.national_admins
 *   2) yip.organizers
 *   3) future.chapter_core_team
 */
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import {
  checkYiNationalAdminsDrift,
  checkYipOrganizersDrift,
  checkChapterCoreTeamDrift,
} from "../actions/sync-status";
import { SyncStatusClient } from "./sync-status-client";

export const dynamic = "force-dynamic";

export default async function SyncStatusPage() {
  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">403 · Forbidden</h1>
        <p className="mt-2 text-sm text-red-800">
          Only super-admins (national role) can view directory sync status.
        </p>
      </div>
    );
  }

  // Run the three gap checks in parallel — they are independent.
  const [gap1, gap2, gap3] = await Promise.all([
    checkYiNationalAdminsDrift(),
    checkYipOrganizersDrift(),
    checkChapterCoreTeamDrift(),
  ]);

  return <SyncStatusClient gap1={gap1} gap2={gap2} gap3={gap3} />;
}
