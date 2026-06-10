"use client";

/**
 * Cohort thread post box (Phase 12) — client form over sendCohortMessage.
 * Polling-free by design (v1): the action revalidates the thread paths and
 * router.refresh() re-renders the server-component list in the same trip.
 * The sender kind is derived SERVER-SIDE by the action's membership gate —
 * nothing identity-shaped is sent from here.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SendHorizonal } from "lucide-react";
import toast from "react-hot-toast";
import { sendCohortMessage } from "@/app/youth-academy/actions/messages";
import { Button } from "@/components/ui/button";

const MESSAGE_MAX_LENGTH = 2000;

export function MessageComposer({ runId }: { runId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending) return;

    setSending(true);
    const result = await sendCohortMessage(runId, trimmed);
    setSending(false);

    if (!result.success) {
      // Explicit denial/error — the typed text stays in the box.
      toast.error(result.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder="Write a message to the cohort…"
        aria-label="Message to the cohort"
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          {body.length}/{MESSAGE_MAX_LENGTH}
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={sending || body.trim().length === 0}
          className="bg-slate-900 hover:bg-slate-800"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizonal className="size-4" />
          )}
          Send
        </Button>
      </div>
    </form>
  );
}
