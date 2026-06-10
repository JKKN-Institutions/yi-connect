/**
 * One cohort thread message (Phase 12) — sender name + kind badge +
 * timestamp + body. Server-renderable (no client JS); own messages get a
 * highlighted card so each viewer can spot their posts at a glance.
 */

import type {
  CohortMessage,
  CohortSenderKind,
} from "@/components/yuva/messages/data";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<CohortSenderKind, string> = {
  student: "Student",
  mentor: "Mentor",
  chapter: "Chapter",
  institution: "Institution",
  national: "National",
};

const KIND_BADGE_STYLES: Record<CohortSenderKind, string> = {
  student: "border-slate-200 bg-slate-50 text-slate-600",
  mentor: "border-amber-200 bg-amber-50 text-amber-700",
  chapter: "border-emerald-200 bg-emerald-50 text-emerald-700",
  institution: "border-sky-200 bg-sky-50 text-sky-700",
  national: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

function timestampLabel(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageItem({
  message,
  isOwn = false,
}: {
  message: CohortMessage;
  isOwn?: boolean;
}) {
  return (
    <li
      className={cn(
        "rounded-lg border px-4 py-3",
        isOwn
          ? "border-slate-300 bg-slate-50"
          : "border-slate-200 bg-white"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-slate-900">
          {message.senderName}
          {isOwn && <span className="font-normal text-slate-500"> (you)</span>}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            KIND_BADGE_STYLES[message.senderKind]
          )}
        >
          {KIND_LABELS[message.senderKind]}
        </span>
        <span className="ml-auto text-xs text-slate-400">
          {timestampLabel(message.createdAt)}
        </span>
      </div>
      <p className="mt-1.5 text-sm break-words whitespace-pre-wrap text-slate-700">
        {message.body}
      </p>
    </li>
  );
}
