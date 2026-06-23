"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  submitJurorCommitteeScore,
  type JurorCommitteeRow,
} from "@/app/yip/actions/committee-scores";
import {
  deriveCommitteeLevels,
  type CommitteeDimensions,
  type CommitteeDimensionLabel,
} from "@/lib/yip/committee-score";
import { Loader2, CheckCircle2, Users, Lock, ShieldX } from "lucide-react";

type Draft = CommitteeDimensions & { judge_notes: string };

const ZERO: Draft = {
  bill_draft_quality: 0,
  policy_relevance: 0,
  innovation: 0,
  feasibility: 0,
  team_collaboration: 0,
  presentation_defence: 0,
  judge_notes: "",
};

function toDraft(c: JurorCommitteeRow): Draft {
  return c.my
    ? {
        bill_draft_quality: c.my.bill_draft_quality,
        policy_relevance: c.my.policy_relevance,
        innovation: c.my.innovation,
        feasibility: c.my.feasibility,
        team_collaboration: c.my.team_collaboration,
        presentation_defence: c.my.presentation_defence,
        judge_notes: c.my.judge_notes ?? "",
      }
    : { ...ZERO };
}

export function JurorCommitteesClient({
  juryAssignmentId,
  eventId,
  locked,
  committees,
  error,
}: {
  juryAssignmentId: string;
  eventId: string;
  locked: boolean;
  committees: JurorCommitteeRow[];
  error: string | null;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    Object.fromEntries(committees.map((c) => [c.committee_name, toDraft(c)]))
  );
  const [saving, setSaving] = useState<string | null>(null);

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
    setSaving(name);
    const d = drafts[name];
    const res = await submitJurorCommitteeScore({
      juryAssignmentId,
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
    setSaving(null);
    if (res.success) {
      toast.success(`${name} saved`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ShieldX className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Committee Evaluation</h1>
        <p className="mt-1 text-sm text-gray-500">
          Score each committee you&apos;re assigned to on the 6 dimensions (/60).
          Your marks are averaged with the other judges of that committee.
        </p>
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <Lock className="size-4" /> Scoring is locked for this event.
        </div>
      )}

      {committees.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          You haven&apos;t been assigned to any committees yet. The organiser
          assigns judges to committees.
        </div>
      ) : (
        committees.map((c) => {
          const d = drafts[c.committee_name];
          const { total60 } = deriveCommitteeLevels(d);
          return (
            <div
              key={c.committee_name}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-[#1a1a3e]">
                  {c.committee_number != null ? `${c.committee_number} · ` : ""}
                  {c.committee_name}
                </h2>
                <span className="flex items-center gap-2 text-xs text-gray-500">
                  {c.my && <CheckCircle2 className="size-4 text-green-600" />}
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" /> {c.member_count}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {COMMITTEE_DIMENSIONS.map((dim) => (
                  <label key={dim.key} className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      {dim.label} <span className="text-gray-400">/10</span>
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={10}
                      disabled={locked}
                      value={d[dim.key]}
                      onChange={(e) => setField(c.committee_name, dim.key, e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-2 text-base focus:border-[#FF9933] focus:outline-none disabled:bg-gray-50"
                    />
                  </label>
                ))}
              </div>

              <label className="mt-3 block text-sm">
                <span className="mb-1 block text-xs font-medium text-gray-600">
                  Notes (optional)
                </span>
                <textarea
                  rows={2}
                  disabled={locked}
                  value={d.judge_notes}
                  onChange={(e) => setField(c.committee_name, "judge_notes", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-[#FF9933] focus:outline-none disabled:bg-gray-50"
                />
              </label>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-[#1a1a3e]">
                  Total {total60}
                  <span className="text-gray-400">/60</span>
                </span>
                {!locked && (
                  <button
                    onClick={() => save(c.committee_name)}
                    disabled={saving === c.committee_name}
                    className="flex items-center gap-2 rounded-lg bg-[#FF9933] px-4 py-2 text-sm font-medium text-white hover:bg-[#E68A2E] disabled:opacity-60"
                  >
                    {saving === c.committee_name && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {c.my ? "Update" : "Save"}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
