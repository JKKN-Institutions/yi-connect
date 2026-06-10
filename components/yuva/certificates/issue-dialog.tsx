"use client";

/**
 * Confirm dialog for the certificate issue batch (Phase 14). Shows exact
 * counts from the issue plan and a prominent warning when any per-student
 * override deviates from the default eligibility (≥75% attendance).
 * Certificates are PUBLISHED FACTS — the confirm step is deliberate.
 */

import { AlertTriangle, Award, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function IssueDialog({
  open,
  onOpenChange,
  toIssue,
  alreadyIssued,
  excluded,
  overrides,
  issuing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toIssue: number;
  alreadyIssued: number;
  excluded: number;
  overrides: number;
  issuing: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !issuing && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="size-5 text-amber-600" />
            Issue certificates?
          </DialogTitle>
          <DialogDescription>
            Each certificate gets a permanent number, a PDF and an email to
            the student. Already-issued students are skipped automatically —
            re-running never duplicates a certificate.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
            <p className="text-xl font-bold text-emerald-700">{toIssue}</p>
            <p className="text-xs text-emerald-700">to issue</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-3 py-2.5">
            <p className="text-xl font-bold text-slate-700">{alreadyIssued}</p>
            <p className="text-xs text-slate-600">already issued</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-3 py-2.5">
            <p className="text-xl font-bold text-slate-700">{excluded}</p>
            <p className="text-xs text-slate-600">excluded</p>
          </div>
        </div>

        {overrides > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              {overrides} student{overrides === 1 ? " is" : "s are"} being
              overridden from the default ≥75% attendance rule. Double-check
              the ticks before confirming — certificate numbers are
              permanent.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={issuing}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={issuing || toIssue === 0}
            onClick={onConfirm}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {issuing && <Loader2 className="size-4 animate-spin" />}
            Issue {toIssue} certificate{toIssue === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
