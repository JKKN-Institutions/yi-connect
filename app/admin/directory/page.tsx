/**
 * Directory Admin — List Page (Phase A, 2026-05-28)
 *
 * Cross-vertical list of `yi_directory.people` with roll-up of active
 * `role_assignments`. Read-only. Super-admin gate via X agent's helper.
 */
import { isCurrentUserPlatformSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import {
  listDirectoryPeople,
  type DirectoryFilters,
  type DirectoryStatusFilter,
} from "./actions/directory-reads";
import { DirectoryListClient } from "./directory-list-client";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  apps?: string;
  role?: string;
  year?: string;
  chapter?: string;
  status?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

const VALID_STATUS: DirectoryStatusFilter[] = [
  "active",
  "inactive",
  "pending_auth",
  "all",
];

function parseSearchParams(sp: SearchParams): DirectoryFilters {
  const apps = sp.apps
    ? sp.apps
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    : undefined;
  const year = sp.year ? Number.parseInt(sp.year, 10) : undefined;
  const status = (
    sp.status && (VALID_STATUS as string[]).includes(sp.status)
      ? sp.status
      : "active"
  ) as DirectoryStatusFilter;
  const sort = (sp.sort === "email" || sp.sort === "role_count"
    ? sp.sort
    : "name") as DirectoryFilters["sort"];
  const sort_dir = (sp.dir === "desc" ? "desc" : "asc") as
    | "asc"
    | "desc";
  const page = sp.page ? Math.max(1, Number.parseInt(sp.page, 10) || 1) : 1;
  return {
    search: sp.q?.trim() || undefined,
    apps,
    role: sp.role && sp.role !== "all" ? sp.role : undefined,
    yi_year:
      typeof year === "number" && Number.isFinite(year) ? year : undefined,
    yi_chapter: sp.chapter?.trim() || undefined,
    status,
    sort,
    sort_dir,
    page,
    limit: 50,
  };
}

export default async function DirectoryAdminListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const isSuperAdmin = await isCurrentUserPlatformSuperAdmin();
  if (!isSuperAdmin) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">403 · Forbidden</h1>
        <p className="mt-2 text-sm text-red-800">
          Only the platform super-admin (director) can view the cross-vertical Yi
          Directory.
        </p>
      </div>
    );
  }

  const filters = parseSearchParams(sp);
  const result = await listDirectoryPeople(filters);

  return (
    <DirectoryListClient
      initialResult={result}
      initialFilters={{
        q: sp.q ?? "",
        apps: sp.apps ?? "",
        role: sp.role ?? "all",
        year: sp.year ?? "",
        chapter: sp.chapter ?? "",
        status: (sp.status as DirectoryStatusFilter) ?? "active",
        sort: (sp.sort as "name" | "email" | "role_count") ?? "name",
        dir: (sp.dir as "asc" | "desc") ?? "asc",
        page: filters.page ?? 1,
      }}
    />
  );
}
