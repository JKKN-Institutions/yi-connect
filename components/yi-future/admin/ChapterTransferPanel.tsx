"use client";

// The picker for moving colleges and teams to another chapter.
//
// It runs through ActionResultForm rather than a bare <form action={...}> so a
// refusal is shown inline with the ticks still in place. A plain form re-renders
// the page on error, clearing every checkbox — the admin then cannot see which
// refusal belonged to which selection (BUG-446/402/466, the reason that wrapper
// exists at all).

import { useState } from "react";
import { ActionResultForm } from "@/components/yi-future/admin/ActionResultForm";
import { transferToChapter } from "@/app/yi-future/actions/chapter-transfer";
import {
  TRANSFER_REASON_MAX,
  type TransferableCollege,
  type TransferableTeam,
} from "@/lib/yi-future/chapter-transfer";

export function ChapterTransferPanel({
  fromChapter,
  toChapter,
  colleges,
  teams,
}: {
  fromChapter: { id: string; name: string };
  toChapter: { id: string; name: string };
  colleges: TransferableCollege[];
  teams: TransferableTeam[];
}) {
  const [pickedColleges, setPickedColleges] = useState<Set<string>>(new Set());
  const [pickedTeams, setPickedTeams] = useState<Set<string>>(new Set());

  function toggle(set: Set<string>, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  const studentsMoving =
    colleges
      .filter((c) => pickedColleges.has(c.id))
      .reduce((n, c) => n + c.delegates, 0) +
    teams.filter((t) => pickedTeams.has(t.id)).reduce((n, t) => n + t.members, 0);

  // Students at a ticked college who are on a team that is NOT ticked. Moving
  // them would leave their team behind in the old chapter — the one outcome
  // this screen exists to prevent, so it is named before the click, not after.
  const strandedWarning = colleges
    .filter((c) => pickedColleges.has(c.id) && c.delegatesOnTeams > 0)
    .reduce((n, c) => n + c.delegatesOnTeams, 0);

  const nothingPicked = pickedColleges.size === 0 && pickedTeams.size === 0;

  return (
    <ActionResultForm action={transferToChapter} className="mt-6 space-y-6">
      <input type="hidden" name="from" value={fromChapter.id} />
      <input type="hidden" name="to" value={toChapter.id} />

      <p className="text-sm text-navy">
        Moving from <strong>{fromChapter.name}</strong> to{" "}
        <strong>{toChapter.name}</strong>.
      </p>

      {/* ─── Colleges ─────────────────────────────────────────────── */}
      <section className="bg-white border border-navy/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-navy">
          Colleges in {fromChapter.name}
        </h2>
        <p className="mt-1 text-xs text-navy/50">
          Ticking a college moves the college and every one of its students in
          this chapter.
        </p>

        <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
          {colleges.length === 0 && (
            <p className="text-xs text-navy/50">No colleges on file.</p>
          )}
          {colleges.map((c) => (
            <label
              key={c.id}
              className="flex items-start gap-3 p-2 min-h-[44px] rounded-md hover:bg-navy/5 cursor-pointer"
            >
              <input
                type="checkbox"
                name="college"
                value={c.id}
                checked={pickedColleges.has(c.id)}
                onChange={() => setPickedColleges((s) => toggle(s, c.id))}
                className="mt-1"
              />
              <span className="text-sm text-navy">
                {c.name}
                {c.city ? (
                  <span className="text-navy/50"> — {c.city}</span>
                ) : null}
                <span className="block text-xs text-navy/50">
                  {c.delegates} student{c.delegates === 1 ? "" : "s"}
                  {c.delegatesOnTeams > 0
                    ? ` · ${c.delegatesOnTeams} on a team`
                    : ""}
                </span>
                {/* The destination already has this college. Say so here, on
                    the row, rather than letting the admin discover it as a
                    database error after clicking. */}
                {c.mergesIntoName && (
                  <span className="block text-xs font-semibold text-yi-gold">
                    Already in {toChapter.name} — these students will be merged
                    into “{c.mergesIntoName}”, and this duplicate closed.
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* ─── Teams ────────────────────────────────────────────────── */}
      <section className="bg-white border border-navy/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-navy">
          Teams in {fromChapter.name}
        </h2>
        <p className="mt-1 text-xs text-navy/50">
          Ticking a team moves the team and all of its members, so it is never
          split across two chapters.
        </p>

        <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
          {teams.length === 0 && (
            <p className="text-xs text-navy/50">No teams on file.</p>
          )}
          {teams.map((t) => (
            <label
              key={t.id}
              className="flex items-start gap-3 p-2 min-h-[44px] rounded-md hover:bg-navy/5 cursor-pointer"
            >
              <input
                type="checkbox"
                name="team"
                value={t.id}
                checked={pickedTeams.has(t.id)}
                onChange={() => setPickedTeams((s) => toggle(s, t.id))}
                className="mt-1"
              />
              <span className="text-sm text-navy">
                {t.name}
                <span className="block text-xs text-navy/50">
                  {t.members} member{t.members === 1 ? "" : "s"}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* ─── Destination + reason ─────────────────────────────────── */}
      <section className="bg-white border border-navy/10 rounded-lg p-4 space-y-4">
        <div>
          <label
            htmlFor="reason"
            className="block text-xs font-semibold text-navy mb-1.5"
          >
            Why (kept in the record)
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={2}
            maxLength={TRANSFER_REASON_MAX}
            placeholder="e.g. these colleges are in Ranipet, students picked the wrong chapter when registering"
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
          />
        </div>

        <div className="text-xs text-navy/60" aria-live="polite">
          {nothingPicked ? (
            <span>Nothing ticked yet.</span>
          ) : (
            <span>
              Moving <strong>{pickedColleges.size}</strong> college
              {pickedColleges.size === 1 ? "" : "s"}
              {mergeCount > 0 ? (
                <>
                  {" "}
                  (<strong>{mergeCount}</strong> of them merged into records{" "}
                  {toChapter.name} already has)
                </>
              ) : null}{" "}
              and <strong>{pickedTeams.size}</strong> team
              {pickedTeams.size === 1 ? "" : "s"}, carrying about{" "}
              <strong>{studentsMoving}</strong> student
              {studentsMoving === 1 ? "" : "s"}.
            </span>
          )}
        </div>

        {strandedWarning > 0 && (
          <p role="alert" className="text-xs font-semibold text-red-600">
            {strandedWarning} of those students are on a team. Tick their team
            as well, or the team stays behind in {fromChapter.name} and ends up
            split across two chapters.
          </p>
        )}

        <button
          type="submit"
          disabled={nothingPicked}
          className="px-4 py-2 min-h-[44px] rounded-md bg-navy text-white text-sm font-semibold disabled:opacity-40"
        >
          Move to the chosen chapter
        </button>
      </section>
    </ActionResultForm>
  );
}
