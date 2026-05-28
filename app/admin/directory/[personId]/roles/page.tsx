/**
 * Directory Admin — Roles Edit Page (Phase B, 2026-05-28)
 *
 * Lists every role_assignment for one person and lets a super-admin:
 *   - toggle is_active
 *   - mark one as primary
 *   - edit title / chapter
 *   - add a new role
 *
 * All mutations live in `directory-mutations.ts` and are super-admin gated +
 * audit-logged server-side.
 */
import { notFound } from "next/navigation";
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getPersonDetail } from "../../actions/directory-reads";
import { RolesEditClient } from "./roles-edit-client";

export const dynamic = "force-dynamic";

export default async function DirectoryRolesEditPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;

  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">403 · Forbidden</h1>
        <p className="mt-2 text-sm text-red-800">
          Only super-admins (national role) can edit directory roles.
        </p>
      </div>
    );
  }

  const detail = await getPersonDetail(personId);
  if (!detail) notFound();

  return <RolesEditClient personId={personId} detail={detail} />;
}
