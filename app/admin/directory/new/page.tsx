/**
 * Directory Admin — New Person Page (2026-06-01)
 *
 * Creates a bare yi_directory.people record with no auth login attached, for
 * subject / no-login identities the directory must track. To grant a login,
 * use the Invite flow (it binds user_id by email).
 */
import { isCurrentUserPlatformSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { NewPersonClient } from "./new-person-client";

export const dynamic = "force-dynamic";

export default async function DirectoryNewPersonPage() {
  const isSuperAdmin = await isCurrentUserPlatformSuperAdmin();
  if (!isSuperAdmin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">403 · Forbidden</h1>
        <p className="mt-2 text-sm text-red-800">
          Only the platform super-admin (director) can create directory entries.
        </p>
      </div>
    );
  }

  return <NewPersonClient />;
}
