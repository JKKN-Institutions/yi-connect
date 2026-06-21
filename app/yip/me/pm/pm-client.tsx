"use client";

import { useState, useCallback } from "react";
import { pmPresentBill, type GovernmentBill } from "@/app/yip/actions/pm";
import {
  getMinistryDesk,
  ministerAnswerQuestion,
  ministerRespondToMotion,
  type MinistryDesk,
} from "@/app/yip/actions/ministry";

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

export function PmClient({
  eventId,
  participantId,
  roleLabel,
  initialBills,
  billsError,
  initialDesk,
  deskError,
}: {
  eventId: string;
  participantId: string;
  roleLabel: string;
  initialBills: GovernmentBill[];
  billsError: string | null;
  initialDesk: MinistryDesk | null;
  deskError: string | null;
}) {
  const [bills, setBills] = useState<GovernmentBill[]>(initialBills);
  const [desk, setDesk] = useState<MinistryDesk | null>(initialDesk);
  const [error, setError] = useState<string | null>(billsError ?? deskError);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refreshDesk = useCallback(async () => {
    const r = await getMinistryDesk(eventId, participantId);
    if (r.success) setDesk(r.data);
    else setError(r.error);
  }, [eventId, participantId]);

  async function submit(
    key: string,
    fn: () => Promise<{ success: boolean; error?: string }>,
    after?: () => Promise<void>
  ) {
    setBusy(key);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (!r.success) {
      setError(r.error ?? "Action failed");
      return;
    }
    setDrafts((d) => {
      const n = { ...d };
      delete n[key];
      return n;
    });
    if (after) {
      try {
        await after();
      } catch {
        setError("Couldn't refresh — reload the page.");
      }
    }
  }

  function markPresented(billId: string) {
    setBills((prev) =>
      prev.map((b) => (b.id === billId ? { ...b, status: "presented" } : b))
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-5 pb-24">
      <header>
        <h1 className="text-lg font-bold text-[#1a1a3e]">{roleLabel}&apos;s Desk</h1>
        <p className="text-sm text-[#1a1a3e]/55">
          Present government bills · answer for the whole Government
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Government bills ───────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[#138808]">
          Government Bills ({bills.length})
        </h2>
        {bills.length === 0 && (
          <Empty>No government bills yet.</Empty>
        )}
        {bills.map((b) => (
          <GovBillCard
            key={b.id}
            bill={b}
            busy={busy === `bill-${b.id}`}
            onPresent={() =>
              submit(`bill-${b.id}`, () => pmPresentBill(eventId, participantId, b.id), async () =>
                markPresented(b.id)
              )
            }
          />
        ))}
      </section>

      {/* ── Cross-ministry questions ──────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[#FF9933]">
          Questions — all ministries ({desk?.questions.length ?? 0})
        </h2>
        {(!desk || desk.questions.length === 0) && (
          <Empty>No questions awaiting a Government answer.</Empty>
        )}
        {desk?.questions.map((q) => {
          const answered = q.status === "answered" || !!q.answer_summary;
          const key = `q-${q.id}`;
          return (
            <Item key={key} title={q.question_text} tag={ml(q.directed_to_ministry)} status={q.status}>
              {q.answer_summary && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span className="font-semibold">Answer: </span>
                  {q.answer_summary}
                </p>
              )}
              {!answered && (
                <Responder
                  placeholder="Type the Government's answer…"
                  value={drafts[key] ?? ""}
                  disabled={busy === key}
                  onChange={(v) => setDrafts((d) => ({ ...d, [key]: v }))}
                  onSubmit={() =>
                    submit(
                      key,
                      () => ministerAnswerQuestion(eventId, participantId, q.id, drafts[key] ?? ""),
                      refreshDesk
                    )
                  }
                  cta="Answer"
                />
              )}
            </Item>
          );
        })}
      </section>

      {/* ── Cross-ministry motions ────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[#FF9933]">
          Motions to ministries ({desk?.motions.length ?? 0})
        </h2>
        {(!desk || desk.motions.length === 0) && (
          <Empty>No motions directed to a ministry.</Empty>
        )}
        {desk?.motions.map((m) => {
          const key = `m-${m.id}`;
          const closed = ["resolved", "rejected"].includes(m.status);
          return (
            <Item
              key={key}
              title={m.subject}
              subtitle={m.details ?? undefined}
              tag={ml(m.directed_to_ministry)}
              status={m.status}
            >
              {m.minister_response && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span className="font-semibold">Response: </span>
                  {m.minister_response}
                </p>
              )}
              {!closed && (
                <Responder
                  placeholder="Type the Government's response…"
                  value={drafts[key] ?? ""}
                  disabled={busy === key}
                  onChange={(v) => setDrafts((d) => ({ ...d, [key]: v }))}
                  onSubmit={() =>
                    submit(
                      key,
                      () => ministerRespondToMotion(eventId, participantId, m.id, drafts[key] ?? ""),
                      refreshDesk
                    )
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

function GovBillCard({
  bill,
  busy,
  onPresent,
}: {
  bill: GovernmentBill;
  busy: boolean;
  onPresent: () => void;
}) {
  const status = bill.status ?? "drafting";
  const canPresent = status === "approved" || status === "submitted";
  const presented = status === "presented";

  return (
    <div className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-[#1a1a3e]">{bill.title}</p>
        <span className="shrink-0 rounded-full bg-[#1a1a3e]/5 px-2 py-0.5 text-[10px] font-semibold text-[#1a1a3e]/55">
          {status}
        </span>
      </div>
      {bill.committee_name && (
        <p className="mt-0.5 text-xs font-medium text-[#138808]">{bill.committee_name}</p>
      )}
      {bill.objective && <p className="mt-1 text-sm text-[#1a1a3e]/70">{bill.objective}</p>}
      {(bill.votes_for || bill.votes_against || bill.votes_abstain) ? (
        <p className="mt-1.5 text-xs text-[#1a1a3e]/45">
          Vote: {bill.votes_for ?? 0}–{bill.votes_against ?? 0}, {bill.votes_abstain ?? 0} abstain
        </p>
      ) : null}

      {bill.opposition_response && (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-600">
            Opposition response
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[#1a1a3e]/80">
            {bill.opposition_response}
          </p>
        </div>
      )}

      {presented ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-800">
          Presented to the House
        </div>
      ) : canPresent ? (
        <button
          type="button"
          disabled={busy}
          onClick={onPresent}
          className="mt-3 w-full rounded-lg bg-[#138808] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Presenting…" : "Present this bill to the House"}
        </button>
      ) : (
        <p className="mt-3 text-[11px] text-[#1a1a3e]/45">
          Available to present once the organiser approves it.
        </p>
      )}
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
