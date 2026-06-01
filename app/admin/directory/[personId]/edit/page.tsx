/**
 * Directory Admin — Edit Person Page (Phase B, 2026-05-28)
 *
 * Patches name / email / phone on yi_directory.people. Auth-bound user_id
 * is NOT editable here (super-admin can break the link only through a
 * separate flow if needed).
 */
import { notFound } from "next/navigation";
import { isCurrentUserPlatformSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getPersonDetail } from "../../actions/directory-reads";
import { PersonEditClient } from "./person-edit-client";

export const dynamic = "force-dynamic";

export default async function DirectoryPersonEditPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;

  const isSuperAdmin = await isCurrentUserPlatformSuperAdmin();
  if (!isSuperAdmin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">403 · Forbidden</h1>
        <p className="mt-2 text-sm text-red-800">
          Only the platform super-admin (director) can edit directory entries.
        </p>
      </div>
    );
  }

  const detail = await getPersonDetail(personId);
  if (!detail) notFound();

  return (
    <PersonEditClient
      personId={personId}
      initial={{
        full_name: detail.person.full_name,
        email: detail.person.email ?? "",
        phone: detail.person.phone ?? "",
      }}
    />
  );
}
