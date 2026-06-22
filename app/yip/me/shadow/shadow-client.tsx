"use client";

import { useState, useCallback } from "react";
import {
  getShadowDesk,
  shadowFileQuestion,
  shadowMoveCounterMotion,
  type ShadowDesk,
} from "@/app/yip/actions/shadow";

const MINISTRY_LABEL: Record<string, string> = {
  home: "Home Affairs",
  finance: "Finance",
  education: "Education",
  health: "Health",
  women_child: "Women & Child Development",
  disaster_management: "Disaster Management",
  youth_sports: "Youth Affairs & Sports",
  it_digital: "IT & Digital",
};
const ml = (k: string | null) => (k ? MINISTRY_LABEL[k] ?? k : "—");

export function ShadowClient({
  eventId,
  participantId,
  initialDesk,
  loadError,
}: {
  eventId: string;
  participantId: string;
  initialDesk: ShadowDesk | null;
  loadError: string | null;
}) {
  const [desk, setDesk] = useState<ShadowDesk | null>(initialDesk);
  const [error, setError] = useState<string | null>(loadError);

  const refresh = useCallback(async () => {
    const r = await getShadowDesk(eventId, participantId);
    if (r.success) setDesk(r.data);
    else setError(r.error);
  }, [eventId, participantId]);

  if (!desk) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-red-700">
        {error ?? "Could not load your shadow desk."}
      </div>
    );
  }

  const hasMinistry = !!desk.ministry;

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-5 pb-24">
      <header>
        <h1 className="text-lg font-bold text-[#1a1a3e]">Shadow Minister&apos;s Desk</h1>
        <p className="text-sm text-[#1a1a3e]/55">
          Shadowing {ml(desk.ministry)}
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!hasMinistry ? (
        <div className="rounded-2xl border border-[#1a1a3e]/8 bg-white px-4 py-8 text-center text-sm text-[#1a1a3e]/55">
          You have no shadow ministry assigned yet. Once the organiser assigns
          your counterpart ministry, its questions and motions will appear here.
        </div>
      ) : (
        <>
          <FileCounter
            eventId={eventId}
            participantId={participantId}
            ministryLabel={ml(desk.ministry)}
            onFiled={refresh}
          />

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#FF9933]">
              Questions to {ml(desk.ministry)} ({desk.questions.length})
            </h2>
            {desk.questions.length === 0 && (
              <Empty>No questions to your counterpart ministry yet.</Empty>
            )}
            {desk.questions.map((q) => (
              <Item key={q.id} title={q.question_text} status={q.status}>
                {q.answer_summary ? (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <span className="font-semibold">Minister&apos;s answer: </span>
                    {q.answer_summary}
                  </p>
                ) : (
                  <p className="text-xs text-[#1a1a3e]/40">Not yet answered.</p>
                )}
              </Item>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[#FF9933]">
              Motions to {ml(desk.ministry)} ({desk.motions.length})
            </h2>
            {desk.motions.length === 0 && (
              <Empty>No motions directed to your counterpart ministry yet.</Empty>
            )}
            {desk.motions.map((m) => (
              <Item key={m.id} title={m.subject} subtitle={m.details ?? undefined} status={m.status}>
                {m.minister_response ? (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <span className="font-semibold">Minister&apos;s response: </span>
                    {m.minister_response}
                  </p>
                ) : (
                  <p className="text-xs text-[#1a1a3e]/40">No minister response yet.</p>
                )}
              </Item>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function FileCounter({
  eventId,
  participantId,
  ministryLabel,
  onFiled,
}: {
  eventId: string;
  participantId: string;
  ministryLabel: string;
  onFiled: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"question" | "motion">("question");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filed, setFiled] = useState(false);

  const reset = () => {
    setSubject("");
    setBody("");
    setErr(null);
  };

  function switchMode(next: "question" | "motion") {
    setMode(next);
    reset();
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    const r =
      mode === "question"
        ? await shadowFileQuestion(eventId, participantId, body)
        : await shadowMoveCounterMotion(eventId, participantId, subject, body);
    setBusy(false);
    if (!r.success) {
      setErr(r.error);
      return;
    }
    reset();
    setFiled(true);
    try {
      await onFiled();
    } catch {
      // non-fatal; the item was filed
    }
  }

  const canSubmit =
    mode === "question"
      ? body.trim().length >= 20
      : subject.trim().length >= 5 && body.trim().length >= 20;

  if (filed) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
        <p className="text-sm font-semibold text-emerald-800">
          Your counter has been filed to the {mode === "question" ? "Question Hour queue" : "Speaker"}.
        </p>
        <button
          type="button"
          onClick={() => setFiled(false)}
          className="mt-2 text-xs font-semibold text-emerald-700 underline"
        >
          File another
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-violet-600">
        File a counter / follow-up
      </h2>
      <div className="space-y-3 rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <ModeButton active={mode === "question"} onClick={() => switchMode("question")}>
            Question
          </ModeButton>
          <ModeButton active={mode === "motion"} onClick={() => switchMode("motion")}>
            Short-duration motion
          </ModeButton>
        </div>

        {mode === "motion" && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Motion subject (e.g. Failure of the scheme)"
            className="w-full rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none"
          />
        )}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            mode === "question"
              ? `Your follow-up question to ${ministryLabel} (at least 20 characters)…`
              : `Grounds for the short-duration discussion (at least 20 characters)…`
          }
          rows={4}
          className="w-full rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none"
        />

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {err}
          </div>
        )}

        <button
          type="button"
          disabled={busy || !canSubmit}
          onClick={submit}
          className="w-full rounded-lg bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy
            ? "Filing…"
            : mode === "question"
              ? "File follow-up question"
              : "Move short-duration motion"}
        </button>
        <p className="text-[11px] text-[#1a1a3e]/45">
          {mode === "question"
            ? `Directed to ${ministryLabel}. Goes to the organiser to approve and queue for Question Hour.`
            : `Directed to ${ministryLabel}. Goes to the Speaker, who admits it for discussion.`}
        </p>
      </div>
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors " +
        (active
          ? "bg-violet-600 text-white"
          : "border-2 border-[#1a1a3e]/10 text-[#1a1a3e]/60")
      }
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1a1a3e]/8 bg-white px-4 py-6 text-center text-sm text-[#1a1a3e]/45">
      {children}
    </div>
  );
}

function Item({
  title,
  subtitle,
  status,
  children,
}: {
  title: string;
  subtitle?: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-[#1a1a3e]">{title}</p>
        <span className="shrink-0 rounded-full bg-[#1a1a3e]/5 px-2 py-0.5 text-[10px] font-semibold text-[#1a1a3e]/55">
          {status}
        </span>
      </div>
      {subtitle && <p className="mt-1 text-sm text-[#1a1a3e]/70">{subtitle}</p>}
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}
