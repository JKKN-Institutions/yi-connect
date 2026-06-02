/**
 * Directory Admin — Access Review (2026-06-02)
 *
 * Platform-super-admin read-only governance view: "who can do what" across all
 * Yi apps. Two lenses — by role (app×role grid → holders) and by person
 * (search → access sheet). CSV export via ./export.
 */
import { isCurrentUserPlatformSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import {
  getAccessSummaryGrid,
  getRoleHolders,
  searchDirectoryPeople,
} from "../actions/access-review-reads";
import { getPersonDetail } from "../actions/directory-reads";
import { AccessReviewClient } from "./access-review-client";

export const dynamic = "force-dynamic";

export default async function AccessReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    app?: string;
    role?: string;
    personId?: string;
    q?: string;
  }>;
}) {
  const isSuper = await isCurrentUserPlatformSuperAdmin();
  if (!isSuper) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">403 · Forbidden</h1>
        <p className="mt-2 text-sm text-red-800">
          Only the platform super-admin (director) can view the access review.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const summary = await getAccessSummaryGrid();
  const holderFilter =
    sp.app && sp.role ? { app: sp.app, role: sp.role } : null;
  const holders = holderFilter
    ? await getRoleHolders(holderFilter.app, holderFilter.role)
    : null;
  const person = sp.personId ? await getPersonDetail(sp.personId) : null;
  const searchResults = sp.q ? await searchDirectoryPeople(sp.q) : [];

  return (
    <AccessReviewClient
      summary={summary}
      holders={holders}
      holderFilter={holderFilter}
      person={person}
      searchResults={searchResults}
      query={sp.q ?? ""}
    />
  );
}
