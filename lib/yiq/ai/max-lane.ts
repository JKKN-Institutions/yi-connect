import "server-only";

/**
 * Client for MyJKKN's ₹0 **Max lane** AI door.
 *
 * WHY THIS AND NOT AN LLM CALL. The production app never holds an LLM key —
 * these are minors, and this is a scored national competition that has to be
 * defensible in a dispute. The Max lane keeps the model outside the app: we
 * enqueue a task, poll for it, and clamp whatever comes back.
 *
 * Contract from docs/yip-maxlane-questionnaire-scoring.md §6. There is NO SDK
 * for this surface — it is a plain fetch.
 *
 *   POST /api/v1/public/ai/run   { task, payload, dedupe_key } -> 202 { job_id }
 *   GET  /api/v1/public/ai/run?job_id=…                        -> { status, result }
 *
 * `app_id` is set server-side from the API key and must NEVER be sent in the
 * body.
 *
 * ── THE TRAP, documented because it has already cost this org weeks ──
 * The door gates on a HARDCODED list, not just on database rows:
 *
 *   if (!allowed.includes(task) || !AI_TASK_KEYS.includes(task))  // -> 403
 *
 * `AI_TASK_KEYS` derives from FALLBACK_AI_TASKS in `lib/ai/tasks.ts` of
 * Jicate-Solutions/BugReporter (deployed branch `jicate/main`). A task that is
 * inserted into `ai_job_types` and ticked in the console will SAVE FINE and
 * then fail at runtime with 403 `task_not_permitted`. Registering a YIQ task
 * is four parts across three repos, never "one row".
 *
 * As of 2026-08-25 exactly five tasks carry `external_allowed = true`
 * (bug.categorize, bug.suggest_fix, bug.summarize, ops.brief, reply.draft) —
 * none of them ours. Until a `yiq.*` task is registered AND added to that
 * hardcoded list, every call here returns TASK_NOT_PERMITTED. That is why
 * enqueue reports the reason instead of throwing: the caller keeps its queue
 * row and the work is simply picked up whenever the lane opens.
 */

import { PAYLOAD_CEILING_BYTES, parseStrictJson } from "./parse";
export { PAYLOAD_CEILING_BYTES, parseStrictJson };

const DOOR = "https://jkkn-centralized-bug-reporter.vercel.app/api/v1/public/ai/run";

export type MaxLaneTask =
  | "yiq.practice_questions"
  | "yiq.bank_draft"
  | "yiq.key_check"
  | "yiq.staleness_scan";

export type EnqueueResult =
  | { ok: true; jobId: string; retryAfterSeconds: number }
  | { ok: false; reason: MaxLaneFailure; detail?: string };

export type MaxLaneFailure =
  | "NOT_CONFIGURED"
  | "TASK_NOT_PERMITTED"
  | "AI_NOT_ENABLED"
  | "IN_FLIGHT"
  | "PAYLOAD_TOO_LARGE"
  | "UNAVAILABLE"
  | "TRANSPORT";

function apiKey(): string | null {
  return process.env.YIQ_MAXLANE_API_KEY || process.env.BUG_REPORTER_API_KEY || null;
}

export async function enqueueMaxLane(
  task: MaxLaneTask,
  payload: Record<string, unknown>,
  dedupeKey: string
): Promise<EnqueueResult> {
  const key = apiKey();
  if (!key) return { ok: false, reason: "NOT_CONFIGURED" };

  const body = JSON.stringify({ task, payload, dedupe_key: dedupeKey });
  if (Buffer.byteLength(body, "utf8") > PAYLOAD_CEILING_BYTES) {
    return { ok: false, reason: "PAYLOAD_TOO_LARGE" };
  }

  try {
    const res = await fetch(DOOR, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": key },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 202 || res.ok) {
      const j = await res.json().catch(() => ({}));
      const jobId = j?.job_id ?? j?.jobId;
      if (!jobId) return { ok: false, reason: "TRANSPORT", detail: "no job_id in 202" };
      return { ok: true, jobId, retryAfterSeconds: j?.poll?.retry_after ?? 30 };
    }

    const text = await res.text().catch(() => "");
    if (res.status === 409) return { ok: false, reason: "IN_FLIGHT" };
    if (res.status === 413) return { ok: false, reason: "PAYLOAD_TOO_LARGE" };
    if (res.status === 503) return { ok: false, reason: "UNAVAILABLE", detail: text.slice(0, 200) };
    if (res.status === 403) {
      return {
        ok: false,
        reason: text.includes("task_not_permitted") ? "TASK_NOT_PERMITTED" : "AI_NOT_ENABLED",
        detail: text.slice(0, 200),
      };
    }
    return { ok: false, reason: "TRANSPORT", detail: `${res.status} ${text.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, reason: "TRANSPORT", detail: String(e).slice(0, 200) };
  }
}

export type PollResult =
  | { status: "queued" | "running" }
  | { status: "done"; raw: string }
  | { status: "error" | "unknown"; detail?: string };

export async function pollMaxLane(jobId: string): Promise<PollResult> {
  const key = apiKey();
  if (!key) return { status: "error", detail: "not configured" };
  try {
    const res = await fetch(`${DOOR}?job_id=${encodeURIComponent(jobId)}`, {
      headers: { "X-API-Key": key },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { status: "error", detail: `HTTP ${res.status}` };
    const j = await res.json().catch(() => ({}));
    const st = j?.status;
    if (st === "queued" || st === "running") return { status: st };
    if (st === "done") {
      // Output is NOT validated by the runner: the model's raw text arrives as
      // a string, and existing readers defensively try several field names.
      const r = j?.result ?? {};
      const raw = r?.answer ?? r?.text ?? r?.result ?? r?.output ?? "";
      return { status: "done", raw: typeof raw === "string" ? raw : JSON.stringify(raw) };
    }
    return { status: st === "error" ? "error" : "unknown", detail: JSON.stringify(j).slice(0, 200) };
  } catch (e) {
    return { status: "error", detail: String(e).slice(0, 200) };
  }
}

/**
 * Parse a strict-JSON reply out of the model's raw text.
 *
 * The runner does not validate output, so the JSON we asked for may arrive
 * wrapped in prose or a markdown fence. A parse failure is a FAILURE for that
 * job — never a silent empty result, and never a partially-applied one.
 */
