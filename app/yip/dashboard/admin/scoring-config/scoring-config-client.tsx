"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  updateScoringSettings,
  setUseBucketModel,
  type ScoringSettings,
  type AggregationMethod,
} from "@/app/yip/actions/scoring-settings";
import { type SessionParametersConfig } from "@/app/yip/actions/session-parameters";
import { updatePositionBonusConfig } from "@/app/yip/actions/positions";
import {
  updateScoringFlagsConfig,
  type FlagDeltas,
} from "@/app/yip/actions/scoring-flags";
import {
  setBucketWeightage,
  type ScoringBucket,
} from "@/app/yip/actions/scoring-buckets";
import {
  updateAwardDefinition,
  type AwardDefinition,
} from "@/app/yip/actions/admin-awards";
import { updateCommitteeDimensionsConfig } from "@/app/yip/actions/committee-dimensions";
import { type CommitteeDimensionsConfig } from "@/lib/yip/committee-score";
import {
  AWARD_ELIGIBILITIES,
  AWARD_RANK_MODES,
  ELIGIBILITY_LABELS,
  RANK_MODE_LABELS,
} from "@/lib/yip/award-formula";
import {
  Save,
  Loader2,
  Check,
  Scale,
  SlidersHorizontal,
  Crown,
  AlertTriangle,
  Trophy,
  Table2,
  ArrowRight,
  Users,
} from "lucide-react";

const FLAG_LABELS: { key: keyof FlagDeltas; label: string }[] = [
  { key: "no_confidence_brought", label: "No-Confidence Motion brought" },
  { key: "walkout", label: "Walkout" },
  { key: "ruckus", label: "Ruckus" },
  { key: "suspension", label: "Suspension" },
];

// Every assignable parliament role (matches yip.position_bonus_config keys).
const ROLE_LABELS: { key: string; label: string }[] = [
  { key: "prime_minister", label: "Prime Minister" },
  { key: "speaker", label: "Speaker (elected)" },
  { key: "deputy_prime_minister", label: "Deputy Prime Minister" },
  { key: "deputy_speaker", label: "Deputy Speaker" },
  { key: "leader_of_opposition", label: "Leader of Opposition" },
  { key: "coalition_leader", label: "Coalition Leader" },
  { key: "cabinet_minister", label: "Cabinet Minister" },
  { key: "party_leader", label: "Party Leader" },
  { key: "shadow_minister", label: "Shadow Minister" },
  { key: "committee_chair", label: "Committee Chairperson" },
  { key: "nominated_speaker", label: "Nominated for Speaker" },
  { key: "mp", label: "Member of Parliament" },
  { key: "bill_committee", label: "Bill Committee" },
  { key: "independent_mp", label: "Independent MP" },
];

const METHOD_LABELS: { value: AggregationMethod; label: string; hint: string }[] = [
  { value: "sum", label: "Sum — additive total /100", hint: "Adds each component's score to a total out of 100. The Yi 2026 Workbook model." },
  { value: "weighted_90", label: "Weighted average → /90 + Position /10", hint: "Scores a delegate only on the sessions they took part in, scaled to 90; position points add up to 10." },
  { value: "weighted_average", label: "Weighted average per session", hint: "Each session weighted by its session weight, then averaged." },
  { value: "average", label: "Simple average across sessions", hint: "Every session counts equally." },
  { value: "best_n", label: "Best-N sessions", hint: "Average only a delegate's top-N session scores." },
];

function Saved({ msg }: { msg: string | null }) {
  if (!msg) return null;
  const ok = msg === "saved";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-green-600" : "text-red-600"}`}>
      {ok ? <Check className="size-3.5" /> : null}
      {ok ? "Saved" : msg}
    </span>
  );
}

const saveBtn =
  "inline-flex items-center gap-1.5 rounded-md bg-[#FF9933] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#E68A2E] disabled:opacity-50";
const numInput = "w-20 rounded border border-gray-300 px-2 py-1 text-sm";
const sectionCls = "rounded-xl border border-[#1a1a3e]/10 bg-white p-5 shadow-sm";
const h2Cls = "flex items-center gap-2 text-base font-semibold text-[#1a1a3e]";

export function ScoringConfigClient({
  initialSettings,
  initialComponents,
  initialBonuses,
  initialDeltas,
  initialBuckets,
  initialAwards,
  initialCommitteeDims,
}: {
  initialSettings: ScoringSettings;
  initialComponents: SessionParametersConfig[];
  initialBonuses: Record<string, number>;
  initialDeltas: FlagDeltas;
  initialBuckets: ScoringBucket[];
  initialAwards: AwardDefinition[];
  initialCommitteeDims: CommitteeDimensionsConfig;
}) {
  const router = useRouter();

  // ── 1. Scoring model ──
  const [method, setMethod] = useState<AggregationMethod>(initialSettings.aggregation_method);
  const [normalize, setNormalize] = useState(initialSettings.normalize_per_session);
  const [bestN, setBestN] = useState(String(initialSettings.best_n));
  const [bucketModel, setBucketModel] = useState(initialSettings.use_bucket_model);
  const [savingModel, setSavingModel] = useState(false);
  const [modelMsg, setModelMsg] = useState<string | null>(null);

  // ── 2b. Committee evaluation (dimensions + divisors) ──
  const [cmteLabels, setCmteLabels] = useState<Record<string, string>>(
    Object.fromEntries(initialCommitteeDims.dimensions.map((d) => [d.key, d.label]))
  );
  const [draftingDiv, setDraftingDiv] = useState(String(initialCommitteeDims.draftingDivisor));
  const [presentationDiv, setPresentationDiv] = useState(
    String(initialCommitteeDims.presentationDivisor)
  );
  const [savingCmte, setSavingCmte] = useState(false);
  const [cmteMsg, setCmteMsg] = useState<string | null>(null);

  async function saveCommitteeDims() {
    setSavingCmte(true);
    setCmteMsg(null);
    const res = await updateCommitteeDimensionsConfig({
      dimensions: initialCommitteeDims.dimensions.map((d) => ({
        key: d.key,
        label: cmteLabels[d.key] ?? d.label,
      })),
      draftingDivisor: Number(draftingDiv),
      presentationDivisor: Number(presentationDiv),
    });
    setSavingCmte(false);
    setCmteMsg(res.success ? "saved" : res.error);
    if (res.success) router.refresh();
  }

  // ── 3. Leadership bonuses ──
  const [bonuses, setBonuses] = useState<Record<string, string>>(
    Object.fromEntries(ROLE_LABELS.map((r) => [r.key, String(initialBonuses[r.key] ?? 0)]))
  );
  const [savingBonus, setSavingBonus] = useState(false);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);

  // ── 4. Penalties ──
  const [deltas, setDeltas] = useState<Record<string, string>>(
    Object.fromEntries(FLAG_LABELS.map((f) => [f.key, String(initialDeltas[f.key] ?? 0)]))
  );
  const [savingDeltas, setSavingDeltas] = useState(false);
  const [deltaMsg, setDeltaMsg] = useState<string | null>(null);

  // ── 5. Awards ──
  const [awardDrafts, setAwardDrafts] = useState<
    Record<
      string,
      {
        label: string;
        recipients: string;
        is_active: boolean;
        eligibility: string;
        rank_mode: string;
        rank_keys: string;
      }
    >
  >(
    Object.fromEntries(
      initialAwards.map((a) => [
        a.award_key,
        {
          label: a.label,
          recipients: String(a.default_recipients),
          is_active: a.is_active,
          eligibility: a.eligibility,
          rank_mode: a.rank_mode,
          rank_keys: (a.rank_keys ?? []).join(", "),
        },
      ])
    )
  );
  const [savingAwards, setSavingAwards] = useState(false);
  const [awardsMsg, setAwardsMsg] = useState<string | null>(null);

  // ── 6. Buckets ──
  const [bucketDrafts, setBucketDrafts] = useState<
    Record<string, { weightage: string; merit_max: string; jury_max: string }>
  >(
    Object.fromEntries(
      initialBuckets.map((b) => [
        b.bucket_key,
        { weightage: String(b.weightage), merit_max: String(b.merit_max), jury_max: String(b.jury_max) },
      ])
    )
  );
  const [savingBuckets, setSavingBuckets] = useState(false);
  const [bucketsMsg, setBucketsMsg] = useState<string | null>(null);

  async function saveModel() {
    setSavingModel(true);
    setModelMsg(null);
    const r1 = await updateScoringSettings({
      aggregation_method: method,
      normalize_per_session: normalize,
      best_n: Number(bestN),
    });
    let ok = r1.success;
    let err = r1.success ? null : r1.error;
    if (ok && bucketModel !== initialSettings.use_bucket_model) {
      const r2 = await setUseBucketModel(bucketModel);
      ok = r2.success;
      if (!r2.success) err = r2.error;
    }
    setSavingModel(false);
    setModelMsg(ok ? "saved" : err ?? "Save failed");
    if (ok) router.refresh();
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

  async function saveAwards() {
    setSavingAwards(true);
    setAwardsMsg(null);
    for (const a of initialAwards) {
      const d = awardDrafts[a.award_key];
      const res = await updateAwardDefinition(a.award_key, {
        label: d.label,
        default_recipients: Number(d.recipients),
        is_active: d.is_active,
        eligibility: d.eligibility,
        rank_mode: d.rank_mode,
        rank_keys: d.rank_keys
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (!res.success) {
        setAwardsMsg(`${a.label}: ${res.error}`);
        setSavingAwards(false);
        return;
      }
    }
    setSavingAwards(false);
    setAwardsMsg("saved");
    router.refresh();
  }

  async function saveBuckets() {
    setSavingBuckets(true);
    setBucketsMsg(null);
    for (const b of initialBuckets) {
      const d = bucketDrafts[b.bucket_key];
      const res = await setBucketWeightage({
        bucket_key: b.bucket_key,
        weightage: Number(d.weightage),
        merit_max: Number(d.merit_max),
        jury_max: Number(d.jury_max),
      });
      if (!res.success) {
        setBucketsMsg(`${b.label}: ${res.error}`);
        setSavingBuckets(false);
        return;
      }
    }
    setSavingBuckets(false);
    setBucketsMsg("saved");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[960px] space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a3e]">Scoring Configuration</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#1a1a3e]/60">
          One place to configure how every YIP event is scored. Every change here
          is <strong>global</strong> — the results engine reads these values live,
          so one edit reflects across all events. National / super-admin only.
        </p>
      </div>

      {/* 1. Scoring model */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>
          <Scale className="size-4 text-[#FF9933]" /> Scoring model
        </h2>
        <div className="mt-4 space-y-2">
          {METHOD_LABELS.map((m) => (
            <label
              key={m.value}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
            >
              <input type="radio" name="method" checked={method === m.value} onChange={() => setMethod(m.value)} className="mt-0.5" />
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
            <input type="number" min={1} value={bestN} onChange={(e) => setBestN(e.target.value)} className={`mt-1 block ${numInput}`} />
          </label>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm text-[#1a1a3e]">
          <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} />
          Normalize each session to its own max before combining
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-[#1a1a3e]">
          <input type="checkbox" checked={bucketModel} onChange={(e) => setBucketModel(e.target.checked)} />
          Use the bucket model (/100 buckets instead of per-session)
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={saveModel} disabled={savingModel} className={saveBtn}>
            {savingModel ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </button>
          <Saved msg={modelMsg} />
        </div>
      </section>

      {/* 2. Components (read-only overview + deep link) */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>
          <SlidersHorizontal className="size-4 text-[#FF9933]" /> Scoring components
        </h2>
        <p className="mt-1 text-xs text-[#1a1a3e]/50">
          A component&apos;s max is the sum of its criteria. Edit criteria, labels
          and maxes on the Session Scoring page.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-[#1a1a3e]/60">
                <th className="border-b py-1.5 pr-3">Component</th>
                <th className="border-b py-1.5 pr-3">Max</th>
                <th className="border-b py-1.5 pr-3">Weight</th>
                <th className="border-b py-1.5">Active</th>
              </tr>
            </thead>
            <tbody>
              {initialComponents.map((c) => (
                <tr key={c.session_key} className="text-[#1a1a3e]">
                  <td className="border-b py-1.5 pr-3">{c.label}</td>
                  <td className="border-b py-1.5 pr-3">{c.total_max}</td>
                  <td className="border-b py-1.5 pr-3">{c.session_weight}</td>
                  <td className="border-b py-1.5">{c.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link
          href="/yip/dashboard/admin/session-parameters"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#FF9933] hover:underline"
        >
          Edit components &amp; criteria <ArrowRight className="size-4" />
        </Link>
      </section>

      {/* 2b. Committee evaluation */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>
          <Users className="size-4 text-[#FF9933]" /> Committee evaluation
        </h2>
        <p className="mt-1 text-xs text-[#1a1a3e]/50">
          Rename the 6 committee rating dimensions, and set the two divisors that
          convert the /60 committee mark into the two /5 committee-level points
          (defaults 10 and 2). Applies to every event.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {initialCommitteeDims.dimensions.map((d) => (
            <label
              key={d.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
            >
              <span className="text-[11px] text-[#1a1a3e]/45">{d.key}</span>
              <input
                type="text"
                value={cmteLabels[d.key] ?? ""}
                onChange={(e) => setCmteLabels((p) => ({ ...p, [d.key]: e.target.value }))}
                className="min-w-[150px] flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-1.5 text-xs text-[#1a1a3e]/70">
            Drafting divisor (→ Committee Discussions /5)
            <input
              type="number"
              value={draftingDiv}
              onChange={(e) => setDraftingDiv(e.target.value)}
              className={numInput}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#1a1a3e]/70">
            Presentation divisor (→ Bill Presentation /5)
            <input
              type="number"
              value={presentationDiv}
              onChange={(e) => setPresentationDiv(e.target.value)}
              className={numInput}
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={saveCommitteeDims} disabled={savingCmte} className={saveBtn}>
            {savingCmte ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </button>
          <Saved msg={cmteMsg} />
        </div>
      </section>

      {/* 3. Leadership bonuses */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>
          <Crown className="size-4 text-[#FF9933]" /> Leadership bonuses (points, 0–10)
        </h2>
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
            {savingBonus ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </button>
          <Saved msg={bonusMsg} />
        </div>
      </section>

      {/* 4. Penalties */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>
          <AlertTriangle className="size-4 text-rose-500" /> Penalties / special remarks
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
            {savingDeltas ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </button>
          <Saved msg={deltaMsg} />
        </div>
      </section>

      {/* 5. Awards */}
      <section className={sectionCls}>
        <h2 className={h2Cls}>
          <Trophy className="size-4 text-[#FF9933]" /> Awards
        </h2>
        <p className="mt-1 text-xs text-[#1a1a3e]/50">
          Turn an award on/off, rename it, and set how many winners it has.
        </p>
        <div className="mt-3 space-y-2">
          {initialAwards.map((a) => {
            const d = awardDrafts[a.award_key];
            return (
              <div key={a.award_key} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={d.is_active}
                    onChange={(e) =>
                      setAwardDrafts((p) => ({ ...p, [a.award_key]: { ...d, is_active: e.target.checked } }))
                    }
                  />
                  On
                </label>
                <input
                  type="text"
                  value={d.label}
                  onChange={(e) => setAwardDrafts((p) => ({ ...p, [a.award_key]: { ...d, label: e.target.value } }))}
                  className="min-w-[200px] flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <label className="flex items-center gap-1.5 text-xs text-[#1a1a3e]/70">
                  Winners
                  <input
                    type="number"
                    min={1}
                    value={d.recipients}
                    onChange={(e) => setAwardDrafts((p) => ({ ...p, [a.award_key]: { ...d, recipients: e.target.value } }))}
                    className={numInput}
                  />
                </label>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={saveAwards} disabled={savingAwards} className={saveBtn}>
            {savingAwards ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save all awards
          </button>
          <Saved msg={awardsMsg} />
        </div>
      </section>

      {/* 6. Buckets (only when bucket model is in use) */}
      {initialSettings.use_bucket_model && initialBuckets.length > 0 && (
        <section className={sectionCls}>
          <h2 className={h2Cls}>
            <Table2 className="size-4 text-[#FF9933]" /> Scoring buckets (/100)
          </h2>
          <p className="mt-1 text-xs text-[#1a1a3e]/50">
            Each bucket&apos;s weightage caps its contribution to the /100 total.
            Edit which sessions feed a bucket on the Scoring Framework page.
          </p>
          <div className="mt-3 space-y-2">
            {initialBuckets.map((b) => {
              const d = bucketDrafts[b.bucket_key];
              return (
                <div key={b.bucket_key} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                  <span className="min-w-[200px] flex-1 text-sm text-[#1a1a3e]">{b.label}</span>
                  <label className="flex items-center gap-1.5 text-xs text-[#1a1a3e]/70">
                    Weight
                    <input type="number" value={d.weightage} onChange={(e) => setBucketDrafts((p) => ({ ...p, [b.bucket_key]: { ...d, weightage: e.target.value } }))} className={numInput} />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[#1a1a3e]/70">
                    Merit
                    <input type="number" value={d.merit_max} onChange={(e) => setBucketDrafts((p) => ({ ...p, [b.bucket_key]: { ...d, merit_max: e.target.value } }))} className={numInput} />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[#1a1a3e]/70">
                    Jury
                    <input type="number" value={d.jury_max} onChange={(e) => setBucketDrafts((p) => ({ ...p, [b.bucket_key]: { ...d, jury_max: e.target.value } }))} className={numInput} />
                  </label>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={saveBuckets} disabled={savingBuckets} className={saveBtn}>
              {savingBuckets ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save buckets
            </button>
            <Saved msg={bucketsMsg} />
          </div>
        </section>
      )}
    </div>
  );
}
