"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  upsertCommitteeScore,
  type CommitteeRow,
} from "@/app/yip/actions/committee-scores";
import {
  COMMITTEE_DIMENSIONS,
  deriveCommitteeLevels,
  type CommitteeDimensions,
} from "@/lib/yip/committee-score";
import { committeeLabel } from "@/lib/yip/committee-label";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Loader2, Users, CheckCircle2 } from "lucide-react";

type Draft = CommitteeDimensions & { judge_notes: string };

function toDraft(c: CommitteeRow): Draft {
  return {
    bill_draft_quality: c.bill_draft_quality,
    policy_relevance: c.policy_relevance,
    innovation: c.innovation,
    feasibility: c.feasibility,
    team_collaboration: c.team_collaboration,
    presentation_defence: c.presentation_defence,
    judge_notes: c.judge_notes ?? "",
  };
}

export function CommitteeScoringClient({
  eventId,
  eventName,
  committees,
  canManage,
}: {
  eventId: string;
  eventName: string;
  committees: CommitteeRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    Object.fromEntries(committees.map((c) => [c.committee_name, toDraft(c)]))
  );
  const [savingFor, setSavingFor] = useState<string | null>(null);

  function setField(name: string, key: keyof Draft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        [key]:
          key === "judge_notes"
            ? value
            : Math.max(0, Math.min(10, Math.round(Number(value) || 0))),
      },
    }));
  }

  async function save(name: string) {
    setSavingFor(name);
    const d = drafts[name];
    const result = await upsertCommitteeScore({
      eventId,
      committeeName: name,
      dimensions: {
        bill_draft_quality: d.bill_draft_quality,
        policy_relevance: d.policy_relevance,
        innovation: d.innovation,
        feasibility: d.feasibility,
        team_collaboration: d.team_collaboration,
        presentation_defence: d.presentation_defence,
      },
      judgeNotes: d.judge_notes || null,
    });
    if (result.success) {
      toast.success(`${name} committee score saved — applied to all members`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setSavingFor(null);
  }

  if (committees.length === 0) {
    return (
      <Card className="py-16">
        <CardContent className="flex flex-col items-center text-center">
          <Users className="mb-4 size-12 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700">No committees yet</h3>
          <p className="mt-1 max-w-md text-sm text-gray-500">
            Run allocation first — committees are formed from participants&apos;
            committee assignments.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Committee Scoring</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          {eventName} · Score each committee ONCE on the 6 dimensions (/60, Yi
          2026 Workbook). The result is applied equally to every member of the
          committee — the 5 drafting dimensions drive the Committee Discussions
          committee-level (5 pts), and Presentation &amp; Defence drives the Bill
          Presentation committee-level (5 pts).
        </p>
      </div>

      {committees.map((c) => {
        const d = drafts[c.committee_name];
        const { cmteLevel, billLevel, total60 } = deriveCommitteeLevels(d);
        return (
          <Card key={c.committee_name}>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[#1a1a3e]">
                    {c.committee_name ?? committeeLabel(c.committee_number)}
                  </h3>
                  {c.scored && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      <CheckCircle2 className="size-3" /> Scored
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Users className="size-3" /> {c.member_count} member
                  {c.member_count === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {COMMITTEE_DIMENSIONS.map((dim) => (
                  <label key={dim.key} className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      {dim.label} <span className="text-gray-400">/10</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      disabled={!canManage}
                      value={d[dim.key]}
                      onChange={(e) => setField(c.committee_name, dim.key, e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#FF9933] focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </label>
                ))}
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-600">
                  Judge notes (optional)
                </span>
                <textarea
                  rows={2}
                  disabled={!canManage}
                  value={d.judge_notes}
                  onChange={(e) => setField(c.committee_name, "judge_notes", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#FF9933] focus:outline-none disabled:bg-gray-50"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="font-medium text-[#1a1a3e]">
                    Total: {total60}<span className="text-gray-400">/60</span>
                  </span>
                  <span className="text-gray-600">
                    Committee level: <strong>{cmteLevel.toFixed(1)}</strong>
                    <span className="text-gray-400">/5</span>
                  </span>
                  <span className="text-gray-600">
                    Bill level: <strong>{billLevel.toFixed(1)}</strong>
                    <span className="text-gray-400">/5</span>
                  </span>
                </div>
                {canManage && (
                  <Button
                    className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                    onClick={() => save(c.committee_name)}
                    disabled={savingFor === c.committee_name}
                  >
                    {savingFor === c.committee_name ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {savingFor === c.committee_name ? "Saving..." : "Save committee score"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
