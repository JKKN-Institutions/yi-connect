/**
 * Directory Admin — Person Detail Client (Phase A, 2026-05-28)
 *
 * Pure display. No edit buttons. The AA agent owns the mutation surfaces
 * (role grant, invite, deactivate) — they will live under `./roles/` and
 * `../invite/` and are out of scope for Phase A.
 */
"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  Phone,
  ShieldAlert,
  Star,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type {
  DirectoryPersonDetail,
  RoleAssignmentRow,
} from "../actions/directory-reads";

const APP_BADGE_CLASS: Record<string, string> = {
  yip: "bg-orange-100 text-orange-800 border-orange-200",
  future: "bg-indigo-100 text-indigo-800 border-indigo-200",
  yuva: "bg-emerald-100 text-emerald-800 border-emerald-200",
  thalir: "bg-pink-100 text-pink-800 border-pink-200",
  masoom: "bg-amber-100 text-amber-800 border-amber-200",
  yi: "bg-slate-200 text-slate-900 border-slate-300",
};

function groupKey(r: RoleAssignmentRow): string {
  return `${r.app}__${r.yi_year}`;
}

function groupLabel(r: RoleAssignmentRow): string {
  return `${r.app} · ${r.yi_year}`;
}

function RoleGroup({
  roles,
  dimmed,
}: {
  roles: RoleAssignmentRow[];
  dimmed?: boolean;
}) {
  if (roles.length === 0) return null;
  const groups = new Map<string, RoleAssignmentRow[]>();
  for (const r of roles) {
    const k = groupKey(r);
    const arr = groups.get(k) ?? [];
    arr.push(r);
    groups.set(k, arr);
  }
  const orderedKeys = Array.from(groups.keys()).sort().reverse();

  return (
    <div className={`space-y-4 ${dimmed ? "opacity-60" : ""}`}>
      {orderedKeys.map((k) => {
        const list = groups.get(k)!;
        const first = list[0]!;
        return (
          <div
            key={k}
            className="rounded-md border border-slate-200 bg-white p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${
                  APP_BADGE_CLASS[first.app] ??
                  "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {groupLabel(first)}
              </Badge>
              <span className="text-xs text-slate-500">
                {list.length} role{list.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="space-y-2">
              {list.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                >
                  <span className="font-medium text-slate-900">{r.role}</span>
                  {r.title ? (
                    <span className="text-slate-600">· {r.title}</span>
                  ) : null}
                  {r.yi_chapter ? (
                    <span className="text-slate-600">
                      · chapter {r.yi_chapter}
                    </span>
                  ) : null}
                  {r.yi_zone ? (
                    <span className="text-slate-600">· zone {r.yi_zone}</span>
                  ) : null}
                  {r.is_primary ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                      <Star className="h-3 w-3" /> primary
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function PersonDetailClient({
  detail,
}: {
  detail: DirectoryPersonDetail;
}) {
  const { person, active_roles, inactive_roles } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/directory"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to directory
      </Link>

      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            {person.photo_url ? (
              <AvatarImage src={person.photo_url} alt={person.full_name} />
            ) : null}
            <AvatarFallback className="bg-slate-100 text-base text-slate-700">
              {person.full_name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {person.full_name}
              </h1>
              {!person.is_active ? (
                <Badge variant="outline" className="text-xs text-slate-500">
                  inactive
                </Badge>
              ) : null}
              {person.has_auth ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Auth linked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                  <ShieldAlert className="h-3.5 w-3.5" /> Pending auth
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
              {person.email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {person.email}
                </span>
              ) : null}
              {person.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {person.phone}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Active roles */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Roles{" "}
          <span className="text-sm font-normal text-slate-500">
            ({active_roles.length} active)
          </span>
        </h2>
        {active_roles.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No active role assignments.
          </div>
        ) : (
          <RoleGroup roles={active_roles} />
        )}
      </section>

      {/* Inactive history */}
      {inactive_roles.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Inactive history{" "}
            <span className="text-sm font-normal text-slate-500">
              ({inactive_roles.length})
            </span>
          </h2>
          <RoleGroup roles={inactive_roles} dimmed />
        </section>
      ) : null}

      {/* Source provenance */}
      {person.source_yip_profile_id || person.source_future_team_id ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Source provenance
          </h2>
          <div className="rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-700">
            <dl className="grid grid-cols-1 gap-y-2 md:grid-cols-2">
              {person.source_yip_profile_id ? (
                <div>
                  <dt className="font-medium text-slate-500">
                    YIP profile id
                  </dt>
                  <dd className="font-mono text-slate-800">
                    {person.source_yip_profile_id}
                  </dd>
                </div>
              ) : null}
              {person.source_future_team_id ? (
                <div>
                  <dt className="font-medium text-slate-500">
                    Yi-Future team id
                  </dt>
                  <dd className="font-mono text-slate-800">
                    {person.source_future_team_id}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      ) : null}
    </div>
  );
}
