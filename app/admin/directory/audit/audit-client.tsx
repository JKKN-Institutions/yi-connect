/**
 * Directory Admin — Audit Log client (2026-06-02)
 *
 * URL-driven filters + table. Read-only: surfaces yip.admin_audit_log rows
 * scoped to yi_directory.* mutations (who / what / when / details).
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DirectoryAuditResult } from "../actions/audit-reads";

const ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete / deactivate" },
];

const ACTION_CLASS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800 border-emerald-200",
  update: "bg-blue-100 text-blue-800 border-blue-200",
  delete: "bg-amber-100 text-amber-800 border-amber-200",
  login: "bg-slate-100 text-slate-700 border-slate-200",
};

function fmt(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortTarget(table: string): string {
  return table.replace(/^yi_directory\./, "");
}

function summarise(meta: Record<string, unknown> | null): string {
  if (!meta || typeof meta !== "object") return "—";
  const pick = (k: string) => (meta[k] == null ? undefined : String(meta[k]));
  const bits: string[] = [];
  const name = pick("full_name");
  const email = pick("email");
  const app = pick("app");
  const role = pick("role");
  if (name) bits.push(name);
  if (email && email !== name) bits.push(email);
  if (app || role) bits.push([app, role].filter(Boolean).join(":"));
  if (bits.length === 0) {
    const keys = Object.keys(meta).slice(0, 4);
    return keys.length ? keys.join(", ") : "—";
  }
  return bits.join(" · ");
}

export function DirectoryAuditClient({
  result,
  initialFilters,
}: {
  result: DirectoryAuditResult;
  initialFilters: { action: string; q: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(initialFilters.q);

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    if (!("page" in next)) params.delete("page");
    startTransition(() => router.push(`/admin/directory/audit?${params.toString()}`));
  }

  const { rows, total, page, limit } = result;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/directory"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to directory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Audit log
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Every directory change — who did it, what changed, and when.{" "}
          {total.toLocaleString()} {total === 1 ? "entry" : "entries"} · page{" "}
          {page} of {totalPages}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Action
            </label>
            <Select
              value={initialFilters.action}
              onValueChange={(v) => pushParams({ action: v === "all" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-8">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Search (who / target id)
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                pushParams({ q: q.trim() || null });
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="actor email or target id…"
                className="pl-8"
              />
            </form>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-slate-500"
                >
                  No audit entries match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className={isPending ? "opacity-60" : undefined}>
                  <TableCell className="whitespace-nowrap text-sm text-slate-700">
                    {fmt(r.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {r.performed_by_email ?? (
                      <span className="text-slate-400">system</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        ACTION_CLASS[r.action_type] ??
                        "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {r.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    <span className="font-medium">{shortTarget(r.target_table)}</span>
                    {r.target_id ? (
                      <span className="ml-1 font-mono text-xs text-slate-400">
                        {r.target_id.slice(0, 8)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm text-slate-600">
                    {summarise(r.metadata)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>
          Showing {total === 0 ? 0 : (page - 1) * limit + 1}–
          {Math.min(page * limit, total)} of {total.toLocaleString()}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isPending}
            onClick={() => pushParams({ page: String(Math.max(1, page - 1)) })}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isPending}
            onClick={() => pushParams({ page: String(Math.min(totalPages, page + 1)) })}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
