import type { Metadata } from "next";
import Link from "next/link";
import { getWhatsAppStatus } from "@/app/actions/whatsapp";
import { ConnectClient } from "./ConnectClient";

export const metadata: Metadata = {
  title: "Connect WhatsApp · Yi National · Yi Future 6.0",
};

// ─────────────────────────────────────────────────────────────────────
// /yi-future/national/admin/whatsapp-connect
//
// Platform-admin surface to link the shared Yi WhatsApp number (BYOW).
// Auto-gated by the /national/admin layout (platform-admin only). The
// connection is a single shared session — once linked here, the WhatsApp
// Outreach page can send nudges + login info to chapter chairs.
// ─────────────────────────────────────────────────────────────────────

export default async function WhatsAppConnectPage(): Promise<React.JSX.Element> {
  const status = (await getWhatsAppStatus()) as {
    status:
      | "disconnected"
      | "connecting"
      | "qr_ready"
      | "authenticated"
      | "ready"
      | "not_configured";
    qrCode: string | null;
    error: string | null;
    isReady: boolean;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-navy">Connect WhatsApp</h2>
        <p className="mt-1 text-sm text-navy/60">
          Link the shared Yi WhatsApp number used for chapter outreach. One
          number serves the whole platform — connect once.
        </p>
      </div>

      <div className="rounded-md border border-yi-gold/30 bg-yi-gold/5 px-4 py-3 text-xs text-navy/70">
        <span className="font-semibold">How it works:</span> this uses your
        personal/organisation WhatsApp via a linked device (like WhatsApp
        Web). Messages appear as sent from this number. Keep the linked phone
        online. Avoid high-volume blasts — WhatsApp may flag automated sending.
      </div>

      <ConnectClient initial={status} />

      <div className="pt-2">
        <Link
          href="/yi-future/national/admin/whatsapp-outreach"
          className="text-xs font-semibold text-navy hover:text-yi-gold"
        >
          → Go to WhatsApp Outreach
        </Link>
      </div>
    </div>
  );
}
