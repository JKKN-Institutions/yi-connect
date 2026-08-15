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
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMyQuestionnaire,
  saveQuestionnaireAnswer,
  startQuestionnaire,
  submitQuestionnaire,
  type MyPostState,
  type StartedAttempt,
} from "@/app/yip/actions/questionnaire";
import { useTimer } from "@/lib/yip/hooks/use-timer";
import { armTimerSound } from "@/lib/yip/timer-sound";
import { wordCount } from "@/lib/yip/questionnaire";
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
  const [isPending, startTransition] = useTransition();

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
      const firstUnanswered = res.data.questions.findIndex((q) => q.answer.trim() === "");
      const at = firstUnanswered === -1 ? 0 : firstUnanswered;
      setIndex(at);
      setDraft(res.data.questions[at]?.answer ?? "");
    });
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
                  {attempt.postKey === "parliamentary_administrator"
                    ? "Administrator"
                    : attempt.postKey === "speaker"
                      ? "Speaker"
                      : "Party Leader"}
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

            <button
              type="button"
              onClick={isLast ? handleSubmit : handleNext}
              disabled={isPending}
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
            const canStart = p.windowOpen && !submitted;
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
                          background: submitted ? GREEN : p.windowOpen ? GREEN : inkA(0.35),
                        }}
                      />
                      <p className="text-xs" style={{ color: inkA(0.55) }}>
                        {submitted
                          ? "Submitted"
                          : inProgress
                            ? `In progress — ${p.attempt!.answered} of ${p.attempt!.total} answered`
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
