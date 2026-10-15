"use client";

import { useState } from "react";
import { saveHealthCardMeasure } from "../../../actions/admin-content";
import { ResultLine } from "../../../_ui/client";
import { useAction } from "../_lib/use-action";

type Measure = {
  key: string;
  label: string;
  definition: string;
  indicators: string;
  purpose: string;
  impact: string;
  weight: number;
};
type Table = { key: "A" | "B"; title: string; measures: Measure[] };

/**
 * The wording of each Health Card measure, separately for table A and
 * table B (e.g. "Stakeholder Engagement" in B vs "Project Engagement" in A).
 * Evaluators see this text when they tap a measure on their sheet. Weights
 * and scores are not edited here.
 */
export function MeasureEditor({ tables }: { tables: Table[] }) {
  const [active, setActive] = useState<"A" | "B">("A");
  const table = tables.find((t) => t.key === active) ?? tables[0];
  return (
    <section className="rx-stack" aria-labelledby="hc-measures-h">
      <div>
        <h2 className="rx-h2" id="hc-measures-h">Measure wording</h2>
        <p className="rx-small rx-mute">
          What Regional Mentors and the NMT read when they tap a measure on their scoring sheet. Each table has its own wording.
        </p>
      </div>
      <nav className="rx-ad-chips" aria-label="Health Card tables">
        {tables.map((t) => (
          <button
            key={t.key}
            type="button"
            className="rx-ad-chip"
            aria-current={t.key === active ? "page" : undefined}
            onClick={() => setActive(t.key)}
          >
            Table {t.key} · {t.title}
          </button>
        ))}
      </nav>
      {table.measures.length === 0 ? (
        <p className="rx-notice rx-notice-alert">Table {table.key} has no measures set up for this cycle.</p>
      ) : (
        table.measures.map((m) => <MeasureForm key={`${table.key}-${m.key}`} tableKey={table.key} m={m} />)
      )}
    </section>
  );
}

function MeasureForm({ tableKey, m }: { tableKey: "A" | "B"; m: Measure }) {
  const [label, setLabel] = useState(m.label);
  const [definition, setDefinition] = useState(m.definition);
  const [indicators, setIndicators] = useState(m.indicators);
  const [purpose, setPurpose] = useState(m.purpose);
  const [impact, setImpact] = useState(m.impact);
  const { pending, result, run } = useAction();
  const id = `hcm-${tableKey}-${m.key}`;

  return (
    <details className="rx-plate rx-ad-details" data-measure={`${tableKey}:${m.key}`}>
      <summary>
        <strong>{m.label}</strong> <span className="rx-ad-mini">· weight {m.weight}% of Layer 1</span>
      </summary>
      <form
        className="rx-stack"
        style={{ marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveHealthCardMeasure({ tableKey, measureKey: m.key, label, definition, indicators, purpose, impact }));
        }}
      >
        <div>
          <label className="rx-label" htmlFor={`${id}-label`}>Measure name</label>
          <input id={`${id}-label`} className="rx-input" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="rx-label" htmlFor={`${id}-def`}>Definition</label>
          <textarea id={`${id}-def`} className="rx-textarea" rows={2} value={definition} onChange={(e) => setDefinition(e.target.value)} />
        </div>
        <div>
          <label className="rx-label" htmlFor={`${id}-ind`}>Indicators (one per line)</label>
          <textarea id={`${id}-ind`} className="rx-textarea" rows={4} value={indicators} onChange={(e) => setIndicators(e.target.value)} />
        </div>
        <div>
          <label className="rx-label" htmlFor={`${id}-pur`}>Purpose</label>
          <textarea id={`${id}-pur`} className="rx-textarea" rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>
        <div>
          <label className="rx-label" htmlFor={`${id}-imp`}>Impact (one per line)</label>
          <textarea id={`${id}-imp`} className="rx-textarea" rows={3} value={impact} onChange={(e) => setImpact(e.target.value)} />
        </div>
        <div>
          <button type="submit" className="rx-btn" disabled={pending || label.trim() === ""}>
            {pending ? "Saving…" : "Save this measure"}
          </button>
        </div>
        <ResultLine result={result} />
      </form>
    </details>
  );
}
