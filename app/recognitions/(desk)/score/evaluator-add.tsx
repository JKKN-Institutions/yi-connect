"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABEL, type Category } from "@/lib/recognitions/constants";
import { countWords } from "@/lib/recognitions/words";
import { ConfirmDialog, ResultLine, WordField } from "@/app/recognitions/_ui/client";
import { addChapterAsEvaluator, approveAddedChapter, declineAddedChapter } from "@/app/recognitions/actions/evaluator-add";

const REASON_WORDS = 100;

export type AddOption = { id: string; name: string; region: string; category: Category };

/**
 * "Add a chapter that didn't apply" (recognitions_05). A Regional Mentor
 * sees only their own region's chapters and the addition waits for an NMT
 * approval; an NMT member's addition is scored straight away. The server
 * re-checks every rule; this only previews.
 */
export function AddChapterForDuty({
  evaluatorId,
  awardTitle,
  layer,
  region,
  options,
  skipped,
  closesAt,
}: {
  evaluatorId: string;
  awardTitle: string;
  layer: "rm" | "nmt";
  region: string | null;
  options: AddOption[];
  skipped: Array<{ name: string; why: string }>;
  closesAt: string;
}) {
  const id = useId();
  const router = useRouter();
  const [chapterId, setChapterId] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const picked = options.find((o) => o.id === chapterId) ?? null;
  const ready = picked !== null && reason.trim() !== "" && countWords(reason) <= REASON_WORDS;

  function add() {
    setResult(null);
    start(async () => {
      const res = await addChapterAsEvaluator(evaluatorId, chapterId, reason);
      setConfirm(false);
      setResult(res.success ? { ok: true, text: res.message ?? "Added." } : { ok: false, text: res.error });
      if (res.success) {
        setChapterId("");
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <details className="rx-p-fold" data-testid={`add-chapter-${evaluatorId}`}>
      <summary>
        <span className="rx-h3">Add a chapter that didn&apos;t apply</span>
      </summary>
      <div className="rx-p-fold-body rx-stack">
        <p className="rx-small rx-mute">
          {layer === "rm"
            ? `Put forward a chapter of region ${region ?? ""} that has done great work for ${awardTitle} but did not apply. An NMT member of this recognition must approve it before it is scored.`
            : `Put forward any chapter that has done great work for ${awardTitle} but did not apply. It goes straight onto the scoring sheets.`}{" "}
          Open until {closesAt}.
        </p>
        {options.length === 0 ? (
          <p className="rx-mute rx-small">No chapter can be added right now.</p>
        ) : (
          <>
            <div>
              <label htmlFor={`${id}-pick`} className="rx-label">Chapter</label>
              <select id={`${id}-pick`} className="rx-select" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                <option value="">Choose a chapter…</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} · {o.region} · {CATEGORY_LABEL[o.category]}
                  </option>
                ))}
              </select>
            </div>
            <WordField
              label="Why does this chapter deserve to be considered? (required)"
              help="The evaluators read this instead of a nomination form."
              value={reason}
              onChange={setReason}
              limit={REASON_WORDS}
              rows={4}
            />
            <div className="rx-row">
              <button type="button" className="rx-btn rx-btn-gilt" disabled={!ready || pending} onClick={() => setConfirm(true)}>
                Add {picked ? picked.name : "chapter"}
              </button>
            </div>
          </>
        )}
        <ResultLine result={confirm ? null : result} />
        {skipped.length > 0 ? (
          <details className="rx-p-fold">
            <summary>
              <span className="rx-small">Why isn&apos;t a chapter listed? ({skipped.length})</span>
            </summary>
            <div className="rx-p-fold-body">
              <ul className="rx-small rx-stack" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
                {skipped.map((s) => (
                  <li key={s.name} style={{ overflowWrap: "anywhere" }}>
                    <strong>{s.name}</strong>: {s.why}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ) : null}
        <ConfirmDialog
          open={confirm}
          title={picked ? `Add ${picked.name} to ${awardTitle}?` : "Add this chapter?"}
          confirmLabel={picked ? `Add ${picked.name}` : "Add"}
          tone="gilt"
          busy={pending}
          onConfirm={add}
          onClose={() => setConfirm(false)}
        >
          <div className="rx-stack" style={{ gap: 8 }}>
            <p className="rx-p-quote rx-small">{reason.trim()}</p>
            <p className="rx-small">
              {layer === "rm" ? "It waits for an NMT member's approval. " : ""}It can&apos;t be undone: the addition stays on
              the record.
            </p>
            <ResultLine result={result} />
          </div>
        </ConfirmDialog>
      </div>
    </details>
  );
}

export type PendingItem = {
  nominationId: string;
  chapterName: string;
  region: string;
  category: Category;
  addedBy: string;
  addedAt: string;
  reason: string;
  blocked: string | null;
};

/** NMT: a Regional Mentor's added chapters waiting for an approval. Decline needs a reason. */
export function PendingApprovals({ evaluatorId, items }: { evaluatorId: string; items: PendingItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rx-stack" aria-label="Waiting for your approval">
      <h3 className="rx-h3">Waiting for your approval ({items.length})</h3>
      {items.map((it) => (
        <PendingRow key={it.nominationId} evaluatorId={evaluatorId} item={it} />
      ))}
    </section>
  );
}

function PendingRow({ evaluatorId, item }: { evaluatorId: string; item: PendingItem }) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function run(kind: "approve" | "decline") {
    setResult(null);
    start(async () => {
      const res =
        kind === "approve"
          ? await approveAddedChapter(evaluatorId, item.nominationId)
          : await declineAddedChapter(evaluatorId, item.nominationId, why);
      setResult(res.success ? { ok: true, text: res.message ?? "Done." } : { ok: false, text: res.error });
      if (res.success) {
        setDeclining(false);
        router.refresh();
      }
    });
  }

  return (
    <article className="rx-plate rx-plate-tight rx-stack" style={{ gap: 8 }}>
      <div className="rx-spread">
        <strong style={{ overflowWrap: "anywhere" }}>{item.chapterName}</strong>
        <span className="rx-small rx-mute">
          {item.region} · {CATEGORY_LABEL[item.category]}
        </span>
      </div>
      <div className="rx-small rx-mute">
        Added by {item.addedBy} · {item.addedAt}
      </div>
      <p className="rx-p-quote rx-small">{item.reason}</p>
      {item.blocked ? (
        <p className="rx-small rx-mute">{item.blocked}</p>
      ) : declining ? (
        <div className="rx-stack" style={{ gap: 8 }}>
          <WordField label="Why are you declining it? (required)" value={why} onChange={setWhy} limit={REASON_WORDS} rows={3} />
          <div className="rx-row" style={{ gap: 8 }}>
            <button type="button" className="rx-btn rx-btn-quiet rx-btn-sm" disabled={pending} onClick={() => setDeclining(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="rx-btn rx-btn-danger rx-btn-sm"
              disabled={pending || why.trim() === "" || countWords(why) > REASON_WORDS}
              onClick={() => run("decline")}
            >
              Decline
            </button>
          </div>
        </div>
      ) : (
        <div className="rx-row" style={{ gap: 8 }}>
          <button type="button" className="rx-btn rx-btn-sm" disabled={pending} onClick={() => run("approve")}>
            Approve
          </button>
          <button type="button" className="rx-btn rx-btn-quiet rx-btn-sm" disabled={pending} onClick={() => setDeclining(true)}>
            Decline…
          </button>
        </div>
      )}
      <ResultLine result={result} />
    </article>
  );
}
