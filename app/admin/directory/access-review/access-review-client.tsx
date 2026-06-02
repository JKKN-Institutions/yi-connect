/**
 * Directory Admin — Access Review client (2026-06-02)
 *
 * Two lenses, URL-driven:
 *   • By role   — app×role grid → click a cell → holders list (+ CSV export)
 *   • By person — search → click a person → their full access sheet
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Search, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { appBadgeClass, appLabel, roleLabel } from "@/lib/yi/directory/role-labels";
import type {
  AccessSummaryCell,
  PersonSearchRow,
  RoleHolderRow,
} from "../actions/access-review-reads";
import type { DirectoryPersonDetail } from "../actions/directory-reads";

type Props = {
  summary: AccessSummaryCell[];
  holders: RoleHolderRow[] | null;
  holderFilter: { app: string; role: string } | null;
  person: DirectoryPersonDetail | null;
  searchResults: PersonSearchRow[];
  query: string;
};

function scopeText(r: {
  yi_chapter: string | null;
  yi_zone: string | null;
  yi_year: number | null;
}): string {
  const bits: string[] = [];
  if (r.yi_chapter) bits.push(r.yi_chapter);
  if (r.yi_zone) bits.push(`zone ${r.yi_zone}`);
  if (r.yi_year) bits.push(String(r.yi_year));
  return bits.length ? bits.join(" · ") : "—";
}

export function AccessReviewClient({
  summary,
  holders,
  holderFilter,
  person,
  searchResults,
  query,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(query);

  function go(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    startTransition(() =>
      router.push(`/admin/directory/access-review?${params.toString()}`)
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/directory"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to directory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Access review
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Who can do what across every Yi app. Read-only.
        </p>
      </div>

      {/* ─── By role ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">By role</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Holders</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                    No active roles.
                  </TableCell>
                </TableRow>
              ) : (
                summary.map((c) => {
                  const selected =
                    holderFilter?.app === c.app && holderFilter?.role === c.role;
                  return (
                    <TableRow
                      key={`${c.app}__${c.role}`}
                      className={selected ? "bg-slate-50" : undefined}
                    >
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${appBadgeClass(c.app)}`}>
                          {appLabel(c.app)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-900">
                        {roleLabel(c.role)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {c.count}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={selected ? "secondary" : "outline"}
                          disabled={isPending}
                          onClick={() => go({ app: c.app, role: c.role, personId: null })}
                        >
                          View holders
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {holderFilter && holders ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {appLabel(holderFilter.app)} · {roleLabel(holderFilter.role)}{" "}
                <span className="font-normal text-slate-500">
                  ({holders.length} {holders.length === 1 ? "holder" : "holders"})
                </span>
              </h3>
              {holders.length > 0 ? (
                <a
                  href={`/admin/directory/access-review/export?app=${encodeURIComponent(
                    holderFilter.app
                  )}&role=${encodeURIComponent(holderFilter.role)}`}
                >
                  <Button type="button" size="sm" variant="outline">
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                  </Button>
                </a>
              ) : null}
            </div>
            {holders.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                No one holds {appLabel(holderFilter.app)} / {roleLabel(holderFilter.role)}.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Title</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holders.map((h) => (
                    <TableRow key={`${h.person_id}-${h.yi_chapter ?? ""}-${h.yi_year ?? ""}`}>
                      <TableCell className="text-sm font-medium text-slate-900">
                        <Link
                          href={`/admin/directory/${h.person_id}`}
                          className="hover:underline"
                        >
                          {h.full_name}
                        </Link>
                        {h.is_primary ? (
                          <Star className="ml-1 inline h-3 w-3 text-yellow-500" />
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {h.email ?? <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{scopeText(h)}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {h.title ?? <span className="text-slate-400">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ) : null}
      </section>

      {/* ─── By person ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">By person</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: q.trim() || null, personId: null });
          }}
          className="relative max-w-md"
        >
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a person by name or email…"
            className="pl-8"
          />
        </form>

        {searchResults.length > 0 && !person ? (
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {searchResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => go({ personId: r.id })}
                    className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-900">{r.full_name}</span>
                    <span className="text-xs text-slate-500">{r.email ?? "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {person ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {person.person.full_name}
              </h3>
              {!person.person.is_active ? (
                <Badge variant="outline" className="text-xs text-slate-500">
                  inactive — no effective access
                </Badge>
              ) : null}
              <span className="text-xs text-slate-500">{person.person.email ?? ""}</span>
            </div>

            {person.active_roles.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 py-4 text-center text-sm text-slate-500">
                No active roles — this person can currently do nothing.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Title</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {person.active_roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${appBadgeClass(r.app)}`}>
                          {appLabel(r.app)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-900">
                        {roleLabel(r.role)}
                        {r.is_primary ? (
                          <Star className="ml-1 inline h-3 w-3 text-yellow-500" />
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{scopeText(r)}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {r.title ?? <span className="text-slate-400">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {person.inactive_roles.length > 0 ? (
              <p className="mt-3 text-xs text-slate-400">
                + {person.inactive_roles.length} inactive/historical role
                {person.inactive_roles.length === 1 ? "" : "s"} (not counted as access)
              </p>
            ) : null}
          </div>
        ) : query && searchResults.length === 0 ? (
          <p className="text-sm text-slate-500">No people match “{query}”.</p>
        ) : null}
      </section>
    </div>
  );
}
