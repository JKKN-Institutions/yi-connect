/**
 * Email-queue health card (Phase 15 — the ops-visibility requirement for the
 * durable notification queue). Presentational RSC; counts come from
 * getEmailQueueHealth(). Amber when anything has failed or the oldest
 * pending email is older than an hour (the cron should have drained it).
 */

import { AlertTriangle, MailCheck } from "lucide-react";
import type { EmailQueueHealth } from "@/app/youth-academy/actions/national-reports";

const STALE_PENDING_MINUTES = 60;

function ageLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} days`;
}

export function QueueHealthCard({ health }: { health: EmailQueueHealth }) {
  const stale =
    health.oldest_pending_minutes !== null &&
    health.oldest_pending_minutes > STALE_PENDING_MINUTES;
  const attention = health.failed > 0 || stale;

  return (
    <div
      className={`rounded-xl border p-4 ${
        attention
          ? "border-amber-300 bg-amber-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        {attention ? (
          <AlertTriangle className="size-4 text-amber-600" />
        ) : (
          <MailCheck className="size-4 text-slate-400" />
        )}
        <h2
          className={`text-xs font-medium uppercase tracking-wide ${
            attention ? "text-amber-700" : "text-slate-400"
          }`}
        >
          Email queue
        </h2>
      </div>
      <div className="mt-3 flex items-baseline gap-4">
        <div>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {health.pending}
          </p>
          <p className="text-[11px] text-slate-500">pending</p>
        </div>
        <div>
          <p
            className={`text-2xl font-bold tabular-nums ${
              health.failed > 0 ? "text-amber-700" : "text-slate-900"
            }`}
          >
            {health.failed}
          </p>
          <p className="text-[11px] text-slate-500">failed</p>
        </div>
      </div>
      <p
        className={`mt-2 text-[11px] ${
          stale ? "font-medium text-amber-700" : "text-slate-400"
        }`}
      >
        {health.oldest_pending_minutes === null
          ? "Nothing waiting to send."
          : `Oldest pending: ${ageLabel(health.oldest_pending_minutes)}${
              stale ? " — check the email cron" : ""
            }`}
      </p>
    </div>
  );
}
