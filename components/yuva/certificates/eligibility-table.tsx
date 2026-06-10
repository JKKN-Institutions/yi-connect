"use client";

/**
 * Certificate eligibility table + issue panel (Phase 14) — chapter /
 * coordinator cohort page. Per student: live attendance %, default
 * eligibility tick at the threshold (≥75%), override checkbox, already-
 * issued badge (cert no + download + reissue). The "Issue certificates"
 * CTA opens a confirm dialog with exact counts and an override warning.
 *
 * Override checkboxes respect canOverrideEligibility — when blocked
 * (zero completed sessions) the checkboxes are frozen at the defaults and
 * the reason is surfaced.
 *
 * The issue plan shown here is computed with the SAME pure engine the
 * server uses (lib/yuva/issue-plan.ts) — the server recomputes it from
 * live data on submit; client state is only a proposal.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, BadgeCheck, Ban, Download, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import {
  getCertificateSignedUrl,
  issueCertificates,
  reissueCertificate,
  revokeCertificate,
} from "@/app/youth-academy/actions/certificates";
import {
  buildIssuePlan,
  type IssueOverride,
  type IssuePlanEntry,
} from "@/lib/yuva/issue-plan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { IssueDialog } from "@/components/yuva/certificates/issue-dialog";

export type EligibilityRow = {
  enrollment_id: string;
  full_name: string;
  institution_name: string | null;
  status: "active" | "completed" | "dropped";
  /** Live attendance % (computed server-side from live rows). */
  attendance_pct: number;
  certificate: {
    id: string;
    certificate_no: string;
    issued_at: string;
    revoked: boolean;
  } | null;
};

export function EligibilityTable({
  runId,
  rows,
  threshold,
  canIssue,
  blockedReason,
  overrideAllowed,
  overrideBlockedReason,
}: {
  runId: string;
  rows: EligibilityRow[];
  threshold: number;
  /** False until the run is completed/certified. */
  canIssue: boolean;
  /** Shown when canIssue is false. */
  blockedReason: string | null;
  /** canOverrideEligibility verdict (pure engine). */
  overrideAllowed: boolean;
  overrideBlockedReason: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);

  // Checkbox state: enrollment_id → include. Defaults = threshold verdict.
  const [includes, setIncludes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      rows
        .filter((r) => !r.certificate && r.status !== "dropped")
        .map((r) => [r.enrollment_id, r.attendance_pct >= threshold])
    )
  );

  // Only DEVIATIONS from the default are overrides.
  const overrides = useMemo<IssueOverride[]>(
    () =>
      rows
        .filter((r) => !r.certificate && r.status !== "dropped")
        .filter(
          (r) =>
            (includes[r.enrollment_id] ?? false) !==
            r.attendance_pct >= threshold
        )
        .map((r) => ({
          enrollment_id: r.enrollment_id,
          include: includes[r.enrollment_id] ?? false,
        })),
    [rows, includes, threshold]
  );

  // Same pure engine the server runs — preview of the plan.
  const plan = useMemo(() => {
    const entries: IssuePlanEntry[] = rows.map((r) => ({
      enrollment_id: r.enrollment_id,
      attendance_pct: r.attendance_pct,
      certificate_id: r.certificate?.id ?? null,
      enrollment_status: r.status,
    }));
    return buildIssuePlan(entries, threshold, overrides);
  }, [rows, threshold, overrides]);

  async function onDownload(certificateId: string) {
    setBusy(certificateId);
    const result = await getCertificateSignedUrl(certificateId);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    window.open(result.data.url, "_blank", "noopener");
  }

  async function onReissue(certificateId: string, name: string) {
    if (
      !window.confirm(
        `Reissue the certificate for ${name}? The certificate number stays the same — only the PDF is regenerated (e.g. after a name fix).`
      )
    ) {
      return;
    }
    setBusy(certificateId);
    const result = await reissueCertificate(certificateId);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Reissued ${result.data.certificateNo} with a fresh PDF.`);
    router.refresh();
  }

  async function onRevoke(certificateId: string, name: string) {
    if (
      !window.confirm(
        `Revoke the certificate for ${name}? The student will no longer be able to download it. This is rare — only for certificates issued in error.`
      )
    ) {
      return;
    }
    setBusy(certificateId);
    const result = await revokeCertificate(certificateId);
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Revoked ${result.data.certificateNo}.`);
    router.refresh();
  }

  async function onConfirmIssue() {
    setIssuing(true);
    const result = await issueCertificates(runId, overrides);
    setIssuing(false);
    setDialogOpen(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const { issued, skippedAlreadyCertified, failures, runCertified } =
      result.data;
    if (failures.length > 0) {
      toast.error(
        `${failures.length} certificate${failures.length === 1 ? "" : "s"} failed: ${failures[0].error}`
      );
    }
    toast.success(
      `Issued ${issued} certificate${issued === 1 ? "" : "s"}` +
        (skippedAlreadyCertified > 0
          ? ` · ${skippedAlreadyCertified} already issued`
          : "") +
        (runCertified ? " · run marked Certified" : "")
    );
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <Award className="mx-auto size-6 text-slate-400" />
        <p className="mt-2 text-sm text-slate-500">
          No cohort yet — certificates can be issued once the cohort is
          formed and the run completes.
        </p>
      </div>
    );
  }

  const issuedCount = rows.filter((r) => r.certificate).length;

  return (
    <div className="space-y-3">
      {!canIssue && blockedReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {blockedReason}
        </div>
      )}
      {canIssue && !overrideAllowed && overrideBlockedReason && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {overrideBlockedReason}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <th className="px-4 py-2.5">Student</th>
              <th className="px-4 py-2.5">Attendance</th>
              <th className="px-4 py-2.5">Eligible (≥{threshold}%)</th>
              <th className="px-4 py-2.5">Issue</th>
              <th className="px-4 py-2.5 text-right">Certificate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const defaultEligible = row.attendance_pct >= threshold;
              const checked = includes[row.enrollment_id] ?? false;
              const isOverridden =
                !row.certificate &&
                row.status !== "dropped" &&
                checked !== defaultEligible;
              return (
                <tr key={row.enrollment_id}>
                  <td className="px-4 py-2.5">
                    <p
                      className={cn(
                        "font-medium text-slate-900",
                        row.status === "dropped" &&
                          "text-slate-400 line-through"
                      )}
                    >
                      {row.full_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.institution_name ?? ""}
                      {row.status === "dropped" && (
                        <span className="text-rose-500"> · dropped</span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {row.status === "dropped" ? "—" : `${row.attendance_pct}%`}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.status === "dropped" ? (
                      <span className="text-slate-400">—</span>
                    ) : defaultEligible ? (
                      <span className="font-medium text-emerald-600">✓</span>
                    ) : (
                      <span className="font-medium text-rose-500">✗</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.certificate || row.status === "dropped" ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Checkbox
                          checked={checked}
                          disabled={!canIssue || !overrideAllowed}
                          onCheckedChange={(value) =>
                            setIncludes((m) => ({
                              ...m,
                              [row.enrollment_id]: value === true,
                            }))
                          }
                          aria-label={`Issue certificate to ${row.full_name}`}
                        />
                        {isOverridden && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 uppercase">
                            override
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.certificate ? (
                      <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {row.certificate.revoked ? (
                          <Badge
                            variant="outline"
                            className="border-rose-200 bg-rose-50 text-rose-600"
                          >
                            <Ban className="size-3" />
                            Revoked · {row.certificate.certificate_no}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            <BadgeCheck className="size-3" />
                            {row.certificate.certificate_no}
                          </Badge>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          disabled={busy === row.certificate.id}
                          onClick={() => onDownload(row.certificate!.id)}
                          title="Download PDF"
                        >
                          <Download className="size-3.5" />
                        </Button>
                        {!row.certificate.revoked && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              disabled={busy === row.certificate.id}
                              onClick={() =>
                                onReissue(row.certificate!.id, row.full_name)
                              }
                              title="Reissue (same number, fresh PDF)"
                            >
                              <RefreshCw className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-rose-500 hover:text-rose-600"
                              disabled={busy === row.certificate.id}
                              onClick={() =>
                                onRevoke(row.certificate!.id, row.full_name)
                              }
                              title="Revoke"
                            >
                              <Ban className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">
                        not issued
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">
            {plan.toIssue.length}
          </span>{" "}
          to issue · {issuedCount} already issued · {plan.excluded.length}{" "}
          excluded
          {overrides.length > 0 && (
            <span className="text-amber-600">
              {" "}
              · {overrides.length} override{overrides.length === 1 ? "" : "s"}
            </span>
          )}
        </p>
        <Button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={!canIssue || plan.toIssue.length === 0}
          className="bg-slate-900 hover:bg-slate-800"
        >
          <Award className="size-4" />
          Issue certificates
        </Button>
      </div>

      <IssueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        toIssue={plan.toIssue.length}
        alreadyIssued={issuedCount}
        excluded={plan.excluded.length}
        overrides={overrides.length}
        issuing={issuing}
        onConfirm={onConfirmIssue}
      />
    </div>
  );
}
