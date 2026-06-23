"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  upsertCommitteeScore,
  deleteCommitteeScore,
  setCommitteeChairLead,
  type CommitteeRow,
} from "@/app/yip/actions/committee-scores";
import {
  deriveCommitteeLevels,
  type CommitteeDimensions,
  type CommitteeDimensionLabel,
} from "@/lib/yip/committee-score";
import { committeeLabel } from "@/lib/yip/committee-label";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import {
  Loader2,
  Users,
  CheckCircle2,
  Download,
  Trash2,
  Lock,
} from "lucide-react";

type ScoreDraft = CommitteeDimensions & { judge_notes: string };

const ZERO_DRAFT: ScoreDraft = {
  bill_draft_quality: 0,
  policy_relevance: 0,
  innovation: 0,
  feasibility: 0,
  team_collaboration: 0,
  presentation_defence: 0,
  judge_notes: "",
};

function csvCell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export function CommitteeScoringClient({
  eventId,
  eventName,
  committees,
  dimensions,
  locked,
}: {
  eventId: string;
  eventName: string;
  committees: CommitteeRow[];
  dimensions: CommitteeDimensionLabel[];
  locked: boolean;
}) {
  const router = useRouter();
  const editable = !locked;

  // Per-(committee, judge) score being edited. Key = `${committee}__${juryId}`.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScoreDraft>(ZERO_DRAFT);
  const [savingScore, setSavingScore] = useState(false);

  // Chair/Lead drafts per committee.
  const [chairDrafts, setChairDrafts] = useState<Record<string, string>>(
    Object.fromEntries(committees.map((c) => [c.committee_name, c.chair_lead ?? ""]))
  );
  const [savingChair, setSavingChair] = useState<string | null>(null);

  function openEditor(committee: CommitteeRow, juryId: string) {
    const existing = committee.scores.find((s) => s.jury_assignment_id === juryId);
    setDraft(
      existing
        ? {
            bill_draft_quality: existing.bill_draft_quality,
            policy_relevance: existing.policy_relevance,
            innovation: existing.innovation,
            feasibility: existing.feasibility,
            team_collaboration: existing.team_collaboration,
            presentation_defence: existing.presentation_defence,
            judge_notes: existing.judge_notes ?? "",
          }
        : { ...ZERO_DRAFT }
    );
    setEditing(`${committee.committee_name}__${juryId}`);
  }

  function setDraftField(key: keyof ScoreDraft, value: string) {
    setDraft((prev) => ({
      ...prev,
      [key]:
        key === "judge_notes"
          ? value
          : Math.max(0, Math.min(10, Math.round(Number(value) || 0))),
    }));
  }

  async function saveScore(committeeName: string, juryAssignmentId: string) {
    setSavingScore(true);
    const res = await upsertCommitteeScore({
      eventId,
      committeeName,
      juryAssignmentId,
      dimensions: {
        bill_draft_quality: draft.bill_draft_quality,
        policy_relevance: draft.policy_relevance,
        innovation: draft.innovation,
        feasibility: draft.feasibility,
        team_collaboration: draft.team_collaboration,
        presentation_defence: draft.presentation_defence,
      },
      judgeNotes: draft.judge_notes || null,
      scoredBy: "organiser",
    });
    setSavingScore(false);
    if (res.success) {
      toast.success("Score saved");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function removeScore(committeeName: string, juryAssignmentId: string) {
    const res = await deleteCommitteeScore({ eventId, committeeName, juryAssignmentId });
    if (res.success) {
      toast.success("Score removed");
      setEditing(null);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function saveChair(committeeName: string) {
    setSavingChair(committeeName);
    const res = await setCommitteeChairLead({
      eventId,
      committeeName,
      chairLead: chairDrafts[committeeName] || null,
    });
    setSavingChair(null);
    if (res.success) {
      toast.success("Chair / Lead saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function downloadSheet() {
    const headers = [
      "Committee #",
      "Committee",
      "Committee Chair / Lead",
      "Members Count",
      "Bill Draft Quality (10)",
      "Policy Relevance (10)",
      "Innovation (10)",
      "Feasibility (10)",
      "Team Collaboration (10)",
      "Presentation & Defence (10)",
      "Total (60)",
      "Judge Notes",
    ];
    const rows = committees.map((c) => [
      c.committee_number ?? "",
      c.committee_name,
      c.chair_lead ?? "",
      c.member_count,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${eventName.replace(/[^a-zA-Z0-9]+/g, "-")}-committee-evaluation.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Committee Evaluation</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {eventName} · Judges score each committee on 6 dimensions (/60). When a
            committee has several judges, their marks are <strong>averaged</strong>.
            The 5 drafting dimensions drive the Committee Discussions level (5 pts)
            and Presentation &amp; Defence drives the Bill Presentation level (5 pts),
            applied equally to every member.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadSheet}>
            <Download className="size-4 mr-2" />
            Download sheet
          </Button>
        </div>
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <Lock className="size-4" /> Scores are locked for this event — entry is
          read-only.
        </div>
      )}

      {committees.map((c) => {
        const { cmteLevel, billLevel, total60 } = deriveCommitteeLevels(c.avg);
        const totalAssigned = c.assigned.length;
        return (
          <Card key={c.committee_name}>
            <CardContent className="space-y-4 p-5">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[#1a1a3e]">
                    {c.committee_number != null ? `${c.committee_number} · ` : ""}
                    {c.committee_name || committeeLabel(c.committee_number)}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Users className="size-3" /> {c.member_count}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-600">
                    {c.scored_count} of {totalAssigned || c.scored_count} judge
                    {(totalAssigned || c.scored_count) === 1 ? "" : "s"} scored
                  </span>
                  <span className="font-semibold text-[#1a1a3e]">
                    Avg {total60.toFixed(1)}
                    <span className="text-gray-400">/60</span>
                  </span>
                </div>
              </div>

              {/* Chair / Lead */}
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex-1 min-w-[200px] text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    Committee Chair / Lead
                  </span>
                  <Input
                    value={chairDrafts[c.committee_name] ?? ""}
                    disabled={!editable}
                    placeholder="Name of the committee chair / lead"
                    onChange={(e) =>
                      setChairDrafts((p) => ({ ...p, [c.committee_name]: e.target.value }))
                    }
                  />
                </label>
                {editable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveChair(c.committee_name)}
                    disabled={savingChair === c.committee_name}
                  >
                    {savingChair === c.committee_name ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                )}
              </div>

              {/* Judges */}
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Judges
                </p>
                {c.assigned.length === 0 && c.scores.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No judges assigned yet — use “Assign judges to committees”.
                  </p>
                ) : (
                  // Show assigned judges, plus any who scored but aren't assigned.
                  Array.from(
                    new Map(
                      [
                        ...c.assigned,
                        ...c.scores.map((s) => ({
                          jury_assignment_id: s.jury_assignment_id,
                          jury_name: s.jury_name,
                        })),
                      ].map((j) => [j.jury_assignment_id, j])
                    ).values()
                  ).map((j) => {
                    const score = c.scores.find(
                      (s) => s.jury_assignment_id === j.jury_assignment_id
                    );
                    const editKey = `${c.committee_name}__${j.jury_assignment_id}`;
                    const isEditing = editing === editKey;
                    return (
                      <div
                        key={j.jury_assignment_id}
                        className="rounded-md border border-gray-200"
                      >
                        <div className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="flex items-center gap-2 text-sm">
                            {score ? (
                              <CheckCircle2 className="size-4 text-green-600" />
                            ) : (
                              <span className="inline-block size-4 rounded-full border border-gray-300" />
                            )}
                            <span className="font-medium text-[#1a1a3e]">
                              {j.jury_name}
                            </span>
                            {score && (
                              <span className="text-gray-500">
                                · {score.total60}/60
                              </span>
                            )}
                          </span>
                          {editable && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                isEditing ? setEditing(null) : openEditor(c, j.jury_assignment_id)
                              }
                            >
                              {isEditing ? "Close" : score ? "Edit" : "Enter marks"}
                            </Button>
                          )}
                        </div>

                        {isEditing && (
                          <div className="space-y-3 border-t bg-gray-50 px-3 py-3">
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
                                    value={draft[dim.key]}
                                    onChange={(e) => setDraftField(dim.key, e.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#FF9933] focus:outline-none"
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
                                value={draft.judge_notes}
                                onChange={(e) => setDraftField("judge_notes", e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#FF9933] focus:outline-none"
                              />
                            </label>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-[#1a1a3e]">
                                Total{" "}
                                {deriveCommitteeLevels(draft).total60}
                                <span className="text-gray-400">/60</span>
                              </span>
                              <div className="flex gap-2">
                                {score && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      removeScore(c.committee_name, j.jury_assignment_id)
                                    }
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                )}
                                <Button
                                  className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
                                  size="sm"
                                  onClick={() => saveScore(c.committee_name, j.jury_assignment_id)}
                                  disabled={savingScore}
                                >
                                  {savingScore ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Averaged committee levels */}
              <div className="flex flex-wrap gap-4 border-t pt-3 text-sm">
                <span className="text-gray-600">
                  Committee level: <strong>{cmteLevel.toFixed(1)}</strong>
                  <span className="text-gray-400">/5</span>
                </span>
                <span className="text-gray-600">
                  Bill level: <strong>{billLevel.toFixed(1)}</strong>
                  <span className="text-gray-400">/5</span>
                </span>
                <span className="text-gray-400">
                  (averaged across {c.scored_count} judge
                  {c.scored_count === 1 ? "" : "s"} · applied to all {c.member_count}{" "}
                  members)
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
