"use client";

import { useState, useCallback } from "react";
import {
  getMinistryDesk,
  ministerAnswerQuestion,
  ministerRespondToMotion,
  type MinistryDesk,
} from "@/app/yip/actions/ministry";
import { ministryLabel, type MinistryPortfolio } from "@/lib/yip/cabinet";

export function MinistryClient({
  eventId,
  participantId,
  initialDesk,
  loadError,
  ministries,
}: {
  eventId: string;
  participantId: string;
  initialDesk: MinistryDesk | null;
  loadError: string | null;
  /** The event's effective cabinet portfolios — resolves the ministry label. */
  ministries: MinistryPortfolio[];
}) {
  const [desk, setDesk] = useState<MinistryDesk | null>(initialDesk);
  const [error, setError] = useState<string | null>(loadError);
  // Resolve a ministry key to its label via the event's cabinet (custom or
  // default), falling back to a dash when there is no ministry.
  const ml = (k: string | null) => (k ? ministryLabel(k, ministries) : "—");
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const r = await getMinistryDesk(eventId, participantId);
    if (r.success) setDesk(r.data);
    else setError(r.error);
  }, [eventId, participantId]);

  async function submit(key: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(key);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (!r.success) {
      setError(r.error ?? "Action failed");
    } else {
      setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
      try {
        await refresh();
      } catch {
        setError("Couldn't refresh — reload the page.");
      }
    }
  }

  if (!desk) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-red-700">
        {error ?? "Could not load your ministry desk."}
      </div>
    );
  }

  const heading = desk.scope === "all" ? "All Ministries" : ml(desk.ministry);

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-5 pb-24">
      <header>
        <h1 className="text-lg font-bold text-[#1a1a3e]">Ministry Desk</h1>
        <p className="text-sm text-[#1a1a3e]/55">
          {heading}
          {!desk.canAnswer ? " · read-only (Shadow)" : ""}
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[#FF9933]">
          Questions ({desk.questions.length})
        </h2>
        {desk.questions.length === 0 && <Empty>No questions for your ministry.</Empty>}
        {desk.questions.map((q) => {
          const answered = q.status === "answered" || !!q.answer_summary;
          const key = `q-${q.id}`;
          return (
            <Item key={key} title={q.question_text} tag={desk.scope === "all" ? ml(q.directed_to_ministry) : undefined} status={q.status}>
              {q.answer_summary && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span className="font-semibold">Answer: </span>{q.answer_summary}
                </p>
              )}
              {desk.canAnswer && !answered && (
                <Responder
                  placeholder="Type the ministry's answer…"
                  value={drafts[key] ?? ""}
                  disabled={busy === key}
                  onChange={(v) => setDrafts((d) => ({ ...d, [key]: v }))}
                  onSubmit={() =>
                    submit(key, () => ministerAnswerQuestion(eventId, participantId, q.id, drafts[key] ?? ""))
                  }
                  cta="Answer"
                />
              )}
            </Item>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[#FF9933]">
          Motions to your ministry ({desk.motions.length})
        </h2>
        {desk.motions.length === 0 && <Empty>No motions directed to your ministry.</Empty>}
        {desk.motions.map((m) => {
          const key = `m-${m.id}`;
          return (
            <Item key={key} title={m.subject} subtitle={m.details ?? undefined} tag={desk.scope === "all" ? ml(m.directed_to_ministry) : undefined} status={m.status}>
              {m.minister_response && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span className="font-semibold">Response: </span>{m.minister_response}
                </p>
              )}
              {desk.canAnswer && (
                <Responder
                  placeholder="Type the ministry's response…"
                  value={drafts[key] ?? ""}
                  disabled={busy === key}
                  onChange={(v) => setDrafts((d) => ({ ...d, [key]: v }))}
                  onSubmit={() =>
                    submit(key, () => ministerRespondToMotion(eventId, participantId, m.id, drafts[key] ?? ""))
                  }
                  cta={m.minister_response ? "Update response" : "Respond"}
                />
              )}
            </Item>
          );
        })}
      </section>
    </div>
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
  tag,
  status,
  children,
}: {
  title: string;
  subtitle?: string;
  tag?: string;
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
      {tag && <p className="mt-1 text-xs font-medium text-[#FF9933]">{tag}</p>}
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function Responder({
  value,
  placeholder,
  disabled,
  onChange,
  onSubmit,
  cta,
}: {
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  cta: string;
}) {
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none"
      />
      <button
        type="button"
        disabled={disabled || value.trim().length < 3}
        onClick={onSubmit}
        className="w-full rounded-lg bg-[#138808] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {cta}
      </button>
    </div>
  );
}
