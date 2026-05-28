/**
 * Directory Admin — Person Detail Page (Phase A, 2026-05-28)
 *
 * Read-only view of one yi_directory.people row plus all role_assignments
 * (active + inactive) grouped by app+year.
 */
import { notFound } from "next/navigation";
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getPersonDetail } from "../actions/directory-reads";
import { PersonDetailClient } from "./person-detail-client";

export const dynamic = "force-dynamic";

export default async function DirectoryPersonDetailPage({
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
          Only super-admins (national role) can view the cross-vertical Yi
          Directory.
        </p>
      </div>
    );
  }

  const detail = await getPersonDetail(personId);
  if (!detail) notFound();

  return <PersonDetailClient detail={detail} />;
}
