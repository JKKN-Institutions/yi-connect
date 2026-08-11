"use client";

/**
 * Formation invite panel — emails every participant their access-code deep
 * link so they can vote from home. Mirrors the email-codes batch flow: a
 * masked-email plan preview, ≤50-per-batch sends with a progress bar, a
 * failed-recipient list, and per-participant code re-issue.
 *
 * Server actions come from ./_stubs until Lane B merges (single-file swap).
 */

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
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
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Loader2,
  Mail,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/yip/utils";
import { INK, SAFFRON, SERIF } from "@/app/yip/me/credential-ui";
import {
  reissueFormationCode,
  sendFormationInvites,
} from "@/app/yip/actions/formation-emails";
import type {
  FormationEmailBatchItemResult,
  FormationEmailSendPlan as FormationInvitePlan,
  FormationQuotaCheck,
} from "@/lib/yip/formation-email-types";

/** Resend batch ceiling — mirrors EMAIL_BATCH_MAX in email-codes.ts. */
const INVITE_BATCH_MAX = 50;

interface InvitePanelProps {
  eventId: string;
  plan: FormationInvitePlan | null;
  planError: string | null;
}

export function InvitePanel({ eventId, plan, planError }: InvitePanelProps) {
  const [listOpen, setListOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [failures, setFailures] = useState<FormationEmailBatchItemResult[]>([]);
  const [quota, setQuota] = useState<FormationQuotaCheck | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reissueFor, setReissueFor] = useState<{
    participantId: string;
    fullName: string;
  } | null>(null);
  const [reissuing, setReissuing] = useState(false);

  const sendable = useMemo(
    () => (plan?.recipients ?? []).filter((r) => r.hasEmail),
    [plan]
  );
  const missing = useMemo(
    () => (plan?.recipients ?? []).filter((r) => !r.hasEmail),
    [plan]
  );

  async function runSend() {
    setConfirmOpen(false);
    if (sendable.length === 0) return;
    setSending(true);
    setFailures([]);
    setQuota(null);
    setProgress({ done: 0, total: sendable.length });

    const allFailures: FormationEmailBatchItemResult[] = [];
    let lastQuota: FormationQuotaCheck | null = null;
    let halted: string | null = null;

    // Sequential ≤50 batches (the email-codes client pattern) so progress is
    // honest and a quota refusal stops the run instead of hammering Resend.
    for (let i = 0; i < sendable.length; i += INVITE_BATCH_MAX) {
      const batch = sendable.slice(i, i + INVITE_BATCH_MAX);
      const res = await sendFormationInvites(
        eventId,
        batch.map((r) => r.participantId)
      );
      if (!res.success) {
        halted = res.error;
        break;
      }
      lastQuota = res.data.quota;
      allFailures.push(...res.data.results.filter((r) => !r.success));
      setProgress({
        done: Math.min(i + batch.length, sendable.length),
        total: sendable.length,
      });
      setQuota(res.data.quota);
      if (!res.data.quota.ok) {
        halted = res.data.quota.reason ?? "Daily email quota reached";
        break;
      }
    }

    setSending(false);
    setFailures(allFailures);
    if (halted) {
      toast.error(`Sending stopped: ${halted}`);
    } else {
      const sent = sendable.length - allFailures.length;
      toast.success(
        `Invites sent to ${sent} participant${sent === 1 ? "" : "s"}` +
          (allFailures.length > 0 ? ` · ${allFailures.length} failed` : "") +
          (lastQuota
            ? ` · ${lastQuota.sentToday}/${lastQuota.dailyCap} emails used today`
            : "")
      );
    }
  }

  async function runReissue() {
    if (!reissueFor) return;
    setReissuing(true);
    const res = await reissueFormationCode(eventId, reissueFor.participantId);
    setReissuing(false);
    if (res.success) {
      toast.success(
        `New code issued and emailed to ${reissueFor.fullName}. The old code no longer works.`
      );
      setReissueFor(null);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: SAFFRON }}
        >
          Remote voting access
        </p>
        <CardTitle
          className="flex items-center gap-2 text-sm"
          style={{ ...SERIF, color: INK }}
        >
          <Mail className="size-4 text-[#FF9933]" />
          Invites & Access Codes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {planError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Invite plan unavailable: {planError}
          </p>
        ) : !plan ? (
          <p className="text-sm text-muted-foreground">No invite plan yet.</p>
        ) : (
          <>
            {/* Plan summary */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge className="bg-[#1a1a3e]/5 text-[#1a1a3e]">
                {plan.total} participants
              </Badge>
              <Badge className="bg-[#138808]/10 text-[#138808]">
                {plan.withEmail} with email
              </Badge>
              {missing.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700">
                  <AlertTriangle className="mr-1 size-3" />
                  {missing.length} without email
                </Badge>
              )}
            </div>

            {/* Quota banner (surfaced from the last send) */}
            {quota && !quota.ok && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Email quota: {quota.reason ?? "daily cap reached"} —{" "}
                {quota.sentToday}/{quota.dailyCap} used today.
              </p>
            )}

            {/* Send + progress */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                disabled={sending || sendable.length === 0}
                onClick={() => setConfirmOpen(true)}
              >
                {sending ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 size-3.5" />
                )}
                {sending
                  ? "Sending…"
                  : `Email invites to ${sendable.length} participants`}
              </Button>
              {progress && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {progress.done} / {progress.total} processed
                </span>
              )}
            </div>
            {progress && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF9933] to-[#E68A2E] transition-all duration-300"
                  style={{
                    width: `${
                      progress.total > 0
                        ? (progress.done / progress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            )}

            {/* Failed sends */}
            {failures.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-700">
                  {failures.length} failed — fix and re-send:
                </p>
                <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-red-700">
                  {failures.map((f) => (
                    <li key={f.participantId}>
                      {f.fullName}
                      {f.error ? ` — ${f.error}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recipient list (masked emails) + per-row re-issue */}
            <div className="rounded-md border bg-white">
              <button
                type="button"
                onClick={() => setListOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-700"
              >
                <span className="flex items-center gap-1.5">
                  {listOpen ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                  Who receives an invite ({plan.recipients.length})
                </span>
              </button>
              {listOpen && (
                <div className="max-h-72 space-y-1 overflow-y-auto border-t px-3 py-2">
                  {plan.recipients.map((r) => (
                    <div
                      key={r.participantId}
                      className="flex items-center justify-between gap-2 rounded-md border bg-gray-50/60 px-2.5 py-1.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-800">
                          {r.serialNo != null && (
                            <span className="text-gray-400">
                              #{r.serialNo}{" "}
                            </span>
                          )}
                          {r.fullName}
                        </p>
                        <p
                          className={cn(
                            "text-[11px]",
                            r.hasEmail ? "text-gray-500" : "text-amber-600"
                          )}
                        >
                          {r.hasEmail
                            ? r.emailMasked
                            : "No usable email — invite cannot be sent"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 px-2 text-[11px]"
                        disabled={sending || !r.hasEmail}
                        onClick={() =>
                          setReissueFor({
                            participantId: r.participantId,
                            fullName: r.fullName,
                          })
                        }
                      >
                        <KeyRound className="mr-1 size-3" />
                        Re-issue code
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      {/* Confirm bulk send */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email formation invites</DialogTitle>
            <DialogDescription>
              Send {sendable.length} participants their personal sign-in link
              and access code for remote voting. Participants without an email
              ({missing.length}) are skipped and listed above.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void runSend()}>Send invites</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm re-issue */}
      <Dialog
        open={!!reissueFor}
        onOpenChange={(open) => {
          if (!open) setReissueFor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-issue access code</DialogTitle>
            <DialogDescription>
              {reissueFor
                ? `Generate a fresh code for ${reissueFor.fullName} and email it to them. Their old code stops working immediately — use this when a code is lost or leaked.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={reissuing}
              onClick={() => setReissueFor(null)}
            >
              Cancel
            </Button>
            <Button disabled={reissuing} onClick={() => void runReissue()}>
              {reissuing ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                  Issuing…
                </>
              ) : (
                "Re-issue & email"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
