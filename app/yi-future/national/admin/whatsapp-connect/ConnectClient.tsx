"use client";

// ─────────────────────────────────────────────────────────────────────
// Platform-admin WhatsApp connect island (BYOW).
//
// Reuses the SHARED single-session service actions (connectWhatsApp /
// getWhatsAppStatus / disconnectWhatsAppAction). One Yi WhatsApp number
// is linked here and every outreach send across the app flows through it.
// Scan once; the session persists on the Railway service (provided a
// persistent volume is mounted at /app/.wwebjs_auth — see deploy runbook).
// ─────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import {
  connectWhatsApp,
  disconnectWhatsAppAction,
  getWhatsAppStatus,
} from "@/app/actions/whatsapp";

type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "authenticated"
  | "ready"
  | "not_configured";

type StatusInfo = {
  status: ConnectionStatus;
  qrCode: string | null;
  error: string | null;
  isReady: boolean;
};

export function ConnectClient({
  initial,
}: {
  initial: StatusInfo;
}): React.JSX.Element {
  const [info, setInfo] = useState<StatusInfo>(initial);
  const [busy, setBusy] = useState<null | "connect" | "disconnect">(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = (await getWhatsAppStatus()) as StatusInfo;
      setInfo(s);
      if (s.isReady || s.status === "not_configured") stopPoll();
    } catch {
      /* transient — keep polling */
    }
  }, [stopPoll]);

  // Poll while mid-connect (qr_ready / connecting / authenticated)
  useEffect(() => {
    const mid =
      info.status === "connecting" ||
      info.status === "qr_ready" ||
      info.status === "authenticated";
    if (mid && !pollRef.current) {
      pollRef.current = setInterval(refresh, 2000);
    }
    return stopPoll;
  }, [info.status, refresh, stopPoll]);

  const handleConnect = useCallback(async () => {
    setBusy("connect");
    try {
      const res = await connectWhatsApp();
      // connectWhatsApp returns {success,status,qrCode?,error?}
      setInfo((prev) => ({
        ...prev,
        status: (res as { status?: ConnectionStatus }).status ?? "connecting",
        qrCode: (res as { qrCode?: string | null }).qrCode ?? null,
        error: (res as { error?: string | null }).error ?? null,
        isReady: false,
      }));
      await refresh();
    } catch (e) {
      setInfo((prev) => ({
        ...prev,
        error: e instanceof Error ? e.message : "Failed to start connection.",
      }));
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const handleDisconnect = useCallback(async () => {
    setBusy("disconnect");
    try {
      await disconnectWhatsAppAction();
      stopPoll();
      setInfo({ status: "disconnected", qrCode: null, error: null, isReady: false });
    } catch (e) {
      setInfo((prev) => ({
        ...prev,
        error: e instanceof Error ? e.message : "Failed to disconnect.",
      }));
    } finally {
      setBusy(null);
    }
  }, [stopPoll]);

  if (info.status === "not_configured") {
    return (
      <div className="rounded-lg border border-yi-saffron/40 bg-yi-saffron/5 p-5 text-sm text-navy/80">
        <p className="font-semibold text-navy">WhatsApp service not configured</p>
        <p className="mt-1">
          The shared WhatsApp service isn&apos;t reachable. A platform admin
          must deploy the Railway service and set{" "}
          <code className="font-mono text-xs">WHATSAPP_SERVICE_URL</code> +{" "}
          <code className="font-mono text-xs">WHATSAPP_API_KEY</code> in the
          Vercel project, then reload this page.
        </p>
      </div>
    );
  }

  if (info.isReady || info.status === "ready") {
    return (
      <div className="rounded-lg border border-yi-green/40 bg-yi-green/5 p-5">
        <p className="text-sm font-semibold text-yi-green">
          ✓ WhatsApp connected
        </p>
        <p className="mt-1 text-sm text-navy/70">
          The Yi number is linked. All outreach sends through it. Keep the
          linked phone online so the session stays alive.
        </p>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={busy === "disconnect"}
          className="mt-4 rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-40"
        >
          {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-navy/10 bg-white p-5">
      {info.qrCode && (info.status === "qr_ready" || info.status === "authenticated") ? (
        <div className="text-center">
          <p className="text-sm font-semibold text-navy">
            Scan with WhatsApp → Settings → Linked Devices → Link a Device
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={info.qrCode}
            alt="WhatsApp QR code"
            className="mx-auto mt-3 h-56 w-56"
          />
          <p className="mt-2 text-xs text-navy/50">
            Waiting for scan… this refreshes automatically.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-navy/70">
            Link the Yi WhatsApp number used for chapter outreach. You&apos;ll
            scan a QR with the phone that owns the number.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy === "connect"}
            className="mt-4 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-ivory hover:bg-navy-dark disabled:opacity-50"
          >
            {busy === "connect" ? "Starting…" : "Connect WhatsApp"}
          </button>
        </div>
      )}
      {info.error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {info.error}
        </p>
      )}
    </div>
  );
}
