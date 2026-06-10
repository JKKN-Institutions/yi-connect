/**
 * Cohort message thread (Phase 12) — server component: message list (data.ts
 * read assembly, ascending window) + client post box (composer.tsx). No
 * realtime/polling in v1 — posting refreshes the list via revalidatePath +
 * router.refresh().
 *
 * ⚠️ Render ONLY from gated surfaces (student portal pages, mentor cohort
 * page, chapter cohort page) — this component does not authorize. The send
 * action re-gates every post regardless, so the page gate is UX and the
 * action gate is the security boundary.
 */

import { MessagesSquare } from "lucide-react";
import { fetchCohortMessages } from "@/components/yuva/messages/data";
import { MessageComposer } from "@/components/yuva/messages/composer";
import { MessageItem } from "@/components/yuva/messages/message-item";

export async function CohortThread({
  runId,
  viewerPersonId,
}: {
  runId: string;
  /** Highlights the viewer's own messages; null renders nothing as "own". */
  viewerPersonId: string | null;
}) {
  const { messages } = await fetchCohortMessages(runId, { limit: 50 });

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <MessagesSquare className="mx-auto size-6 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            No messages yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Say hello to your cohort.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isOwn={
                viewerPersonId !== null &&
                message.senderPersonId === viewerPersonId
              }
            />
          ))}
        </ul>
      )}

      <MessageComposer runId={runId} />
    </div>
  );
}
