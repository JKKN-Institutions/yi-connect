"use client";

/**
 * The YIQ team console.
 *
 * Two things it deliberately does NOT do:
 *   1. It never offers a free-text chapter box. The chapter picker is fed from
 *      yi.chapters, because the access check compares chapter names literally
 *      and a typo produces a role that grants nothing while looking granted.
 *   2. It never shows a revoke button beside a DERIVED chair. Those come from
 *      the Yi directory itself; a button that cannot work is worse than none.
 *
 * Validation is the same `validateRoleGrant` the server runs, so the message
 * you see here is the message the server would have given you.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  YIQ_ROLES,
  YIQ_ZONE_CODES,
  groupYiqTeam,
  roleNeedsChapter,
  roleNeedsZone,
  validateRoleGrant,
  yiqRoleDef,
  yiqRoleLabel,
  type YiqRoleValue,
  type YiqTeamMember,
  type YiqUnmanagedRole,
} from "@/lib/yiq/roles";
import { grantYiqRole, revokeYiqRole } from "../../actions/admin-team";

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
// #14795a is the YIQ green on paper; on the ink ground it needs the lighter
// tint to stay legible (the same value the paper-tools "Published" pill uses).
const GREEN_ON_INK = "#7fd4b0";
const VERMILION = "#c8452f";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  borderRadius: "0.5rem",
  border: `1.5px solid ${RULE}`,
  background: "rgba(247,244,237,0.06)",
  color: PAPER,
  fontSize: "1rem", // 16px — anything smaller makes iOS zoom the page on focus
  minHeight: "2.75rem",
};

type Props = {
  granted: YiqTeamMember[];
  derived: YiqTeamMember[];
  unmanaged: YiqUnmanagedRole[];
  chapters: { name: string; zone: string | null }[];
  zones: string[];
  grantableRoles: YiqRoleValue[];
};

export function TeamManager({
  granted,
  derived,
  unmanaged,
  chapters,
  zones,
  grantableRoles,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(grantableRoles[0] ?? "");
  const [chapter, setChapter] = useState("");
  const [zone, setZone] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const def = yiqRoleDef(role);
  const needsChapter = roleNeedsChapter(role);
  const needsZone = roleNeedsZone(role);
  const groups = useMemo(() => groupYiqTeam(granted), [granted]);
  // Zones come from the live chapter table; the handbook list is the fallback
  // so the picker can never be empty (an empty required select is a dead end).
  const zoneOptions = zones.length > 0 ? zones : [...YIQ_ZONE_CODES];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Same validator the server runs — no chance of a friendlier client rule
    // than the one that actually decides.
    const shapeError = validateRoleGrant({
      role,
      chapter: needsChapter ? chapter : null,
      zone: needsZone ? zone : null,
    });
    if (shapeError) {
      toast.error(shapeError);
      return;
    }
    start(async () => {
      const res = await grantYiqRole({
        email,
        role,
        chapter: needsChapter ? chapter : null,
        zone: needsZone ? zone : null,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      if (res.warning) toast.warning(res.warning);
      setEmail("");
      setChapter("");
      setZone("");
      setOpen(false);
      router.refresh();
    });
  }

  function revoke(assignmentId: string) {
    start(async () => {
      const res = await revokeYiqRole(assignmentId);
      setConfirmingId(null);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <div className="mt-9">
      {/* ── Roles this console does not manage ─────────────────────── */}
      {unmanaged.length > 0 ? (
        <section
          className="mb-8 rounded-2xl border p-4 sm:p-5"
          style={{ borderColor: VERMILION, background: "rgba(200,69,47,0.09)" }}
        >
          <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
            {unmanaged.length} role{unmanaged.length === 1 ? "" : "s"} this page
            does not manage
          </p>
          <p className="mt-2 text-[0.875rem] leading-relaxed" style={{ color: PAPER }}>
            These YIQ rows carry a role name outside the four below. They are
            listed rather than hidden — a role nobody can see is a role nobody
            can audit.
          </p>
          <ul className="mt-3 grid gap-2">
            {unmanaged.map((u) => (
              <li
                key={u.assignmentId}
                className="rounded-xl px-3 py-2.5"
                style={{ background: "rgba(247,244,237,0.06)" }}
              >
                <p className="text-[0.9375rem] font-semibold">{u.fullName}</p>
                <p className="yiq-data mt-0.5 text-[0.75rem]" style={{ color: DIM }}>
                  {u.role}
                  {u.chapter || u.zone ? ` · ${u.chapter ?? u.zone}` : ""}
                  {u.grantsNational ? " · grants national access" : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Grant ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="yiq-display text-[1.5rem]">Granted roles</h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full px-5 py-3 text-[0.875rem] font-bold"
          style={{ background: SAFFRON, color: INK, minHeight: "2.75rem" }}
        >
          {open ? "Cancel" : "Add someone"}
        </button>
      </div>

      {open ? (
        <form
          onSubmit={submit}
          className="mt-4 grid gap-4 rounded-2xl border p-4 sm:p-5"
          style={{ borderColor: RULE }}
        >
          <label className="block">
            <span className="yiq-eyebrow" style={{ color: DIM }}>
              Their email
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.org"
              style={fieldStyle}
              className="mt-1.5"
            />
            <span className="mt-1.5 block text-[0.8125rem]" style={{ color: DIM }}>
              They must already be in the Yi directory. This page grants roles;
              it does not create people.
            </span>
          </label>

          <label className="block">
            <span className="yiq-eyebrow" style={{ color: DIM }}>
              Role
            </span>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setChapter("");
                setZone("");
              }}
              style={fieldStyle}
              className="mt-1.5"
            >
              {grantableRoles.map((r) => (
                <option key={r} value={r}>
                  {yiqRoleLabel(r)}
                </option>
              ))}
            </select>
          </label>

          {/* The scope field exists only when the role actually needs one. */}
          {needsChapter ? (
            <label className="block">
              <span className="yiq-eyebrow" style={{ color: DIM }}>
                Which chapter
              </span>
              <select
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                style={fieldStyle}
                className="mt-1.5"
                required
              >
                <option value="">Choose a chapter…</option>
                {chapters.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                    {c.zone ? ` · ${c.zone}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {needsZone ? (
            <label className="block">
              <span className="yiq-eyebrow" style={{ color: DIM }}>
                Which zone
              </span>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                style={fieldStyle}
                className="mt-1.5"
                required
              >
                <option value="">Choose a zone…</option>
                {zoneOptions.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {def ? (
            <div
              className="rounded-xl p-3.5"
              style={{ background: "rgba(247,244,237,0.05)" }}
            >
              <p className="text-[0.875rem] font-semibold">{def.summary}</p>
              <ul className="mt-2 grid gap-1">
                {def.can.map((c) => (
                  <li key={c} className="text-[0.8125rem]" style={{ color: PAPER }}>
                    <span style={{ color: GREEN_ON_INK }}>✓</span> {c}
                  </li>
                ))}
                {def.cannot.map((c) => (
                  <li key={c} className="text-[0.8125rem]" style={{ color: DIM }}>
                    <span style={{ color: SAFFRON }}>✕</span> {c}
                  </li>
                ))}
              </ul>
              {def.note ? (
                <p className="mt-2.5 text-[0.8125rem]" style={{ color: SAFFRON }}>
                  {def.note}
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="justify-self-start rounded-full px-6 py-3 text-[0.875rem] font-bold disabled:opacity-60"
            style={{ background: SAFFRON, color: INK, minHeight: "2.75rem" }}
          >
            {pending ? "Granting…" : "Grant the role"}
          </button>
        </form>
      ) : null}

      {/* ── The granted team ───────────────────────────────────────── */}
      {groups.length === 0 ? (
        <p className="mt-5 text-[0.9375rem]" style={{ color: DIM }}>
          Nobody has been granted a YIQ role yet. Chapter chairs can already run
          their own chapter — see below.
        </p>
      ) : (
        <div className="mt-5 grid gap-7">
          {groups.map((g) => (
            <section key={g.role}>
              <h3 className="yiq-eyebrow" style={{ color: SAFFRON }}>
                {g.def.label} · {g.members.length}
              </h3>
              <p className="mt-1.5 text-[0.8125rem]" style={{ color: DIM }}>
                {g.def.summary}
              </p>
              <ul className="mt-3 grid gap-2">
                {g.members.map((m) => (
                  <li
                    key={m.assignmentId ?? `${m.personId}-${m.chapter}`}
                    className="rounded-xl border p-3.5"
                    style={{ borderColor: RULE }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.9375rem] font-semibold">
                          {m.fullName}
                        </p>
                        <p
                          className="yiq-data mt-0.5 break-all text-[0.75rem]"
                          style={{ color: DIM }}
                        >
                          {m.email ?? "no email on file"}
                        </p>
                        <p className="yiq-eyebrow mt-1.5" style={{ color: DIM }}>
                          {m.chapter ?? m.zone ?? "National"}
                          {m.yiYear ? ` · ${m.yiYear}` : ""}
                        </p>
                        {!m.hasLogin ? (
                          <p
                            className="mt-2 rounded-lg px-2.5 py-1.5 text-[0.75rem]"
                            style={{
                              background: "rgba(200,69,47,0.16)",
                              color: PAPER,
                            }}
                          >
                            No Yi login yet — they cannot sign in to use this.
                          </p>
                        ) : null}
                      </div>
                      {m.assignmentId ? (
                        confirmingId === m.assignmentId ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => revoke(m.assignmentId!)}
                              disabled={pending}
                              className="rounded-full px-4 py-2.5 text-[0.8125rem] font-bold disabled:opacity-60"
                              style={{
                                background: VERMILION,
                                color: PAPER,
                                minHeight: "2.75rem",
                              }}
                            >
                              {pending ? "Removing…" : "Yes, remove"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              className="rounded-full px-4 py-2.5 text-[0.8125rem] font-bold"
                              style={{
                                background: "rgba(247,244,237,0.08)",
                                color: DIM,
                                minHeight: "2.75rem",
                              }}
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingId(m.assignmentId)}
                            className="rounded-full px-4 py-2.5 text-[0.8125rem] font-bold"
                            style={{
                              background: "rgba(247,244,237,0.08)",
                              color: DIM,
                              minHeight: "2.75rem",
                            }}
                          >
                            Remove
                          </button>
                        )
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* ── Derived chairs ─────────────────────────────────────────── */}
      <section className="mt-10 border-t pt-7" style={{ borderColor: RULE }}>
        <h2 className="yiq-display text-[1.5rem]">
          Chapter chairs — already in
        </h2>
        <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed" style={{ color: DIM }}>
          The Yi directory decides who chairs a chapter, and YIQ simply believes
          it. These {derived.length} people already run their own chapter&apos;s
          quiz with nothing granted here. Copying them into YIQ would only
          create a second list to keep in step — change a chair in the Yi
          directory instead.
        </p>
        {derived.length > 0 ? (
          <details className="mt-4">
            <summary
              className="cursor-pointer rounded-full px-5 py-3 text-[0.875rem] font-bold"
              style={{
                background: "rgba(247,244,237,0.08)",
                color: PAPER,
                minHeight: "2.75rem",
                display: "inline-block",
              }}
            >
              Show all {derived.length}
            </summary>
            <ul className="mt-3 grid gap-1.5">
              {derived
                .slice()
                .sort((a, b) => (a.chapter ?? "").localeCompare(b.chapter ?? ""))
                .map((m) => (
                  <li
                    key={`${m.personId}-${m.chapter}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl px-3.5 py-2.5"
                    style={{ background: "rgba(247,244,237,0.05)" }}
                  >
                    <span className="text-[0.9375rem] font-semibold">
                      {m.chapter}
                    </span>
                    <span className="text-[0.8125rem]" style={{ color: DIM }}>
                      {m.fullName}
                      {!m.hasLogin ? " · no login" : ""}
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        ) : null}
      </section>

      {/* ── What the four roles mean ───────────────────────────────── */}
      <section className="mt-10 border-t pt-7" style={{ borderColor: RULE }}>
        <h2 className="yiq-display text-[1.5rem]">What each role can do</h2>
        <div className="mt-4 grid gap-3">
          {YIQ_ROLES.map((r) => (
            <div
              key={r.value}
              className="rounded-2xl border p-4"
              style={{ borderColor: RULE }}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-[1rem] font-bold">{r.label}</h3>
                <span className="yiq-eyebrow" style={{ color: SAFFRON }}>
                  {r.scope === "national"
                    ? "all chapters"
                    : r.scope === "zone"
                      ? "one zone"
                      : "one chapter"}
                </span>
              </div>
              <ul className="mt-2.5 grid gap-1">
                {r.can.map((c) => (
                  <li key={c} className="text-[0.8125rem]">
                    <span style={{ color: GREEN_ON_INK }}>✓</span> {c}
                  </li>
                ))}
                {r.cannot.map((c) => (
                  <li key={c} className="text-[0.8125rem]" style={{ color: DIM }}>
                    <span style={{ color: SAFFRON }}>✕</span> {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
