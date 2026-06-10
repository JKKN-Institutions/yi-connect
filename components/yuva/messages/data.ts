import "server-only";

/**
 * Cohort message thread — read-side assembly (Phase 12).
 *
 * One thread per run (yuva.threads, UNIQUE run_id — created at cohort
 * formation, or lazily by getOrCreateCohortThread for pre-formation runs).
 * Sender names come from the canonical identity spine (yi_directory.people)
 * via the same cross-schema service-client pattern as
 * components/yuva/cohort/data.ts.
 *
 * ⚠️ Callers are gated pages/actions — these helpers do NOT authorize.
 */

import { createServiceClient } from "@/lib/yuva/supabase/service";
// The yip server module's Database type includes the yi_directory schema —
// same cross-schema access path components/yuva/cohort/data.ts uses.
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";

export const COHORT_SENDER_KINDS = [
  "student",
  "mentor",
  "chapter",
  "institution",
  "national",
] as const;
export type CohortSenderKind = (typeof COHORT_SENDER_KINDS)[number];

export type CohortMessage = {
  id: string;
  senderPersonId: string;
  senderName: string;
  senderKind: CohortSenderKind;
  body: string;
  createdAt: string;
};

const KIND_SET = new Set<string>(COHORT_SENDER_KINDS);

function asSenderKind(raw: string): CohortSenderKind {
  // The DB CHECK constraint limits values to this set; the fallback only
  // guards against drift and never widens access (display-only).
  return KIND_SET.has(raw) ? (raw as CohortSenderKind) : "student";
}

/**
 * Latest messages of a run's cohort thread as an ASCENDING window
 * (oldest → newest of the most recent `limit`, optionally before a cursor).
 * A run without a thread yet (pre-formation) yields an empty list.
 */
export async function fetchCohortMessages(
  runId: string,
  opts?: { before?: string; limit?: number }
): Promise<{ threadId: string | null; messages: CohortMessage[] }> {
  const limit = Math.min(Math.max(Math.trunc(opts?.limit ?? 50), 1), 200);
  const svc = await createServiceClient();

  const { data: thread } = await svc
    .from("threads")
    .select("id")
    .eq("run_id", runId)
    .maybeSingle();
  if (!thread) return { threadId: null, messages: [] };

  let query = svc
    .from("messages")
    .select("id, sender_person_id, sender_kind, body, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts?.before) {
    query = query.lt("created_at", opts.before);
  }
  const { data: rows, error } = await query;
  if (error) {
    console.error("[yuva-messages] fetch failed:", error.message);
    return { threadId: thread.id, messages: [] };
  }

  // Newest-first window → ascending for display.
  const ordered = [...(rows ?? [])].reverse();

  // Sender names — canonical identity spine (yi_directory.people).
  const personIds = [...new Set(ordered.map((m) => m.sender_person_id))];
  const nameByPersonId = new Map<string, string>();
  if (personIds.length > 0) {
    const dir = await createDirService();
    const { data: people } = await dir
      .schema("yi_directory")
      .from("people")
      .select("id, full_name")
      .in("id", personIds);
    for (const p of people ?? []) {
      nameByPersonId.set(p.id, p.full_name ?? "—");
    }
  }

  return {
    threadId: thread.id,
    messages: ordered.map((m) => ({
      id: m.id,
      senderPersonId: m.sender_person_id,
      senderName: nameByPersonId.get(m.sender_person_id) ?? "—",
      senderKind: asSenderKind(m.sender_kind),
      body: m.body,
      createdAt: m.created_at,
    })),
  };
}
