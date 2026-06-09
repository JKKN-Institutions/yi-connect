"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getYipWhatsAppState,
  connectYipWhatsApp,
  getYipCodeSendPlan,
  sendYipAccessCodesBatch,
} from "@/app/yip/actions/whatsapp-codes";
import type {
  YipWaState,
  YipCodeSendPlan,
  YipBatchItemResult,
} from "@/lib/yip/whatsapp-codes-types";
import { Button } from "@/components/yip/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/yip/ui/dialog";
import { MessageCircle, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

const SAFFRON = "#FF9933";
const BATCH_SIZE = 5;
const POLL_MS = 3000;

const STATUS_LABELS: Record<YipWaState["status"], string> = {
  disconnected: "Disconnected",
  connecting: "Connecting…",
  qr_ready: "Waiting for QR scan",
  authenticated: "Authenticated",
  ready: "Ready",
};

type FlowStage = "summary" | "confirm" | "sending" | "done";

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function WhatsAppSendCodes({
  eventId,
}: {
  eventId: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  // Loading + data
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [waState, setWaState] = useState<YipWaState | null>(null);
  const [plan, setPlan] = useState<YipCodeSendPlan | null>(null);

  // Connect flow
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Connect-once guard. The bridge is a SINGLE global WhatsApp session, so
  // calling /connect more than once spawns competing sessions and the bridge
  // never reaches "ready". This ref is flipped true the instant a connect is
  // initiated and is NOT cleared by the poll loop — so the auto-connect effect
  // can fire exactly once per dialog session. It is reset only by the explicit
  // "Reconnect" button (handleReconnect) or when the dialog closes.
  const connectGuardRef = useRef(false);

  // Send flow
  const [stage, setStage] = useState<FlowStage>("summary");
  const [sentCount, setSentCount] = useState(0);
  const [failedResults, setFailedResults] = useState<YipBatchItemResult[]>([]);
  const [sendTotal, setSendTotal] = useState(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshPlan = useCallback(async () => {
    const res = await getYipCodeSendPlan(eventId);
    if (res.success) {
      setPlan(res.data);
    }
  }, [eventId]);

  // Initial load when dialog opens
  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [stateRes, planRes] = await Promise.all([
      getYipWhatsAppState(eventId),
      getYipCodeSendPlan(eventId),
    ]);
    if (stateRes.success) {
      setWaState(stateRes.data);
    } else {
      setLoadError(stateRes.error);
    }
    if (planRes.success) {
      setPlan(planRes.data);
    } else if (stateRes.success) {
      // Only surface plan error if state loaded fine.
      setLoadError(planRes.error);
    }
    setLoading(false);
  }, [eventId]);

  // React to open/close
  useEffect(() => {
    if (open) {
      // Reset send flow whenever reopened.
      setStage("summary");
      setSentCount(0);
      setFailedResults([]);
      setSendTotal(0);
      // Fresh dialog session → allow exactly one auto-connect again.
      connectGuardRef.current = false;
      void loadInitial();
    } else {
      stopPolling();
      // Closing ends this connect session; next open may auto-connect once.
      connectGuardRef.current = false;
    }
    return () => {
      stopPolling();
    };
  }, [open, loadInitial, stopPolling]);

  // Polling tick — STATUS ONLY. This never calls connect; re-calling connect on
  // the poll loop is what spawned competing bridge sessions and stopped the
  // bridge ever reaching "ready".
  const pollState = useCallback(async () => {
    const res = await getYipWhatsAppState(eventId);
    if (!res.success) return;
    setWaState(res.data);
    if (res.data.status === "ready") {
      stopPolling();
      await refreshPlan();
    }
  }, [eventId, stopPolling, refreshPlan]);

  // Idempotent: start the 3s status poll if it isn't already running.
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      void pollState();
    }, POLL_MS);
  }, [pollState]);

  // Fire the bridge connect EXACTLY ONCE. Guarded so neither the auto-connect
  // effect nor a double-click can launch a second competing session. Always
  // begins the status poll so the QR / state updates flow in without re-connect.
  const fireConnect = useCallback(async () => {
    if (connectGuardRef.current) return; // already connecting/connected this session
    connectGuardRef.current = true;
    setConnecting(true);
    const res = await connectYipWhatsApp(eventId);
    setConnecting(false);
    if (res.success) {
      setWaState(res.data);
      if (res.data.status === "ready") {
        stopPolling();
        await refreshPlan();
      } else {
        startPolling();
      }
    } else {
      // Connect call itself failed — surface the reason and release the guard so
      // the user can hit Reconnect to retry (no automatic retry loop).
      connectGuardRef.current = false;
      setWaState((prev) => (prev ? { ...prev, error: res.error } : prev));
    }
  }, [eventId, refreshPlan, startPolling, stopPolling]);

  // Explicit user "Reconnect" for the genuinely-stuck case: clear the guard and
  // fire a single fresh connect. This is the ONLY path that re-triggers connect.
  const handleReconnect = useCallback(async () => {
    connectGuardRef.current = false;
    await fireConnect();
  }, [fireConnect]);

  // Auto-connect ONCE when the dialog is open, the service is configured, and
  // the bridge is sitting at "disconnected". The guard inside fireConnect makes
  // this safe to depend on waState — it can only ever fire a single connect per
  // dialog session; the poll loop thereafter only reads status.
  useEffect(() => {
    if (!open) return;
    if (!waState?.configured) return;
    if (waState.status === "ready") return;
    if (waState.status === "disconnected" && !connectGuardRef.current) {
      // Defer the external-system call out of the synchronous effect body.
      // fireConnect owns the guard (set synchronously at its top), so even
      // across the microtask boundary only a single connect can ever fire.
      queueMicrotask(() => {
        void fireConnect();
      });
    } else if (!connectGuardRef.current) {
      // Bridge already mid-handshake (connecting/qr_ready/authenticated) without
      // us having called connect this session — adopt it and just poll status,
      // never connect on top of an in-progress session.
      connectGuardRef.current = true;
      startPolling();
    }
  }, [open, waState?.configured, waState?.status, fireConnect, startPolling]);

  function pendingRecipients() {
    if (!plan) return [];
    return plan.recipients.filter((r) => r.hasPhone && !r.alreadySent);
  }

  async function runSend(ids: string[]) {
    if (ids.length === 0) return;
    setStage("sending");
    setSendTotal(ids.length);
    setSentCount(0);
    setFailedResults([]);

    let sent = 0;
    const failures: YipBatchItemResult[] = [];
    const planById = new Map(plan?.recipients.map((r) => [r.participantId, r]) ?? []);

    for (const batch of chunk(ids, BATCH_SIZE)) {
      const res = await sendYipAccessCodesBatch(eventId, batch);
      if (res.success) {
        for (const item of res.data.results) {
          if (item.success) {
            sent += 1;
          } else {
            failures.push(item);
          }
        }
      } else {
        // Whole batch failed — mark all 5 (or fewer) as failed and continue.
        for (const id of batch) {
          const rec = planById.get(id);
          failures.push({
            participantId: id,
            fullName: rec?.fullName ?? "Unknown student",
            success: false,
            error: res.error,
          });
        }
      }
      setSentCount(sent);
      setFailedResults([...failures]);
    }

    setStage("done");
    // Refresh plan so alreadySent reflects the new state.
    await refreshPlan();
  }

  const sending = stage === "sending";

  // Look up serial number for a failed participant (for the failure list).
  function serialFor(participantId: string): number | null {
    return (
      plan?.recipients.find((r) => r.participantId === participantId)?.serialNo ??
      null
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Don't fight the X; just allow it. We warn during sending instead.
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        <MessageCircle className="size-4" />
        WhatsApp Codes
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send access codes on WhatsApp</DialogTitle>
          <DialogDescription>
            Send each student their private login code from the connected Yi
            WhatsApp number.
          </DialogDescription>
        </DialogHeader>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin" style={{ color: SAFFRON }} />
          </div>
        )}

        {/* Hard load error */}
        {!loading && loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {/* Not configured */}
        {!loading && !loadError && waState && !waState.configured && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>WhatsApp service not configured</span>
          </div>
        )}

        {/* Configured but not ready → connect / QR */}
        {!loading &&
          !loadError &&
          waState &&
          waState.configured &&
          waState.status !== "ready" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Connection</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  <span className="size-2 rounded-full bg-amber-400" />
                  {STATUS_LABELS[waState.status]}
                </span>
              </div>

              {waState.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {waState.error}
                </div>
              )}

              {/* Bridge's own last failure — tells the organiser WHY it isn't
                  connecting (e.g. session conflict, auth failure). */}
              {waState.lastError && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <span className="font-medium">Last error:</span>{" "}
                    {waState.lastError}
                  </span>
                </div>
              )}

              {waState.qrCode ? (
                <div className="space-y-3 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={waState.qrCode}
                    alt="Scan with the Yi WhatsApp phone"
                    className="mx-auto h-56 w-56 rounded-lg border"
                  />
                  <p className="text-xs text-gray-500">
                    Open WhatsApp on the Yi phone → Linked devices → Link a
                    device
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Connection is established automatically; show progress
                      instead of a connect button that could spawn a second
                      bridge session. */}
                  <p className="flex items-center justify-center gap-2 text-center text-sm text-gray-600">
                    <Loader2 className="size-4 animate-spin" />
                    {connecting
                      ? "Connecting…"
                      : "Waiting for the WhatsApp bridge…"}
                  </p>
                  {/* Explicit escape hatch for the genuinely-stuck case. Single
                      fresh connect; never an automatic repeat. */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => void handleReconnect()}
                    disabled={connecting}
                  >
                    <MessageCircle className="size-4" />
                    Reconnect
                  </Button>
                </div>
              )}
            </div>
          )}

        {/* Ready → summary / confirm / sending / done */}
        {!loading &&
          !loadError &&
          waState &&
          waState.configured &&
          waState.status === "ready" &&
          plan && (
            <div className="space-y-4">
              {/* Summary card (always shown except mid-send / done detail) */}
              {(stage === "summary" || stage === "confirm") && (
                <>
                  <div className="rounded-xl border bg-gray-50 p-3 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold text-gray-900">
                        {plan.withPhone}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-gray-900">
                        {plan.total}
                      </span>{" "}
                      students have phone numbers ·{" "}
                      <span className="font-semibold text-gray-900">
                        {plan.alreadySent}
                      </span>{" "}
                      already sent
                    </p>
                  </div>

                  {(() => {
                    const pending = pendingRecipients();
                    const n = pending.length;

                    if (stage === "summary") {
                      if (n === 0) {
                        return (
                          <div className="flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
                            <CheckCircle2 className="size-4" />
                            All codes sent ✓
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-1.5">
                          <Button
                            className="w-full text-white"
                            style={{ backgroundColor: SAFFRON }}
                            onClick={() => setStage("confirm")}
                          >
                            Send codes to {n} student{n === 1 ? "" : "s"}
                          </Button>
                          <p className="text-center text-xs text-gray-500">
                            Re-send is skipped automatically
                          </p>
                        </div>
                      );
                    }

                    // confirm
                    return (
                      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm text-amber-900">
                          This sends a WhatsApp message with each student&apos;s
                          private login code, from the connected Yi number.
                          Proceed?
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
                              void runSend(pending.map((r) => r.participantId))
                            }
                          >
                            Yes, send {n}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Sending progress */}
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
                                ((sentCount + failedResults.length) /
                                  sendTotal) *
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

              {/* Done */}
              {stage === "done" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
                    <CheckCircle2 className="size-4" />
                    Sent {sentCount} of {sendTotal}
                  </div>

                  {failedResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">
                        Could not send to {failedResults.length} student
                        {failedResults.length === 1 ? "" : "s"}:
                      </p>
                      <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border bg-white p-2">
                        {failedResults.map((f) => {
                          const serial = serialFor(f.participantId);
                          return (
                            <div
                              key={f.participantId}
                              className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700"
                            >
                              <span className="font-medium">
                                {serial != null ? `${serial} · ` : ""}
                                {f.fullName}
                              </span>
                              <span className="block text-red-600">
                                {f.error ?? "Unknown error"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <Button
                        className="w-full text-white"
                        style={{ backgroundColor: SAFFRON }}
                        onClick={() =>
                          void runSend(
                            failedResults.map((f) => f.participantId)
                          )
                        }
                      >
                        Retry failed ({failedResults.length})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
