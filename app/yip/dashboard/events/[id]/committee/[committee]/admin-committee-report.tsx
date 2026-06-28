"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Textarea } from "@/components/yip/ui/textarea";
import { Badge } from "@/components/yip/ui/badge";
import { ClipboardList, Save, Send, CheckCircle2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  getReportForCommittee,
  saveReportDraft,
  submitReport,
  type CommitteeReport,
} from "@/app/yip/actions/committee-reports";

const FIELDS: { key: keyof Form; label: string; required?: boolean }[] = [
  { key: "background", label: "Background of the issue" },
  { key: "current_challenges", label: "Current challenges" },
  { key: "findings", label: "Findings of the committee", required: true },
  { key: "recommendations", label: "Policy recommendations", required: true },
  { key: "proposed_solutions", label: "Proposed solutions" },
];

interface Form {
  background: string;
  current_challenges: string;
  findings: string;
  recommendations: string;
  proposed_solutions: string;
}

const EMPTY: Form = {
  background: "",
  current_challenges: "",
  findings: "",
  recommendations: "",
  proposed_solutions: "",
};

/**
 * Organiser/admin editor for a committee's research report — the same artifact
 * members fill at /yip/me/report, but driven by canManage so an admin can run
 * the committee solo (director decision 2026-06-28). Submitting it unlocks bill
 * drafting for the committee's members too. Collapsed by default so the bill
 * workspace stays the focus.
 */
export function AdminCommitteeReport({
  eventId,
  committeeName,
}: {
  eventId: string;
  committeeName: string;
}) {
  const [report, setReport] = useState<CommitteeReport | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getReportForCommittee(eventId, committeeName).then((r) => {
      if (r) {
        setReport(r);
        setForm({
          background: r.background || "",
          current_challenges: r.current_challenges || "",
          findings: r.findings || "",
          recommendations: r.recommendations || "",
          proposed_solutions: r.proposed_solutions || "",
        });
      }
    });
  }, [eventId, committeeName]);

  const submitted = report?.status === "submitted";

  function handleSave() {
    startTransition(async () => {
      const r = await saveReportDraft(eventId, committeeName, null, form);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      const fresh = await getReportForCommittee(eventId, committeeName);
      if (fresh) setReport(fresh);
      toast.success("Report saved");
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      // Persist first so a report row exists, then submit it.
      const saved = await saveReportDraft(eventId, committeeName, null, form);
      if (!saved.success) {
        toast.error(saved.error);
        return;
      }
      const r = await submitReport(saved.data.reportId, null);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      const fresh = await getReportForCommittee(eventId, committeeName);
      if (fresh) setReport(fresh);
      toast.success("Report submitted — bill drafting is unlocked for the committee.");
    });
  }

  return (
    <Card className="mb-4">
      <CardContent className="py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
        >
          <ClipboardList className="size-5 text-amber-600" />
          <span className="text-sm font-bold text-gray-900">Committee Report</span>
          {submitted ? (
            <Badge className="bg-green-100 text-green-700">Submitted</Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600">
              {report ? "Draft" : "Not started"}
            </Badge>
          )}
          <ChevronDown
            className={`ml-auto size-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-gray-500">
              The research step before the bill. Filling and submitting this on
              the committee&apos;s behalf unlocks bill drafting for its members —
              but you can also draft the bill directly without it.
            </p>
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-gray-700">
                  {f.label}
                  {f.required && <span className="text-[#FF9933]"> *</span>}
                </label>
                <Textarea
                  value={form[f.key]}
                  disabled={submitted || isPending}
                  rows={2}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.key]: e.target.value }))
                  }
                  className="mt-1 bg-white"
                />
              </div>
            ))}

            {submitted ? (
              <p className="flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="size-4" />
                Report submitted — locked.
              </p>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSave} disabled={isPending}>
                  <Save className="size-4 mr-1.5" />
                  Save
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isPending || !form.findings.trim() || !form.recommendations.trim()}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  <Send className="size-4 mr-1.5" />
                  Submit report
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
