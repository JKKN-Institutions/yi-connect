"use client";

/**
 * Organiser view of the selection questionnaire.
 *
 * Three things live here: the per-post window switches, the question set for
 * each post, and the ranked answers.
 *
 * THE RANKING ONLY ADVISES. A human confirms the shortlist (Director,
 * 2026-08-15), so this screen marks a suggested cut and does nothing else — it
 * promotes nobody, assigns no role and drops nobody.
 */

import { useCallback, useState, useTransition } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileText,
  Info,
  Loader2,
  Paperclip,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/yip/ui/dialog";
import { ParticipantNameButton } from "@/components/yip/participant-profile-dialog";
import {
  exportQuestionnaireCsv,
  exportQuestionnaireResponsesCsv,
  getQuestionnaireAttemptDetail,
  getQuestionnaireFileUrl,
  getQuestionnaireOverview,
  getQuestionnaireQuestionReview,
  getQuestionnaireResults,
  listQuestionnaireQuestions,
  requestQuestionnaireQuestionReview,
  rescoreQuestionnaireAttempt,
  saveManualQuestionnaireMarks,
  saveQuestionnaireQuestions,
  setQuestionnaireWindow,
  type PostOverview,
} from "@/app/yip/actions/questionnaire";
import {
  formatFileSize,
  formatQuestionnaireTime,
  questionnairePostLabel,
  RUBRIC_CRITERIA,
  shortlistCutoff,
  type QuestionnaireMissingRow,
  type QuestionnaireResultRow,
} from "@/lib/yip/questionnaire";

const INK = "#1a1a3e";
const SAFFRON = "#C2691A";
const GREEN = "#138808";

async function callAction<T>(
  fn: () => Promise<{ success: true; data: T } | { success: false; error: string }>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    return await fn();
  } catch {
    return { success: false, error: "Could not reach the server. Refresh and try again." };
  }
}

type Detail = Awaited<ReturnType<typeof getQuestionnaireAttemptDetail>>;

/** One question's hand-typed marks, before they are sent to the server. */
type ManualMark = { grounding: number; depth: number; voice: number };

/** The AI's read of the QUESTION BANK (never of anybody's answers). */
type QuestionReview = {
  status: string | null;
  text: string | null;
  generatedAt: string | null;
  modelNote: string | null;
};

export function QuestionnaireAdminClient({
  eventId,
  eventName,
  canManage,
  initialPosts,
  minutes,
  initialRows,
  initialUnscored,
  initialMissing,
  initialError,
  initialReview,
}: {
  eventId: string;
  eventName: string;
  canManage: boolean;
  initialPosts: PostOverview[];
  minutes: number;
  initialRows: QuestionnaireResultRow[];
  initialUnscored: number;
  initialMissing: QuestionnaireMissingRow[];
  initialError: string | null;
  initialReview: QuestionReview;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [rows, setRows] = useState(initialRows);
  const [unscored, setUnscored] = useState(initialUnscored);
  const [missing, setMissing] = useState(initialMissing);
  const [error, setError] = useState<string | null>(initialError);
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<{ postKey: string; open: boolean } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editLocked, setEditLocked] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [review, setReview] = useState<QuestionReview>(initialReview);
  /**
   * Hand-typed marks for a paper the scorer cannot read, keyed by question
   * position. Cleared every time a row opens or closes, so numbers typed
   * against one candidate can never be saved onto the next one.
   */
  const [marks, setMarks] = useState<Record<number, Partial<ManualMark>>>({});
  const [savingMarks, setSavingMarks] = useState(false);

  const refresh = useCallback(async () => {
    const [o, r, qr] = await Promise.all([
      callAction(() => getQuestionnaireOverview(eventId)),
      callAction(() => getQuestionnaireResults(eventId)),
      callAction(() => getQuestionnaireQuestionReview(eventId)),
    ]);
    if (o.success) setPosts(o.data.posts);
    if (qr.success) setReview(qr.data);
    if (r.success) {
      setRows(r.data.rows);
      setUnscored(r.data.unscored);
      setMissing(r.data.missing);
    }
    // A clean reload means whatever the banner was complaining about is no
    // longer true — but only say so if BOTH reads actually came back, or a
    // failed refresh would silently wipe a real error off the screen.
    if (o.success && r.success) setError(null);
  }, [eventId]);

  /**
   * Open one handed-in file.
   *
   * The bucket is PRIVATE — there is no URL to link to until the server mints
   * a signed one, and it lasts five minutes. The blank tab is opened on the
   * CLICK, before the await, or Safari treats the later window.open as a popup
   * and swallows it.
   */
  function openHandedInFile(attemptId: string, path: string) {
    const tab = window.open("", "_blank", "noopener,noreferrer");
    void (async () => {
      const res = await callAction(() => getQuestionnaireFileUrl(eventId, attemptId, path));
      if (!res.success) {
        tab?.close();
        toast.error(res.error);
        return;
      }
      if (tab) tab.location.href = res.data.url;
      else window.location.href = res.data.url;
    })();
  }

  function applyToggle() {
    if (!confirm) return;
    const { postKey, open } = confirm;
    setConfirm(null);
    startTransition(async () => {
      const res = await callAction(() => setQuestionnaireWindow(eventId, postKey, open));
      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      // Clear any earlier refusal. Without this the banner from a blocked
      // attempt ("Speaker is still running") stays on screen after you close
      // Speaker and it succeeds — the page then contradicts itself, telling an
      // organiser a post is running while showing it as closed.
      setError(null);
      toast.success(
        open
          ? `${questionnairePostLabel(postKey)} questions are open.`
          : `${questionnairePostLabel(postKey)} questions are closed to new starts.`
      );
      await refresh();
    });
  }

  function openEditor(postKey: string) {
    startTransition(async () => {
      const res = await callAction(() => listQuestionnaireQuestions(eventId, postKey));
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setEditing(postKey);
      setEditLocked(res.data.locked);
      setEditText(res.data.questions.map((q) => q.body).join("\n\n"));
    });
  }

  function saveEditor() {
    if (!editing) return;
    const bodies = editText
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    startTransition(async () => {
      const res = await callAction(() =>
        saveQuestionnaireQuestions(eventId, editing, bodies)
      );
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.count === 0
          ? "Reverted to the national question set."
          : `Saved ${res.data.count} questions for this event.`
      );
      setEditing(null);
      await refresh();
    });
  }

  /**
   * Ask the routine to read the question bank. The app never calls a model —
   * this queues the work and pings; the text arrives on a later refresh.
   */
  function askForQuestionReview() {
    startTransition(async () => {
      const res = await callAction(() => requestQuestionnaireQuestionReview(eventId));
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setReview((r) => ({ ...r, status: "requested", text: null }));
      toast.success(
        res.data.pinged
          ? "Asked for a read of the questions — it usually lands in a minute or two. Hit Refresh."
          : "Queued. It will be written on the next scheduled run."
      );
    });
  }

  function toggleRow(attemptId: string) {
    if (expanded === attemptId) {
      setExpanded(null);
      setDetail(null);
      setMarks({});
      return;
    }
    setExpanded(attemptId);
    setDetail(null);
    setMarks({});
    startTransition(async () => {
      const res = await callAction(() =>
        getQuestionnaireAttemptDetail(eventId, attemptId)
      );
      setDetail(res);
    });
  }

  /**
   * Type one criterion's mark for one question.
   *
   * Clamped to the rubric's own range as it is typed, so the box never shows a
   * number the server would quietly reduce — an organiser who types 9 into a
   * field worth 3 should see it become 3 immediately, not discover it later in
   * a total that does not add up. An emptied box returns to unset rather than
   * to zero, because "not judged yet" and "judged worth nothing" must stay
   * different right up until Save.
   */
  function setMark(position: number, key: keyof ManualMark, raw: string, max: number) {
    setMarks((prev) => {
      const next = { ...(prev[position] ?? {}) };
      if (raw.trim() === "") {
        delete next[key];
      } else {
        const n = Math.round(Number(raw));
        if (!Number.isFinite(n)) return prev;
        next[key] = Math.min(max, Math.max(0, n));
      }
      return { ...prev, [position]: next };
    });
  }

  /**
   * Save a person's marks for a paper handed in as a file.
   *
   * Every question must carry a mark before this will send. A blank left as an
   * implicit zero is the failure this screen exists to prevent — an unread
   * question and a question judged worth nothing look identical once stored,
   * and the candidate cannot tell them apart either.
   */
  function saveMarks(attemptId: string, positions: number[]) {
    const filled = positions.map((p) => ({ position: p, mark: marks[p] }));
    const incomplete = filled.filter(
      ({ mark }) =>
        typeof mark?.grounding !== "number" ||
        typeof mark?.depth !== "number" ||
        typeof mark?.voice !== "number"
    );
    if (incomplete.length > 0) {
      toast.error(
        incomplete.length === positions.length
          ? "Give every question all three marks before saving."
          : `${incomplete.length} question${incomplete.length === 1 ? " is" : "s are"} still missing a mark.`
      );
      return;
    }
    setSavingMarks(true);
    startTransition(async () => {
      const res = await callAction(() =>
        saveManualQuestionnaireMarks(
          eventId,
          attemptId,
          filled.map(({ position, mark }) => ({
            position,
            grounding: mark!.grounding as number,
            depth: mark!.depth as number,
            voice: mark!.voice as number,
          }))
        )
      );
      setSavingMarks(false);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Marked — ${res.data.total} of ${res.data.max} (${res.data.pct}%).`);
      setMarks({});
      // Re-read the paper AND the table: the row must stop saying "read this
      // one yourself" and start showing the mark, or the organiser cannot tell
      // the save worked.
      const fresh = await callAction(() =>
        getQuestionnaireAttemptDetail(eventId, attemptId)
      );
      setDetail(fresh);
      await refresh();
    });
  }

  function doExport() {
    startTransition(async () => {
      const res = await callAction(() => exportQuestionnaireCsv(eventId));
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      // Never let un-scored rows slip into a ranking unnoticed.
      if (res.data.unscored > 0) {
        toast.warning(
          `${res.data.unscored} submission${res.data.unscored === 1 ? " is" : "s are"} not scored yet — they carry no rank in this file.`
        );
      } else {
        toast.success(`Downloaded ${rows.length} submissions.`);
      }
    });
  }

  /**
   * Download every answer, question by question — the file you can read
   * yourself or hand to another model. The other export carries no writing at
   * all, only ranks and percentages.
   *
   * This file has students' names next to their written work, so it is worth a
   * beat of friction: the toast says how many students are in it.
   */
  function doExportResponses() {
    startTransition(async () => {
      const res = await callAction(() => exportQuestionnaireResponsesCsv(eventId));
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Downloaded ${res.data.answers} answers from ${res.data.students} papers, with student names.`
      );
    });
  }

  // Scored counts per post drive the shortlist marker.
  const scoredByPost = new Map<string, number>();
  for (const r of rows) {
    if (r.scoringStatus === "scored") {
      scoredByPost.set(r.postKey, (scoredByPost.get(r.postKey) ?? 0) + 1);
    }
  }
  const rankSeen = new Map<string, number>();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: SAFFRON }}
          >
            Before the Event
          </p>
          <h2 className="text-xl font-semibold" style={{ color: INK }}>
            Selection Questionnaire
          </h2>
          <p className="mt-1 text-sm text-[#1a1a3e]/60">
            One post at a time. The {minutes} minutes start when you open it and run for
            the whole group at once, so open it with the room already seated.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => startTransition(refresh)} disabled={isPending}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          {canManage && (
            <>
              <Button
                variant="outline"
                onClick={doExportResponses}
                disabled={isPending || rows.length === 0}
                title="Every question and answer, for reading yourself or handing to another tool. Includes student names."
              >
                <Download className="size-4" /> Export answers
              </Button>
              <Button onClick={doExport} disabled={isPending || rows.length === 0}>
                <Download className="size-4" /> Export scores
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }}
        >
          {error}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.02] px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0" style={{ color: SAFFRON }} />
        <p className="text-sm text-[#1a1a3e]/70">
          The ranking below is a <b>suggestion to read, not a decision</b>. Nobody is
          promoted, assigned or dropped by it — you confirm the shortlist yourself.
          Students never see their score.
        </p>
      </div>

      {/* ── Per-post windows ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        {posts.map((p) => (
          <Card key={p.postKey}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold" style={{ color: INK }}>
                    {p.label}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: p.status === "open" ? GREEN : "#1a1a3e40" }}
                    />
                    <span className="text-xs text-[#1a1a3e]/60">
                      {p.status === "open" ? "Open" : "Closed"}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    onClick={() => setConfirm({ postKey: p.postKey, open: p.status !== "open" })}
                    disabled={isPending}
                    style={{ background: p.status === "open" ? INK : GREEN, color: "#fff" }}
                  >
                    {p.status === "open" ? "End" : "Start"}
                  </Button>
                )}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[#1a1a3e]/70">
                <dt>Nominated</dt>
                <dd className="text-right font-medium">{p.nominated}</dd>
                <dt>Started</dt>
                <dd className="text-right font-medium">{p.started}</dd>
                <dt>Submitted</dt>
                <dd className="text-right font-medium">{p.submitted}</dd>
                <dt>Scored</dt>
                <dd className="text-right font-medium">{p.scored}</dd>
              </dl>

              <div className="mt-3 border-t border-[#1a1a3e]/10 pt-2 text-xs text-[#1a1a3e]/60">
                Asks <b>{p.drawSize}</b> of {p.questionCount}{" "}
                {p.questionSource === "chapter" ? "of your own" : "national"} questions
                {p.locked && " · locked"}
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => openEditor(p.postKey)}
                  disabled={isPending}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: SAFFRON }}
                >
                  <FileText className="size-3" />
                  {p.locked ? "View questions" : "Edit questions"}
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── AI read of the QUESTIONS (not of anybody's answers) ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: SAFFRON }}
              >
                A second reader
              </p>
              <p className="font-semibold" style={{ color: INK }}>
                AI read of the questions
              </p>
              <p className="mt-1 max-w-2xl text-sm text-[#1a1a3e]/60">
                Reads the question set itself — wording that could be taken two ways,
                questions that lead to an answer, two that ask the same thing, or one
                nobody could answer in the time. It never sees a student&apos;s answers.
              </p>
            </div>
            {canManage && (
              <Button variant="outline" onClick={askForQuestionReview} disabled={isPending}>
                <Sparkles className="size-4" />
                {review.text ? "Read them again" : "Read the questions"}
              </Button>
            )}
          </div>

          {review.text ? (
            <div className="mt-3 rounded-xl border border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.02] px-4 py-3">
              <p className="whitespace-pre-wrap text-sm text-[#1a1a3e]/85">{review.text}</p>
              <p className="mt-2 text-[11px] text-[#1a1a3e]/50">
                Advisory. Changing a question is your call — and a post whose first
                paper is already in stays locked, so those notes are for the next round.
              </p>
            </div>
          ) : review.status === "requested" || review.status === "generating" ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[#1a1a3e]/60">
              <Loader2 className="size-4 animate-spin" />
              Being written now — press Refresh in a minute or two.
            </p>
          ) : (
            <p className="mt-3 text-sm text-[#1a1a3e]/50">
              Nothing read yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Results ── */}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-[#1a1a3e]/55">
              No submissions yet. Answers appear here as students finish.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#1a1a3e]/10 text-left text-xs text-[#1a1a3e]/55">
                  <tr>
                    <th className="px-4 py-2 font-semibold">#</th>
                    <th className="px-4 py-2 font-semibold">Student</th>
                    <th className="px-4 py-2 font-semibold">Post</th>
                    <th className="px-4 py-2 font-semibold">Submitted</th>
                    <th className="px-4 py-2 text-right font-semibold">Score</th>
                    <th className="px-4 py-2 text-right font-semibold">Flags</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    let rank: number | null = null;
                    let shortlisted = false;
                    if (r.scoringStatus === "scored") {
                      const n = (rankSeen.get(r.postKey) ?? 0) + 1;
                      rankSeen.set(r.postKey, n);
                      rank = n;
                      shortlisted = n <= shortlistCutoff(scoredByPost.get(r.postKey) ?? 0);
                    }
                    return (
                      <tr key={r.attemptId} className="border-b border-[#1a1a3e]/5 align-top">
                        <td className="px-4 py-2 font-mono text-xs text-[#1a1a3e]/60">
                          {rank ?? "—"}
                          {shortlisted && (
                            <span
                              className="ml-1 rounded px-1 text-[10px] font-semibold"
                              style={{ background: `${GREEN}1a`, color: GREEN }}
                            >
                              ▲
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <ParticipantNameButton
                            eventId={eventId}
                            eventName={eventName}
                            participantId={r.participantId}
                            name={r.fullName}
                            className="text-left underline-offset-4 hover:underline"
                          />
                        </td>
                        <td className="px-4 py-2 text-[#1a1a3e]/80">
                          {questionnairePostLabel(r.postKey)}
                        </td>
                        <td className="px-4 py-2 text-xs text-[#1a1a3e]/60">
                          {formatQuestionnaireTime(r.submittedAt)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {r.scoringStatus === "scored" ? (
                            <span className="font-semibold">{r.pct}%</span>
                          ) : r.scoringStatus === "needs_human" ? (
                            /*
                              Not a failure and not "not scored" — the paper is
                              complete, it was handed in as a file the scorer
                              cannot read, and it is waiting on a person. Said
                              plainly so nobody re-queues it or reads it as a
                              zero.
                            */
                            <span className="text-xs font-semibold text-[#b45309]">
                              read this one yourself
                            </span>
                          ) : (
                            <span className="text-xs text-[#1a1a3e]/50">
                              {r.scoringStatus === "failed" ? "failed" : "not scored"}
                            </span>
                          )}
                          {/*
                            How much of the paper they actually got through. Every
                            candidate for a post is drawn the same number of
                            questions, so the percentage above already ranks them
                            fairly — but a human confirms the shortlist, and
                            "63% on 4 of 6" is a different candidate from "63% on
                            6 of 6". Only shown when they ran short.
                          */}
                          {r.answered < r.drawn && (
                            <span className="mt-0.5 block text-[11px] text-[#1a1a3e]/50">
                              {r.answered} of {r.drawn} answered
                            </span>
                          )}
                          {/*
                            A handed-in file counts as an answer, so a paper
                            here may have almost no typed words in it. Say so
                            on the row — otherwise a low score on a photographed
                            report reads as a candidate who barely wrote
                            anything, and the pages never get opened.
                          */}
                          {r.fileCount > 0 && (
                            <span
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px]"
                              style={{ color: SAFFRON }}
                            >
                              <Paperclip className="size-3" />
                              {r.fileCount} file{r.fileCount === 1 ? "" : "s"} handed in
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-xs">
                          {r.redFlagCount > 0 ? (
                            <span style={{ color: "#b45309" }}>{r.redFlagCount}</span>
                          ) : (
                            <span className="text-[#1a1a3e]/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => toggleRow(r.attemptId)}
                            className="inline-flex items-center gap-1 text-xs font-medium"
                            style={{ color: SAFFRON }}
                          >
                            Answers
                            <ChevronDown
                              className={`size-3 transition-transform ${expanded === r.attemptId ? "rotate-180" : ""}`}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {expanded && (
                <div className="border-t border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.02] px-6 py-4">
                  {!detail ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : !detail.success ? (
                    <p className="text-sm text-[#b91c1c]">{detail.error}</p>
                  ) : (
                    <div className="space-y-4">
                      {detail.data.analysisNote && (
                        <div
                          className="rounded-xl border px-4 py-3"
                          style={{ background: "#fff", borderColor: "#1a1a3e1a" }}
                        >
                          <p
                            className="text-[10px] font-bold uppercase tracking-[0.16em]"
                            style={{ color: SAFFRON }}
                          >
                            What this paper argued · AI read
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[#1a1a3e]/80">
                            {detail.data.analysisNote}
                          </p>
                          <p className="mt-2 text-[11px] text-[#1a1a3e]/50">
                            A second reader, not a verdict. The student never sees this.
                          </p>
                        </div>
                      )}
                      {detail.data.answers.map((a) => (
                        <div key={a.position}>
                          <p className="text-xs font-semibold" style={{ color: INK }}>
                            {a.position}. {a.question}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[#1a1a3e]/80">
                            {a.answer || (
                              <em className="text-[#1a1a3e]/40">
                                {a.files.length > 0
                                  ? "Handed in as a file — nothing typed."
                                  : "No answer"}
                              </em>
                            )}
                          </p>
                          {a.files.length > 0 && (
                            <ul className="mt-1.5 space-y-1">
                              {a.files.map((f) => (
                                <li key={f.path}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openHandedInFile(expanded, f.path)
                                    }
                                    className="inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-xs underline-offset-4 hover:underline"
                                    style={{ borderColor: "#1a1a3e1a", color: SAFFRON }}
                                  >
                                    <Paperclip className="size-3 shrink-0" />
                                    <span className="truncate">{f.name}</span>
                                    <span className="shrink-0 text-[11px] text-[#1a1a3e]/45">
                                      {formatFileSize(f.size)}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className="mt-1 text-[11px] text-[#1a1a3e]/55">
                            {a.score == null
                              ? "Not scored"
                              : `${a.score}/${detail.data.maxPerAnswer} · grounding ${a.grounding} · depth ${a.depth} · voice ${a.voice}${a.penalty ? ` · −${a.penalty}` : ""}`}
                          </p>
                          {/*
                            The marks boxes. Shown ONLY on a paper waiting on a
                            person, and only to someone who can manage the event
                            — a viewer can read the pages but not decide them.
                            The server re-checks both before it writes.
                          */}
                          {canManage && detail.data.scoringStatus === "needs_human" && (
                            <div
                              className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2 rounded-xl border px-3 py-2"
                              style={{ background: "#fff", borderColor: "#1a1a3e1a" }}
                            >
                              {RUBRIC_CRITERIA.map((c) => {
                                const key = c.key as keyof ManualMark;
                                const value = marks[a.position]?.[key];
                                return (
                                  <label key={c.key} className="flex flex-col gap-1">
                                    <span
                                      className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1a1a3e]/55"
                                      title={c.instruction}
                                    >
                                      {c.label}
                                      <span className="ml-1 text-[#1a1a3e]/35">/{c.max}</span>
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={c.max}
                                      step={1}
                                      inputMode="numeric"
                                      disabled={savingMarks}
                                      value={value ?? ""}
                                      onChange={(e) =>
                                        setMark(a.position, key, e.target.value, c.max)
                                      }
                                      aria-label={`${c.label}, question ${a.position}, out of ${c.max}`}
                                      className="w-16 rounded-lg border px-2 py-1 text-sm"
                                      style={{ borderColor: "#1a1a3e26" }}
                                    />
                                  </label>
                                );
                              })}
                              <span className="pb-1 text-[11px] text-[#1a1a3e]/55">
                                {(() => {
                                  const m = marks[a.position];
                                  const done =
                                    typeof m?.grounding === "number" &&
                                    typeof m?.depth === "number" &&
                                    typeof m?.voice === "number";
                                  return done
                                    ? `= ${m!.grounding! + m!.depth! + m!.voice!} of ${detail.data.maxPerAnswer}`
                                    : "not marked yet";
                                })()}
                              </span>
                            </div>
                          )}
                          {a.flags.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {a.flags.map((f) => (
                                <li
                                  key={f}
                                  className="flex items-start gap-1 text-[11px]"
                                  style={{ color: "#b45309" }}
                                >
                                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                      {/*
                        Save the hand-typed marks. Sits under ALL the questions
                        rather than beside each one, because a paper is judged
                        as a whole — marking question 1 and wandering off would
                        leave a part-marked paper in the ranking as though it
                        had been judged.
                      */}
                      {canManage &&
                        expanded &&
                        detail.data.scoringStatus === "needs_human" && (
                          <div
                            className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
                            style={{ background: "#fff", borderColor: "#1a1a3e1a" }}
                          >
                            <Button
                              size="sm"
                              disabled={savingMarks || isPending}
                              onClick={() =>
                                saveMarks(
                                  expanded,
                                  detail.data.answers.map((a) => a.position)
                                )
                              }
                            >
                              {savingMarks ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                "Save these marks"
                              )}
                            </Button>
                            <span className="text-[11px] text-[#1a1a3e]/55">
                              Open the pages above, then give each question its three
                              marks. Saving puts this paper into the ranking with the
                              others — the student never sees the marks.
                            </span>
                          </div>
                        )}
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              const res = await callAction(() =>
                                rescoreQuestionnaireAttempt(eventId, expanded)
                              );
                              if (res.success) {
                                toast.success("Queued for re-scoring.");
                                await refresh();
                              } else toast.error(res.error);
                            })
                          }
                        >
                          Score this again
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {unscored > 0 && (
        <p className="text-xs text-[#1a1a3e]/55">
          {unscored} submission{unscored === 1 ? "" : "s"} not scored yet. Scoring runs
          in the background shortly after a student submits.
        </p>
      )}

      {/*
        Who nominated and has nothing to show for it.

        The ranking can only contain students who wrote something, so without
        this an organiser cannot tell "nobody is missing" from "eight people are
        missing" — and chasing them is only possible before the post is closed.
        A blank paper is called out separately from never opening it: the first
        may mean the student hit a problem, the second usually just means they
        have not been told.
      */}
      {missing.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="font-semibold" style={{ color: INK }}>
              Nominated, nothing answered ({missing.length})
            </p>
            <p className="mt-1 text-xs text-[#1a1a3e]/60">
              These students put their name down but have nothing on record — no typed
              answers and no files handed in — so they are not in the ranking above.
            </p>
            <ul className="mt-3 space-y-1.5">
              {missing.map((m) => (
                <li
                  key={`${m.participantId}:${m.postKey}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                >
                  <ParticipantNameButton
                    eventId={eventId}
                    eventName={eventName}
                    participantId={m.participantId}
                    name={m.fullName}
                    className="text-left underline-offset-4 hover:underline"
                  />
                  {m.constituencyNumber != null && (
                    <span className="font-mono text-xs text-[#1a1a3e]/45">
                      #{m.constituencyNumber}
                    </span>
                  )}
                  <span className="text-xs text-[#1a1a3e]/60">
                    {questionnairePostLabel(m.postKey)}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                    style={
                      m.startedButBlank
                        ? { background: "#fef3c7", color: "#92400e" }
                        : { background: "#1a1a3e0d", color: "#1a1a3e99" }
                    }
                  >
                    {m.startedButBlank ? "Opened it, wrote nothing" : "Never opened it"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Confirm window toggle ── */}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.open ? "Start" : "End"}{" "}
              {confirm ? questionnairePostLabel(confirm.postKey) : ""} questions?
            </DialogTitle>
            <DialogDescription>
              {confirm?.open
                ? `The ${minutes} minutes start now and run for everyone at once — the post ends at the same moment for the whole group. A student who starts late gets the time that is left, not a fresh ${minutes} minutes.`
                : "This only stops new students from starting."}
            </DialogDescription>
          </DialogHeader>
          {confirm && !confirm.open && (
            <div
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}
            >
              Anyone already writing keeps their {minutes} minutes and can still submit.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button onClick={applyToggle} disabled={isPending}>
              {confirm?.open ? "Start" : "End"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Question editor ── */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? questionnairePostLabel(editing) : ""} questions
            </DialogTitle>
            <DialogDescription>
              {editLocked
                ? "These questions are locked."
                : "One question per paragraph — leave a blank line between them. Save an empty box to go back to the national set."}
            </DialogDescription>
          </DialogHeader>
          {editLocked && (
            <div
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}
            >
              Students have already answered for this post, so the questions are locked.
              Everyone must be asked the same questions.
            </div>
          )}
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            readOnly={editLocked}
            rows={16}
            className="w-full rounded-xl border border-[#1a1a3e]/15 p-3 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Close
            </Button>
            {!editLocked && (
              <Button onClick={saveEditor} disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
