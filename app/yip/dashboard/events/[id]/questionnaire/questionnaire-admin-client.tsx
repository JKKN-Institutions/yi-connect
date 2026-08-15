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
  RefreshCw,
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
  getQuestionnaireAttemptDetail,
  getQuestionnaireOverview,
  getQuestionnaireResults,
  listQuestionnaireQuestions,
  rescoreQuestionnaireAttempt,
  saveQuestionnaireQuestions,
  setQuestionnaireWindow,
  type PostOverview,
} from "@/app/yip/actions/questionnaire";
import {
  formatQuestionnaireTime,
  questionnairePostLabel,
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

  const refresh = useCallback(async () => {
    const [o, r] = await Promise.all([
      callAction(() => getQuestionnaireOverview(eventId)),
      callAction(() => getQuestionnaireResults(eventId)),
    ]);
    if (o.success) setPosts(o.data.posts);
    if (r.success) {
      setRows(r.data.rows);
      setUnscored(r.data.unscored);
      setMissing(r.data.missing);
    }
  }, [eventId]);

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
            Each post opens on its own window. Every candidate gets {minutes} minutes
            once they start.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => startTransition(refresh)} disabled={isPending}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          {canManage && (
            <Button onClick={doExport} disabled={isPending || rows.length === 0}>
              <Download className="size-4" /> Export CSV
            </Button>
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
                      {detail.data.answers.map((a) => (
                        <div key={a.position}>
                          <p className="text-xs font-semibold" style={{ color: INK }}>
                            {a.position}. {a.question}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[#1a1a3e]/80">
                            {a.answer || <em className="text-[#1a1a3e]/40">No answer</em>}
                          </p>
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
              These students put their name down but have no answers on record, so they
              are not in the ranking above.
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
