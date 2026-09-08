"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  ClipboardPaste,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import {
  SectionHeading,
  SectionShell,
  INK,
  SAFFRON,
  GREEN,
  GOLD,
  SERIF,
  inkA,
} from "@/app/yip/me/credential-ui";
import {
  bulkAssignChaptersBySchool,
  setParticipantChapter,
  setSchoolChapter,
  type BulkAssignReport,
  type ChapterAssignmentProgress,
  type ChapterOption,
  type RosterParticipant,
  type SchoolChapterGroup,
} from "@/app/yip/actions/chapter-assign";

/**
 * Record which Yi chapter sent each student to this round.
 *
 * CHAPTER IS THE AXIS. Recognition at a regional round is computed per chapter;
 * school decides nothing. So the roster is grouped by CHAPTER, and "Not assigned
 * yet" is the group at the top — on every live round today it holds the entire
 * roster, which is the state this screen is built around rather than an edge
 * case to mop up afterwards.
 *
 * The previous school-first layout was unusable in practice: four of the five
 * live 2026 rounds (WR Ahmedabad, ER Durg, Durg Chapter, Ahmedabad Chapter —
 * 531 students) carry NO school on a single row, so the main list rendered
 * empty. School now appears only as a second line under each name, where it
 * still helps an organiser recognise a student on SRTN, the one round that has
 * it.
 *
 * SEARCH IS THE NAVIGATION. A roster runs to ~200 names and an organiser is
 * usually hunting for one. It matches name or school, and works whether or not
 * anything has been assigned.
 *
 * The school shortcuts — paste a list, or one dropdown per school — appear only
 * when the roster actually carries schools. They are a real saving on SRTN and
 * simply absent everywhere else.
 *
 * Every chapter shown is one of the event's OWN zone's; the server refuses
 * anything else, so a mis-paste cannot file a student under another region.
 */

const REASON_LABEL: Record<BulkAssignReport["unresolved"][number]["reason"], string> = {
  unknown_school: "No student on this event is from that school",
  unknown_chapter: "No Yi chapter by that name",
  chapter_outside_zone: "That chapter is in another zone",
  duplicate_row: "That school already appeared on an earlier line",
  blank_row: "Each line needs a school AND a chapter, separated by a comma",
};

/**
 * Split one pasted line into school and chapter.
 *
 * School names routinely contain commas ("St Joseph's, Erode") and chapter
 * names never do, so the LAST comma is the separator. A school wrapped in
 * double quotes is honoured first, which is what a spreadsheet export produces.
 */
function parseLine(line: string): { schoolName: string; chapterName: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('"')) {
    const close = trimmed.indexOf('"', 1);
    if (close > 0) {
      const rest = trimmed.slice(close + 1).replace(/^\s*,/, "");
      return {
        schoolName: trimmed.slice(1, close).trim(),
        chapterName: rest.trim(),
      };
    }
  }

  const cut = trimmed.lastIndexOf(",");
  if (cut < 0) return { schoolName: trimmed, chapterName: "" };
  return {
    schoolName: trimmed.slice(0, cut).trim(),
    chapterName: trimmed.slice(cut + 1).trim(),
  };
}

/**
 * Defined at module level, not inside ChaptersClient — a component declared in
 * a render body is a NEW type every render, which remounts the native <select>
 * and can close the picker mid-choice on a phone.
 */
function ChapterSelect({
  chapters,
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  chapters: ChapterOption[];
  value: string | null;
  onChange: (chapterId: string | null) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="w-full rounded-md border bg-white px-2.5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderColor: inkA(0.15), color: INK }}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Not assigned</option>
      {chapters.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

export function ChaptersClient({
  eventId,
  zone,
  chapters,
  migrationApplied,
  participants,
  schools,
  progress,
}: {
  eventId: string;
  zone: string | null;
  chapters: ChapterOption[];
  migrationApplied: boolean;
  participants: RosterParticipant[];
  schools: SchoolChapterGroup[];
  progress: ChapterAssignmentProgress;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nameQuery, setNameQuery] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");
  const [paste, setPaste] = useState("");
  const [report, setReport] = useState<BulkAssignReport | null>(null);

  // Optimistic layer over the server props: a dropdown shows its new value the
  // instant it is chosen, while the counts above come from the refreshed server
  // read. Once the refresh lands the override matches the prop and does nothing.
  const [schoolOverride, setSchoolOverride] = useState<
    Record<string, string | null>
  >({});
  const [personOverride, setPersonOverride] = useState<
    Record<string, string | null>
  >({});

  const chapterName = useMemo(
    () => new Map(chapters.map((c) => [c.id, c.name])),
    [chapters]
  );

  const visibleSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.schoolName.toLowerCase().includes(q));
  }, [schools, schoolQuery]);

  /**
   * The roster folded by chapter, and filtered by the search box.
   *
   * Grouping happens HERE rather than on the server so a chapter just chosen
   * moves that student into their new group immediately, instead of leaving
   * them sitting under "Not assigned yet" until the refresh lands.
   *
   * Empty groups are dropped, so "Not assigned yet" is shown exactly when
   * somebody is unfiled — which today, on every live round, is everybody.
   */
  const groups = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    const buckets = new Map<
      string,
      { chapterId: string | null; people: RosterParticipant[] }
    >();

    for (const p of participants) {
      if (
        q &&
        !p.fullName.toLowerCase().includes(q) &&
        !p.schoolName.toLowerCase().includes(q)
      ) {
        continue;
      }
      const chapterId =
        p.id in personOverride ? personOverride[p.id] : p.chapterId;
      const key = chapterId ?? "";
      const bucket = buckets.get(key) ?? { chapterId, people: [] };
      bucket.people.push(p);
      buckets.set(key, bucket);
    }

    return [...buckets.values()]
      .map((b) => ({
        chapterId: b.chapterId,
        // A chapter deactivated after students were filed under it is no longer
        // in the picklist. Say so plainly instead of printing a raw id.
        label: b.chapterId
          ? (chapterName.get(b.chapterId) ?? "Chapter no longer listed")
          : "Not assigned yet",
        people: b.people,
      }))
      .sort((a, b) => {
        if (a.chapterId === null) return -1;
        if (b.chapterId === null) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [participants, personOverride, nameQuery, chapterName]);

  const matchCount = groups.reduce((n, g) => n + g.people.length, 0);

  // A write is only possible when the column exists AND the event has a zone to
  // scope the picklist to. Both are shown as banners below, so a disabled
  // dropdown is never unexplained.
  const canWrite = migrationApplied && !!zone && chapters.length > 0;

  function assignSchool(schoolName: string, chapterId: string | null) {
    setSchoolOverride((m) => ({ ...m, [schoolName]: chapterId }));
    startTransition(async () => {
      const r = await setSchoolChapter(eventId, schoolName, chapterId);
      if (!r.success) {
        // Drop the override so the dropdown snaps back to the stored truth.
        setSchoolOverride((m) => {
          const next = { ...m };
          delete next[schoolName];
          return next;
        });
        toast.error(r.error);
        return;
      }
      toast.success(
        chapterId
          ? `${r.data.matchedParticipants} student${r.data.matchedParticipants === 1 ? "" : "s"} filed under ${chapterName.get(chapterId) ?? "that chapter"}`
          : `Chapter cleared for ${r.data.matchedParticipants} student${r.data.matchedParticipants === 1 ? "" : "s"}`
      );
      router.refresh();
    });
  }

  function assignPerson(participantId: string, chapterId: string | null) {
    setPersonOverride((m) => ({ ...m, [participantId]: chapterId }));
    startTransition(async () => {
      const r = await setParticipantChapter(eventId, participantId, chapterId);
      if (!r.success) {
        setPersonOverride((m) => {
          const next = { ...m };
          delete next[participantId];
          return next;
        });
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  function applyPaste() {
    const rows = paste
      .split(/\r?\n/)
      .map(parseLine)
      .filter((r): r is { schoolName: string; chapterName: string } => r !== null);

    if (rows.length === 0) {
      toast.error("Nothing to apply — paste one school,chapter per line.");
      return;
    }

    startTransition(async () => {
      const r = await bulkAssignChaptersBySchool(eventId, rows);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setReport(r.data);
      if (r.data.matchedParticipants > 0) {
        toast.success(
          `${r.data.matchedParticipants} student${r.data.matchedParticipants === 1 ? "" : "s"} filed across ${r.data.appliedRows} school${r.data.appliedRows === 1 ? "" : "s"}`
        );
      }
      if (r.data.unresolved.length > 0) {
        toast.error(
          `${r.data.unresolved.length} line${r.data.unresolved.length === 1 ? "" : "s"} did not apply — see the list below.`
        );
      }
      router.refresh();
    });
  }

  const pct =
    progress.total > 0 ? Math.round((progress.assigned / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ── Progress ───────────────────────────────────────────── */}
      <SectionShell accent={`linear-gradient(90deg, ${SAFFRON}, ${GOLD}, ${GREEN})`}>
        <div className="p-4">
          <SectionHeading
            eyebrow="Regional round setup"
            title="Which chapter is each student from?"
            icon={MapPin}
          />
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: inkA(0.7) }}>
            Every chapter in{" "}
            <span className="font-semibold">{zone ?? "this zone"}</span> sends
            candidates to this round. Recording the sending chapter is what makes
            per-chapter recognition possible — until a student is filed, they
            count for nobody.
          </p>

          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] font-semibold" style={{ ...SERIF, color: INK }}>
                {progress.assigned} of {progress.total} students assigned
              </p>
              <span className="text-[13px] font-semibold" style={{ color: GREEN }}>
                {pct}%
              </span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full"
              style={{ background: inkA(0.08) }}
            >
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${pct}%`, background: GREEN }}
              />
            </div>
            <p className="mt-2 text-[12px]" style={{ color: inkA(0.6) }}>
              {progress.unassigned} student
              {progress.unassigned === 1 ? "" : "s"} still to file
              {isPending && " · saving…"}
            </p>
          </div>
        </div>
      </SectionShell>

      {/* ── Blockers ───────────────────────────────────────────── */}
      {!migrationApplied && (
        <div
          className="flex items-start gap-2.5 rounded-xl border p-3.5 text-[13px]"
          style={{ borderColor: "#f0b429", background: "#fffaf0", color: "#7a4d00" }}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Not switched on yet</p>
            <p className="mt-0.5 leading-relaxed">
              The database column that holds a student&apos;s chapter has not been
              added yet, so nothing can be saved on this screen. Ask a platform
              admin to apply{" "}
              <code className="rounded bg-black/5 px-1">
                20260829120000_yip_participant_chapter
              </code>
              , then reload.
            </p>
          </div>
        </div>
      )}

      {migrationApplied && !zone && (
        <div
          className="flex items-start gap-2.5 rounded-xl border p-3.5 text-[13px]"
          style={{ borderColor: "#f0b429", background: "#fffaf0", color: "#7a4d00" }}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">This event has no Yi zone set</p>
            <p className="mt-0.5 leading-relaxed">
              The chapter list is scoped to the round&apos;s own zone so a student
              cannot be filed under another region. Set the zone on the
              event&apos;s Edit screen, then come back.
            </p>
          </div>
        </div>
      )}

      {migrationApplied && !!zone && chapters.length === 0 && (
        <div
          className="flex items-start gap-2.5 rounded-xl border p-3.5 text-[13px]"
          style={{ borderColor: "#f0b429", background: "#fffaf0", color: "#7a4d00" }}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">No active chapters in {zone}</p>
            <p className="mt-0.5 leading-relaxed">
              There is nothing to choose from. Check the chapter directory before
              continuing.
            </p>
          </div>
        </div>
      )}

      {/* ── The roster, by chapter ─────────────────────────────── */}
      <SectionShell>
        <div className="p-4">
          <SectionHeading
            eyebrow={`${participants.length} student${participants.length === 1 ? "" : "s"} on this round`}
            title="Students by chapter"
            icon={Users}
          />
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: inkA(0.7) }}>
            Everyone starts under{" "}
            <span className="font-semibold">Not assigned yet</span>. Pick a
            chapter on a student and they move under it straight away.
          </p>

          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
              style={{ color: inkA(0.4) }}
            />
            <input
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Find a student by name"
              className="w-full rounded-md border py-2 pl-9 pr-3 text-sm"
              style={{ borderColor: inkA(0.15), color: INK }}
            />
          </div>
          {nameQuery.trim() !== "" && (
            <p className="mt-1.5 text-[12px]" style={{ color: inkA(0.55) }}>
              {matchCount} match{matchCount === 1 ? "" : "es"}
            </p>
          )}

          {participants.length === 0 ? (
            <p className="py-6 text-center text-[13px]" style={{ color: inkA(0.5) }}>
              No students have been imported to this round yet.
            </p>
          ) : matchCount === 0 ? (
            <p className="py-6 text-center text-[13px]" style={{ color: inkA(0.5) }}>
              No student matches &ldquo;{nameQuery.trim()}&rdquo;.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.chapterId ?? "unassigned"} className="mt-4">
                <div
                  className="flex items-baseline justify-between gap-3 border-b pb-1.5"
                  style={{ borderColor: inkA(0.1) }}
                >
                  <p
                    className="text-[14px] font-semibold"
                    style={{ ...SERIF, color: g.chapterId ? INK : SAFFRON }}
                  >
                    {g.label}
                  </p>
                  <span
                    className="shrink-0 text-[12px] tabular-nums"
                    style={{ color: inkA(0.55) }}
                  >
                    {g.people.length} student{g.people.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {/* The student sits in this group precisely because their
                      chapter — override included — is g.chapterId, so that is
                      also what the dropdown shows. */}
                  {g.people.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border p-3"
                      style={{
                        borderColor: g.chapterId ? `${GREEN}33` : inkA(0.1),
                        background: g.chapterId ? `${GREEN}08` : "#ffffff",
                      }}
                    >
                      <p
                        className="text-[13px] font-semibold leading-snug"
                        style={{ color: INK }}
                      >
                        {p.fullName}
                      </p>
                      {/* School is a recognition aid only — blank on most
                          rounds, and never what anything is counted by. */}
                      <p className="mt-0.5 text-[12px]" style={{ color: inkA(0.5) }}>
                        {p.schoolName || "No school on the roster"}
                      </p>
                      <div className="mt-2">
                        <ChapterSelect
                          chapters={chapters}
                          value={g.chapterId}
                          disabled={!canWrite || isPending}
                          ariaLabel={`Chapter for ${p.fullName}`}
                          onChange={(chapterId) => assignPerson(p.id, chapterId)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </SectionShell>

      {/* ── School shortcuts ───────────────────────────────────────
          Only when the roster actually carries schools. On a round imported
          without them these would be two empty boxes promising a faster path
          that cannot reach a single student. */}
      {schools.length > 0 && (
        <>
          <SectionShell>
            <div className="p-4">
              <SectionHeading
                eyebrow="Shortcut"
                title="Paste a school-to-chapter list"
                icon={ClipboardPaste}
              />
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: inkA(0.7) }}>
                One line per school, as{" "}
                <code className="rounded px-1" style={{ background: inkA(0.06) }}>
                  school name,chapter
                </code>
                . Chapter names are matched however you type them. Anything that
                doesn&apos;t match is listed back to you — nothing is dropped quietly.
              </p>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                disabled={!canWrite || isPending}
                rows={5}
                spellCheck={false}
                placeholder={`Government Higher Secondary School, Erode\nSt Joseph's Matriculation, Salem`}
                className="mt-3 w-full rounded-md border px-3 py-2 font-mono text-[12px] leading-relaxed disabled:opacity-50"
                style={{ borderColor: inkA(0.15), color: INK }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={applyPaste}
                  disabled={!canWrite || isPending || !paste.trim()}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: INK }}
                >
                  {isPending ? "Applying…" : "Apply list"}
                </button>
                {report && (
                  <button
                    type="button"
                    onClick={() => setReport(null)}
                    className="rounded-lg px-3 py-2 text-sm font-medium"
                    style={{ color: inkA(0.6) }}
                  >
                    Clear result
                  </button>
                )}
              </div>

              {report && (
                <div
                  className="mt-3 rounded-lg border p-3 text-[13px]"
                  style={{ borderColor: inkA(0.12), background: inkA(0.03) }}
                >
                  <p className="font-semibold" style={{ color: INK }}>
                    {report.matchedParticipants} student
                    {report.matchedParticipants === 1 ? "" : "s"} filed across{" "}
                    {report.appliedRows} school
                    {report.appliedRows === 1 ? "" : "s"}
                  </p>
                  {report.unresolved.length === 0 ? (
                    <p className="mt-1" style={{ color: GREEN }}>
                      Every line applied.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 font-semibold" style={{ color: "#b42318" }}>
                        {report.unresolved.length} line
                        {report.unresolved.length === 1 ? "" : "s"} did not apply
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {report.unresolved.map((u, i) => (
                          <li
                            key={`${u.schoolName}-${u.chapterName}-${i}`}
                            className="leading-snug"
                            style={{ color: inkA(0.75) }}
                          >
                            <span className="font-medium">
                              {u.schoolName || "(blank school)"} →{" "}
                              {u.chapterName || "(blank chapter)"}
                            </span>
                            <span style={{ color: inkA(0.55) }}>
                              {" "}
                              — {REASON_LABEL[u.reason]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </SectionShell>

          {/* ── Per school ─────────────────────────────────────────── */}
          <SectionShell>
            <div className="p-4">
              <SectionHeading
                eyebrow={`Shortcut · ${schools.length} school${schools.length === 1 ? "" : "s"} on this roster`}
                title="Assign a whole school at once"
                icon={Building2}
              />
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: inkA(0.7) }}>
                One choice covers everyone from that school. Each student still shows
                up under their chapter in the list above.
              </p>

              <div className="relative mt-3">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                  style={{ color: inkA(0.4) }}
                />
                <input
                  value={schoolQuery}
                  onChange={(e) => setSchoolQuery(e.target.value)}
                  placeholder="Find a school"
                  className="w-full rounded-md border py-2 pl-9 pr-3 text-sm"
                  style={{ borderColor: inkA(0.15), color: INK }}
                />
              </div>

              <div className="mt-3 space-y-2">
                {visibleSchools.length === 0 && (
                  <p className="py-6 text-center text-[13px]" style={{ color: inkA(0.5) }}>
                    No school matches &ldquo;{schoolQuery}&rdquo;.
                  </p>
                )}
                {visibleSchools.map((s) => {
                  const value =
                    s.schoolName in schoolOverride
                      ? schoolOverride[s.schoolName]
                      : s.chapterId;
                  return (
                    <div
                      key={s.schoolName}
                      className="rounded-lg border p-3"
                      style={{
                        borderColor: value ? `${GREEN}33` : inkA(0.1),
                        background: value ? `${GREEN}08` : "#ffffff",
                      }}
                    >
                      <p
                        className="text-[13px] font-semibold leading-snug"
                        style={{ color: INK }}
                      >
                        {s.schoolName}
                      </p>
                      <p className="mt-0.5 text-[12px]" style={{ color: inkA(0.55) }}>
                        {s.participantCount} student
                        {s.participantCount === 1 ? "" : "s"}
                        {s.mixed && !(s.schoolName in schoolOverride) && (
                          <span style={{ color: SAFFRON }}>
                            {" · currently split across chapters — choosing here sets all of them"}
                          </span>
                        )}
                      </p>
                      <div className="mt-2">
                        <ChapterSelect
                          chapters={chapters}
                          value={value}
                          disabled={!canWrite || isPending}
                          ariaLabel={`Chapter for ${s.schoolName}`}
                          onChange={(chapterId) => assignSchool(s.schoolName, chapterId)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </SectionShell>
        </>
      )}
    </div>
  );
}
