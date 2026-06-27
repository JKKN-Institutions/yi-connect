import "server-only";

/**
 * Server-only data layer for yip.ai_drafts.
 *
 * The `ai_drafts` table is NOT in the generated types/yip/database.ts, so every
 * access goes through the service client loose-cast `svc.from("ai_drafts" as never)`
 * (the same `as never` pattern used by lib/yip/report/sections/overview.ts and
 * app/yip/actions/admin-team.ts for not-yet-typed tables).
 *
 * This module is read/enqueue plumbing only — it does NOT gate (callers gate
 * via getYipEventAccess) and it NEVER calls an LLM. Generation happens entirely
 * out-of-band in the hourly routine.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import type {
  AiDraftKind,
  AiDraftRow,
  AiDraftStatus,
  AiSourceRef,
} from "./types";

/**
 * Loose row shape returned by the un-typed `ai_drafts` reads. We normalise it
 * into a typed AiDraftRow before returning.
 */
type RawAiDraft = {
  id: string;
  event_id: string;
  kind: string;
  subject_id: string | null;
  status: string;
  draft_text: string | null;
  source_refs: unknown;
  model_note: string | null;
  generated_at: string | null;
  reviewed_by: string | null;
  approved_text: string | null;
  reviewed_at: string | null;
  is_mock: boolean | null;
  created_at: string;
  updated_at: string;
};

function normalize(r: RawAiDraft): AiDraftRow {
  return {
    id: r.id,
    event_id: r.event_id,
    kind: r.kind as AiDraftKind,
    subject_id: r.subject_id,
    status: r.status as AiDraftStatus,
    draft_text: r.draft_text,
    source_refs: Array.isArray(r.source_refs)
      ? (r.source_refs as AiSourceRef[])
      : [],
    model_note: r.model_note,
    generated_at: r.generated_at,
    reviewed_by: r.reviewed_by,
    approved_text: r.approved_text,
    reviewed_at: r.reviewed_at,
    is_mock: r.is_mock ?? false,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** The columns selected for every read (kept identical across helpers). */
const SELECT_COLS =
  "id, event_id, kind, subject_id, status, draft_text, source_refs, model_note, generated_at, reviewed_by, approved_text, reviewed_at, is_mock, created_at, updated_at";

/**
 * Untyped-table escape hatch. `ai_drafts` is not in the generated Database type,
 * so we cast the service client to a minimal builder surface. Mirrors the
 * loose-cast in lib/yip/report/sections/overview.ts.
 */
type LooseClient = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

async function svcLoose(): Promise<LooseClient> {
  const svc = await createServiceClient();
  return svc as unknown as LooseClient;
}

/**
 * Read ONE draft by (event, kind, subject). subjectId omitted/null → the
 * event-level row (e.g. round_narrative). Returns null when no row exists, so
 * callers render "not ready yet" gracefully on early/empty data.
 */
export async function getAiDraft(
  eventId: string,
  kind: AiDraftKind,
  subjectId: string | null = null
): Promise<AiDraftRow | null> {
  const db = await svcLoose();
  let q = db
    .from("ai_drafts")
    .select(SELECT_COLS)
    .eq("event_id", eventId)
    .eq("kind", kind);
  q = subjectId === null ? q.is("subject_id", null) : q.eq("subject_id", subjectId);
  const { data } = await q.maybeSingle();
  return data ? normalize(data as RawAiDraft) : null;
}

/**
 * Read every draft for an event (any kind/subject). Used by the dashboard
 * "AI status" surface so the chair can see how many participant cards are ready.
 */
export async function listAiDraftsForEvent(
  eventId: string
): Promise<AiDraftRow[]> {
  const db = await svcLoose();
  const { data } = await db
    .from("ai_drafts")
    .select(SELECT_COLS)
    .eq("event_id", eventId);
  return ((data as RawAiDraft[]) ?? []).map(normalize);
}

/**
 * Enqueue a request row (status='requested') for the routine to pick up.
 * Idempotent: if a row already exists for (event, kind, subject) we DO NOT
 * clobber a draft already in flight — we only reset a row that was previously
 * rejected back to 'requested' (a deliberate re-request). Returns the row id.
 *
 * The unique index on (event_id, kind, subject_id) guarantees one row per
 * subject; we upsert against it.
 */
export async function enqueueAiDraft(args: {
  eventId: string;
  kind: AiDraftKind;
  subjectId?: string | null;
  /** When true, a rejected/approved/ready row is reset to 'requested' (regenerate). */
  force?: boolean;
}): Promise<{ id: string } | { error: string }> {
  const { eventId, kind, subjectId = null, force = false } = args;
  const db = await svcLoose();

  const existing = await getAiDraft(eventId, kind, subjectId);
  if (existing) {
    // Already in flight (requested/generating) → no-op, return it.
    const inFlight =
      existing.status === "requested" || existing.status === "generating";
    if (inFlight && !force) return { id: existing.id };
    // Reset to requested (regenerate / re-request). Clear prior draft + review.
    const { error } = await db
      .from("ai_drafts")
      .update({
        status: "requested",
        draft_text: null,
        source_refs: [],
        model_note: null,
        generated_at: null,
        reviewed_by: null,
        approved_text: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    return { id: existing.id };
  }

  const { data, error } = await db
    .from("ai_drafts")
    .insert({
      event_id: eventId,
      kind,
      subject_id: subjectId,
      status: "requested",
      source_refs: [],
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: (data as { id: string }).id };
}

/**
 * List pending request rows (status='requested' or 'generating') across all
 * events, for the out-of-band routine to drain. Returns the bare rows; the
 * route handler attaches the grounding payload per row.
 */
export async function listPendingAiDrafts(
  limit = 100
): Promise<AiDraftRow[]> {
  const db = await svcLoose();
  const { data } = await db
    .from("ai_drafts")
    .select(SELECT_COLS)
    .in("status", ["requested", "generating"])
    .order("created_at", { ascending: true })
    .limit(limit);
  return ((data as RawAiDraft[]) ?? []).map(normalize);
}

/**
 * Routine write-back: store the generated draft + citations and advance status.
 * participant_story → 'ready' (auto-shows). round_narrative → 'pending_review'
 * (awaits chair approval). The route handler decides the target status by kind
 * and passes it here.
 */
export async function writeAiDraft(args: {
  id: string;
  draftText: string;
  sourceRefs: AiSourceRef[];
  modelNote: string | null;
  status: AiDraftStatus;
}): Promise<{ success: true } | { success: false; error: string }> {
  const db = await svcLoose();
  const { error } = await db
    .from("ai_drafts")
    .update({
      draft_text: args.draftText,
      source_refs: args.sourceRefs ?? [],
      model_note: args.modelNote,
      status: args.status,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Set a draft's status + (optionally) review fields. Used by chair actions. */
export async function setAiDraftReview(args: {
  id: string;
  status: AiDraftStatus;
  approvedText?: string | null;
  reviewedBy?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const db = await svcLoose();
  const patch: Record<string, unknown> = {
    status: args.status,
    updated_at: new Date().toISOString(),
  };
  if (args.status === "approved" || args.status === "rejected") {
    patch.reviewed_at = new Date().toISOString();
    if (args.reviewedBy !== undefined) patch.reviewed_by = args.reviewedBy;
  }
  if (args.approvedText !== undefined) patch.approved_text = args.approvedText;
  const { error } = await db.from("ai_drafts").update(patch).eq("id", args.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Read events.ai_enabled (not-yet-typed column → loose cast). */
export async function getEventAiEnabled(eventId: string): Promise<boolean> {
  const db = await svcLoose();
  const { data } = await db
    .from("events")
    .select("ai_enabled")
    .eq("id", eventId)
    .maybeSingle();
  return Boolean((data as { ai_enabled?: boolean } | null)?.ai_enabled);
}

/** Write events.ai_enabled. */
export async function writeEventAiEnabled(
  eventId: string,
  on: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const db = await svcLoose();
  const { error } = await db
    .from("events")
    .update({ ai_enabled: on })
    .eq("id", eventId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
