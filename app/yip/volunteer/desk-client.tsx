"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  getMyYuvaAssignment,
  type MyDesk,
} from "@/app/yip/actions/volunteer-desk";

// Static responsibilities per desk (decision: static text, not per-row config).
const RESPONSIBILITIES = [
  "Help the students at your desk find their seats and follow the agenda.",
  "Mark attendance for your students as they arrive.",
  "When a student finishes their 90-second speech, mark it done.",
  "During an open vote, carry the device and hand it to each of your students to cast their own vote.",
];

export function DeskCard({ eventId }: { eventId: string }) {
  const [desk, setDesk] = useState<MyDesk | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getMyYuvaAssignment(eventId).then((r) =>
      r.success ? setDesk(r.data) : setErr(r.error)
    );
  }, [eventId]);

  if (err) return <Banner>{err}</Banner>;
  if (!desk) return <Banner>Loading your desk…</Banner>;

  if (!desk.hasDesk) {
    return (
      <Banner tone="warn">
        You haven&apos;t been assigned to a party or committee yet. Please see an
        organiser to get your desk.
      </Banner>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#FF9933]">
          Your Desk
        </h2>
        <div className="mt-2 space-y-1">
          {desk.parties.map((p) => (
            <p key={p.id} className="text-base font-semibold text-[#1a1a3e]">
              🏛️ {p.name}
            </p>
          ))}
          {desk.committees.map((c) => (
            <p key={c} className="text-base font-semibold text-[#1a1a3e]">
              📋 {c} Committee
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#FF9933]">
          Your Responsibilities
        </h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[#1a1a3e]/80">
          {RESPONSIBILITIES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Banner({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warn";
}) {
  const cls =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-[#1a1a3e]/8 bg-white text-[#1a1a3e]/70";
  return (
    <div
      className={`rounded-2xl border px-4 py-6 text-center text-sm font-medium shadow-sm ${cls}`}
    >
      {children}
    </div>
  );
}
