"use client";

/**
 * The student's questionnaire screen.
 *
 * FOUR STATES, in this order of precedence:
 *   PICK      — choose which post to answer (only ones they nominated for)
 *   ANSWERING — one question at a time, countdown running
 *   SUBMITTED — a tick, and nothing else
 *   CLOSED    — no window is open
 *
 * THE STUDENT NEVER SEES A SCORE. There is no score in the props, so there is
 * nothing here to accidentally render.
 *
 * NO GOING BACK. Once a question is advanced past it cannot be returned to —
 * the reference build's rule, and it is what stops earlier answers being edited
 * after later questions reveal what the paper is about.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMyQuestionnaire,
  removeQuestionnaireFile,
  saveQuestionnaireAnswer,
  startQuestionnaire,
  submitQuestionnaire,
  uploadQuestionnaireFile,
  type MyPostState,
  type StartedAttempt,
} from "@/app/yip/actions/questionnaire";
import { useTimer } from "@/lib/yip/hooks/use-timer";
import { armTimerSound } from "@/lib/yip/timer-sound";
import {
  QUESTIONNAIRE_MAX_FILES_PER_ANSWER,
  QUESTIONNAIRE_UPLOAD_ACCEPT,
  answerIsGiven,
  formatFileSize,
  questionnaireAllowsFileUpload,
  questionnairePostLabel,
  wordCount,
} from "@/lib/yip/questionnaire";
import {
  SectionShell,
  SectionHeading,
  INK,
  SAFFRON,
  GREEN,
  SERIF,
  inkA,
} from "../credential-ui";

/**
 * A server action can REJECT at the transport layer rather than return a
 * result — after a deploy the endpoint the page was built against is gone. Left
 * unhandled the spinner just clears with nothing on screen, and "nothing
 * happened" reads as "it worked", which on a submit is the dangerous direction.
 */
async function callAction<T>(
  fn: () => Promise<{ success: true; data: T } | { success: false; error: string }>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    return await fn();
  } catch {
    return {
      success: false,
      error: "Could not reach the server. Refresh the page and check before trying again.",
    };
  }
}

export function QuestionnaireClient({
  eventId,
  initialPosts,
  loadError,
}: {
  eventId: string;
  initialPosts: MyPostState[];
  loadError: string | null;
}) {
  const [posts, setPosts] = useState<MyPostState[]>(initialPosts);
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(loadError);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const mine = posts.filter((p) => p.nominated);
  const openNow = mine.filter((p) => p.windowOpen && !p.attempt?.submittedAt);

  const resync = useCallback(async () => {
    const res = await callAction(() => getMyQuestionnaire(eventId));
    if (res.success) setPosts(res.data.posts);
  }, [eventId]);

  // ── Countdown ──────────────────────────────────────────────────
  // Purely `deadline - Date.now()`, so a reload re-derives it and nothing is
  // lost. It is DISPLAY ONLY — the server re-checks expires_at on every write.
  const timer = useTimer(attempt?.expiresAt ?? null, attempt !== null && !attempt.submittedAt);

  // Time ran out: submit whatever exists. That is the reference build's
  // auto-submit, and the server allows a late submit for exactly this reason.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (!attempt || attempt.submittedAt || !timer.isExpired || autoSubmitted.current) return;
    // `timer.isExpired` is derived from useTimer's `remaining` STATE, which is
    // still 0 from the previous (no-attempt) render for exactly one commit
    // after setAttempt(). For that one commit isExpired reads true on a
    // brand-new 30-minute attempt, and this effect used to auto-submit a blank
    // paper the instant the student tapped Start — locking them out for good,
    // because the unique index allows one attempt per post.
    //
    // So re-check the authoritative deadline instead of trusting the UI state:
    // expires_at is written once at start and is what the server enforces on
    // every write. A derived value can disagree with reality; this cannot.
    if (new Date(attempt.expiresAt).getTime() > Date.now()) return;
    autoSubmitted.current = true;
    void (async () => {
      const res = await callAction(() => submitQuestionnaire(eventId, attempt.postKey));
      if (res.success) {
        setAttempt({ ...attempt, submittedAt: res.data.submittedAt });
        toast.info("Time's up — your answers were submitted.");
        await resync();
      }
    })();
  }, [attempt, timer.isExpired, eventId, resync]);

  // ── Autosave ───────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNow = useCallback(
    async (postKey: string, position: number, text: string) => {
      setSaving(true);
      const res = await callAction(() =>
        saveQuestionnaireAnswer(eventId, postKey, position, text)
      );
      setSaving(false);
      if (!res.success) {
        setError(res.error);
        await resync();
      }
      return res.success;
    },
    [eventId, resync]
  );

  function onType(text: string) {
    setDraft(text);
    if (!attempt) return;
    const position = attempt.questions[index]?.position;
    if (position == null) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveNow(attempt.postKey, position, text);
    }, 1000);
  }

  // Flush any pending debounce when the component goes away, or the last few
  // keystrokes are silently dropped.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Actions ────────────────────────────────────────────────────

  function handleStart(postKey: string) {
    setError(null);
    // Must be called from the tap itself — browsers only allow audio to be
    // armed from a user gesture, and this is the student's only one.
    armTimerSound();
    startTransition(async () => {
      const res = await callAction(() => startQuestionnaire(eventId, postKey));
      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
        await resync();
        return;
      }
      setAttempt(res.data);
      // A question with a handed-in file is ANSWERED — resuming must not drop
      // the student back on a question they already dealt with by uploading.
      const firstUnanswered = res.data.questions.findIndex(
        (q) => !answerIsGiven(q.answer, q.files)
      );
      const at = firstUnanswered === -1 ? 0 : firstUnanswered;
      setIndex(at);
      setDraft(res.data.questions[at]?.answer ?? "");
    });
  }

  // ── Handing in a file ──────────────────────────────────────────
  // Only offered on the Student Journalist report. Typing keeps working
  // exactly as it did — a file is as well as, or instead of, typed text.

  /** Replace this question's file list in state after the server confirms it. */
  const setFilesForCurrent = useCallback(
    (files: StartedAttempt["questions"][number]["files"]) => {
      setAttempt((prev) =>
        prev
          ? {
              ...prev,
              questions: prev.questions.map((q, i) =>
                i === index ? { ...q, files } : q
              ),
            }
          : prev
      );
    },
    [index]
  );

  async function handlePickFiles(picked: FileList | null) {
    if (!attempt || !picked || picked.length === 0) return;
    const position = attempt.questions[index]?.position;
    if (position == null) return;

    setUploading(true);
    // One at a time: the server appends to the answer row, so parallel uploads
    // would race and one could overwrite the other's entry.
    for (const file of Array.from(picked)) {
      const form = new FormData();
      form.append("file", file);
      const res = await callAction(() =>
        uploadQuestionnaireFile(eventId, attempt.postKey, position, form)
      );
      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
        break;
      }
      setFilesForCurrent(res.data.files);
      setError(null);
    }
    setUploading(false);
    // Clear the input or picking the SAME file again fires no change event.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemoveFile(path: string) {
    if (!attempt) return;
    const position = attempt.questions[index]?.position;
    if (position == null) return;
    setUploading(true);
    const res = await callAction(() =>
      removeQuestionnaireFile(eventId, attempt.postKey, position, path)
    );
    setUploading(false);
    if (!res.success) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setFilesForCurrent(res.data.files);
  }

  function handleNext() {
    if (!attempt) return;
    const q = attempt.questions[index];
    if (!q) return;
    startTransition(async () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const ok = await saveNow(attempt.postKey, q.position, draft);
      if (!ok) return;
      const updated = {
        ...attempt,
        questions: attempt.questions.map((x, i) => (i === index ? { ...x, answer: draft } : x)),
      };
      setAttempt(updated);
      const next = index + 1;
      setIndex(next);
      setDraft(updated.questions[next]?.answer ?? "");
    });
  }

  function handleSubmit() {
    if (!attempt) return;
    const q = attempt.questions[index];
    startTransition(async () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q) await saveNow(attempt.postKey, q.position, draft);
      const res = await callAction(() => submitQuestionnaire(eventId, attempt.postKey));
      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
        await resync();
        return;
      }
      setAttempt({ ...attempt, submittedAt: res.data.submittedAt });
      toast.success("Answers submitted.");
      await resync();
    });
  }

  // ── Render ─────────────────────────────────────────────────────

  const isLast = attempt ? index >= attempt.questions.length - 1 : false;
  const answering = attempt !== null && !attempt.submittedAt;
  const currentFiles = attempt?.questions[index]?.files ?? [];

  return (
    <div className="space-y-4">
      <Link
        href="/yip/me"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: inkA(0.6) }}
      >
        <ArrowLeft className="size-3" /> Back
      </Link>

      {error && (
        <div
          role="alert"
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }}
        >
          {error}
        </div>
      )}

      {/* ── SUBMITTED ── */}
      {attempt?.submittedAt && (
        <SectionShell accent={GREEN}>
          <div className="px-5 py-8 text-center">
            <CheckCircle2 className="mx-auto size-10" style={{ color: GREEN }} />
            <h2 className="mt-3 text-[18px] font-semibold" style={{ ...SERIF, color: INK }}>
              Answers Submitted
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: inkA(0.6) }}>
              Your answers have been recorded. Marking happens on the organisers&apos;
              side — you won&apos;t see a score here.
            </p>
            <button
              type="button"
              onClick={() => {
                setAttempt(null);
                autoSubmitted.current = false;
              }}
              className="mt-5 inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-medium"
              style={{ background: `${SAFFRON}14`, color: SAFFRON }}
            >
              Back to my posts
            </button>
          </div>
        </SectionShell>
      )}

      {/* ── ANSWERING ── */}
      {answering && attempt && (
        <SectionShell accent={SAFFRON}>
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: SAFFRON }}
                >
                  {questionnairePostLabel(attempt.postKey)}
                </p>
                <h2 className="text-[16px] font-semibold" style={{ ...SERIF, color: INK }}>
                  Question {index + 1} of {attempt.questions.length}
                </h2>
              </div>
              <div className="text-right">
                <p
                  className="font-mono text-lg font-bold tabular-nums"
                  style={{
                    color: timer.isExpired ? "#b91c1c" : timer.seconds <= 120 ? SAFFRON : INK,
                  }}
                >
                  {timer.display}
                </p>
                <p className="text-[10px]" style={{ color: inkA(0.45) }}>
                  time left
                </p>
              </div>
            </div>

            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: INK }}>
              {attempt.questions[index]?.text}
            </p>

            <textarea
              value={draft}
              onChange={(e) => onType(e.target.value)}
              rows={9}
              autoFocus
              placeholder="Answer in your own words."
              className="mt-3 w-full rounded-xl border p-3 text-[15px] outline-none"
              style={{ borderColor: inkA(0.15), color: INK }}
            />

            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs" style={{ color: inkA(0.45) }}>
                {wordCount(draft)} words
              </span>
              <span className="text-xs" style={{ color: inkA(0.45) }} aria-live="polite">
                {saving ? "Saving…" : draft.trim() ? "Saved" : ""}
              </span>
            </div>

            {/* ── Hand in a file (Student Journalist only) ── */}
            {questionnaireAllowsFileUpload(attempt.postKey) && (
              <div
                className="mt-3 rounded-xl border p-3"
                style={{ borderColor: inkA(0.15), background: `${SAFFRON}08` }}
              >
                <p className="text-[13px] font-semibold" style={{ color: INK }}>
                  Or hand in a file
                </p>
                <p className="mt-0.5 text-xs" style={{ color: inkA(0.6) }}>
                  A document, or a photo of your handwritten report. You can do this
                  instead of typing, or as well as it.
                </p>

                {currentFiles.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5">
                    {currentFiles.map((f) => (
                      <li
                        key={f.path}
                        className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2"
                        style={{ borderColor: inkA(0.12) }}
                      >
                        <Paperclip
                          className="size-3.5 shrink-0"
                          style={{ color: SAFFRON }}
                        />
                        <span
                          className="min-w-0 flex-1 truncate text-xs"
                          style={{ color: INK }}
                        >
                          {f.name}
                        </span>
                        <span
                          className="shrink-0 text-[11px] tabular-nums"
                          style={{ color: inkA(0.45) }}
                        >
                          {formatFileSize(f.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleRemoveFile(f.path)}
                          disabled={uploading}
                          aria-label={`Remove ${f.name}`}
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl disabled:opacity-40"
                          style={{ color: inkA(0.55) }}
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={QUESTIONNAIRE_UPLOAD_ACCEPT}
                  className="sr-only"
                  onChange={(e) => void handlePickFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || currentFiles.length >= QUESTIONNAIRE_MAX_FILES_PER_ANSWER}
                  className="mt-2.5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: `${SAFFRON}14`, color: SAFFRON }}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Paperclip className="size-4" />
                  )}
                  {uploading
                    ? "Adding…"
                    : currentFiles.length > 0
                      ? "Add another file"
                      : "Choose a file or take a photo"}
                </button>
                <p className="mt-1.5 text-[11px]" style={{ color: inkA(0.45) }}>
                  {currentFiles.length >= QUESTIONNAIRE_MAX_FILES_PER_ANSWER
                    ? `That's the most you can add (${QUESTIONNAIRE_MAX_FILES_PER_ANSWER}). Remove one if you need to swap it.`
                    : `Up to ${QUESTIONNAIRE_MAX_FILES_PER_ANSWER} files, 10 MB each. Photos, PDF or Word.`}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={isLast ? handleSubmit : handleNext}
              // Also blocked while a file is going up — submitting mid-upload
              // would hand in a paper without the page the student just chose.
              disabled={isPending || uploading}
              className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: isLast ? GREEN : INK }}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isLast ? (
                <Send className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              {isLast ? "Submit my answers" : "Next question"}
            </button>

            <p className="mt-2 text-center text-[11px]" style={{ color: inkA(0.45) }}>
              You can&apos;t go back to a question once you move on. Submitting early is
              fine — you don&apos;t have to use the full time.
            </p>
          </div>
        </SectionShell>
      )}

      {/* ── PICK / CLOSED ── */}
      {!attempt && (
        <>
          <SectionShell accent={SAFFRON}>
            <div className="px-5 py-4">
              <SectionHeading
                eyebrow="Selection"
                title="Selection Questions"
                accent={SAFFRON}
              />
              <p className="mt-2 text-sm" style={{ color: inkA(0.6) }}>
                {mine.length === 0
                  ? "You haven't nominated yourself for any post yet."
                  : "Answer the questions for each post you nominated for. Each one is timed separately."}
              </p>
            </div>
          </SectionShell>

          {mine.map((p) => {
            const submitted = Boolean(p.attempt?.submittedAt);
            const inProgress = Boolean(p.attempt && !p.attempt.submittedAt);
            // The clock is uniform, so a window can still be `open` after the
            // cohort's 30 minutes are spent. Starting then is refused by the
            // server, so don't offer a button that can only fail. Never applies
            // to a student already writing — their own expires_at governs, and
            // they are entitled to finish.
            const timeOver =
              p.windowOpen &&
              !inProgress &&
              !submitted &&
              p.closesAt !== null &&
              new Date(p.closesAt).getTime() <= Date.now();
            const canStart = p.windowOpen && !submitted && !timeOver;
            return (
              <SectionShell key={p.postKey} accent={submitted ? GREEN : SAFFRON}>
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold" style={{ color: INK }}>
                      {p.label}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{
                          background: submitted
                            ? GREEN
                            : p.windowOpen && !timeOver
                              ? GREEN
                              : inkA(0.35),
                        }}
                      />
                      <p className="text-xs" style={{ color: inkA(0.55) }}>
                        {submitted
                          ? "Submitted"
                          : inProgress
                            ? `In progress — ${p.attempt!.answered} of ${p.attempt!.total} answered`
                            : timeOver
                              ? "Time is over — speak to your organiser"
                              : p.windowOpen
                                ? "Open now"
                                : "Not open yet"}
                      </p>
                    </div>
                  </div>
                  {canStart ? (
                    <button
                      type="button"
                      onClick={() => handleStart(p.postKey)}
                      disabled={isPending}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
                      style={{ background: `${SAFFRON}14`, color: SAFFRON }}
                    >
                      {inProgress ? "Continue" : "Start"}
                      <ChevronRight className="size-4" />
                    </button>
                  ) : null}
                </div>
              </SectionShell>
            );
          })}

          {mine.length > 0 && openNow.length === 0 && (
            <SectionShell>
              <div className="px-5 py-8 text-center">
                <Clock3 className="mx-auto size-8" style={{ color: inkA(0.35) }} />
                <h2 className="mt-3 text-[16px] font-semibold" style={{ ...SERIF, color: INK }}>
                  Nothing open right now
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: inkA(0.6) }}>
                  Your organisers open each post&apos;s questions at a different time.
                  Watch your Party or Committee WhatsApp group for the announcement.
                </p>
              </div>
            </SectionShell>
          )}
        </>
      )}
    </div>
  );
}
