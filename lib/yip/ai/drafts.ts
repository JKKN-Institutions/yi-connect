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
  agenda_item_id: string | null;
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
    agenda_item_id: r.agenda_item_id ?? null,
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
  "id, event_id, kind, subject_id, agenda_item_id, status, draft_text, source_refs, model_note, generated_at, reviewed_by, approved_text, reviewed_at, is_mock, created_at, updated_at";

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
 * Read ONE draft by (event, kind, subject[, agendaItem]).
 *
 * - subjectId omitted/null → the event-level row (e.g. round_narrative).
 * - agendaItemId is the session-level discriminator for session_feedback:
 *     • pass a string  → match that exact session row.
 *     • pass null      → match rows where agenda_item_id IS NULL
 *                        (participant_story / round_narrative).
 *     • OMIT (undefined) → do not filter on agenda_item_id at all
 *                        (back-compat: participant_story callers pass 3 args).
 *
 * Returns null when no row exists, so callers render "not ready yet" gracefully.
 */
export async function getAiDraft(
  eventId: string,
  kind: AiDraftKind,
  subjectId: string | null = null,
  agendaItemId: string | null | undefined = undefined
): Promise<AiDraftRow | null> {
  const db = await svcLoose();
  let q = db
    .from("ai_drafts")
    .select(SELECT_COLS)
    .eq("event_id", eventId)
    .eq("kind", kind);
  q = subjectId === null ? q.is("subject_id", null) : q.eq("subject_id", subjectId);
  if (agendaItemId !== undefined) {
    q = agendaItemId === null
      ? q.is("agenda_item_id", null)
      : q.eq("agenda_item_id", agendaItemId);
  }
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
 * PARTICIPANT-FACING READER for the growth card.
 *
 * Returns every session_feedback draft for ONE participant, ordered by the
 * session's (agenda.day, agenda.sequence_order) so the card renders a coherent
 * journey. Reads ONLY ai_drafts + agenda (for ordering) — NEVER yip.scores /
 * yip.results. The card consumes draft_text alone and shows zero numbers.
 *
 * NOTE: this DOES return non-ready rows too (requested/generating); the card
 * filters to showable states itself so it can render a soft placeholder while
 * the routine catches up.
 */
export async function getParticipantSessionFeedback(
  eventId: string,
  participantId: string
): Promise<AiDraftRow[]> {
  const db = await svcLoose();
  const { data } = await db
    .from("ai_drafts")
    .select(SELECT_COLS)
    .eq("event_id", eventId)
    .eq("kind", "session_feedback")
    .eq("subject_id", participantId);
  const rows = ((data as RawAiDraft[]) ?? []).map(normalize);
  if (rows.length === 0) return [];

  // Resolve session ordering (day, sequence_order) for the referenced agenda
  // items. One lean read; sort in memory.
  const agendaIds = Array.from(
    new Set(rows.map((r) => r.agenda_item_id).filter((x): x is string => !!x))
  );
  const order = new Map<string, { day: number; seq: number }>();
  if (agendaIds.length > 0) {
    const { data: ags } = await db
      .from("agenda")
      .select("id, day, sequence_order")
      .in("id", agendaIds);
    for (const a of (ags as Array<{
      id: string;
      day: number | null;
      sequence_order: number | null;
    }>) ?? []) {
      order.set(a.id, { day: a.day ?? 0, seq: a.sequence_order ?? 0 });
    }
  }
  rows.sort((x, y) => {
    const ox = x.agenda_item_id ? order.get(x.agenda_item_id) : undefined;
    const oy = y.agenda_item_id ? order.get(y.agenda_item_id) : undefined;
    const dx = ox?.day ?? 0;
    const dy = oy?.day ?? 0;
    if (dx !== dy) return dx - dy;
    const sx = ox?.seq ?? 0;
    const sy = oy?.seq ?? 0;
    if (sx !== sy) return sx - sy;
    // Stable tiebreak by creation order.
    return x.created_at.localeCompare(y.created_at);
  });
  return rows;
}

/**
 * PARTICIPANT-FACING READER for the bill-feedback card (/yip/me/bill).
 *
 * The participant page only knows the viewer's committee_name, so this resolves
 * committee → its bill → that bill's kind='bill_feedback' draft. Reads ONLY
 * yip.bills + yip.ai_drafts — NEVER yip.scores / yip.results. Returns null when
 * the committee has no bill or no draft yet (the card then shows a placeholder).
 *
 * If a committee somehow has >1 bill, the latest-created one wins (deterministic).
 */
export async function getBillFeedbackForCommittee(
  eventId: string,
  committeeName: string
): Promise<AiDraftRow | null> {
  const db = await svcLoose();
  const { data: bill } = await db
    .from("bills")
    .select("id")
    .eq("event_id", eventId)
    .eq("committee_name", committeeName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const billId = (bill as { id?: string } | null)?.id;
  if (!billId) return null;
  // bill_feedback is keyed by subject_id=bill.id with agenda_item_id NULL.
  return getAiDraft(eventId, "bill_feedback", billId, null);
}

/**
 * REPORT READER: every bill_feedback draft for an event (any status). The
 * chapter-report section joins these to committees by bill id (subject_id).
 * Reads ai_drafts only — never yip.scores / yip.results.
 */
export async function listBillFeedbackForEvent(
  eventId: string
): Promise<AiDraftRow[]> {
  const db = await svcLoose();
  const { data } = await db
    .from("ai_drafts")
    .select(SELECT_COLS)
    .eq("event_id", eventId)
    .eq("kind", "bill_feedback");
  return ((data as RawAiDraft[]) ?? []).map(normalize);
}

/**
 * Enqueue a request row (status='requested') for the routine to pick up.
 *
 * For participant_story / round_narrative (agendaItemId omitted) this is
 * idempotent against the participant/event-level unique index: if a row already
 * exists we DO NOT clobber a draft in flight — we only reset a previously
 * rejected/terminal row back to 'requested' when force=true.
 *
 * For session_feedback, pass kind='session_feedback', subjectId=participant,
 * agendaItemId=session — the session-level partial unique index
 * (event_id, kind, subject_id, agenda_item_id) dedupes. Returns the row id.
 */
export async function enqueueAiDraft(args: {
  eventId: string;
  kind: AiDraftKind;
  subjectId?: string | null;
  /** Session discriminator for session_feedback; omit for other kinds. */
  agendaItemId?: string | null;
  /** When true, a rejected/approved/ready row is reset to 'requested' (regenerate). */
  force?: boolean;
}): Promise<{ id: string } | { error: string }> {
  const {
    eventId,
    kind,
    subjectId = null,
    agendaItemId = null,
    force = false,
  } = args;
  const db = await svcLoose();

  // For lookup we must match on agenda_item_id when this is a session row.
  const existing = await getAiDraft(
    eventId,
    kind,
    subjectId,
    kind === "session_feedback" ? agendaItemId : null
  );
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
      agenda_item_id: kind === "session_feedback" ? agendaItemId : null,
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
 *   participant_story → 'ready' (auto-shows).
 *   session_feedback  → 'ready' (auto-shows on the growth card; no chair gate).
 *   round_narrative   → 'pending_review' (awaits chair approval).
 * The route handler decides the target status by kind and passes it here.
 *
 * agenda_item_id is set at INSERT time (enqueue) and is immutable here — the
 * write-back never moves a draft to a different session.
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
