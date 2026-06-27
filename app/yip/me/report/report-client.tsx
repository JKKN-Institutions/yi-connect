"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Textarea } from "@/components/yip/ui/textarea";
import { Label } from "@/components/yip/ui/label";
import { Badge } from "@/components/yip/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yip/ui/dialog";
import {
  ClipboardList,
  Save,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  saveReportDraft,
  submitReport,
  getReportForCommittee,
  type CommitteeReport,
} from "@/app/yip/actions/committee-reports";

export interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

interface ReportFormData {
  background: string;
  current_challenges: string;
  findings: string;
  recommendations: string;
  proposed_solutions: string;
}

const EMPTY_FORM: ReportFormData = {
  background: "",
  current_challenges: "",
  findings: "",
  recommendations: "",
  proposed_solutions: "",
};

const FIELDS: {
  key: keyof ReportFormData;
  label: string;
  hint: string;
  required?: boolean;
}[] = [
  { key: "background", label: "Background of the issue", hint: "Set the scene — why does this topic matter?" },
  { key: "current_challenges", label: "Current challenges", hint: "What problems or gaps exist today?" },
  { key: "findings", label: "Findings of the committee", hint: "What did your committee conclude?", required: true },
  { key: "recommendations", label: "Policy recommendations", hint: "What should be done?", required: true },
  { key: "proposed_solutions", label: "Proposed solutions", hint: "How would your recommendations work in practice?" },
];

export function ReportClient({
  initialSession,
  committeeName,
  committeeNumber,
  committeeTopic,
  committeeScheme,
}: {
  initialSession: ParticipantSession;
  committeeName: string | null;
  committeeNumber: number | null;
  committeeTopic: string | null;
  committeeScheme: string | null;
}) {
  const session = initialSession;
  const isEligible = !!committeeName;
  const [report, setReport] = useState<CommitteeReport | null>(null);
  const [form, setForm] = useState<ReportFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      if (!isEligible || !committeeName) {
        setLoading(false);
        return;
      }
      try {
        const existing = await getReportForCommittee(session.eventId, committeeName);
        if (existing) {
          setReport(existing);
          setForm({
            background: existing.background || "",
            current_challenges: existing.current_challenges || "",
            findings: existing.findings || "",
            recommendations: existing.recommendations || "",
            proposed_solutions: existing.proposed_solutions || "",
          });
        }
      } catch {
        toast.error("Failed to load the committee report");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoSave = useCallback(
    (newForm: ReportFormData) => {
      if (!isEligible || !committeeName) return;
      if (report && report.status === "submitted") return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        const result = await saveReportDraft(
          session.eventId,
          committeeName,
          session.id,
          newForm
        );
        setSaving(false);
        if (result.success && !report) {
          const existing = await getReportForCommittee(session.eventId, committeeName);
          if (existing) setReport(existing);
        }
      }, 1000);
    },
    [session, isEligible, committeeName, report]
  );

  function handleChange(field: keyof ReportFormData, value: string) {
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    autoSave(newForm);
  }

  function handleManualSave() {
    if (!isEligible || !committeeName) return;
    if (report && report.status === "submitted") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startTransition(async () => {
      const result = await saveReportDraft(
        session.eventId,
        committeeName,
        session.id,
        form
      );
      if (result.success) {
        toast.success("Report saved");
        if (!report) {
          const existing = await getReportForCommittee(session.eventId, committeeName);
          if (existing) setReport(existing);
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  function confirmSubmitReport() {
    if (!report) {
      toast.error("Save your report first");
      return;
    }
    startTransition(async () => {
      const result = await submitReport(report.id, session.id);
      if (result.success) {
        toast.success("Committee Report submitted — you can now draft your bill!");
        setReport((prev) => (prev ? { ...prev, status: "submitted" } : prev));
        setConfirmSubmit(false);
      } else {
        toast.error(result.error);
        setConfirmSubmit(false);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="size-8 text-[#FF9933] animate-spin mb-3" />
        <p className="text-sm text-gray-500">Loading committee report...</p>
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="size-10 text-amber-400 mb-3" />
        <p className="font-medium text-gray-800">Committee report</p>
        <p className="text-sm text-gray-600 mt-1 max-w-xs">
          The committee report is written by committee members. You are not on a
          committee.
        </p>
      </div>
    );
  }

  const status = report?.status ?? "draft";
  const isSubmitted = status === "submitted";
  const canSubmit = !!form.findings.trim() && !!form.recommendations.trim();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="size-5 text-[#FF9933]" />
            Committee Report
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Research and agree your committee&apos;s findings — then draft the bill
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              Saving...
            </span>
          )}
          <Badge
            variant="secondary"
            className={
              isSubmitted
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-700"
            }
          >
            {isSubmitted ? (
              <CheckCircle2 className="size-3 mr-0.5" />
            ) : (
              <Clock className="size-3 mr-0.5" />
            )}
            {isSubmitted ? "Submitted" : "Draft"}
          </Badge>
        </div>
      </div>

      {/* Committee identity: number + topic, ministry as a tag, linked scheme */}
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center rounded-full bg-purple-600 px-3 py-1 text-sm font-semibold text-white">
            Committee {committeeNumber ?? "—"}
          </span>
          {committeeName && (
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
              {committeeName}
            </span>
          )}
        </div>
        {committeeTopic && (
          <div className="mt-2">
            <p className="text-sm font-medium text-gray-900">{committeeTopic}</p>
            {committeeScheme && (
              <p className="text-xs text-gray-500 mt-0.5">
                Linked scheme / policy: {committeeScheme}
              </p>
            )}
          </div>
        )}
      </div>

      {isSubmitted ? (
        /* Submitted → read-only summary + link to the bill */
        <>
          <Card>
            <CardContent className="pt-5 space-y-4">
              {FIELDS.map((f) =>
                form[f.key].trim() ? (
                  <div key={f.key}>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">
                      {f.label}
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {form[f.key]}
                    </p>
                  </div>
                ) : null
              )}
            </CardContent>
          </Card>
          <Link href="/yip/me/bill">
            <Button className="w-full bg-[#FF9933] hover:bg-[#E68A2E]">
              Go to Committee Room
              <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </Link>
        </>
      ) : (
        /* Draft → editable form */
        <Card>
          <CardContent className="pt-5 space-y-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <Label htmlFor={f.key} className="text-sm font-medium">
                  {f.label}
                  {f.required && " *"}
                </Label>
                <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>
                <Textarea
                  id={f.key}
                  value={form[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleManualSave}
                disabled={isPending}
                className="flex-1"
              >
                <Save className="size-4 mr-1.5" />
                Save Draft
              </Button>
              <Button
                onClick={() => setConfirmSubmit(true)}
                disabled={isPending || !canSubmit}
                className="flex-1 bg-[#FF9933] hover:bg-[#E68A2E]"
              >
                <Send className="size-4 mr-1.5" />
                Submit Report
              </Button>
            </div>
            {!canSubmit && (
              <p className="text-xs text-gray-400 text-center">
                Add your committee&apos;s <b>Findings</b> and{" "}
                <b>Recommendations</b> to submit.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit confirmation */}
      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Committee Report</DialogTitle>
            <DialogDescription>
              Once submitted, the report is locked and your committee can start
              drafting its bill. Make sure your findings and recommendations are
              complete. Submit now?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={confirmSubmitReport}
              className="bg-[#FF9933] hover:bg-[#E68A2E]"
            >
              {isPending ? "Submitting..." : "Yes, Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
