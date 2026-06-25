"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AwardCandidateGroup } from "@/app/yip/actions/results";
import { lockAwardQualifiers } from "@/app/yip/actions/qualification";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import {
  ArrowUpRight,
  Crown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Trophy,
} from "lucide-react";

/**
 * Award-based Regional qualification (model locked 2026-06-25).
 *
 * Advancement = each QUALIFYING award's chosen advancer moves to the next round.
 * No rank-based additions, no hard ceiling — the advancer count is however many
 * the qualifying awards send (deduped). Which awards qualify is per-zone config
 * (default = all 15); a zone can mark awards RECOGNITION-ONLY (awarded + shown,
 * but do not advance). The organiser sees each qualifying award's top-5 shortlist
 * (from yip.award_candidates) with the WINNER pre-selected, can SWAP the advancer
 * to any of that award's top-5, then LOCK → participants.qualified_for_next via
 * the shared markQualified/unmarkQualified primitives.
 */
export function QualificationPanel({
  eventId,
  nextLevelLabel,
  awardCandidates,
  zoneAwardConfig,
  qualifiedIds,
  onQualifiedChange,
  canQualify,
}: {
  eventId: string;
  nextLevelLabel: string;
  awardCandidates: AwardCandidateGroup[];
  /** award_key -> qualifies (override; ABSENCE means qualifies = true). */
  zoneAwardConfig: Record<string, boolean>;
  qualifiedIds: Set<string>;
  onQualifiedChange: (ids: string[]) => void;
  canQualify: boolean;
}) {
  const router = useRouter();
  const qualifies = (key: string) => zoneAwardConfig[key] ?? true;

  // Only awards with a real shortlist can send an advancer. Empty-pool awards
  // (e.g. benchless Ruling/Opposition, or no Independent MP) have no candidates
  // and send nobody. (Plain consts — the React Compiler memoizes for us.)
  const qualifyingGroups = awardCandidates.filter(
    (g) => qualifies(g.award_key) && g.candidates.length > 0
  );
  const recognitionGroups = awardCandidates.filter(
    (g) => !qualifies(g.award_key) && g.candidates.length > 0
  );

  // Default advancers per qualifying award = ALL of its winners (post-cap). A
  // multi-recipient award (e.g. Best Parliamentarian = 2) therefore sends BOTH
  // winners. Falls back to the top-ranked contender (rank 1) when the cap left
  // this award without a winner (e.g. a very small field). The organiser can
  // SWAP — untick a winner, tick any top-5 contender. No hard ceiling.
  const defaultAdvancers = (g: AwardCandidateGroup): string[] => {
    const winners = g.candidates.filter((c) => c.is_winner).map((c) => c.participant_id);
    if (winners.length > 0) return winners;
    return g.candidates.length > 0 ? [g.candidates[0].participant_id] : [];
  };

  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(qualifyingGroups.map((g) => [g.award_key, defaultAdvancers(g)]))
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function toggle(awardKey: string, pid: string) {
    setSelected((prev) => {
      const cur = prev[awardKey] ?? [];
      const next = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid];
      return { ...prev, [awardKey]: next };
    });
  }

  const nameById = new Map<string, string | null>();
  for (const g of awardCandidates)
    for (const c of g.candidates) nameById.set(c.participant_id, c.participant_name);

  // Deduped set of advancers across all qualifying awards (a student chosen for
  // two awards advances ONCE — qualified_for_next is a boolean).
  const advancerIds = Array.from(
    new Set(qualifyingGroups.flatMap((g) => selected[g.award_key] ?? []))
  );

  async function handleLock() {
    setLoading(true);
    setMessage(null);
    const res = await lockAwardQualifiers(eventId, advancerIds);
    setLoading(false);
    if (!res.success) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    onQualifiedChange(advancerIds);
    setMessage({
      type: "success",
      text: `Locked — ${res.data.qualified} student${res.data.qualified !== 1 ? "s" : ""} qualified for ${nextLevelLabel}.`,
    });
    router.refresh();
  }

  if (awardCandidates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="size-5 text-[#138808]" />
            Qualification for {nextLevelLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Compute results first — the award shortlists drive qualification.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="size-5 text-[#138808]" />
            <CardTitle className="text-base">
              Qualification for {nextLevelLabel} — award-based
            </CardTitle>
          </div>
          <p className="text-sm text-gray-500">
            {advancerIds.length} advancing · {qualifiedIds.size} currently qualified
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-gray-600">
          Each <strong>qualifying award</strong> sends its winner(s) to {nextLevelLabel} — the
          winners are pre-ticked (a multi-recipient award like Best Parliamentarian sends both).
          Swap by un-ticking a winner and ticking any of that award&apos;s top-5, then lock. A
          student picked for two awards advances once. Recognition-only awards are shown but do
          not advance.
        </p>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            {message.text}
          </div>
        )}

        {/* Qualifying awards — tick the advancer(s) from the top-5 shortlist
            (pre-ticked = winners; multi-recipient awards send all winners). */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qualifyingGroups.map((g) => (
            <div key={g.award_key} className="rounded-lg border border-[#138808]/30 bg-[#138808]/5 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0f6b06]">
                {g.award_label}
              </p>
              <div className="space-y-1">
                {g.candidates.map((c) => {
                  const isPicked = (selected[g.award_key] ?? []).includes(c.participant_id);
                  return (
                    <label
                      key={c.participant_id}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-sm ${
                        isPicked ? "bg-white font-semibold text-gray-900 ring-1 ring-[#138808]/40" : "text-gray-700"
                      } ${canQualify ? "" : "cursor-default opacity-90"}`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={isPicked}
                          disabled={!canQualify || loading}
                          onChange={() => toggle(g.award_key, c.participant_id)}
                          className="size-3.5 shrink-0 rounded text-[#138808] focus:ring-[#138808]"
                        />
                        {c.is_winner && <Crown className="size-3.5 shrink-0 text-[#FF9933]" />}
                        <span className="truncate">{c.participant_name ?? "—"}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-xs text-gray-500">
                        {c.score.toFixed(1)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Recognition-only awards — shown, explicitly tagged as non-advancing */}
        {recognitionGroups.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Trophy className="size-3.5" /> Recognition only — does not advance
            </p>
            <div className="flex flex-wrap gap-2">
              {recognitionGroups.map((g) => {
                const winner = g.candidates.find((c) => c.is_winner) ?? g.candidates[0];
                return (
                  <Badge key={g.award_key} variant="secondary" className="bg-white text-gray-600">
                    {g.award_label}: {winner.participant_name ?? "—"}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Advancer summary + lock */}
        <div className="flex flex-col gap-3 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {advancerIds.length} student{advancerIds.length !== 1 ? "s" : ""} will advance to{" "}
              {nextLevelLabel}
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {advancerIds.map((id) => nameById.get(id) ?? "—").join(", ") || "—"}
            </p>
          </div>
          {canQualify ? (
            <Button
              onClick={handleLock}
              disabled={loading || advancerIds.length === 0}
              className="shrink-0 bg-[#138808] text-white hover:bg-[#0f6b06]"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              Lock &amp; mark qualified
            </Button>
          ) : (
            <p className="shrink-0 text-xs text-gray-500">
              Qualification is set by the national team.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
