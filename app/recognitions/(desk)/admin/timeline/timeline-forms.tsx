"use client";

import { useState } from "react";
import { createCycle, makeCycleCurrent, updateCycleSettings } from "../../../actions/admin-setup";
import { ConfirmDialog, ResultLine } from "../../../_ui/client";
import { useAction } from "../_lib/use-action";

type Settings = {
  id: string;
  name: string;
  nominationDeadline: string;
  stage1Deadline: string;
  stage2Deadline: string;
  reevaluationDeadline: string;
  weight1: number;
  weight2: number;
  weight3: number;
  layer2Mode: "raw" | "percentile";
  quizOpen: boolean;
};

const DEADLINES: Array<{ key: keyof Settings; label: string; help: string }> = [
  { key: "nominationDeadline", label: "Nomination deadline", help: "Chapters can't submit or edit after this." },
  { key: "stage1Deadline", label: "Stage 1 deadline", help: "RM and NMT scoring locks." },
  { key: "stage2Deadline", label: "Stage 2 deadline", help: "The NMT leader's final rankings lock." },
  { key: "reevaluationDeadline", label: "Re-evaluation deadline", help: "Only used if National Leadership sends an award back." },
];

export function CycleSettingsForm({ cycle }: { cycle: Settings }) {
  const [v, setV] = useState<Settings>(cycle);
  const { pending, result, run } = useAction();
  const sum = Number(v.weight1) + Number(v.weight2) + Number(v.weight3);
  const set = <K extends keyof Settings>(k: K, val: Settings[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      className="rx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          updateCycleSettings({
            cycleId: v.id,
            name: v.name,
            nominationDeadline: v.nominationDeadline,
            stage1Deadline: v.stage1Deadline,
            stage2Deadline: v.stage2Deadline,
            reevaluationDeadline: v.reevaluationDeadline,
            weight1: Number(v.weight1),
            weight2: Number(v.weight2),
            weight3: Number(v.weight3),
            layer2Mode: v.layer2Mode,
            quizOpen: v.quizOpen,
          })
        );
      }}
    >
      <div>
        <label className="rx-label" htmlFor="cy-name">Cycle name</label>
        <input id="cy-name" className="rx-input" value={v.name} onChange={(e) => set("name", e.target.value)} />
      </div>

      <div className="rx-ad-fields">
        {DEADLINES.map((d) => (
          <div key={d.key}>
            <label className="rx-label" htmlFor={`cy-${d.key}`}>{d.label} (IST)</label>
            <input
              id={`cy-${d.key}`}
              type="datetime-local"
              className="rx-input"
              value={String(v[d.key] ?? "")}
              onChange={(e) => set(d.key, e.target.value as never)}
            />
            <p className="rx-help">{d.help} Leave blank if not decided yet.</p>
          </div>
        ))}
      </div>

      <hr className="rx-rule" />
      <div>
        <div className="rx-h3">Weights</div>
        <p className="rx-help">The evaluation matrix sets 50 / 25 / 25. The three must add up to 100.</p>
      </div>
      <div className="rx-ad-fields">
        {(
          [
            ["weight1", "Layer 1 · Health Card"],
            ["weight2", "Layer 2 · Regional Mentors"],
            ["weight3", "Layer 3 · NMT"],
          ] as const
        ).map(([k, label]) => (
          <div key={k}>
            <label className="rx-label" htmlFor={`cy-${k}`}>{label} (%)</label>
            <input
              id={`cy-${k}`}
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              className="rx-input rx-num"
              value={v[k]}
              onChange={(e) => set(k, e.target.value as unknown as number)}
            />
          </div>
        ))}
      </div>
      <p className="rx-small rx-num" style={{ color: sum === 100 ? "var(--rx-laurel)" : "var(--rx-vermilion)", fontWeight: 600 }}>
        Total {sum} / 100{sum === 100 ? "" : " — must be 100"}
      </p>

      <fieldset className="rx-stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rx-h3">How Layer 2 is counted</legend>
        <label className="rx-tile" aria-checked={v.layer2Mode === "raw"}>
          <input type="radio" name="l2mode" className="rx-ad-check" checked={v.layer2Mode === "raw"} onChange={() => set("layer2Mode", "raw")} />
          <span>
            <strong>Raw score</strong> — each chapter&apos;s average RM total out of 25 counts as it is. (Default; the latest matrix doc says nothing more.)
          </span>
        </label>
        <label className="rx-tile" aria-checked={v.layer2Mode === "percentile"}>
          <input type="radio" name="l2mode" className="rx-ad-check" checked={v.layer2Mode === "percentile"} onChange={() => set("layer2Mode", "percentile")} />
          <span>
            <strong>Percentile within region</strong> — each chapter is placed against the other nominees from its own region, so a strict and a lenient RM count the same. (Mail 3 suggested this.)
          </span>
        </label>
      </fieldset>

      <label className="rx-row" style={{ gap: 10 }}>
        <input type="checkbox" className="rx-ad-check" checked={v.quizOpen} onChange={(e) => set("quizOpen", e.target.checked)} />
        <span>Prediction quiz is open for chapters</span>
      </label>

      <div className="rx-row">
        <button type="submit" className="rx-btn" disabled={pending}>
          {pending ? "Saving…" : "Save timeline and weights"}
        </button>
      </div>
      <ResultLine result={result} />
    </form>
  );
}

export function CreateCycleForm({ defaultYear }: { defaultYear: number }) {
  const [name, setName] = useState(`Take Pride ${defaultYear}`);
  const [year, setYear] = useState(String(defaultYear));
  const [makeCurrent, setMakeCurrent] = useState(true);
  const { pending, result, run } = useAction();
  return (
    <form
      className="rx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createCycle({ name, yiYear: Number(year), makeCurrent }));
      }}
    >
      <div className="rx-ad-fields">
        <div>
          <label className="rx-label" htmlFor="nc-name">Name</label>
          <input id="nc-name" className="rx-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="rx-label" htmlFor="nc-year">Yi year</label>
          <input id="nc-year" className="rx-input rx-num" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
      </div>
      <label className="rx-row" style={{ gap: 10 }}>
        <input type="checkbox" className="rx-ad-check" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} />
        <span>Make it the current cycle (the old current cycle stops being current)</span>
      </label>
      <div>
        <button type="submit" className="rx-btn" disabled={pending}>
          {pending ? "Creating…" : "Create cycle"}
        </button>
      </div>
      <ResultLine result={result} />
    </form>
  );
}

export function MakeCurrentButton({ cycleId, name }: { cycleId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const { pending, result, run } = useAction();
  return (
    <>
      <button type="button" className="rx-btn rx-btn-quiet rx-btn-sm" onClick={() => setOpen(true)}>
        Make current
      </button>
      <ResultLine result={result} />
      <ConfirmDialog
        open={open}
        title={`Make ${name} the current cycle?`}
        confirmLabel="Make current"
        busy={pending}
        onClose={() => setOpen(false)}
        onConfirm={() => run(() => makeCycleCurrent(cycleId), (r) => r.success && setOpen(false))}
      >
        <p>Every desk switches to this cycle&apos;s awards and deadlines. The present cycle stays saved and can be made current again.</p>
      </ConfirmDialog>
    </>
  );
}
