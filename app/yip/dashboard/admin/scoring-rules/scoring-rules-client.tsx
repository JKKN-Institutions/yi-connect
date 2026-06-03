"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateScoringSettings,
  type ScoringSettings,
  type AggregationMethod,
} from "@/app/yip/actions/scoring-settings";
import {
  updateScoringFlagsConfig,
  type FlagDeltas,
} from "@/app/yip/actions/scoring-flags";
import { updatePositionBonusConfig } from "@/app/yip/actions/positions";
import { Save, Loader2, Scale, AlertTriangle, Award, Check } from "lucide-react";

const FLAG_LABELS: { key: keyof FlagDeltas; label: string }[] = [
  { key: "no_confidence_brought", label: "No-Confidence Motion brought" },
  { key: "walkout", label: "Walkout" },
  { key: "ruckus", label: "Ruckus" },
  { key: "suspension", label: "Suspension" },
];

const ROLE_LABELS: { key: string; label: string }[] = [
  { key: "prime_minister", label: "Prime Minister" },
  { key: "speaker", label: "Speaker (elected)" },
  { key: "nominated_speaker", label: "Nominated for Speaker" },
  { key: "deputy_speaker", label: "Deputy Speaker" },
  { key: "leader_of_opposition", label: "Leader of Opposition" },
  { key: "cabinet_minister", label: "Cabinet Minister" },
  { key: "shadow_minister", label: "Shadow Minister" },
  { key: "party_leader", label: "Party Leader" },
  { key: "coalition_leader", label: "Coalition Leader" },
  { key: "committee_chair", label: "Committee Chairperson" },
  { key: "mp", label: "Member of Parliament" },
];

const METHOD_LABELS: { value: AggregationMethod; label: string; hint: string }[] = [
  {
    value: "weighted_average",
    label: "Weighted average per session",
    hint: "Each session's score is weighted by its session weight, then averaged.",
  },
  {
    value: "average",
    label: "Simple average across sessions",
    hint: "Every session counts equally.",
  },
  {
    value: "best_n",
    label: "Best-N sessions",
    hint: "Average only a delegate's top-N session scores.",
  },
  {
    value: "sum",
    label: "Sum — additive total",
    hint: "Adds each component's score to a total out of 100. A session a delegate wasn't scored in counts as 0.",
  },
  {
    value: "weighted_90",
    label: "Weighted average → /90 + Position /10 (Yi 2026 Workbook)",
    hint: "Scores a delegate only on the sessions they took part in: (sum of component scores ÷ sum of those components' maxes) × 90, then Position Points add up to 10 on top. A delegate strong in 3 sessions isn't capped by the ones they missed.",
  },
];

function Saved({ msg }: { msg: string | null }) {
  if (!msg) return null;
  const ok = msg === "saved";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${ok ? "text-green-600" : "text-red-600"}`}
    >
      {ok ? <Check className="size-3.5" /> : null}
      {ok ? "Saved" : msg}
    </span>
  );
}

export function ScoringRulesClient({
  initialSettings,
  initialDeltas,
  initialBonuses,
}: {
  initialSettings: ScoringSettings;
  initialDeltas: FlagDeltas;
  initialBonuses: Record<string, number>;
}) {
  const router = useRouter();

  // ── Aggregation ──
  const [method, setMethod] = useState<AggregationMethod>(initialSettings.aggregation_method);
  const [normalize, setNormalize] = useState(initialSettings.normalize_per_session);
  const [bestN, setBestN] = useState(String(initialSettings.best_n));
  const [savingAgg, setSavingAgg] = useState(false);
  const [aggMsg, setAggMsg] = useState<string | null>(null);

  // ── Special remarks ──
  const [deltas, setDeltas] = useState<Record<string, string>>(
    Object.fromEntries(FLAG_LABELS.map((f) => [f.key, String(initialDeltas[f.key] ?? 0)]))
  );
  const [savingDeltas, setSavingDeltas] = useState(false);
  const [deltaMsg, setDeltaMsg] = useState<string | null>(null);

  // ── Bonuses ──
  const [bonuses, setBonuses] = useState<Record<string, string>>(
    Object.fromEntries(ROLE_LABELS.map((r) => [r.key, String(initialBonuses[r.key] ?? 0)]))
  );
  const [savingBonus, setSavingBonus] = useState(false);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);

  async function saveAgg() {
    setSavingAgg(true);
    setAggMsg(null);
    const res = await updateScoringSettings({
      aggregation_method: method,
      normalize_per_session: normalize,
      best_n: Number(bestN),
    });
    setSavingAgg(false);
    setAggMsg(res.success ? "saved" : res.error);
    if (res.success) router.refresh();
  }

  async function saveDeltas() {
    setSavingDeltas(true);
    setDeltaMsg(null);
    const res = await updateScoringFlagsConfig({
      no_confidence_brought: Number(deltas.no_confidence_brought),
      walkout: Number(deltas.walkout),
      ruckus: Number(deltas.ruckus),
      suspension: Number(deltas.suspension),
    });
    setSavingDeltas(false);
    setDeltaMsg(res.success ? "saved" : res.error);
    if (res.success) router.refresh();
  }

  async function saveBonuses() {
    setSavingBonus(true);
    setBonusMsg(null);
    const payload: Record<string, number> = {};
    for (const r of ROLE_LABELS) payload[r.key] = Number(bonuses[r.key]);
    const res = await updatePositionBonusConfig(payload);
    setSavingBonus(false);
    setBonusMsg(res.success ? "saved" : res.error);
    if (res.success) router.refresh();
  }

  const saveBtn = "inline-flex items-center gap-1.5 rounded-md bg-[#FF9933] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#E68A2E] disabled:opacity-50";
  const numInput = "w-24 rounded border border-gray-300 px-2 py-1 text-sm";

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a3e]">Scoring Rules</h1>
        <p className="mt-1 text-sm text-[#1a1a3e]/60">
          Global scoring policy — applies to every chapter and event. Set by
          super-admin; the results engine reads these values (nothing hardcoded).
        </p>
      </div>

      {/* Aggregation */}
      <section className="rounded-xl border border-[#1a1a3e]/10 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#1a1a3e]">
          <Scale className="size-4 text-[#FF9933]" /> How session scores combine
        </h2>
        <div className="mt-4 space-y-2">
          {METHOD_LABELS.map((m) => (
            <label
              key={m.value}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
            >
              <input
                type="radio"
                name="method"
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-[#1a1a3e]">{m.label}</span>
                <span className="block text-xs text-[#1a1a3e]/50">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {method === "best_n" && (
          <label className="mt-3 block text-xs font-medium text-[#1a1a3e]/70">
            N (top sessions to average)
            <input
              type="number"
              min={1}
              value={bestN}
              onChange={(e) => setBestN(e.target.value)}
              className={`mt-1 block ${numInput}`}
            />
          </label>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm text-[#1a1a3e]">
          <input
            type="checkbox"
            checked={normalize}
            onChange={(e) => setNormalize(e.target.checked)}
          />
          Normalize each session to its own max before combining
          <span className="text-xs text-[#1a1a3e]/50">
            (fair when sessions have different parameters/maxes)
          </span>
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={saveAgg} disabled={savingAgg} className={saveBtn}>
            {savingAgg ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
          <Saved msg={aggMsg} />
        </div>
      </section>

      {/* Special remarks */}
      <section className="rounded-xl border border-[#1a1a3e]/10 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#1a1a3e]">
          <AlertTriangle className="size-4 text-rose-500" /> Special Remarks (point values)
        </h2>
        <p className="mt-1 text-xs text-[#1a1a3e]/50">
          Applied once at full value to a delegate&apos;s final score if any juror
          flags it. Use negatives for penalties.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FLAG_LABELS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <span className="text-sm text-[#1a1a3e]">{f.label}</span>
              <input
                type="number"
                value={deltas[f.key]}
                onChange={(e) => setDeltas((p) => ({ ...p, [f.key]: e.target.value }))}
                className={numInput}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={saveDeltas} disabled={savingDeltas} className={saveBtn}>
            {savingDeltas ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
          <Saved msg={deltaMsg} />
        </div>
      </section>

      {/* Role bonuses */}
      <section className="rounded-xl border border-[#1a1a3e]/10 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#1a1a3e]">
          <Award className="size-4 text-amber-500" /> Role bonuses
        </h2>
        <p className="mt-1 text-xs text-[#1a1a3e]/50">
          Added once to a delegate&apos;s final score based on their parliamentary role.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROLE_LABELS.map((r) => (
            <label key={r.key} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <span className="text-sm text-[#1a1a3e]">{r.label}</span>
              <input
                type="number"
                value={bonuses[r.key]}
                onChange={(e) => setBonuses((p) => ({ ...p, [r.key]: e.target.value }))}
                className={numInput}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={saveBonuses} disabled={savingBonus} className={saveBtn}>
            {savingBonus ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
          <Saved msg={bonusMsg} />
        </div>
      </section>
    </div>
  );
}
