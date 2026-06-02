/**
 * Directory Admin — Access Review CSV export (2026-06-02)
 *
 * GET /admin/directory/access-review/export?app=&role=  →  holders CSV.
 * Platform-super-admin only (explicit 403). UTF-8 BOM so Excel renders Tamil
 * names correctly. The export itself is audit-logged.
 */
import { isCurrentUserPlatformSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { getRoleHolders } from "../../actions/access-review-reads";
import { toCSV, csvResponse } from "@/lib/yi-future/csv";
import { logAuditAction } from "@/lib/yip/audit/log-action";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const isSuper = await isCurrentUserPlatformSuperAdmin();
  if (!isSuper) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const app = (url.searchParams.get("app") ?? "").trim();
  const role = (url.searchParams.get("role") ?? "").trim();
  if (!app || !role) {
    return new Response("Missing app/role", { status: 400 });
  }

  const holders = await getRoleHolders(app, role);
  const rows = holders.map((h) => ({
    name: h.full_name,
    email: h.email ?? "",
    chapter: h.yi_chapter ?? "",
    zone: h.yi_zone ?? "",
    year: h.yi_year ?? "",
    title: h.title ?? "",
    primary: h.is_primary ? "yes" : "",
  }));
  const csv = toCSV(rows, [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "chapter", label: "Chapter" },
    { key: "zone", label: "Zone" },
    { key: "year", label: "Year" },
    { key: "title", label: "Title" },
    { key: "primary", label: "Primary" },
  ]);

  // Audit the export (filter only, never the result rows).
  await logAuditAction({
    action_type: "export",
    target_table: "yi_directory.role_assignments",
    metadata: { export: "access-review-holders", app, role, count: holders.length },
  });

  // UTF-8 BOM for Excel correctness with non-Latin (Tamil) names.
  return csvResponse(`access-${app}-${role}.csv`, "﻿" + csv);
}
