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
import {
  updatePositionBonusConfig,
  upsertPositionBonusScope,
  deletePositionBonusScope,
  type PositionBonusScope,
} from "@/app/yip/actions/positions";
import { setUseBucketModel } from "@/app/yip/actions/scoring-settings";
import {
  ROUND_LEVELS,
  ROUND_LEVEL_LABELS,
  describeRoundLevels,
  type RoundLevel,
} from "@/lib/yip/round-level";

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
  initialBonusScopes,
}: {
  initialBuckets: ScoringBucket[];
  initialBonuses: Record<string, number>;
  initialUseBuckets: boolean;
  initialBonusScopes: PositionBonusScope[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initialBuckets.map((b) => ({ ...b, _w: String(b.weightage) }))
  );
  const [useBuckets, setUseBuckets] = useState(initialUseBuckets);
  const [togglingLive, setTogglingLive] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; text: string; ok: boolean } | null>(null);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newWeight, setNewWeight] = useState("");
  // Which rounds a newly added component applies to. Empty = every round,
  // which is what every component meant before this control existed.
  const [newLevels, setNewLevels] = useState<RoundLevel[]>([]);
  const [levelFilter, setLevelFilter] = useState<"all" | RoundLevel>("all");

  // ── Merit points, per round-level scope ──
  // meritScope is which merit table is on screen: "*" is the shared one held in
  // yip.position_bonus_config, a level is a row of position_bonus_config_levels.
  const [scopes, setScopes] = useState<PositionBonusScope[]>(initialBonusScopes);
  const [meritScope, setMeritScope] = useState<"*" | RoundLevel>("*");
  const [bonuses, setBonuses] = useState<Record<string, string>>(
    Object.fromEntries(
      MERIT_ROLES.map((r) => [r.key, String(initialBonuses[r.key] ?? 0)])
    )
  );
  const [savingMerit, setSavingMerit] = useState(false);
  const [meritMsg, setMeritMsg] = useState<string | null>(null);

  // The saved row backing the scope on screen, if there is one yet.
  const activeScopeRow =
    meritScope === "*"
      ? null
      : scopes.find((s) => s.levels.includes(meritScope)) ?? null;

  function showMeritScope(next: "*" | RoundLevel) {
    setMeritScope(next);
    setMeritMsg(null);
    const row = next === "*" ? null : scopes.find((s) => s.levels.includes(next));
    // No row yet for this level: pre-fill from the shared table, so an admin
    // starts from a full copy and edits down. Resolution never merges the two,
    // so a half-filled scoped table would score every unlisted role 0.
    const source = row ? row.bonuses : initialBonuses;
    setBonuses(
      Object.fromEntries(MERIT_ROLES.map((r) => [r.key, String(source[r.key] ?? 0)]))
    );
  }

  function toggleNewLevel(l: RoundLevel) {
    setNewLevels((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
  }

  // Grouped by the rounds each component applies to, so a growing model stays
  // legible: the shared components first, then each level's own set. The
  // weightages must total 100 WITHIN a scope, because the engine uses one tier
  // or the other and never mixes them.
  const visible = useMemo(
    () =>
      levelFilter === "all"
        ? rows
        : rows.filter(
            (r) => !r.levels?.length || r.levels.includes(levelFilter)
          ),
    [rows, levelFilter]
  );

  const groups = useMemo(
    () =>
      [
        {
          key: "*",
          title: "Every round",
          rows: visible.filter((r) => !r.levels?.length),
        },
        ...ROUND_LEVELS.map((l) => ({
          key: l as string,
          title: `${ROUND_LEVEL_LABELS[l]} rounds only`,
          rows: visible.filter((r) => r.levels?.length === 1 && r.levels[0] === l),
        })),
        {
          key: "multi",
          title: "Shared by some rounds",
          rows: visible.filter((r) => (r.levels?.length ?? 0) > 1),
        },
      ].filter((g) => g.rows.length > 0),
    [visible]
  );

  const groupTotal = (gr: Row[]) =>
    gr.filter((r) => r.is_active).reduce((s, r) => s + (Number(r._w) || 0), 0);

  function setRowWeight(id: string, val: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, _w: val } : r)));
  }

  async function saveRow(row: Row) {
    const weightage = Math.round(Number(row._w));
    if (!Number.isFinite(weightage) || weightage < 0 || weightage > 100) {
      setMsg({ key: row.id, text: "Weightage must be 0–100", ok: false });
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
    setSavingKey(row.id);
    setMsg(null);
    const res = await upsertScoringBucket({
      // Identity is the row id: a bucket_key may now be held by a shared
      // component AND a level-scoped one.
      id: row.id,
      bucket_key: row.bucket_key,
      label: row.label,
      weightage,
      merit_max,
      jury_max,
      day_group: row.day_group,
      display_order: row.display_order,
      session_keys: row.session_keys,
      is_active: row.is_active,
      levels: row.levels ?? [],
    });
    setSavingKey(null);
    if (res.success) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, ...res.data, _w: String(res.data.weightage) } : r
        )
      );
      setMsg({ key: row.id, text: "Saved", ok: true });
    } else {
      setMsg({ key: row.id, text: res.error, ok: false });
    }
  }

  // Change which rounds one component applies to. Saves immediately, so the
  // grouping below always reflects what the engine would resolve.
  async function setRowLevels(row: Row, levels: RoundLevel[]) {
    setSavingKey(row.id);
    setMsg(null);
    const res = await upsertScoringBucket({
      id: row.id,
      bucket_key: row.bucket_key,
      label: row.label,
      weightage: row.weightage,
      merit_max: row.merit_max,
      jury_max: row.jury_max,
      day_group: row.day_group,
      display_order: row.display_order,
      session_keys: row.session_keys,
      is_active: row.is_active,
      levels,
    });
    setSavingKey(null);
    if (res.success) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, ...res.data, _w: String(res.data.weightage) } : r
        )
      );
      setMsg({ key: row.id, text: "Saved", ok: true });
    } else {
      setMsg({ key: row.id, text: res.error, ok: false });
    }
  }

  async function removeRow(row: Row) {
    if (
      !confirm(
        `Remove "${row.label}" (${describeRoundLevels(row.levels)}) from the scoring model?`
      )
    )
      return;
    setSavingKey(row.id);
    const res = await deleteScoringBucket(row.id);
    setSavingKey(null);
    if (res.success) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } else {
      setMsg({ key: row.id, text: res.error, ok: false });
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
      levels: newLevels,
    });
    setSavingKey(null);
    if (res.success) {
      setRows((prev) => [...prev, { ...res.data, _w: String(res.data.weightage) }]);
      setNewLabel("");
      setNewWeight("");
      setNewLevels([]);
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

    if (meritScope === "*") {
      const res = await updatePositionBonusConfig(payload);
      setSavingMerit(false);
      setMeritMsg(res.success ? "Shared merit points saved" : res.error);
      return;
    }

    const res = await upsertPositionBonusScope({
      id: activeScopeRow?.id,
      levels: [meritScope],
      bonuses: payload,
    });
    setSavingMerit(false);
    if (res.success) {
      setScopes((prev) => {
        const rest = prev.filter((s) => s.id !== res.data.id);
        return [...rest, res.data];
      });
      setMeritMsg(`${ROUND_LEVEL_LABELS[meritScope]} merit points saved`);
    } else {
      setMeritMsg(res.error);
    }
  }

  // Drop a level's own merit table; those rounds go back to the shared one.
  async function removeMeritScope() {
    if (!activeScopeRow) return;
    if (
      !confirm(
        `Remove the ${describeRoundLevels(
          activeScopeRow.levels
        )} merit points? Those rounds go back to the shared merit points.`
      )
    )
      return;
    setSavingMerit(true);
    const res = await deletePositionBonusScope(activeScopeRow.id);
    setSavingMerit(false);
    if (res.success) {
      setScopes((prev) => prev.filter((s) => s.id !== activeScopeRow.id));
      setBonuses(
        Object.fromEntries(
          MERIT_ROLES.map((r) => [r.key, String(initialBonuses[r.key] ?? 0)])
        )
      );
      setMeritMsg("Removed — these rounds now use the shared merit points");
    } else {
      setMeritMsg(res.error);
    }
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

      {/* Which rounds to show */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[#1a1a3e]/50">
          Show components used by
        </span>
        {(["all", ...ROUND_LEVELS] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setLevelFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              levelFilter === f
                ? "border-[#1a1a3e] bg-[#1a1a3e] text-white"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            )}
          >
            {f === "all" ? "All rounds" : `${ROUND_LEVEL_LABELS[f]} rounds`}
          </button>
        ))}
      </div>

      {/* Editable summary tables, one per scope. The weightages must total 100
          WITHIN a scope: the engine uses the level-scoped set or the shared set,
          never a mixture of the two. */}
      {groups.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
          {rows.length === 0
            ? "No components yet. Click “Add component” to create one."
            : "No components apply to those rounds yet. Components marked “Every round” apply here too."}
        </div>
      )}
      {groups.map((g) => {
      const total = groupTotal(g.rows);
      const totalOk = total === 100;
      return (
      <div key={g.key} className="mt-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1a1a3e]/40">
        {g.title}{" "}
        <span className="font-normal normal-case tracking-normal">
          ({g.rows.length})
        </span>
      </h2>
      <div className="overflow-hidden rounded-xl border border-[#1a1a3e]/10 bg-white shadow-sm">
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
            {g.rows.map((row, i) => {
              const dirty = String(row.weightage) !== row._w;
              return (
                <tr key={row.id} className="border-b border-[#1a1a3e]/5">
                  <td className="px-4 py-2.5 text-[#1a1a3e]/40">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-[#1a1a3e]">{row.label}</span>
                    {row.merit_max > 0 && (
                      <span className="ml-2 rounded-full bg-[#FF9933]/10 px-2 py-0.5 text-[11px] font-medium text-[#FF9933]">
                        {row.merit_max} merit + {row.jury_max} jury
                      </span>
                    )}
                    {/* Scope badge + the control that changes it. */}
                    <span
                      className={cn(
                        "ml-2 rounded px-1.5 py-0.5 align-middle text-[10px] font-medium",
                        row.levels?.length
                          ? "bg-[#FF9933]/10 text-[#B35C00]"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {describeRoundLevels(row.levels)}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-[#1a1a3e]/40">Applies to</span>
                      <button
                        type="button"
                        disabled={savingKey === row.id}
                        onClick={() => setRowLevels(row, [])}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium disabled:opacity-40",
                          !row.levels?.length
                            ? "border-[#FF9933] bg-[#FF9933]/10 text-[#B35C00]"
                            : "border-gray-300 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        Every round
                      </button>
                      {ROUND_LEVELS.map((l) => {
                        const on = row.levels?.includes(l) ?? false;
                        return (
                          <button
                            key={l}
                            type="button"
                            disabled={savingKey === row.id}
                            onClick={() =>
                              setRowLevels(
                                row,
                                on
                                  ? (row.levels ?? []).filter((x) => x !== l)
                                  : [...(row.levels ?? []), l]
                              )
                            }
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-medium disabled:opacity-40",
                              on
                                ? "border-[#1a1a3e] bg-[#1a1a3e]/5 text-[#1a1a3e]"
                                : "border-gray-300 text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            {ROUND_LEVEL_LABELS[l]}
                          </button>
                        );
                      })}
                    </span>
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
                      onChange={(e) => setRowWeight(row.id, e.target.value)}
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
                      {msg && msg.key === row.id && (
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
                        disabled={savingKey === row.id || !dirty}
                        className="rounded-lg bg-[#1a1a3e] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-30"
                        title="Save weightage"
                      >
                        {savingKey === row.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Save className="size-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row)}
                        disabled={savingKey === row.id}
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
          Active components in “{g.title}” add up to {total}, not 100. Adjust the
          weightages so they total 100.
        </p>
      )}
      </div>
      );
      })}

      {/* Add component */}
      <div className="mt-3">
        {adding ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#1a1a3e]/10 bg-white p-3">
            {/* Round-level scope. Nothing selected = applies everywhere, which
                is what every component meant before this control existed. */}
            <div className="w-full">
              <p className="text-xs font-medium text-[#1a1a3e]/70">Applies to</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewLevels([])}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    newLevels.length === 0
                      ? "border-[#FF9933] bg-[#FF9933]/10 text-[#B35C00]"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  Every round
                </button>
                {ROUND_LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleNewLevel(l)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      newLevels.includes(l)
                        ? "border-[#1a1a3e] bg-[#1a1a3e]/5 text-[#1a1a3e]"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {ROUND_LEVEL_LABELS[l]}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-[#1a1a3e]/50">
                {newLevels.length === 0
                  ? "Used by chapter, regional and national rounds alike."
                  : `Used only by ${describeRoundLevels(newLevels)} rounds. Those rounds then use their OWN set of components — the shared ones are not added to it — so that set must total 100 on its own.`}
              </p>
            </div>
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

          {/* Which rounds these merit points are for. Regional rounds have roles
              chapter rounds do not (Deputy Minister, Parliamentary
              Administrator, Parliamentary Journalist), so each level can hold
              its own complete merit table. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[#1a1a3e]/50">Merit points for</span>
            {(["*", ...ROUND_LEVELS] as const).map((s) => {
              const has = s === "*" || scopes.some((x) => x.levels.includes(s));
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => showMeritScope(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    meritScope === s
                      ? "border-[#1a1a3e] bg-[#1a1a3e] text-white"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {s === "*" ? "Every round" : `${ROUND_LEVEL_LABELS[s]} rounds`}
                  {s !== "*" && !has && (
                    <span className="ml-1 opacity-60">(shared)</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-[#1a1a3e]/50">
            {meritScope === "*"
              ? "The shared merit points. Every round uses these unless it has its own set below."
              : activeScopeRow
                ? `${ROUND_LEVEL_LABELS[meritScope]} rounds use THESE points instead of the shared ones — the two are never added together, so anything left at 0 here is worth 0 at this level.`
                : `${ROUND_LEVEL_LABELS[meritScope]} rounds currently use the shared points. The values below are a copy of them — save to give this level its own set.`}
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
            {meritScope === "*"
              ? "Save shared merit points"
              : activeScopeRow
                ? `Save ${ROUND_LEVEL_LABELS[meritScope]} merit points`
                : `Create ${ROUND_LEVEL_LABELS[meritScope]} merit points`}
          </button>
          {activeScopeRow && (
            <button
              type="button"
              onClick={removeMeritScope}
              disabled={savingMerit}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Use shared points instead
            </button>
          )}
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
          const open = openRef === row.id;
          return (
            <div key={row.id} className="rounded-xl border border-[#1a1a3e]/10 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setOpenRef(open ? null : row.id)}
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
