"use client";

import { useState } from "react";
import { assignEvaluator, lookupPerson, removeEvaluator, updateEvaluatorConflicts } from "../../../actions/admin-people";
import { REGIONS } from "@/lib/recognitions/constants";
import { ConfirmDialog, ResultLine } from "../../../_ui/client";
import { useAction } from "../_lib/use-action";

type ChapterLite = { id: string; name: string };
type Found = { id: string; full_name: string; email: string | null; hasLogin: boolean };

function ConflictPicker({
  chapters,
  value,
  onChange,
  idPrefix,
}: {
  chapters: ChapterLite[];
  value: string[];
  onChange: (v: string[]) => void;
  idPrefix: string;
}) {
  const [q, setQ] = useState("");
  const shown = q.trim() ? chapters.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())) : chapters;
  const set = new Set(value);
  return (
    <div className="rx-stack" style={{ gap: 8 }}>
      <input
        className="rx-input"
        placeholder="Find a chapter"
        aria-label="Find a chapter"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="rx-ad-checks">
        {shown.map((c) => (
          <label key={c.id} htmlFor={`${idPrefix}-${c.id}`}>
            <input
              id={`${idPrefix}-${c.id}`}
              type="checkbox"
              className="rx-ad-check"
              checked={set.has(c.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))}
            />
            {c.name}
          </label>
        ))}
        {shown.length === 0 ? <span className="rx-ad-mini">No chapter matches.</span> : null}
      </div>
      <p className="rx-help">
        {value.length} declared. Chapters where they hold any Yi directory role are excluded automatically; tick only extra ones (for example, a
        family member chairs it).
      </p>
    </div>
  );
}

export function AssignEvaluatorForm({ awardId, hasLeader, chapters }: { awardId: string; hasLeader: boolean; chapters: ChapterLite[] }) {
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [layer, setLayer] = useState<"rm" | "nmt">("rm");
  const [region, setRegion] = useState<string>("");
  const [leader, setLeader] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const look = useAction();
  const save = useAction();

  return (
    <div className="rx-stack">
      <form
        className="rx-stack"
        onSubmit={(e) => {
          e.preventDefault();
          setFound(null);
          look.run(() => lookupPerson(email), (r) => {
            if (r.success && r.data) {
              setFound(r.data);
              look.setResult(null);
            }
          });
        }}
      >
        <div>
          <label className="rx-label" htmlFor={`as-email-${awardId}`}>Email in the Yi directory</label>
          <div className="rx-row">
            <input
              id={`as-email-${awardId}`}
              type="email"
              className="rx-input"
              style={{ flex: "1 1 240px" }}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFound(null);
              }}
              placeholder="name@example.com"
              autoComplete="off"
            />
            <button type="submit" className="rx-btn rx-btn-quiet" disabled={look.pending || email.trim() === ""}>
              {look.pending ? "Looking…" : "Find person"}
            </button>
          </div>
        </div>
        <ResultLine result={look.result} />
      </form>

      {found ? (
        <form
          className="rx-stack"
          onSubmit={(e) => {
            e.preventDefault();
            save.run(
              () => assignEvaluator({ awardId, email, layer, region: layer === "rm" ? region : null, isLeader: layer === "nmt" && leader, conflictChapterIds: conflicts }),
              (r) => {
                if (r.success) {
                  setFound(null);
                  setEmail("");
                  setConflicts([]);
                  setLeader(false);
                }
              }
            );
          }}
        >
          <div className="rx-notice rx-notice-ok">
            <strong>{found.full_name}</strong> · {found.email}
            <br />
            {found.hasLogin ? "Has a Yi login." : "No login yet — they can be assigned now, but can't sign in until they have a Yi login."}
          </div>

          <fieldset className="rx-row" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="rx-label">Duty</legend>
            <label className="rx-row" style={{ gap: 8 }}>
              <input type="radio" className="rx-ad-check" name={`layer-${awardId}`} checked={layer === "rm"} onChange={() => setLayer("rm")} />
              Regional Mentor
            </label>
            <label className="rx-row" style={{ gap: 8 }}>
              <input type="radio" className="rx-ad-check" name={`layer-${awardId}`} checked={layer === "nmt"} onChange={() => setLayer("nmt")} />
              NMT
            </label>
          </fieldset>

          {layer === "rm" ? (
            <div style={{ maxWidth: 260 }}>
              <label className="rx-label" htmlFor={`as-region-${awardId}`}>Region</label>
              <select id={`as-region-${awardId}`} className="rx-select" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">Choose a region</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          ) : (
            <label className="rx-row" style={{ gap: 8 }}>
              <input type="checkbox" className="rx-ad-check" checked={leader} disabled={hasLeader} onChange={(e) => setLeader(e.target.checked)} />
              <span>
                NMT leader (moderates Stage 2 and the re-evaluation)
                {hasLeader ? <span className="rx-ad-mini"> — this award already has a leader</span> : null}
              </span>
            </label>
          )}

          <details className="rx-ad-details">
            <summary>Declared conflicts ({conflicts.length})</summary>
            <ConflictPicker chapters={chapters} value={conflicts} onChange={setConflicts} idPrefix={`as-cf-${awardId}`} />
          </details>

          <div>
            <button type="submit" className="rx-btn" disabled={save.pending || (layer === "rm" && region === "")}>
              {save.pending ? "Assigning…" : "Assign duty"}
            </button>
          </div>
        </form>
      ) : null}
      <ResultLine result={save.result} />
    </div>
  );
}

export function DutyActions({
  evaluatorId,
  personName,
  declared,
  chapters,
}: {
  evaluatorId: string;
  personName: string;
  declared: string[];
  chapters: ChapterLite[];
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [value, setValue] = useState<string[]>(declared);
  const { pending, result, run } = useAction();
  return (
    <div className="rx-stack" style={{ gap: 6 }}>
      <div className="rx-row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <button type="button" className="rx-btn rx-btn-quiet rx-btn-sm" onClick={() => setEditOpen(true)}>
          Conflicts
        </button>
        <button type="button" className="rx-btn rx-btn-danger rx-btn-sm" onClick={() => setRemoveOpen(true)}>
          Remove
        </button>
      </div>
      <ResultLine result={result} />
      <ConfirmDialog
        open={removeOpen}
        title={`Remove ${personName}'s duty?`}
        confirmLabel="Remove duty"
        tone="danger"
        busy={pending}
        onClose={() => setRemoveOpen(false)}
        onConfirm={() => run(() => removeEvaluator(evaluatorId), (r) => r.success && setRemoveOpen(false))}
      >
        <p>
          They stop seeing this award. Any scores they already submitted stay on record and still count. Removing someone mid-scoring changes what
          &ldquo;100% submitted&rdquo; means for Stage 2.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={editOpen}
        title={`Declared conflicts for ${personName}`}
        confirmLabel="Save conflicts"
        busy={pending}
        onClose={() => setEditOpen(false)}
        onConfirm={() => run(() => updateEvaluatorConflicts({ evaluatorId, conflictChapterIds: value }), (r) => r.success && setEditOpen(false))}
      >
        <ConflictPicker chapters={chapters} value={value} onChange={setValue} idPrefix={`cf-${evaluatorId}`} />
      </ConfirmDialog>
    </div>
  );
}
