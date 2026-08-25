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

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  Eraser,
  Eye,
  FileText,
  Info,
  Loader2,
  Paperclip,
  RefreshCw,
  Scale,
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
  clearQuestionnaireMarksForPost,
  exportQuestionnaireCsv,
  exportQuestionnaireResponsesCsv,
  getQuestionnaireAttemptDetail,
  getQuestionnaireFileUrl,
  getQuestionnaireMarkingProgress,
  getQuestionnaireOverview,
  getQuestionnaireQuestionReview,
  getQuestionnaireResults,
  listQuestionnaireQuestions,
  requestQuestionnaireQuestionReview,
  rescoreQuestionnaireAttempt,
  saveQuestionnaireQuestions,
  setQuestionnaireWindow,
  type PostOverview,
} from "@/app/yip/actions/questionnaire";
import {
  buildQuestionnaireWatchList,
  describeMinutes,
  formatFileSize,
  formatQuestionnaireTime,
  markingStallWarnings,
  questionnairePostLabel,
  shortlistCutoff,
  type QuestionnaireMarkingProgress,
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
  initialProgress,
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
  initialProgress: QuestionnaireMarkingProgress | null;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [rows, setRows] = useState(initialRows);
  const [unscored, setUnscored] = useState(initialUnscored);
  const [missing, setMissing] = useState(initialMissing);
  const [error, setError] = useState<string | null>(initialError);
  const [progress, setProgress] = useState(initialProgress);
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<{ postKey: string; open: boolean } | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editLocked, setEditLocked] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [review, setReview] = useState<QuestionReview>(initialReview);

  const refresh = useCallback(async () => {
    const [o, r, qr, mp] = await Promise.all([
      callAction(() => getQuestionnaireOverview(eventId)),
      callAction(() => getQuestionnaireResults(eventId)),
      callAction(() => getQuestionnaireQuestionReview(eventId)),
      callAction(() => getQuestionnaireMarkingProgress(eventId)),
    ]);
    if (o.success) setPosts(o.data.posts);
    if (qr.success) setReview(qr.data);
    if (mp.success) setProgress(mp.data);
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
   * Keep the marking count live.
   *
   * Marking happens outside this app, so nothing pushes a change back here —
   * without a poll the count freezes at whatever it was when the page loaded,
   * and a queue that has died looks identical to a queue that is working. Thirty
   * seconds against three columns is cheap enough to leave running all day.
   *
   * Only the progress figures are polled, not the whole page: re-reading every
   * answer on a timer would fight the organiser's scroll position and their open
   * dialogs. A failed poll is left alone rather than blanking the last known
   * numbers — the stall banner is built from the newest reading that ARRIVED,
   * and a flapping connection is not a stalled marker.
   */
  useEffect(() => {
    let live = true;
    const id = setInterval(async () => {
      const mp = await callAction(() => getQuestionnaireMarkingProgress(eventId));
      if (live && mp.success) setProgress(mp.data);
    }, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [eventId]);

  function applyClearMarks() {
    if (!clearing) return;
    const postKey = clearing;
    setClearing(null);
    startTransition(async () => {
      const res = await callAction(() => clearQuestionnaireMarksForPost(eventId, postKey));
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Cleared the marks on ${res.data.attempts} ${questionnairePostLabel(
          postKey
        )} paper${res.data.attempts === 1 ? "" : "s"} (${res.data.answers} answer${
          res.data.answers === 1 ? "" : "s"
        }). They are back in the queue to be marked again. No answers were changed.`
      );
      await refresh();
    });
  }

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
      return;
    }
    setExpanded(attemptId);
    setDetail(null);
    startTransition(async () => {
      const res = await callAction(() =>
        getQuestionnaireAttemptDetail(eventId, attemptId)
      );
      setDetail(res);
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

  const stallWarnings = progress ? markingStallWarnings(progress) : [];
  const watch = buildQuestionnaireWatchList(rows);
  const worthALook = watch.flaggedHigh.length + watch.cutTies.length;

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

      {/*
        ── How far the marking has got ──

        Marking runs outside this app, so nothing pushes a change back to this
        screen; the numbers below are re-read every 30 seconds. NO estimate of
        when it will finish is shown, on purpose — the papers queue behind work
        this app cannot see, so any time printed here would be a guess an
        organiser would then plan the room around.
      */}
      {progress && progress.submitted > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: SAFFRON }}
                >
                  Marking
                </p>
                <p className="text-lg font-semibold" style={{ color: INK }}>
                  {progress.scored} of {progress.submitted} marked
                </p>
              </div>
              <p className="text-xs text-[#1a1a3e]/55">
                {progress.stalledMinutes == null
                  ? "Nothing has moved yet."
                  : progress.stalledMinutes < 1
                    ? "Last moved just now."
                    : `Last moved ${describeMinutes(progress.stalledMinutes)} ago.`}{" "}
                Checked every 30 seconds.
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span
                className="rounded-full px-2.5 py-1 font-medium"
                style={{ background: `${GREEN}1a`, color: GREEN }}
              >
                {progress.scored} marked
              </span>
              <span
                className="rounded-full px-2.5 py-1 font-medium"
                style={{ background: "#1a1a3e0d", color: "#1a1a3e99" }}
              >
                {progress.pending} waiting
              </span>
              <span
                className="rounded-full px-2.5 py-1 font-medium"
                style={
                  progress.stuckScoring > 0
                    ? { background: "#fef3c7", color: "#92400e" }
                    : { background: "#1a1a3e0d", color: "#1a1a3e99" }
                }
              >
                {progress.scoring} being marked
                {progress.stuckScoring > 0 && ` · ${progress.stuckScoring} stuck`}
              </span>
              {progress.failed > 0 && (
                <span
                  className="rounded-full px-2.5 py-1 font-medium"
                  style={{ background: "#fef2f2", color: "#b91c1c" }}
                >
                  {progress.failed} failed
                </span>
              )}
            </div>

            {stallWarnings.map((w) => (
              <div
                key={w}
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
                style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <button
                    type="button"
                    onClick={() => openEditor(p.postKey)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: SAFFRON }}
                  >
                    <FileText className="size-3" />
                    {p.locked ? "View questions" : "Edit questions"}
                  </button>
                  {/*
                    Only offered once something has been handed in — on a post
                    with no papers there is nothing to clear, and the button
                    would only ever produce a refusal.
                  */}
                  {p.submitted > 0 && (
                    <button
                      type="button"
                      onClick={() => setClearing(p.postKey)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-xs font-medium"
                      style={{ color: "#b45309" }}
                      title="Throw away the marks on this post's papers and put them back in the queue. Student answers are not touched."
                    >
                      <Eraser className="size-3" />
                      Clear marks and mark again
                    </button>
                  )}
                </div>
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

      {/*
        ── Worth a look ──

        NOT a confirm gate over the whole shortlist. A gate that fires on every
        candidate teaches you to click through it, and it fires hardest at the
        moment you most need to be reading. This names only the two cases the
        ranked list, read straight down, hides:

          · someone the ranking wants to shortlist whose paper carries red flags
          · people level on points across the cut, where only the ordering of
            two equal numbers decides who is in

        It blocks nothing and changes no ranking.
      */}
      {worthALook > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Eye className="mt-0.5 size-4 shrink-0" style={{ color: SAFFRON }} />
              <div>
                <p className="font-semibold" style={{ color: INK }}>
                  Worth a look before you confirm the shortlist
                </p>
                <p className="mt-1 text-xs text-[#1a1a3e]/60">
                  Two things the ranking above does not show on its face. Nothing here
                  changes a score or a place — it is only pointing.
                </p>
              </div>
            </div>

            {watch.flaggedHigh.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold" style={{ color: "#b45309" }}>
                  In the suggested shortlist, but the paper was flagged
                </p>
                <p className="mt-0.5 text-[11px] text-[#1a1a3e]/55">
                  The marker raised something on these answers — read the paper before
                  you count the score.
                </p>
                <ul className="mt-2 space-y-1.5">
                  {watch.flaggedHigh.map((f) => (
                    <li
                      key={f.attemptId}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                    >
                      <span className="font-mono text-xs text-[#1a1a3e]/45">#{f.rank}</span>
                      <ParticipantNameButton
                        eventId={eventId}
                        eventName={eventName}
                        participantId={f.participantId}
                        name={f.fullName}
                        className="text-left underline-offset-4 hover:underline"
                      />
                      <span className="text-xs text-[#1a1a3e]/60">
                        {questionnairePostLabel(f.postKey)}
                      </span>
                      {f.pct != null && (
                        <span className="text-xs font-semibold text-[#1a1a3e]/75">
                          {f.pct}%
                        </span>
                      )}
                      <span
                        className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                        style={{ background: "#fef3c7", color: "#92400e" }}
                      >
                        {f.redFlagCount} flag{f.redFlagCount === 1 ? "" : "s"}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleRow(f.attemptId)}
                        className="text-xs font-medium"
                        style={{ color: SAFFRON }}
                      >
                        Open answers
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {watch.cutTies.map((t) => (
              <div key={t.postKey} className="mt-4">
                <p
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: INK }}
                >
                  <Scale className="size-3.5" />
                  Level on points at the {questionnairePostLabel(t.postKey)} cut
                </p>
                <p className="mt-0.5 text-[11px] text-[#1a1a3e]/55">
                  These {t.candidates.length} all scored {t.pct}%, and the suggested
                  shortlist is the top {t.cutoff}. Nothing in the marks separates them —
                  only where they happened to land in the list.
                </p>
                <ul className="mt-2 space-y-1.5">
                  {t.candidates.map((c) => (
                    <li
                      key={c.attemptId}
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                    >
                      <span className="font-mono text-xs text-[#1a1a3e]/45">#{c.rank}</span>
                      <ParticipantNameButton
                        eventId={eventId}
                        eventName={eventName}
                        participantId={c.participantId}
                        name={c.fullName}
                        className="text-left underline-offset-4 hover:underline"
                      />
                      {c.constituencyNumber != null && (
                        <span className="font-mono text-xs text-[#1a1a3e]/45">
                          #{c.constituencyNumber}
                        </span>
                      )}
                      <span
                        className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                        style={
                          c.insideCut
                            ? { background: `${GREEN}1a`, color: GREEN }
                            : { background: "#1a1a3e0d", color: "#1a1a3e99" }
                        }
                      >
                        {c.insideCut ? "Inside the cut" : "Below the cut"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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

      {/*
        ── Confirm clearing a post's marks ──

        The confirm text says what goes and what stays, in those words. "Are you
        sure?" is not enough here: the thing an organiser is actually afraid of
        is losing what the students wrote, and that is exactly the thing this
        does not touch.
      */}
      <Dialog open={clearing !== null} onOpenChange={(o) => !o && setClearing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Clear the marks on {clearing ? questionnairePostLabel(clearing) : ""} papers?
            </DialogTitle>
            <DialogDescription>
              Every {clearing ? questionnairePostLabel(clearing) : ""} paper that has been
              handed in goes back into the queue and gets marked again from scratch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div
              className="rounded-lg border px-3 py-2"
              style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}
            >
              <b>This clears:</b> the scores and percentages, the per-answer marks and
              flags, and the AI note on each paper. The old marks are gone for good.
            </div>
            <div
              className="rounded-lg border px-3 py-2"
              style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}
            >
              <b>This does not touch:</b> anything the students wrote, or the time they
              handed it in. Every answer stays exactly as it is.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearing(null)}>
              Cancel
            </Button>
            <Button
              onClick={applyClearMarks}
              disabled={isPending}
              style={{ background: "#b45309", color: "#fff" }}
            >
              Clear marks and mark again
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
