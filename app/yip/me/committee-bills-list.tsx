"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";

// Literal hex mirrors app/yip/me/credential-ui.tsx (the YIP brand tokens are
// dead in this route group — see project memory). Kept in sync by hand.
const INK = "#1a1a3e";
const SAFFRON = "#C2691A";
const GREEN = "#138808";
function inkA(alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${INK}${a}`;
}

export type DashboardCommitteeBill = {
  id: string;
  committeeName: string | null;
  title: string | null;
  status: string | null;
  preamble: string | null;
  definitions: string | null;
  objectives: string[];
  provisions: string[];
  implementation: string | null;
  fundingBudget: string | null;
  expectedImpact: string | null;
  conclusion: string | null;
};

function statusColor(status: string | null): string {
  if (status === "passed" || status === "approved") return GREEN;
  if (status === "presented") return SAFFRON;
  return inkA(0.45);
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div>
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: inkA(0.4) }}
      >
        {label}
      </p>
      <p
        className="mt-0.5 whitespace-pre-wrap text-sm"
        style={{ color: inkA(0.82) }}
      >
        {value.trim()}
      </p>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  const clean = items.map((i) => (i ?? "").trim()).filter(Boolean);
  if (clean.length === 0) return null;
  return (
    <div>
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: inkA(0.4) }}
      >
        {label}
      </p>
      <ol
        className="mt-1 list-decimal space-y-1 pl-5 text-sm"
        style={{ color: inkA(0.82) }}
      >
        {clean.map((t, i) => (
          <li key={i} className="whitespace-pre-wrap">
            {t}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Read-only list of committee bills on the MP dashboard. Every MP sees this;
 * each bill is collapsed to one line (committee · title · status) and expands
 * to the full bill text on tap. Only organiser-approved bills reach this list
 * (the page filters status to approved/presented/passed) — drafts and rejected
 * bills never appear.
 */
export function CommitteeBillsList({
  bills,
}: {
  bills: DashboardCommitteeBill[];
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2.5">
      {bills.map((bill) => {
        const isOpen = open.has(bill.id);
        const heading =
          bill.committeeName?.trim() || bill.title?.trim() || "Committee Bill";
        const hasBody =
          !!(
            bill.preamble ||
            bill.definitions ||
            bill.implementation ||
            bill.fundingBudget ||
            bill.expectedImpact ||
            bill.conclusion
          ) ||
          bill.objectives.some((o) => (o ?? "").trim()) ||
          bill.provisions.some((p) => (p ?? "").trim());

        return (
          <div
            key={bill.id}
            className="rounded-xl"
            style={{ background: `${SAFFRON}0d`, border: `1px solid ${SAFFRON}30` }}
          >
            <button
              type="button"
              onClick={() => toggle(bill.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 p-3 text-left"
            >
              <FileText className="size-4 shrink-0" style={{ color: SAFFRON }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: SAFFRON }}
                  >
                    {heading}
                  </span>
                  {bill.status && (
                    <span
                      className="font-mono text-[10px] tracking-wide"
                      style={{ color: statusColor(bill.status) }}
                    >
                      {bill.status}
                    </span>
                  )}
                </div>
                {bill.title && (
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: INK }}
                  >
                    {bill.title}
                  </p>
                )}
              </div>
              <ChevronDown
                className="size-4 shrink-0 transition-transform"
                style={{
                  color: inkA(0.4),
                  transform: isOpen ? "rotate(180deg)" : "none",
                }}
              />
            </button>

            {isOpen && (
              <div className="space-y-3 px-3 pb-3.5 pt-0.5">
                {hasBody ? (
                  <>
                    <Field label="Preamble" value={bill.preamble} />
                    <Field label="Definitions" value={bill.definitions} />
                    <ListField label="Objectives" items={bill.objectives} />
                    <ListField label="Key Provisions" items={bill.provisions} />
                    <Field
                      label="Implementation Plan"
                      value={bill.implementation}
                    />
                    <Field label="Funding / Budget" value={bill.fundingBudget} />
                    <Field label="Expected Impact" value={bill.expectedImpact} />
                    <Field
                      label="Conclusion / Call to Action"
                      value={bill.conclusion}
                    />
                  </>
                ) : (
                  <p className="text-xs" style={{ color: inkA(0.5) }}>
                    This bill hasn&apos;t been written out in detail yet.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
