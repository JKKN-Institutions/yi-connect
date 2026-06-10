"use client";

/**
 * Expanded applicant detail + accept/reject controls (Phase 9).
 * Shows the full form answers (institution, YUVA membership claim,
 * motivation), an optional review note, and accept/reject buttons. Review
 * controls are hidden when the run is not reviewable or the applicant is
 * already enrolled.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  acceptApplication,
  rejectApplication,
} from "@/app/youth-academy/actions/applications";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationQueueRow } from "./data";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-700">{value}</dd>
    </div>
  );
}

export function ApplicationReviewCard({
  application,
  canReview,
}: {
  application: ApplicationQueueRow;
  /** False when the run status forbids review or the applicant is enrolled. */
  canReview: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState(application.review_note ?? "");
  const [submitting, setSubmitting] = useState<"accept" | "reject" | null>(
    null
  );

  async function review(decision: "accept" | "reject") {
    setSubmitting(decision);
    const action =
      decision === "accept" ? acceptApplication : rejectApplication;
    const result = await action({
      applicationId: application.id,
      reviewNote: note.trim() || undefined,
    });
    setSubmitting(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.warning) {
      toast(result.warning, { icon: "⚠️", duration: 6000 });
    }
    toast.success(
      decision === "accept" ? "Application accepted." : "Application rejected."
    );
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Email" value={application.email} />
        <Field label="Phone" value={application.phone} />
        <Field label="Date of birth" value={application.dob} />
        <Field label="Institution" value={application.institution_name} />
        <Field label="Degree" value={application.degree} />
        <Field label="Year of study" value={application.year_of_study} />
        <Field
          label="YUVA membership claim"
          value={application.yuva_member_claim}
        />
        <Field
          label="Applied"
          value={new Date(application.created_at).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          })}
        />
      </dl>

      <div>
        <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
          Motivation
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
          {application.motivation}
        </p>
      </div>

      {canReview ? (
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Review note (optional — kept with the application)"
            rows={2}
            maxLength={2000}
            className="bg-white"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => review("accept")}
              disabled={submitting !== null}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {submitting === "accept" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => review("reject")}
              disabled={submitting !== null}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              {submitting === "reject" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <X className="size-4" />
              )}
              Reject
            </Button>
          </div>
        </div>
      ) : (
        application.review_note && (
          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              Review note
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {application.review_note}
            </p>
          </div>
        )
      )}
    </div>
  );
}
