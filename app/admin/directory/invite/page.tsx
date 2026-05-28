/**
 * Directory Admin — Invite Person Page (Phase B, 2026-05-28)
 *
 * Creates an auth.users invite + yi_directory.people row + initial
 * role_assignment in one server action call.
 */
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { InviteClient } from "./invite-client";

export const dynamic = "force-dynamic";

export default async function DirectoryInvitePage() {
  const isSuperAdmin = await isCurrentUserSuperAdmin();
  if (!isSuperAdmin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">403 · Forbidden</h1>
        <p className="mt-2 text-sm text-red-800">
          Only super-admins (national role) can invite new directory entries.
        </p>
      </div>
    );
  }
  return <InviteClient />;
}
