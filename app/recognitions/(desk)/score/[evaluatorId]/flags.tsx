"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNmtApproval, setRmRecommendation } from "@/app/recognitions/actions/score";
import { ResultLine } from "../../../_ui/client";
import { IconCheck } from "../../../_ui/icons";

/**
 * RM "Recommend this chapter to the NMT" / NMT "Approve RM recommendation".
 * These flags never gate scoring (mail 1 gives them no such role).
 */
export function FlagToggle({
  kind,
  evaluatorId,
  nominationId,
  on,
  disabled,
  note,
}: {
  kind: "recommend" | "approve";
  evaluatorId: string;
  nominationId: string;
  on: boolean;
  disabled: boolean;
  note?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const label = kind === "recommend" ? "Recommend this chapter to the NMT" : "Approve RM recommendation";

  function toggle() {
    setResult(null);
    startTransition(async () => {
      const action = kind === "recommend" ? setRmRecommendation : setNmtApproval;
      const res = await action({ evaluatorId, nominationId, on: !on });
      if (res.success) {
        setResult({ ok: true, text: res.message ?? "Saved." });
        router.replace(`/recognitions/score/${evaluatorId}?n=${nominationId}`, { scroll: false });
        router.refresh();
      } else {
        setResult({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        className="rx-tile"
        aria-pressed={on}
        disabled={disabled || pending}
        onClick={toggle}
      >
        <span
          aria-hidden="true"
          style={{
            width: 20,
            height: 20,
            flex: "none",
            borderRadius: 4,
            border: "1px solid var(--rx-line-strong)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: on ? "var(--rx-laurel)" : "transparent",
            color: "var(--rx-ivory)",
          }}
        >
          {on ? <IconCheck size={14} /> : null}
        </span>
        <span>
          <span style={{ fontWeight: 600 }}>{pending ? "Saving…" : label}</span>
          {note ? <span className="rx-help" style={{ display: "block", marginTop: 2 }}>{note}</span> : null}
        </span>
      </button>
      <ResultLine result={result} />
    </div>
  );
}
