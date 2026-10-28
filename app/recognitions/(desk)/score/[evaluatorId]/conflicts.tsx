"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { declareConflicts } from "@/app/recognitions/actions/declare-conflicts";
import { ConfirmDialog, ResultLine } from "../../../_ui/client";

export type ConflictRow = {
  chapterId: string;
  name: string;
  /** Why it is already off the sheet, or why it can't be ticked; null = free to tick. */
  locked: null | "role" | "declared" | "scored";
};

const LOCK_NOTE: Record<Exclude<ConflictRow["locked"], null>, string> = {
  role: "your chapter in the Yi directory",
  declared: "declared",
  scored: "you have submitted marks",
};

/** "Any conflict of interest?" at the top of a scoring sheet (Piyush, 28 Oct). */
export function ConflictPanel({ evaluatorId, rows }: { evaluatorId: string; rows: ConflictRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const names = rows.filter((r) => picked.includes(r.chapterId)).map((r) => r.name);

  function save() {
    setResult(null);
    start(async () => {
      try {
        const r = await declareConflicts({ evaluatorId, chapterIds: picked });
        setResult(r.success ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error });
        if (r.success) {
          setPicked([]);
          setOpen(false);
          router.refresh();
        }
      } catch {
        setResult({ ok: false, text: "The connection dropped before the server answered. Check your network and try again." });
      }
    });
  }

  return (
    <details className="rx-plate rx-stack" style={{ marginBottom: 24 }} open={rows.some((r) => r.locked === null)}>
      <summary className="rx-h3" style={{ cursor: "pointer" }}>Any conflict of interest?</summary>
      <p className="rx-small rx-mute">
        Tick any chapter you should not score: your home chapter, or one you are closely linked to. It leaves your sheet,
        and only the Recognitions super admin can put it back.
      </p>
      {rows.length === 0 ? (
        <p className="rx-small rx-mute">No chapter has filed for this recognition on your sheet yet.</p>
      ) : (
        <ul className="rx-stack" style={{ gap: 6, listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li key={r.chapterId}>
              <label className="rx-row rx-small" style={{ gap: 8, flexWrap: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={r.locked === "role" || r.locked === "declared" || picked.includes(r.chapterId)}
                  disabled={r.locked !== null || pending}
                  onChange={(e) =>
                    setPicked((p) => (e.target.checked ? [...p, r.chapterId] : p.filter((x) => x !== r.chapterId)))
                  }
                />
                <span>
                  {r.name}
                  {r.locked ? <span className="rx-mute"> · {LOCK_NOTE[r.locked]}</span> : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {rows.some((r) => r.locked === null) ? (
        <div>
          <button type="button" className="rx-btn rx-btn-sm" disabled={picked.length === 0 || pending} onClick={() => setOpen(true)}>
            Declare conflict{picked.length === 1 ? "" : "s"}
          </button>
        </div>
      ) : null}
      <ResultLine result={result} />
      <ConfirmDialog
        open={open}
        title="Take these chapters off your sheet?"
        confirmLabel="Yes, declare"
        busy={pending}
        onClose={() => setOpen(false)}
        onConfirm={save}
      >
        <p>{names.join(", ")}. You won&apos;t score {names.length === 1 ? "it" : "them"}. Only the Recognitions super admin can undo this.</p>
      </ConfirmDialog>
    </details>
  );
}
