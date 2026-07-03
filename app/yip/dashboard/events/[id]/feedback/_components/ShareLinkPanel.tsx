"use client";

/**
 * Organizer-only control (rendered on the feedback report page) to mint / copy
 * / revoke a public, no-login share link. The link opens the report with
 * respondent names stripped (server-side), so it is safe to forward to
 * committee members who don't have platform accounts.
 *
 * print:hidden — never appears in the printed PDF.
 */
import { useState, useTransition } from "react";
import { Link2, Copy, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createFeedbackShareLink,
  revokeFeedbackShareLink,
} from "@/app/yip/actions/feedback-share";

export function ShareLinkPanel({
  eventId,
  initialToken,
}: {
  eventId: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const url = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/yip/r/${token}`
    : "";

  function handleCreate() {
    startTransition(async () => {
      const res = await createFeedbackShareLink(eventId);
      if (res.success) {
        setToken(res.data);
        toast.success("Share link created");
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleCopy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        toast.success("Link copied");
        setTimeout(() => setCopied(false), 1800);
      },
      () => toast.error("Couldn't copy — select and copy manually")
    );
  }

  function handleRevoke() {
    startTransition(async () => {
      const res = await revokeFeedbackShareLink(eventId);
      if (res.success) {
        setToken(null);
        toast.success("Link revoked — it no longer opens");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="print:hidden rounded-lg border border-[#E5E0D2] bg-white p-4">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-[#C96F1B]" />
        <h3 className="text-sm font-semibold text-[#20241B]">
          Share with the committee — no login needed
        </h3>
      </div>
      <p className="mt-1 text-xs text-[#57584C]">
        A private link that opens this report without a login. Student names are
        hidden. Only people with the link can view it; you can revoke it anytime.
      </p>

      {token ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-[#E5E0D2] bg-[#FBF9F4] px-3 py-2 text-xs text-[#20241B]"
            aria-label="Public share link"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#C96F1B] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B06015]"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#B3452F]/30 px-3 py-2 text-xs font-medium text-[#B3452F] transition-colors hover:bg-[#B3452F]/5 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            Revoke
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#C96F1B] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B06015] disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
          Create share link
        </button>
      )}
    </div>
  );
}
