"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftSalesChaser } from "./actions";

/** "Draft chaser" for one applicant. */
export function DraftChaserButton({ partnerId, label = "Draft chaser" }: { partnerId: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span style={{ display: "grid", gap: 4, justifyItems: "start" }}>
      <button
        type="button"
        className="tp-btn sm"
        disabled={pending}
        data-tp="draft-chaser"
        onClick={() =>
          start(async () => {
            setErr(null);
            const r = await draftSalesChaser(partnerId);
            if (!r.success) setErr(r.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Asking…" : label}
      </button>
      {err && (
        <span className="tp-small" style={{ color: "var(--tp-bad)" }} role="alert">
          {err}
        </span>
      )}
    </span>
  );
}
