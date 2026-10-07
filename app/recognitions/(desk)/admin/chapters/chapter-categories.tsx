"use client";

import { useMemo, useState } from "react";
import { pasteChapterCategories, saveChapterCategories } from "../../../actions/admin-people";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/recognitions/constants";
import { ResultLine } from "../../../_ui/client";
import { useAction } from "../_lib/use-action";

type Row = { id: string; name: string; region: string | null; category: Category | null };

export function CategoryTable({ rows }: { rows: Row[] }) {
  const [draft, setDraft] = useState<Record<string, Category | null>>({});
  const [filter, setFilter] = useState("");
  const { pending, result, run } = useAction();

  const changed = Object.entries(draft).filter(([id, c]) => rows.find((r) => r.id === id)?.category !== c);
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? rows.filter((r) => r.name.toLowerCase().includes(f) || (r.region ?? "").toLowerCase() === f) : rows;
  }, [rows, filter]);

  return (
    <section className="rx-stack">
      <div className="rx-spread">
        <h2 className="rx-h2">All active chapters</h2>
        <input
          className="rx-input"
          style={{ maxWidth: 260 }}
          placeholder="Find a chapter or region"
          aria-label="Find a chapter or region"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="rx-ledger-wrap">
        <table className="rx-ledger">
          <thead>
            <tr>
              <th>Chapter</th>
              <th>Region</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const value = r.id in draft ? draft[r.id] : r.category;
              const dirty = r.id in draft && draft[r.id] !== r.category;
              return (
                <tr key={r.id}>
                  <td>
                    {r.name}
                    {dirty ? <span className="rx-ad-mini"> · unsaved</span> : null}
                  </td>
                  <td className="rx-num">{r.region ?? "—"}</td>
                  <td>
                    <select
                      className="rx-select rx-ad-select-sm"
                      aria-label={`Category for ${r.name}`}
                      value={value ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.id]: (e.target.value || null) as Category | null }))}
                    >
                      <option value="">—</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={3} className="rx-mute">No chapter matches &ldquo;{filter}&rdquo;.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="rx-row" style={{ position: "sticky", bottom: 0, background: "var(--rx-paper)", padding: "10px 0" }}>
        <button
          type="button"
          className="rx-btn"
          disabled={pending || changed.length === 0}
          onClick={() =>
            run(
              () => saveChapterCategories(changed.map(([chapterId, category]) => ({ chapterId, category }))),
              (r) => r.success && setDraft({})
            )
          }
        >
          {pending ? "Saving…" : changed.length ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "No changes to save"}
        </button>
        <ResultLine result={result} />
      </div>
    </section>
  );
}

export function PasteCategories() {
  const [text, setText] = useState("");
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const { pending, result, run } = useAction();
  return (
    <div className="rx-stack">
      <div>
        <label className="rx-label" htmlFor="paste-cats">One chapter per line: chapter name, category</label>
        <textarea
          id="paste-cats"
          className="rx-textarea"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Erode, Pioneers\nSiliguri, Trailblazers\nMysuru, Sparks"}
        />
        <p className="rx-help">Names match ignoring capitals. A tab works instead of the comma, so you can paste two columns from Excel.</p>
      </div>
      <div>
        <button
          type="button"
          className="rx-btn"
          disabled={pending || text.trim() === ""}
          onClick={() =>
            run(
              () => pasteChapterCategories(text),
              (r) => {
                setUnmatched(r.success ? r.data?.unmatched ?? [] : []);
                if (r.success && (r.data?.unmatched.length ?? 0) === 0) setText("");
              }
            )
          }
        >
          {pending ? "Saving…" : "Save pasted categories"}
        </button>
      </div>
      <ResultLine result={result} />
      {unmatched.length > 0 ? (
        <div className="rx-notice rx-notice-alert">
          <strong>These lines were not saved:</strong>
          <ul style={{ margin: "6px 0 0 18px" }}>
            {unmatched.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
