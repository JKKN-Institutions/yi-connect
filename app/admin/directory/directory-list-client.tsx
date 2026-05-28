/**
 * Directory Admin — List Client (Phase A, 2026-05-28)
 *
 * Filter bar + table. URL is the source of truth for filters / pagination so
 * a server fetch always reflects what the user sees.
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldAlert,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import type {
  DirectoryListResult,
  DirectoryStatusFilter,
} from "./actions/directory-reads";

const APP_OPTIONS = [
  { value: "yip", label: "YIP" },
  { value: "future", label: "Yi-Future" },
  { value: "yuva", label: "Yuva" },
  { value: "thalir", label: "Thalir" },
  { value: "masoom", label: "Masoom" },
  { value: "yi", label: "Yi (cross)" },
];

const ROLE_OPTIONS = [
  { value: "all", label: "All roles" },
  { value: "super_admin", label: "Super admin" },
  { value: "national_admin", label: "National admin" },
  { value: "national", label: "National" },
  { value: "rm", label: "Regional manager" },
  { value: "chapter_em", label: "Chapter EM" },
  { value: "chapter_chair", label: "Chapter chair" },
  { value: "platform_admin", label: "Platform admin" },
];

const STATUS_OPTIONS: { value: DirectoryStatusFilter; label: string }[] = [
  { value: "active", label: "Active only" },
  { value: "inactive", label: "Inactive only" },
  { value: "pending_auth", label: "Pending auth" },
  { value: "all", label: "All" },
];

const APP_BADGE_CLASS: Record<string, string> = {
  yip: "bg-orange-100 text-orange-800 border-orange-200",
  future: "bg-indigo-100 text-indigo-800 border-indigo-200",
  yuva: "bg-emerald-100 text-emerald-800 border-emerald-200",
  thalir: "bg-pink-100 text-pink-800 border-pink-200",
  masoom: "bg-amber-100 text-amber-800 border-amber-200",
  yi: "bg-slate-200 text-slate-900 border-slate-300",
};

type InitialFilters = {
  q: string;
  apps: string;
  role: string;
  year: string;
  chapter: string;
  status: DirectoryStatusFilter;
  sort: "name" | "email" | "role_count";
  dir: "asc" | "desc";
  page: number;
};

export function DirectoryListClient({
  initialResult,
  initialFilters,
}: {
  initialResult: DirectoryListResult;
  initialFilters: InitialFilters;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initialFilters.q);
  const [chapter, setChapter] = useState(initialFilters.chapter);

  const selectedApps = useMemo(
    () => (initialFilters.apps ? initialFilters.apps.split(",").filter(Boolean) : []),
    [initialFilters.apps]
  );

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    // Reset to page 1 when filters change unless caller explicitly set page.
    if (!("page" in next)) params.delete("page");
    startTransition(() => {
      router.push(`/admin/directory?${params.toString()}`);
    });
  }

  function toggleApp(app: string) {
    const set = new Set(selectedApps);
    if (set.has(app)) set.delete(app);
    else set.add(app);
    pushParams({ apps: set.size ? Array.from(set).join(",") : null });
  }

  function toggleSort(column: "name" | "email" | "role_count") {
    let nextDir: "asc" | "desc" = "asc";
    if (initialFilters.sort === column) {
      nextDir = initialFilters.dir === "asc" ? "desc" : "asc";
    }
    pushParams({ sort: column, dir: nextDir });
  }

  function sortIcon(column: "name" | "email" | "role_count") {
    if (initialFilters.sort !== column)
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return initialFilters.dir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  }

  const { rows, total, page, limit, available_years } = initialResult;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Directory
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {total.toLocaleString()} {total === 1 ? "person" : "people"} ·
            page {page} of {totalPages}
          </p>
        </div>
      </header>

      {/* Filter bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Search (name or email)
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
                placeholder="Name or email…"
                className="pl-8"
              />
            </form>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Role
            </label>
            <Select
              value={initialFilters.role}
              onValueChange={(v) =>
                pushParams({ role: v === "all" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Year
            </label>
            <Select
              value={initialFilters.year || "all"}
              onValueChange={(v) =>
                pushParams({ year: v === "all" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {available_years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Chapter contains
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                pushParams({ chapter: chapter.trim() || null });
              }}
            >
              <Input
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="e.g. Coimbatore"
              />
            </form>
          </div>

          <div className="md:col-span-8">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Vertical / app
            </label>
            <div className="flex flex-wrap gap-2">
              {APP_OPTIONS.map((a) => {
                const active = selectedApps.includes(a.value);
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => toggleApp(a.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? `${APP_BADGE_CLASS[a.value] ?? "bg-slate-900 text-white border-slate-900"}`
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <Select
              value={initialFilters.status}
              onValueChange={(v) =>
                pushParams({ status: v === "active" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("name")}
                  className="flex items-center gap-1 font-medium text-slate-700"
                >
                  Person {sortIcon("name")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("email")}
                  className="flex items-center gap-1 font-medium text-slate-700"
                >
                  Email {sortIcon("email")}
                </button>
              </TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("role_count")}
                  className="flex items-center gap-1 font-medium text-slate-700"
                >
                  Active roles {sortIcon("role_count")}
                </button>
              </TableHead>
              <TableHead>Verticals</TableHead>
              <TableHead>Auth</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-slate-500"
                >
                  No people match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow
                  key={p.id}
                  className={isPending ? "opacity-60" : undefined}
                >
                  <TableCell>
                    <Link
                      href={`/admin/directory/${p.id}`}
                      className="flex items-center gap-3 hover:text-slate-900"
                    >
                      <Avatar className="h-8 w-8">
                        {p.photo_url ? (
                          <AvatarImage src={p.photo_url} alt={p.full_name} />
                        ) : null}
                        <AvatarFallback className="bg-slate-100 text-xs text-slate-700">
                          {p.full_name
                            .split(" ")
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {p.full_name}
                        </div>
                        {!p.is_active ? (
                          <div className="text-xs text-slate-500">inactive</div>
                        ) : null}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {p.email ?? <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {p.phone ?? <span className="text-slate-400">—</span>}
                  </TableCell>
                  <TableCell className="text-sm font-medium tabular-nums">
                    {p.active_role_count}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.apps.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        p.apps.map((a) => (
                          <Badge
                            key={a}
                            variant="outline"
                            className={`text-xs ${
                              APP_BADGE_CLASS[a] ??
                              "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {a}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.has_auth ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Linked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                        <ShieldAlert className="h-3.5 w-3.5" /> Pending
                      </span>
                    )}
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
          Showing {(page - 1) * limit + 1}–
          {Math.min(page * limit, total)} of {total.toLocaleString()}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isPending}
            onClick={() =>
              pushParams({ page: String(Math.max(1, page - 1)) })
            }
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isPending}
            onClick={() =>
              pushParams({ page: String(Math.min(totalPages, page + 1)) })
            }
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
