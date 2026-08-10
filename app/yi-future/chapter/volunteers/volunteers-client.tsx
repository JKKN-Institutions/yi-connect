"use client";

/**
 * Chapter chair's volunteer roster. Client-side submit on purpose: the plain
 * `<form action={serverAction}>` pattern re-renders and blanks the fields on
 * error with no message (the BUG-446/402/466 class), which is why every result
 * here is rendered inline. Same reasoning as
 * components/yi-future/admin/ActionResultForm.tsx.
 */

import { useState, useTransition } from "react";
import {
  createVolunteer,
  setVolunteerStation,
  setVolunteerActive,
  regenerateVolunteerCode,
  revokeVolunteerCode,
  deleteVolunteer,
} from "@/app/yi-future/actions/volunteers";
import {
  VOLUNTEER_STATIONS,
  isCheckInStation,
  stationLabel,
  type FutureVolunteer,
} from "@/lib/yi-future/volunteers";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export function VolunteersClient({
  chapterId,
  editionId,
  chapterName,
  volunteers,
  disabled,
}: {
  chapterId: string;
  editionId: string;
  chapterName: string;
  volunteers: FutureVolunteer[];
  disabled: boolean;
}) {
  const [addResult, setAddResult] = useState<Result | null>(null);
  const [rowResult, setRowResult] = useState<Record<string, Result>>({});
  const [pending, startTransition] = useTransition();
  const [busyRow, setBusyRow] = useState<string | null>(null);

  function runRow(id: string, fn: () => Promise<Result>) {
    setBusyRow(id);
    setRowResult((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
    startTransition(async () => {
      try {
        const res = await fn();
        setRowResult((m) => ({ ...m, [id]: res }));
      } catch (e) {
        // Never leave a row silently unchanged: a thrown action (network drop,
        // 403 redirect boundary) must still say something.
        setRowResult((m) => ({
          ...m,
          [id]: {
            ok: false,
            error: `That did not go through (${
              e instanceof Error ? e.message : String(e)
            }). Reload and try again.`,
          },
        }));
      } finally {
        setBusyRow(null);
      }
    });
  }

  const present = volunteers.filter((v) => v.arrived).length;
  const canCheckIn = volunteers.filter((v) => isCheckInStation(v.station)).length;

  return (
    <div className="space-y-6">
      {/* Add */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy">
          Add a volunteer to {chapterName}
        </h3>
        <form
          className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            setAddResult(null);
            startTransition(async () => {
              try {
                const res = await createVolunteer(
                  { chapterId, editionId },
                  fd
                );
                setAddResult(res ?? { ok: true });
                if (res?.ok) form.reset();
              } catch (err) {
                setAddResult({
                  ok: false,
                  error: `Could not add (${
                    err instanceof Error ? err.message : String(err)
                  }).`,
                });
              }
            });
          }}
        >
          <input
            name="full_name"
            required
            placeholder="Full name *"
            className="px-3 py-2.5 border border-navy/20 rounded-md text-sm bg-white"
          />
          <select
            name="station"
            defaultValue="check_in"
            className="px-3 py-2.5 border border-navy/20 rounded-md text-sm bg-white"
          >
            {VOLUNTEER_STATIONS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label} — {s.hint}
              </option>
            ))}
          </select>
          <input
            name="phone"
            placeholder="Phone (optional)"
            className="px-3 py-2.5 border border-navy/20 rounded-md text-sm bg-white"
          />
          <input
            name="email"
            type="email"
            placeholder="Email (optional)"
            className="px-3 py-2.5 border border-navy/20 rounded-md text-sm bg-white"
          />
          <input
            name="notes"
            placeholder="Notes (shift, T-shirt size…)"
            className="md:col-span-2 px-3 py-2.5 border border-navy/20 rounded-md text-sm bg-white"
          />
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={pending || disabled}
              className="px-4 py-2.5 rounded-md bg-navy text-ivory text-sm font-bold hover:bg-navy-dark disabled:opacity-40"
            >
              {pending ? "Adding…" : "+ Add volunteer"}
            </button>
            {addResult && !addResult.ok && (
              <p className="text-sm font-semibold text-red-600">
                {addResult.error}
              </p>
            )}
            {addResult?.ok && addResult.message && (
              <p className="text-sm font-semibold text-emerald-700">
                {addResult.message}
              </p>
            )}
          </div>
        </form>
        <p className="mt-2 text-[11px] text-navy/40">
          A volunteer code is 6 characters and always starts with a ZERO — read
          it out as &ldquo;zero&rdquo;. Student, mentor, jury, partner and expert
          codes can never contain a zero, so a volunteer code can never be
          anybody else&rsquo;s code and a volunteer can never sign in as a
          student. If they type the letter O the sign-in box corrects it for
          them.
        </p>
      </section>

      {/* Roster */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy">
            Roster ({volunteers.length})
          </h3>
          <p className="text-xs text-navy/50">
            {canCheckIn} can mark attendance · {present} have signed in
          </p>
        </div>

        {volunteers.length === 0 ? (
          <p className="mt-4 text-sm text-navy/50 italic">
            No volunteers yet. Add your check-in desk staff above.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {volunteers.map((v) => {
              const res = rowResult[v.id];
              const busy = busyRow === v.id;
              return (
                <li
                  key={v.id}
                  className={`border rounded-lg p-4 ${
                    v.is_active ? "border-navy/10" : "border-navy/10 bg-navy/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-navy">
                        {v.full_name}
                        {!v.is_active && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-navy/40">
                            paused
                          </span>
                        )}
                        {v.arrived && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                            signed in
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-navy/50">
                        {stationLabel(v.station)}
                        {v.phone ? ` · ${v.phone}` : ""}
                        {v.email ? ` · ${v.email}` : ""}
                      </div>
                      {v.notes && (
                        <div className="mt-1 text-xs text-navy/60">
                          {v.notes}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {v.access_code ? (
                        <code className="text-sm font-mono font-bold tracking-[0.2em] bg-[#F5A623]/10 text-[#B8770F] px-2 py-1 rounded">
                          {v.access_code}
                        </code>
                      ) : (
                        <span className="text-xs font-semibold text-red-600">
                          code revoked
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-navy/10 flex flex-wrap items-center gap-3">
                    <select
                      defaultValue={v.station}
                      disabled={busy || disabled}
                      onChange={(e) =>
                        runRow(v.id, () =>
                          setVolunteerStation(v.id, e.target.value)
                        )
                      }
                      className="px-2 py-1 text-xs border border-navy/20 rounded bg-white"
                      aria-label={`Station for ${v.full_name}`}
                    >
                      {VOLUNTEER_STATIONS.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={busy || disabled}
                      onClick={() =>
                        runRow(v.id, () => regenerateVolunteerCode(v.id))
                      }
                      className="text-xs font-semibold text-navy hover:text-[#B8770F] disabled:opacity-40"
                    >
                      New code
                    </button>

                    {v.access_code && (
                      <button
                        type="button"
                        disabled={busy || disabled}
                        onClick={() =>
                          runRow(v.id, () => revokeVolunteerCode(v.id))
                        }
                        className="text-xs font-semibold text-navy/60 hover:text-navy disabled:opacity-40"
                      >
                        Revoke code
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy || disabled}
                      onClick={() =>
                        runRow(v.id, () =>
                          setVolunteerActive(v.id, !v.is_active)
                        )
                      }
                      className="text-xs font-semibold text-navy/60 hover:text-navy disabled:opacity-40"
                    >
                      {v.is_active ? "Pause" : "Re-activate"}
                    </button>

                    <button
                      type="button"
                      disabled={busy || disabled}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Remove ${v.full_name}? Attendance they already marked stays, but their code stops working.`
                          )
                        ) {
                          return;
                        }
                        runRow(v.id, () => deleteVolunteer(v.id));
                      }}
                      className="text-xs font-semibold text-red-600/70 hover:text-red-600 disabled:opacity-40 ml-auto"
                    >
                      Remove
                    </button>
                  </div>

                  {busy && (
                    <p className="mt-2 text-xs font-semibold text-navy/50">
                      Working…
                    </p>
                  )}
                  {res && !res.ok && (
                    <p className="mt-2 text-xs font-semibold text-red-600">
                      {res.error}
                    </p>
                  )}
                  {res?.ok && res.message && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      {res.message} — reload to see it in the list.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
