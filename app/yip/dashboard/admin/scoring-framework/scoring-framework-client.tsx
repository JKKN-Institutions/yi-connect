"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  TriangleAlert,
  Info,
  Save,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/yip/utils";
import {
  SCORING_FRAMEWORK,
  type FrameworkBucket,
} from "@/lib/yip/scoring-framework";
import {
  upsertScoringBucket,
  deleteScoringBucket,
  type ScoringBucket,
} from "@/app/yip/actions/scoring-buckets";
import { updatePositionBonusConfig } from "@/app/yip/actions/positions";
import { setUseBucketModel } from "@/app/yip/actions/scoring-settings";

// Merit roles in display order (matches the Yi reference table).
const MERIT_ROLES: { key: string; label: string }[] = [
  { key: "prime_minister", label: "Prime Minister" },
  { key: "speaker", label: "Elected Speaker" },
  { key: "deputy_speaker", label: "Elected Deputy Speaker" },
  { key: "leader_of_opposition", label: "Leader of Opposition" },
  { key: "coalition_leader", label: "Coalition Leader" },
  { key: "party_leader", label: "Party Leader" },
  { key: "cabinet_minister", label: "Cabinet Minister" },
  { key: "shadow_minister", label: "Shadow Cabinet Minister" },
  { key: "committee_chair", label: "Committee Chairperson" },
  { key: "committee_drafter", label: "Committee Drafter" },
  { key: "committee_presenter", label: "Committee Presenter" },
  { key: "nominated_speaker", label: "Nominated for Speaker" },
  { key: "mp", label: "No Position (MP)" },
];

// Criteria reference, keyed by bucket_key, from the static spec.
const CRITERIA_BY_KEY: Record<string, FrameworkBucket> = Object.fromEntries(
  SCORING_FRAMEWORK.map((b) => [b.key, b])
);

type Row = ScoringBucket & { _w: string }; // _w = editable weightage string

export function ScoringFrameworkClient({
  initialBuckets,
  initialBonuses,
  initialUseBuckets,
}: {
  initialBuckets: ScoringBucket[];
  initialBonuses: Record<string, number>;
  initialUseBuckets: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(
    initialBuckets.map((b) => ({ ...b, _w: String(b.weightage) }))
  );
  const [useBuckets, setUseBuckets] = useState(initialUseBuckets);
  const [togglingLive, setTogglingLive] = useState(false);
  const [bonuses, setBonuses] = useState<Record<string, string>>(
    Object.fromEntries(
      MERIT_ROLES.map((r) => [r.key, String(initialBonuses[r.key] ?? 0)])
    )
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; text: string; ok: boolean } | null>(null);
  const [savingMerit, setSavingMerit] = useState(false);
  const [meritMsg, setMeritMsg] = useState<string | null>(null);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newWeight, setNewWeight] = useState("");

  const total = useMemo(
    () =>
      rows
        .filter((r) => r.is_active)
        .reduce((s, r) => s + (Number(r._w) || 0), 0),
    [rows]
  );
  const totalOk = total === 100;

  function setRowWeight(key: string, val: string) {
    setRows((prev) => prev.map((r) => (r.bucket_key === key ? { ...r, _w: val } : r)));
  }

  async function saveRow(row: Row) {
    const weightage = Math.round(Number(row._w));
    if (!Number.isFinite(weightage) || weightage < 0 || weightage > 100) {
      setMsg({ key: row.bucket_key, text: "Weightage must be 0–100", ok: false });
      return;
    }
    // Keep merit/jury consistent with the new weightage.
    let merit_max = row.merit_max;
    let jury_max = row.jury_max;
    if (merit_max + jury_max !== weightage) {
      if (merit_max > 0 && row.weightage > 0) {
        merit_max = Math.min(weightage, Math.round((merit_max / row.weightage) * weightage));
        jury_max = weightage - merit_max;
      } else {
        merit_max = 0;
        jury_max = weightage;
      }
    }
    setSavingKey(row.bucket_key);
    setMsg(null);
    const res = await upsertScoringBucket({
      bucket_key: row.bucket_key,
      label: row.label,
      weightage,
      merit_max,
      jury_max,
      day_group: row.day_group,
      display_order: row.display_order,
      session_keys: row.session_keys,
      is_active: row.is_active,
    });
    setSavingKey(null);
    if (res.success) {
      setRows((prev) =>
        prev.map((r) =>
          r.bucket_key === row.bucket_key
            ? { ...r, ...res.data, _w: String(res.data.weightage) }
            : r
        )
      );
      setMsg({ key: row.bucket_key, text: "Saved", ok: true });
    } else {
      setMsg({ key: row.bucket_key, text: res.error, ok: false });
    }
  }

  async function removeRow(row: Row) {
    if (!confirm(`Remove "${row.label}" from the scoring model?`)) return;
    setSavingKey(row.bucket_key);
    const res = await deleteScoringBucket(row.bucket_key);
    setSavingKey(null);
    if (res.success) {
      setRows((prev) => prev.filter((r) => r.bucket_key !== row.bucket_key));
    } else {
      setMsg({ key: row.bucket_key, text: res.error, ok: false });
    }
  }

  async function addRow() {
    const label = newLabel.trim();
    const weightage = Math.round(Number(newWeight));
    if (label.length < 2) {
      setMsg({ key: "__new__", text: "Name too short", ok: false });
      return;
    }
    if (!Number.isFinite(weightage) || weightage < 0) {
      setMsg({ key: "__new__", text: "Weightage must be a number", ok: false });
      return;
    }
    const bucket_key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `bucket_${rows.length + 1}`;
    setSavingKey("__new__");
    const res = await upsertScoringBucket({
      bucket_key,
      label,
      weightage,
      merit_max: 0,
      jury_max: weightage,
      day_group: null,
      display_order: rows.length + 1,
      session_keys: [],
      is_active: true,
    });
    setSavingKey(null);
    if (res.success) {
      setRows((prev) => [...prev, { ...res.data, _w: String(res.data.weightage) }]);
      setNewLabel("");
      setNewWeight("");
      setAdding(false);
    } else {
      setMsg({ key: "__new__", text: res.error, ok: false });
    }
  }

  async function saveMerit() {
    setSavingMerit(true);
    setMeritMsg(null);
    const payload: Record<string, number> = {};
    for (const r of MERIT_ROLES) payload[r.key] = Number(bonuses[r.key]) || 0;
    const res = await updatePositionBonusConfig(payload);
    setSavingMerit(false);
    setMeritMsg(res.success ? "Merit points saved" : res.error);
  }

  async function toggleLive() {
    const target = !useBuckets;
    if (
      target &&
      !confirm(
        "Switch LIVE scoring to this framework? All result computations will use these 7 buckets. You can switch back anytime."
      )
    )
      return;
    setTogglingLive(true);
    const res = await setUseBucketModel(target);
    setTogglingLive(false);
    if (res.success) setUseBuckets(target);
    else alert(res.error);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <h1 className="text-2xl font-bold text-[#1a1a3e]">Scoring Framework</h1>
      <p className="mt-1 max-w-3xl text-sm text-[#1a1a3e]/60">
        The configurable final scoring model. Edit each component&apos;s weightage and the
        running total below — it should add up to your target (100). Changes here are the
        live source of truth for scoring (the results engine reads this). Per-session jury
        criteria are shown for reference; edit those on the <strong>Session Scoring</strong> tab.
      </p>

      {/* Live cutover toggle */}
      <div
        className={cn(
          "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
          useBuckets
            ? "border-emerald-200 bg-emerald-50"
            : "border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.02]"
        )}
      >
        <div className="text-sm">
          <span className="font-semibold text-[#1a1a3e]">Live scoring source: </span>
          {useBuckets ? (
            <span className="font-semibold text-emerald-700">This framework (7 buckets / 100)</span>
          ) : (
            <span className="text-[#1a1a3e]/60">Legacy per-session model</span>
          )}
          <p className="mt-0.5 text-xs text-[#1a1a3e]/50">
            {useBuckets
              ? "Result computations use these buckets."
              : "This framework is editable but not yet driving live scores."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleLive}
          disabled={togglingLive}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50",
            useBuckets ? "bg-[#1a1a3e]" : "bg-[#FF9933]"
          )}
        >
          {togglingLive
            ? "Switching…"
            : useBuckets
              ? "Switch back to legacy"
              : "Use this framework for live scoring"}
        </button>
      </div>

      {/* Editable summary table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-[#1a1a3e]/10 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a3e]/10 bg-[#1a1a3e]/[0.02] text-left text-xs uppercase tracking-wide text-[#1a1a3e]/45">
              <th className="px-4 py-2.5 font-semibold">#</th>
              <th className="px-4 py-2.5 font-semibold">Component</th>
              <th className="px-4 py-2.5 text-center font-semibold">Day</th>
              <th className="px-4 py-2.5 text-center font-semibold">Weightage</th>
              <th className="px-4 py-2.5 text-right font-semibold">Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const dirty = String(row.weightage) !== row._w;
              return (
                <tr key={row.bucket_key} className="border-b border-[#1a1a3e]/5">
                  <td className="px-4 py-2.5 text-[#1a1a3e]/40">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-[#1a1a3e]">{row.label}</span>
                    {row.merit_max > 0 && (
                      <span className="ml-2 rounded-full bg-[#FF9933]/10 px-2 py-0.5 text-[11px] font-medium text-[#FF9933]">
                        {row.merit_max} merit + {row.jury_max} jury
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-[#1a1a3e]/50">
                    {row.day_group ? `Day ${row.day_group}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={row._w}
                      onChange={(e) => setRowWeight(row.bucket_key, e.target.value)}
                      className={cn(
                        "w-16 rounded-lg border px-2 py-1 text-center text-sm tabular-nums focus:outline-none focus:ring-2",
                        dirty
                          ? "border-[#FF9933] focus:ring-[#FF9933]/30"
                          : "border-[#1a1a3e]/15 focus:ring-[#1a1a3e]/20"
                      )}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {msg && msg.key === row.bucket_key && (
                        <span
                          className={cn(
                            "mr-1 text-[11px]",
                            msg.ok ? "text-emerald-600" : "text-red-600"
                          )}
                        >
                          {msg.text}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => saveRow(row)}
                        disabled={savingKey === row.bucket_key || !dirty}
                        className="rounded-lg bg-[#1a1a3e] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-30"
                        title="Save weightage"
                      >
                        {savingKey === row.bucket_key ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Save className="size-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row)}
                        disabled={savingKey === row.bucket_key}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        title="Remove component"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-[#1a1a3e]/[0.02]">
              <td className="px-4 py-3" />
              <td className="px-4 py-3 font-bold text-[#1a1a3e]">TOTAL</td>
              <td />
              <td
                className={cn(
                  "px-4 py-3 text-center text-lg font-bold tabular-nums",
                  totalOk ? "text-emerald-600" : "text-red-600"
                )}
              >
                {total}
              </td>
              <td className="px-4 py-3 text-right">
                {totalOk ? (
                  <CircleCheck className="ml-auto size-4 text-emerald-600" />
                ) : (
                  <TriangleAlert className="ml-auto size-4 text-red-600" />
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!totalOk && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
          <TriangleAlert className="size-3.5" />
          Active components add up to {total}, not 100. Adjust the weightages so they total 100.
        </p>
      )}

      {/* Add component */}
      <div className="mt-3">
        {adding ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#1a1a3e]/10 bg-white p-3">
            <input
              placeholder="Component name"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1 rounded-lg border border-[#1a1a3e]/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a3e]/20"
            />
            <input
              type="number"
              placeholder="Wt"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              className="w-20 rounded-lg border border-[#1a1a3e]/15 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a3e]/20"
            />
            <button
              type="button"
              onClick={addRow}
              disabled={savingKey === "__new__"}
              className="rounded-lg bg-[#FF9933] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {savingKey === "__new__" ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-[#1a1a3e]/60"
            >
              Cancel
            </button>
            {msg && msg.key === "__new__" && !msg.ok && (
              <span className="text-[11px] text-red-600">{msg.text}</span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#1a1a3e]/20 px-3 py-2 text-xs font-medium text-[#1a1a3e]/60 hover:border-[#1a1a3e]/40 hover:text-[#1a1a3e]"
          >
            <Plus className="size-3.5" /> Add component
          </button>
        )}
      </div>

      {/* Merit table (Leadership & Positions) */}
      <div className="mt-7 rounded-xl border border-[#1a1a3e]/10 bg-white shadow-sm">
        <div className="border-b border-[#1a1a3e]/5 px-4 py-3">
          <h2 className="font-semibold text-[#1a1a3e]">Position merit points (Leadership)</h2>
          <p className="mt-0.5 text-xs text-[#1a1a3e]/55">
            Auto-awarded points for securing a role — the merit half of Leadership &amp; Positions.
            Capped at the bucket&apos;s merit share.
          </p>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {MERIT_ROLES.map((r) => (
            <label key={r.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-[#1a1a3e]/70">{r.label}</span>
              <input
                type="number"
                min={0}
                value={bonuses[r.key] ?? "0"}
                onChange={(e) =>
                  setBonuses((prev) => ({ ...prev, [r.key]: e.target.value }))
                }
                className="w-16 rounded-lg border border-[#1a1a3e]/15 px-2 py-1 text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1a1a3e]/20"
              />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-[#1a1a3e]/5 px-4 py-3">
          <button
            type="button"
            onClick={saveMerit}
            disabled={savingMerit}
            className="flex items-center gap-1.5 rounded-lg bg-[#1a1a3e] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {savingMerit ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save merit points
          </button>
          {meritMsg && <span className="text-xs text-[#1a1a3e]/60">{meritMsg}</span>}
        </div>
      </div>

      {/* Criteria reference (read-only, from spec) */}
      <h2 className="mb-2 mt-7 text-sm font-semibold uppercase tracking-wide text-[#1a1a3e]/45">
        Jury criteria per component (reference)
      </h2>
      <div className="space-y-2">
        {rows.map((row) => {
          const ref = CRITERIA_BY_KEY[row.bucket_key];
          if (!ref) return null;
          const open = openRef === row.bucket_key;
          return (
            <div key={row.bucket_key} className="rounded-xl border border-[#1a1a3e]/10 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setOpenRef(open ? null : row.bucket_key)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm"
              >
                {open ? (
                  <ChevronDown className="size-4 text-[#1a1a3e]/40" />
                ) : (
                  <ChevronRight className="size-4 text-[#1a1a3e]/40" />
                )}
                <span className="flex-1 font-medium text-[#1a1a3e]">{row.label}</span>
                <span className="text-xs text-[#1a1a3e]/40">
                  {ref.sessions.length} session{ref.sessions.length !== 1 ? "s" : ""}
                </span>
              </button>
              {open && (
                <div className="border-t border-[#1a1a3e]/5 px-4 py-3 pl-10">
                  {ref.note && (
                    <p className="mb-2 flex gap-1.5 text-xs text-[#1a1a3e]/55">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      {ref.note}
                    </p>
                  )}
                  {ref.sessions.map((s, si) => (
                    <div key={si} className="mb-2 last:mb-0">
                      <p className="text-xs font-medium text-[#1a1a3e]">{s.name}</p>
                      <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
                        {s.criteria.map((c, ci) => (
                          <li key={ci} className="flex gap-1.5 text-xs text-[#1a1a3e]/65">
                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#FF9933]/60" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
