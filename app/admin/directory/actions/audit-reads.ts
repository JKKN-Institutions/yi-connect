/**
 * Directory Admin — Audit Log reads (2026-06-02)
 *
 * Read-only view over yip.admin_audit_log, filtered to the directory's own
 * mutations (target_table LIKE 'yi_directory%'). Every directory write already
 * calls logAuditAction, so this just surfaces the captured who/what/when.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";

export type DirectoryAuditFilters = {
  action?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type DirectoryAuditRow = {
  id: string;
  action_type: string;
  target_table: string;
  target_id: string | null;
  performed_by_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type DirectoryAuditResult = {
  rows: DirectoryAuditRow[];
  total: number;
  page: number;
  limit: number;
};

// Permissive query-builder shape — admin_audit_log lives in the yip schema and
// we only need a few chained filters + an exact count, so a loose cast keeps
// this readable (same approach as directory-reads.ts).
type AuditQuery = {
  eq: (k: string, v: unknown) => AuditQuery;
  like: (k: string, v: string) => AuditQuery;
  or: (filter: string) => AuditQuery;
  order: (k: string, opts?: { ascending?: boolean }) => AuditQuery;
  range: (a: number, b: number) => AuditQuery;
  then: <T>(
    on: (v: {
      data: DirectoryAuditRow[] | null;
      error: unknown;
      count: number | null;
    }) => T
  ) => Promise<T>;
};

export async function getDirectoryAuditLog(
  filters: DirectoryAuditFilters = {}
): Promise<DirectoryAuditResult> {
  const svc = await createServiceClient();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // admin_audit_log is not in the generated yip table union (types lag), so
  // cast the client's from() to accept the table name (same as log-action.ts).
  const client = svc as unknown as {
    from: (t: string) => {
      select: (cols: string, opts?: { count?: "exact" }) => AuditQuery;
    };
  };

  let qb = client
    .from("admin_audit_log")
    .select(
      "id, action_type, target_table, target_id, performed_by_email, metadata, created_at",
      { count: "exact" }
    )
    .like("target_table", "yi_directory%");

  if (filters.action && filters.action !== "all") {
    qb = qb.eq("action_type", filters.action);
  }
  if (filters.search && filters.search.trim()) {
    // Strip chars that would break the PostgREST or() filter grammar.
    const s = filters.search.trim().replace(/[%,()]/g, "");
    if (s) qb = qb.or(`performed_by_email.ilike.%${s}%,target_id.ilike.%${s}%`);
  }

  const { data, count } = await qb
    .order("created_at", { ascending: false })
    .range(from, to);

  return {
    rows: (data ?? []) as DirectoryAuditRow[],
    total: count ?? 0,
    page,
    limit,
  };
}
