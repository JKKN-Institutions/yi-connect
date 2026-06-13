"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getYipEmailCodePlan,
  sendYipAccessCodeEmailsBatch,
} from "@/app/yip/actions/email-codes";
import type {
  YipEmailSendPlan,
  YipEmailBatchItemResult,
} from "@/lib/yip/email-codes-types";
import { Button } from "@/components/yip/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/yip/ui/dialog";
import { Mail, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

const SAFFRON = "#FF9933";
// Server action caps each call at 50 (Resend batch limit is 100); 50 keeps the
// serverless call snappy and gives the progress bar a few steps for a full event.
const BATCH_SIZE = 50;

type FlowStage = "summary" | "confirm" | "sending" | "done";

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Email each participant their private access code via Resend — the reliable
 * alternative to the WhatsApp bridge. No connection step: the email service is
 * always ready, so this dialog goes straight to the send plan.
 */
export function EmailSendCodes({
  eventId,
}: {
  eventId: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [plan, setPlan] = useState<YipEmailSendPlan | null>(null);

  const [stage, setStage] = useState<FlowStage>("summary");
  const [sentCount, setSentCount] = useState(0);
  const [failedResults, setFailedResults] = useState<YipEmailBatchItemResult[]>(
    []
  );
  const [sendTotal, setSendTotal] = useState(0);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await getYipEmailCodePlan(eventId);
    if (res.success) {
      setPlan(res.data);
    } else {
      setLoadError(res.error);
    }
    setLoading(false);
  }, [eventId]);

  // Load the plan each time the dialog opens; reset the flow on close.
  useEffect(() => {
    if (open) {
      setStage("summary");
      setSentCount(0);
      setFailedResults([]);
      setSendTotal(0);
      void loadPlan();
    }
  }, [open, loadPlan]);

  const pendingRecipients = useCallback(
    () => (plan?.recipients ?? []).filter((r) => r.hasEmail),
    [plan]
  );

  const runSend = useCallback(
    async (ids: string[]) => {
      setStage("sending");
      setSentCount(0);
      setFailedResults([]);
      setSendTotal(ids.length);

      const failures: YipEmailBatchItemResult[] = [];
      let sent = 0;
      for (const batch of chunk(ids, BATCH_SIZE)) {
        const res = await sendYipAccessCodeEmailsBatch(eventId, batch);
        if (res.success) {
          for (const r of res.data.results) {
            if (r.success) sent++;
            else failures.push(r);
          }
        } else {
          // Whole batch call failed — count each as failed and keep going.
          for (const id of batch) {
            failures.push({
              participantId: id,
              fullName: "",
              success: false,
              error: res.error,
            });
          }
        }
        setSentCount(sent);
        setFailedResults([...failures]);
      }
      setStage("done");
    },
    [eventId]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Mail className="size-4" />
        Email Codes
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send access codes by email</DialogTitle>
          <DialogDescription>
            Email each student their private login code. Sent individually from
            the Yi address — one student per email, no addresses shared.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-gray-600">
            <Loader2 className="size-4 animate-spin" />
            Checking who has an email…
          </p>
        )}

        {!loading && loadError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {!loading && !loadError && plan && (
          <div className="space-y-4">
            {(stage === "summary" || stage === "confirm") && (
              <>
                <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
                  <p>
                    <span className="font-semibold text-gray-900">
                      {plan.withEmail}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-gray-900">
                      {plan.total}
                    </span>{" "}
                    students have an email on file
                    {plan.withEmail < plan.total && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="font-semibold text-gray-900">
                          {plan.total - plan.withEmail}
                        </span>{" "}
                        will be skipped
                      </>
                    )}
                  </p>
                </div>

                {(() => {
                  const n = pendingRecipients().length;
                  if (n === 0) {
                    return (
                      <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700">
                        <AlertTriangle className="size-4" />
                        No students have a sendable email
                      </div>
                    );
                  }
                  if (stage === "summary") {
                    return (
                      <Button
                        className="w-full text-white"
                        style={{ backgroundColor: SAFFRON }}
                        onClick={() => setStage("confirm")}
                      >
                        Email codes to {n} student{n === 1 ? "" : "s"}
                      </Button>
                    );
                  }
                  // confirm
                  return (
                    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm text-amber-900">
                        This emails each of the {n} student
                        {n === 1 ? "" : "s"} their private login code. Sending
                        again re-sends the same code. Proceed?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setStage("summary")}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1 text-white"
                          style={{ backgroundColor: SAFFRON }}
                          onClick={() =>
                            void runSend(
                              pendingRecipients().map((r) => r.participantId)
                            )
                          }
                        >
                          Yes, email {n}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {stage === "sending" && (
              <div className="space-y-3">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: SAFFRON,
                      width: `${
                        sendTotal === 0
                          ? 0
                          : Math.round(
                              ((sentCount + failedResults.length) / sendTotal) *
                                100
                            )
                      }%`,
                    }}
                  />
                </div>
                <p className="text-center text-sm text-gray-600">
                  Sent {sentCount} · Failed {failedResults.length}
                </p>
                <p className="flex items-center justify-center gap-2 text-center text-xs text-gray-500">
                  <Loader2 className="size-3.5 animate-spin" />
                  Keep this dialog open while sending…
                </p>
              </div>
            )}

            {stage === "done" && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
                  <CheckCircle2 className="size-4" />
                  Emailed {sentCount} of {sendTotal}
                </div>

                {failedResults.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p className="font-medium">
                      {failedResults.length} could not be sent:
                    </p>
                    <ul className="max-h-32 list-disc space-y-0.5 overflow-auto pl-5 text-xs">
                      {failedResults.slice(0, 20).map((f, i) => (
                        <li key={`${f.participantId}-${i}`}>
                          {f.fullName || f.participantId}
                          {f.error ? ` — ${f.error}` : ""}
                        </li>
                      ))}
                      {failedResults.length > 20 && (
                        <li>…and {failedResults.length - 20} more</li>
                      )}
                    </ul>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStage("summary");
                    void loadPlan();
                  }}
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
