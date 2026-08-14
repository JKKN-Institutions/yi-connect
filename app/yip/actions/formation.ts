"use server";

// Online House Formation (pre-Regional-Round) — the step engine.
//
// Regional Rounds form their House ONLINE before event day: the organiser runs
// allocation + party formation, then opens windowed remote elections (Speaker →
// per-party leaders → PM → LoP) that participants cast in from their phones at
// /yip/me/vote, then makes appointments and locks the House. Each step is a
// yip.formation_steps row; election steps open REAL vote_sessions (the whole
// existing ballot/scope/tally machinery is reused verbatim) anchored on one
// hidden day-0 agenda item (vote_sessions.agenda_item_id is NOT NULL; day-0
// also buys the pre-event check-in bypass).
//
// Every mutation gates on getYipEventAccess(eventId).canManage; reads on
// canView. Deny = structured { success:false, error } — NEVER a redirect.
// All types/constants live in lib/yip/formation.ts ("use server" files may
// export only async functions).

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  FORMATION_STEPS,
  FORMATION_ANCHOR_SESSION_KEY,
  formationStepDef,
  stepDeadlinePassed,
  isTerminalTieSession,
  maskEmail,
  type FormationStepKey,
  type FormationStepRow,
  type FormationState,
  type FormationSessionLite,
  type FormationTurnout,
  type FormationTurnoutSession,
  type FormationPendingParticipant,
  type FormationCloseResult,
  type FormationAnnouncement,
  type FormationAnnouncementPerson,
} from "@/lib/yip/formation";
import {
  openVote,
  closeVote,
  revealResults,
  clearVoteResults,
  openRunoff,
} from "@/app/yip/actions/voting";
import {
  runAllocationAction,
  lockAllocation,
  unlockAllocation,
} from "@/app/yip/actions/allocation";
import { formParties, listParties } from "@/app/yip/actions/parties";
import type { Json } from "@/types/yip/database";
import { revalidatePath } from "next/cache";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Untyped table access (new tables are NOT in generated types) ────
// yip.formation_steps ships in migration 20260812090000_yip_online_formation
// and types/yip/database.ts is never regenerated alongside (the supabase CLI
// appends a version banner that corrupts the file). Narrow, file-local
// accessor — the votesTable pattern documented in voting.ts lines 36–63.
type StepsPgError = { code?: string; message: string };
type FormationStepsTable = {
  select: (cols: string) => FormationStepsTable;
  insert: (
    rows: Record<string, unknown> | Record<string, unknown>[]
  ) => Promise<{ error: StepsPgError | null }>;
  upsert: (
    rows: Record<string, unknown>[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean }
  ) => Promise<{ error: StepsPgError | null }>;
  update: (row: Record<string, unknown>) => FormationStepsTable;
  eq: (col: string, val: unknown) => FormationStepsTable;
  order: (
    col: string,
    opts?: { ascending?: boolean }
  ) => FormationStepsTable;
  maybeSingle: () => Promise<{
    data: FormationStepRow | null;
    error: StepsPgError | null;
  }>;
  then: Promise<{
    data: FormationStepRow[] | null;
    error: StepsPgError | null;
  }>["then"];
};
function formationStepsTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): FormationStepsTable {
  return (sb as unknown as { from: (t: string) => FormationStepsTable }).from(
    "formation_steps"
  );
}

// Ballot COUNTS for live turnout (never the ballots themselves). Same narrow
// accessor pattern for yip.votes (session_id post-dates the generated types).
type VoteLiteRow = { session_id: string | null; participant_id: string | null };
type FormationVotesTable = {
  select: (cols: string) => FormationVotesTable;
  in: (col: string, vals: readonly unknown[]) => FormationVotesTable;
  then: Promise<{
    data: VoteLiteRow[] | null;
    error: StepsPgError | null;
  }>["then"];
};
function formationVotesTable(
  sb: Awaited<ReturnType<typeof createServiceClient>>
): FormationVotesTable {
  return (sb as unknown as { from: (t: string) => FormationVotesTable }).from(
    "votes"
  );
}

// ─── Internal helpers (non-exported; free of the async-only export rule) ──

const STEP_COLS =
  "id, event_id, step_key, step_order, status, opens_at, closes_at, session_ids, config";

/** Idempotently seed the 7 step rows for an event (no-op when present). */
async function ensureStepsSeeded(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
): Promise<StepsPgError | null> {
  const rows = FORMATION_STEPS.map((s) => ({
    event_id: eventId,
    step_key: s.key,
    step_order: s.order,
    status: "pending",
  }));
  const { error } = await formationStepsTable(supabase).upsert(rows, {
    onConflict: "event_id,step_key",
    ignoreDuplicates: true,
  });
  return error;
}

async function loadSteps(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
): Promise<FormationStepRow[]> {
  const { data } = await formationStepsTable(supabase)
    .select(STEP_COLS)
    .eq("event_id", eventId)
    .order("step_order", { ascending: true });
  return (data ?? []).map((r) => ({
    ...r,
    session_ids: Array.isArray(r.session_ids) ? r.session_ids : [],
    config: (r.config ?? {}) as Record<string, unknown>,
  }));
}

/**
 * Parse + validate a step deadline: must be a real timestamp, in the future,
 * and before the event's Day-1 (interpreted at IST midnight — every YIP event
 * runs in India). Returns the ISO string to store, or an error message.
 */
function validateClosesAt(
  closesAt: string,
  day1Date: string | null
): { ok: true; iso: string } | { ok: false; error: string } {
  const t = Date.parse(closesAt);
  if (Number.isNaN(t)) {
    return { ok: false, error: "Invalid closing time — pick a date and time." };
  }
  if (t <= Date.now()) {
    return { ok: false, error: "The closing time must be in the future." };
  }
  if (day1Date) {
    const day1 = Date.parse(`${day1Date}T00:00:00.000+05:30`);
    if (!Number.isNaN(day1) && t >= day1) {
      return {
        ok: false,
        error:
          "Online formation must finish before the event's Day 1 — pick an earlier closing time.",
      };
    }
  }
  return { ok: true, iso: new Date(t).toISOString() };
}

/**
 * Find-or-create the hidden day-0 anchor agenda item every formation ballot
 * hangs off (vote_sessions.agenda_item_id is NOT NULL). Never made live; the
 * ensure-helper recreates it if deleted. Follows addAgendaItem's max-sequence
 * logic (agenda.ts) for the insert.
 */
async function ensureFormationAnchorItem(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
): Promise<{ id: string } | { error: string }> {
  const { data: existing } = await supabase
    .from("agenda")
    .select("id")
    .eq("event_id", eventId)
    .eq("session_key", FORMATION_ANCHOR_SESSION_KEY)
    .limit(1)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data: maxRow } = await supabase
    .from("agenda")
    .select("sequence_order")
    .eq("event_id", eventId)
    .eq("day", 0)
    .order("sequence_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeq = (maxRow?.sequence_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("agenda")
    .insert({
      event_id: eventId,
      day: 0,
      sequence_order: nextSeq,
      title: "Online House Formation",
      description:
        "Hidden anchor for pre-event online formation ballots. Do not make live.",
      duration_minutes: 0,
      agenda_type: "general",
      status: "upcoming",
      is_scoreable: false,
      session_key: FORMATION_ANCHOR_SESSION_KEY,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to create the formation anchor item." };
  }
  return { id: data.id };
}

async function updateStep(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string,
  stepKey: FormationStepKey,
  patch: Record<string, unknown>
): Promise<StepsPgError | null> {
  const { error } = await formationStepsTable(supabase)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("step_key", stepKey);
  return error;
}

/** Merge keys into a vote session's config (read-modify-write). */
async function patchSessionConfig(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  sessionId: string,
  patch: Record<string, unknown>,
  alsoReopen = false
): Promise<string | null> {
  const { data: session } = await supabase
    .from("vote_sessions")
    .select("id, status, config")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return "Vote session not found";
  const config = {
    ...((session.config ?? {}) as Record<string, unknown>),
    ...patch,
  };
  const update: Record<string, unknown> = { config: config as Json };
  // A session the deadline sweep already closed comes back to 'open' when the
  // organiser EXTENDS the window (revealed/archived sessions are final).
  if (alsoReopen && session.status === "closed") {
    update.status = "open";
    update.closed_at = null;
  }
  const { error } = await supabase
    .from("vote_sessions")
    .update(update as never)
    .eq("id", sessionId);
  return error ? error.message : null;
}

const formationPath = (eventId: string) =>
  `/yip/dashboard/events/${eventId}/formation`;

// ─── State (seeding read) ───────────────────────────────────────────

/**
 * The formation dashboard read: seeds the 7 step rows on first read
 * (idempotent), and returns steps + their sessions + live ballot counts +
 * the event lock flags. canView-gated.
 */
export async function getFormationState(
  eventId: string
): Promise<ActionResult<FormationState>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event" };
  }

  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, allocation_locked, scores_locked, results_published_at, day1_date, level"
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found" };

  const seedErr = await ensureStepsSeeded(supabase, eventId);
  if (seedErr) return { success: false, error: seedErr.message };

  const steps = await loadSteps(supabase, eventId);

  const allSessionIds = steps.flatMap((s) => s.session_ids);
  const sessions: Record<string, FormationSessionLite> = {};
  const voteCounts: Record<string, number> = {};
  const turnout: FormationState["turnout"] = {};

  if (allSessionIds.length > 0) {
    const { data: sessionRows } = await supabase
      .from("vote_sessions")
      .select("id, vote_type, status, config")
      .in("id", allSessionIds);
    for (const s of sessionRows ?? []) {
      const cfg = (s.config ?? {}) as {
        partyId?: string;
        side?: "ruling" | "opposition";
        closesAt?: string;
      };
      sessions[s.id] = {
        id: s.id,
        vote_type: s.vote_type,
        status: s.status ?? "unknown",
        partyId: cfg.partyId ?? null,
        side: cfg.side ?? null,
        closesAt: cfg.closesAt ?? null,
      };
    }

    const { data: votes } = await formationVotesTable(supabase)
      .select("session_id, participant_id")
      .in("session_id", allSessionIds);
    const votersBySession = new Map<string, Set<string>>();
    for (const v of votes ?? []) {
      if (!v.session_id) continue;
      voteCounts[v.session_id] = (voteCounts[v.session_id] ?? 0) + 1;
      if (v.participant_id) {
        const set = votersBySession.get(v.session_id) ?? new Set<string>();
        set.add(v.participant_id);
        votersBySession.set(v.session_id, set);
      }
    }

    // Per-step turnout summary (plan §3.2): party ballots partition the
    // electorate, house/bench ballots take it whole — per-session sums are
    // step totals either way. Same eligibility rules as getFormationTurnout.
    const { data: participants } = await supabase
      .from("participants")
      .select("id, party_id, party_side")
      .eq("event_id", eventId);
    const everyone = participants ?? [];
    for (const step of steps) {
      if (step.session_ids.length === 0) continue;
      let eligible = 0;
      let voted = 0;
      for (const sessionId of step.session_ids) {
        const lite = sessions[sessionId];
        if (!lite) continue;
        const eligibleRows =
          lite.partyId != null
            ? everyone.filter((p) => p.party_id === lite.partyId)
            : lite.side != null
              ? everyone.filter((p) => p.party_side === lite.side)
              : everyone;
        const voters = votersBySession.get(sessionId) ?? new Set<string>();
        eligible += eligibleRows.length;
        voted += eligibleRows.filter((p) => voters.has(p.id)).length;
      }
      turnout[step.step_key] = { eligible, voted };
    }
  }

  return {
    success: true,
    data: {
      steps,
      event: {
        allocation_locked: event.allocation_locked === true,
        scores_locked: event.scores_locked === true,
        results_published_at: event.results_published_at,
        day1_date: event.day1_date ?? null,
        level: event.level ?? null,
      },
      sessions,
      voteCounts,
      turnout,
    },
  };
}

// ─── Step 1: Allocation + party formation ───────────────────────────

/**
 * Runs the existing allocation (benches + constituencies, NO auto roles) then
 * forms N parties across the benches, and marks the 'allocation' step closed.
 * Delegate errors (committees not picked, parties already formed, allocation
 * locked, …) are surfaced verbatim.
 */
export async function runFormationAllocation(
  eventId: string,
  opts: { partyCount: number }
): Promise<ActionResult<{ partyCount: number }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const seedErr = await ensureStepsSeeded(supabase, eventId);
  if (seedErr) return { success: false, error: seedErr.message };

  const steps = await loadSteps(supabase, eventId);
  const step = steps.find((s) => s.step_key === "allocation");
  if (!step) return { success: false, error: "Formation steps not initialised" };
  if (step.status === "locked") {
    return { success: false, error: "Formation is locked — allocation cannot be re-run." };
  }

  const alloc = await runAllocationAction(eventId, {
    assignSides: false,
    assignRoles: false,
  });
  if (!alloc.success) return { success: false, error: alloc.error };

  // Benchless-default reality (rehearsal-caught, 2026-08-11): on an event with
  // no sided parties yet, runAllocationAction writes party_side NULL for
  // everyone — even with assignSides on — and formParties then refuses ("no
  // bench yet"). Online formation needs benches BEFORE parties (decision-1
  // sequencing), so this step assigns them itself, AFTER allocation (whose
  // write clobbers party_side): school-ordered alternation → two near-equal,
  // school-spread benches.
  const { data: roster } = await supabase
    .from("participants")
    .select("id, school_name")
    .eq("event_id", eventId)
    .order("school_name")
    .order("id");
  const rows = roster ?? [];
  if (rows.length < 2) {
    return {
      success: false,
      error: "Need at least 2 participants to form benches.",
    };
  }
  const rulingIds = rows.filter((_, i) => i % 2 === 0).map((r) => r.id);
  const oppositionIds = rows.filter((_, i) => i % 2 === 1).map((r) => r.id);
  for (const [side, ids] of [
    ["ruling", rulingIds],
    ["opposition", oppositionIds],
  ] as const) {
    const { error: benchErr } = await supabase
      .from("participants")
      .update({ party_side: side })
      .in("id", ids);
    if (benchErr) {
      return {
        success: false,
        error: `Bench assignment failed: ${benchErr.message}`,
      };
    }
  }

  const parties = await formParties(eventId, opts.partyCount, false);
  if (!parties.success) return { success: false, error: parties.error };

  const upErr = await updateStep(supabase, eventId, "allocation", {
    status: "closed",
    closed_at_ts: new Date().toISOString(),
    config: {
      partyCount: opts.partyCount,
      benchSplit: parties.data.benchSplit,
      counts: parties.data.counts,
    },
  });
  if (upErr) return { success: false, error: upErr.message };

  revalidatePath(formationPath(eventId));
  return { success: true, data: { partyCount: opts.partyCount } };
}

// ─── Open a step ────────────────────────────────────────────────────

/**
 * Opens a formation step with a voting window. Election steps open real
 * vote_sessions (one house-wide ballot, or one per party for party leaders);
 * the 'appointments' step is a window-only organiser gate. 'allocation' has
 * its own action (runFormationAllocation) and 'lock' is lockFormation.
 *
 * party_leader_ballots is RE-ENTRANT while open: calling again opens any
 * party's ballot that failed/was missing on the first pass (parties with an
 * active ballot are skipped).
 */
export async function openFormationStep(
  eventId: string,
  stepKey: FormationStepKey,
  input: { closesAt: string; candidateIds?: string[] }
): Promise<ActionResult<{ sessionIds: string[] }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const def = formationStepDef(stepKey);
  if (!def) return { success: false, error: "Unknown formation step" };
  if (stepKey === "allocation") {
    return { success: false, error: "Run the allocation step via Run Allocation instead." };
  }
  if (stepKey === "lock") {
    return { success: false, error: "The final step is locked via Lock Formation." };
  }

  const supabase = await createServiceClient();
  const seedErr = await ensureStepsSeeded(supabase, eventId);
  if (seedErr) return { success: false, error: seedErr.message };

  const { data: event } = await supabase
    .from("events")
    .select("id, day1_date")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found" };

  const closes = validateClosesAt(input.closesAt, event.day1_date ?? null);
  if (!closes.ok) return { success: false, error: closes.error };

  const steps = await loadSteps(supabase, eventId);
  const step = steps.find((s) => s.step_key === stepKey);
  if (!step) return { success: false, error: "Formation steps not initialised" };

  const reentrant = stepKey === "party_leader_ballots" && step.status === "open";
  if (step.status !== "pending" && !reentrant) {
    return {
      success: false,
      error: `This step is already ${step.status} — it can only be opened once.`,
    };
  }

  // Sequencing: every earlier step must be closed (allocation included).
  const blocker = steps.find(
    (s) =>
      s.step_order < step.step_order &&
      s.status !== "closed" &&
      s.status !== "locked"
  );
  if (blocker) {
    const bDef = formationStepDef(blocker.step_key);
    return {
      success: false,
      error: `Finish "${bDef?.label ?? blocker.step_key}" first — steps run in order.`,
    };
  }

  // PM / LoP need every participant benched (decision-1 sequencing constraint).
  if (stepKey === "pm_ballot" || stepKey === "lop_ballot") {
    const { count: unbenched } = await supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .is("party_side", null);
    if ((unbenched ?? 0) > 0) {
      return {
        success: false,
        error: `${unbenched} participant(s) have no bench yet — re-run allocation before bench elections.`,
      };
    }
  }

  // Organiser-mode window (appointments): no ballots, just the window.
  if (def.mode === "organiser") {
    const upErr = await updateStep(supabase, eventId, stepKey, {
      status: "open",
      opens_at: new Date().toISOString(),
      closes_at: closes.iso,
    });
    if (upErr) return { success: false, error: upErr.message };
    revalidatePath(formationPath(eventId));
    return { success: true, data: { sessionIds: [] } };
  }

  const anchor = await ensureFormationAnchorItem(supabase, eventId);
  if ("error" in anchor) return { success: false, error: anchor.error };

  const candidateIds = (input.candidateIds ?? []).filter(
    (x) => typeof x === "string" && x.length > 0
  );

  const sessionIds: string[] = [...step.session_ids];

  if (stepKey === "speaker_ballot" || stepKey === "pm_ballot" || stepKey === "lop_ballot") {
    // Candidate ballots refuse empty nominee lists: castVote validates the
    // chosen value against config.candidateIds, so an empty list would make
    // every cast fail with "not a listed candidate".
    if (candidateIds.length < 2) {
      return {
        success: false,
        error: "Pick at least two candidates for this election.",
      };
    }
    const voteType =
      stepKey === "speaker_ballot"
        ? ("speaker_election" as const)
        : stepKey === "pm_ballot"
          ? ("prime_minister" as const)
          : ("leader_of_opposition" as const);
    const opened = await openVote(eventId, anchor.id, voteType, {
      candidateIds,
      ...(stepKey === "pm_ballot" ? { side: "ruling" as const } : {}),
      ...(stepKey === "lop_ballot" ? { side: "opposition" as const } : {}),
      closesAt: closes.iso,
      formationStepId: step.id,
    });
    if (!opened.success) return { success: false, error: opened.error };
    sessionIds.push(opened.data.sessionId);
  } else {
    // party_leader_ballots: one parallel ballot per party. Candidates: the
    // organiser's nominees split by party membership; a party with no nominees
    // falls back to its FULL member roster (every member is a candidate —
    // the natural remote-formation default).
    const parties = await listParties(eventId);
    if (parties.length === 0) {
      return {
        success: false,
        error: "No parties exist yet — run the allocation step first.",
      };
    }

    const { data: members } = await supabase
      .from("participants")
      .select("id, party_id")
      .eq("event_id", eventId)
      .not("party_id", "is", null);
    const membersByParty = new Map<string, string[]>();
    for (const m of members ?? []) {
      if (!m.party_id) continue;
      const list = membersByParty.get(m.party_id) ?? [];
      list.push(m.id);
      membersByParty.set(m.party_id, list);
    }
    const nomineeSet = new Set(candidateIds);

    // Re-entrancy: skip parties that already have an active/settled ballot in
    // this step (their session is in session_ids and not archived-by-failure).
    const existingPartyIds = new Set<string>();
    if (step.session_ids.length > 0) {
      const { data: existingSessions } = await supabase
        .from("vote_sessions")
        .select("id, config, status")
        .in("id", step.session_ids);
      for (const s of existingSessions ?? []) {
        const cfg = (s.config ?? {}) as { partyId?: string };
        if (cfg.partyId) existingPartyIds.add(cfg.partyId);
      }
    }

    const failures: string[] = [];
    for (const party of parties) {
      if (existingPartyIds.has(party.id)) continue;
      const roster = membersByParty.get(party.id) ?? [];
      const perParty = roster.filter((id) => nomineeSet.has(id));
      const ballotCandidates = perParty.length > 0 ? perParty : roster;
      if (ballotCandidates.length === 0) {
        failures.push(`${party.name}: no members`);
        continue;
      }
      const opened = await openVote(eventId, anchor.id, "party_leader", {
        partyId: party.id,
        candidateIds: ballotCandidates,
        closesAt: closes.iso,
        formationStepId: step.id,
      });
      if (opened.success) {
        sessionIds.push(opened.data.sessionId);
      } else {
        failures.push(`${party.name}: ${opened.error}`);
      }
    }

    if (sessionIds.length === 0) {
      return {
        success: false,
        error: `No party ballots could be opened — ${failures.join("; ")}`,
      };
    }
    if (failures.length > 0) {
      // Persist what DID open so the organiser can retry (re-entrant) —
      // then surface the partial failure explicitly.
      await updateStep(supabase, eventId, stepKey, {
        status: "open",
        opens_at: step.opens_at ?? new Date().toISOString(),
        closes_at: closes.iso,
        session_ids: sessionIds,
      });
      revalidatePath(formationPath(eventId));
      return {
        success: false,
        error: `Opened ${sessionIds.length} party ballot(s), but some failed — ${failures.join(
          "; "
        )}. Fix and open the step again to retry the failed parties.`,
      };
    }
  }

  const upErr = await updateStep(supabase, eventId, stepKey, {
    status: "open",
    opens_at: step.opens_at ?? new Date().toISOString(),
    closes_at: closes.iso,
    session_ids: sessionIds,
  });
  if (upErr) return { success: false, error: upErr.message };

  revalidatePath(formationPath(eventId));
  return { success: true, data: { sessionIds } };
}

// ─── Extend a step's window ─────────────────────────────────────────

/**
 * Push an OPEN step's deadline out. Updates the step row AND every session's
 * config.closesAt (the castVote hard guard reads the session config). Sessions
 * the deadline sweep already closed are REOPENED — extending the window means
 * voting resumes; revealed/archived sessions stay final.
 */
export async function extendFormationStep(
  eventId: string,
  stepKey: FormationStepKey,
  newClosesAt: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, day1_date")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found" };

  const closes = validateClosesAt(newClosesAt, event.day1_date ?? null);
  if (!closes.ok) return { success: false, error: closes.error };

  const steps = await loadSteps(supabase, eventId);
  const step = steps.find((s) => s.step_key === stepKey);
  if (!step) return { success: false, error: "Formation step not found" };
  if (step.status !== "open") {
    return { success: false, error: "Only an open step's window can be extended." };
  }

  for (const sessionId of step.session_ids) {
    const err = await patchSessionConfig(
      supabase,
      sessionId,
      { closesAt: closes.iso },
      true
    );
    if (err) return { success: false, error: err };
  }

  const upErr = await updateStep(supabase, eventId, stepKey, {
    closes_at: closes.iso,
  });
  if (upErr) return { success: false, error: upErr.message };

  revalidatePath(formationPath(eventId));
  return { success: true, data: null };
}

// ─── Close a step (reveal + archive) ────────────────────────────────

/**
 * Closes an open step: every still-open session is closed, every closed one
 * revealed (which writes the winners' roles — the existing revealResults
 * machinery), and — when every reveal is clean — the revealed tallies are
 * immediately archived (clearVoteResults) so participant visibility is
 * seconds-long (C4), and the step is marked closed.
 *
 * On a TIE the step stays OPEN and { tie:true, tiedSessionIds } is returned —
 * the organiser opens a runoff (openFormationRunoff) and closes again after.
 * A tie on a session that is ITSELF a runoff is TERMINAL (listed in
 * terminalTiedSessionIds): runoffs stop at one and the organiser assigns that
 * seat on Positions instead. The organiser-mode 'appointments' step just flips
 * to closed.
 */
export async function closeFormationStep(
  eventId: string,
  stepKey: FormationStepKey
): Promise<ActionResult<FormationCloseResult>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const def = formationStepDef(stepKey);
  if (!def) return { success: false, error: "Unknown formation step" };
  if (stepKey === "allocation" || stepKey === "lock") {
    return { success: false, error: "This step is not closed via Close Step." };
  }

  const supabase = await createServiceClient();
  const steps = await loadSteps(supabase, eventId);
  const step = steps.find((s) => s.step_key === stepKey);
  if (!step) return { success: false, error: "Formation step not found" };

  // The organiser-mode 'appointments' step has no ballot and no window —
  // appointments are made inline on the panel whenever, then the organiser
  // marks the step complete. It therefore closes directly from 'pending'
  // (rehearsal-caught 2026-08-12: it has no "Open" control, so requiring
  // 'open' first made it un-completable and blocked Lock). Election steps
  // still must be opened before they can be closed.
  if (def.mode === "organiser") {
    if (step.status === "closed" || step.status === "locked") {
      return { success: false, error: "This step is already complete." };
    }
    // Sequencing: every earlier step must be closed first (mirrors
    // openFormationStep) so appointments can't be finished before the
    // elections that seat the benches it draws from.
    const blocker = steps.find(
      (s) =>
        s.step_order < step.step_order &&
        s.status !== "closed" &&
        s.status !== "locked"
    );
    if (blocker) {
      const bDef = formationStepDef(blocker.step_key);
      return {
        success: false,
        error: `Finish "${bDef?.label ?? blocker.step_key}" first — steps run in order.`,
      };
    }
    const upErr = await updateStep(supabase, eventId, stepKey, {
      status: "closed",
      closed_at_ts: new Date().toISOString(),
    });
    if (upErr) return { success: false, error: upErr.message };
    revalidatePath(formationPath(eventId));
    return {
      success: true,
      data: {
        tie: false,
        tiedSessionIds: [],
        terminalTiedSessionIds: [],
        runoffOffered: false,
      },
    };
  }

  if (step.status !== "open") {
    return { success: false, error: "Only an open election step can be closed." };
  }

  if (step.session_ids.length === 0) {
    return { success: false, error: "This step has no ballots to close." };
  }

  const { data: sessionRows } = await supabase
    .from("vote_sessions")
    .select("id, status, config")
    .in("id", step.session_ids);
  const statusOf = new Map((sessionRows ?? []).map((s) => [s.id, s.status]));
  // config carries openRunoff's isRunoff/runoffOf markers — a tie on one of
  // those sessions is a REPEAT tie and gets no further runoff.
  const configOf = new Map(
    (sessionRows ?? []).map((s) => [
      s.id,
      (s.config ?? {}) as { isRunoff?: unknown; runoffOf?: unknown },
    ])
  );

  const tiedSessionIds: string[] = [];

  for (const sessionId of step.session_ids) {
    const status = statusOf.get(sessionId);
    if (!status || status === "revealed" || status === "archived") continue;

    if (status === "open") {
      const closed = await closeVote(sessionId);
      if (!closed.success) return { success: false, error: closed.error };
    }

    const revealed = await revealResults(sessionId);
    if (!revealed.success) return { success: false, error: revealed.error };
    if (revealed.data.tie) tiedSessionIds.push(sessionId);
  }

  if (tiedSessionIds.length > 0) {
    // Step stays OPEN: the organiser opens a runoff per tied session that has
    // not already had one, then closes the step again once those windows
    // elapse. A ballot that was ITSELF a runoff and tied again is terminal —
    // the organiser assigns that seat on Positions (Director, 2026-08-11).
    const terminalTiedSessionIds = tiedSessionIds.filter((id) =>
      isTerminalTieSession(configOf.get(id))
    );
    revalidatePath(formationPath(eventId));
    return {
      success: true,
      data: {
        tie: true,
        tiedSessionIds,
        terminalTiedSessionIds,
        runoffOffered:
          terminalTiedSessionIds.length < tiedSessionIds.length,
      },
    };
  }

  // All clean: archive the revealed tallies (participants saw them for
  // seconds at most — C4), then close the step.
  const cleared = await clearVoteResults(eventId);
  if (!cleared.success) return { success: false, error: cleared.error };

  const upErr = await updateStep(supabase, eventId, stepKey, {
    status: "closed",
    closed_at_ts: new Date().toISOString(),
  });
  if (upErr) return { success: false, error: upErr.message };

  revalidatePath(formationPath(eventId));
  return {
    success: true,
    data: {
      tie: false,
      tiedSessionIds: [],
      terminalTiedSessionIds: [],
      runoffOffered: false,
    },
  };
}

// ─── Runoff (tie-break) inside a step ───────────────────────────────

/**
 * Opens a runoff for a tied, revealed session belonging to an open step:
 * delegates to the existing openRunoff (which restricts the ballot to exactly
 * the tied candidates), stamps the new session with the formation window
 * (config.closesAt — openRunoff doesn't carry it), appends it to the step's
 * session_ids, moves the step deadline, and archives the revealed tie tally
 * so participants stop seeing it (C4).
 */
export async function openFormationRunoff(
  eventId: string,
  stepKey: FormationStepKey,
  revealedSessionId: string,
  newClosesAt: string
): Promise<ActionResult<{ sessionId: string }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, day1_date")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found" };

  const closes = validateClosesAt(newClosesAt, event.day1_date ?? null);
  if (!closes.ok) return { success: false, error: closes.error };

  const steps = await loadSteps(supabase, eventId);
  const step = steps.find((s) => s.step_key === stepKey);
  if (!step) return { success: false, error: "Formation step not found" };
  if (step.status !== "open") {
    return { success: false, error: "Runoffs can only be opened while the step is open." };
  }
  if (!step.session_ids.includes(revealedSessionId)) {
    return { success: false, error: "That ballot does not belong to this step." };
  }

  // Runoffs stop at ONE (Director, 2026-08-11). A ballot that is itself a
  // runoff and tied again is terminal — the organiser decides that seat on the
  // Positions page. Deny explicitly rather than opening runoff after runoff.
  const { data: tiedSession } = await supabase
    .from("vote_sessions")
    .select("id, config")
    .eq("id", revealedSessionId)
    .maybeSingle();
  if (
    isTerminalTieSession(
      (tiedSession?.config ?? {}) as { isRunoff?: unknown; runoffOf?: unknown }
    )
  ) {
    return {
      success: false,
      error:
        "This runoff tied again — there is no second runoff. Assign the seat on the Positions page, then press Close & count again.",
    };
  }

  const runoff = await openRunoff(revealedSessionId);
  if (!runoff.success) return { success: false, error: runoff.error };

  const cfgErr = await patchSessionConfig(supabase, runoff.data.sessionId, {
    closesAt: closes.iso,
    formationStepId: step.id,
  });
  if (cfgErr) return { success: false, error: cfgErr };

  // Hide the revealed tie tally now that the runoff is live (C4) — archived
  // sessions are skipped by closeFormationStep, so re-closing works.
  await clearVoteResults(eventId);

  const upErr = await updateStep(supabase, eventId, stepKey, {
    session_ids: [...step.session_ids, runoff.data.sessionId],
    closes_at: closes.iso,
  });
  if (upErr) return { success: false, error: upErr.message };

  revalidatePath(formationPath(eventId));
  return { success: true, data: { sessionId: runoff.data.sessionId } };
}

// ─── Deadline sweep ─────────────────────────────────────────────────

/**
 * Enact elapsed deadlines: for every OPEN step past its closes_at, close any
 * still-open ballot sessions (statuses only — NO auto-reveal; the organiser
 * closes the step to reveal). Idempotent; called at the top of the Formation
 * tab load. Casts past the deadline are hard-blocked in castVote regardless —
 * this sweep only removes UI staleness.
 */
export async function sweepFormationDeadlines(
  eventId: string
): Promise<ActionResult<{ sweptSessionIds: string[] }>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const steps = await loadSteps(supabase, eventId);
  const now = new Date();
  const sweptSessionIds: string[] = [];

  for (const step of steps) {
    if (!stepDeadlinePassed(step, now)) continue;
    if (step.session_ids.length === 0) continue;
    const { data: sessionRows } = await supabase
      .from("vote_sessions")
      .select("id, status")
      .in("id", step.session_ids);
    for (const s of sessionRows ?? []) {
      if (s.status !== "open") continue;
      const closed = await closeVote(s.id);
      if (closed.success) sweptSessionIds.push(s.id);
    }
  }

  if (sweptSessionIds.length > 0) revalidatePath(formationPath(eventId));
  return { success: true, data: { sweptSessionIds } };
}

// ─── Turnout ────────────────────────────────────────────────────────

/**
 * Per-ballot turnout for an election step: eligible voters (house-wide = all
 * participants; party ballots = that party's members; bench ballots = that
 * bench) minus those who have cast. Returns WHO hasn't voted (name + masked
 * email, for reminders) — never any vote value. canView-gated.
 */
export async function getFormationTurnout(
  eventId: string,
  stepKey: FormationStepKey
): Promise<ActionResult<FormationTurnout>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event" };
  }

  const supabase = await createServiceClient();
  const steps = await loadSteps(supabase, eventId);
  const step = steps.find((s) => s.step_key === stepKey);
  if (!step) return { success: false, error: "Formation step not found" };

  const { data: participants } = await supabase
    .from("participants")
    .select("id, full_name, email, party_id, party_side")
    .eq("event_id", eventId);
  const everyone = participants ?? [];

  const sessions: FormationTurnoutSession[] = [];
  const stepPendingById = new Map<string, FormationPendingParticipant>();
  let stepEligible = 0;
  let stepVoted = 0;

  if (step.session_ids.length > 0) {
    const { data: sessionRows } = await supabase
      .from("vote_sessions")
      .select("id, vote_type, status, config")
      .in("id", step.session_ids);

    const { data: votes } = await formationVotesTable(supabase)
      .select("session_id, participant_id")
      .in("session_id", step.session_ids);
    const votersBySession = new Map<string, Set<string>>();
    for (const v of votes ?? []) {
      if (!v.session_id || !v.participant_id) continue;
      const set = votersBySession.get(v.session_id) ?? new Set<string>();
      set.add(v.participant_id);
      votersBySession.set(v.session_id, set);
    }

    for (const s of sessionRows ?? []) {
      const cfg = (s.config ?? {}) as {
        partyId?: string;
        side?: "ruling" | "opposition";
      };
      const eligibleRows =
        cfg.partyId != null
          ? everyone.filter((p) => p.party_id === cfg.partyId)
          : cfg.side != null
            ? everyone.filter((p) => p.party_side === cfg.side)
            : everyone;
      const voters = votersBySession.get(s.id) ?? new Set<string>();
      const votedCount = eligibleRows.filter((p) => voters.has(p.id)).length;
      const pending = eligibleRows
        .filter((p) => !voters.has(p.id))
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          emailMasked: maskEmail(p.email),
        }));

      sessions.push({
        sessionId: s.id,
        voteType: s.vote_type,
        partyId: cfg.partyId ?? null,
        side: cfg.side ?? null,
        eligible: eligibleRows.length,
        voted: votedCount,
        pendingParticipants: pending,
      });
      stepEligible += eligibleRows.length;
      stepVoted += votedCount;
      for (const p of pending) stepPendingById.set(p.id, p);
    }
  }

  return {
    success: true,
    data: {
      stepKey,
      sessions,
      eligible: stepEligible,
      voted: stepVoted,
      pendingParticipants: [...stepPendingById.values()],
    },
  };
}

// ─── Lock ───────────────────────────────────────────────────────────

/**
 * The final freeze: refuses unless every other step is closed AND no vote
 * session for the event is left open/unrevealed (C5 — a lingering formation
 * ballot would block event-day voting via openVote's exclusivity rule), then
 * locks allocation (the existing lock) and marks every step 'locked'.
 */
export async function lockFormation(
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const seedErr = await ensureStepsSeeded(supabase, eventId);
  if (seedErr) return { success: false, error: seedErr.message };

  const steps = await loadSteps(supabase, eventId);
  const unfinished = steps.find(
    (s) =>
      s.step_key !== "lock" &&
      s.status !== "closed" &&
      s.status !== "locked"
  );
  if (unfinished) {
    const def = formationStepDef(unfinished.step_key);
    return {
      success: false,
      error: `"${def?.label ?? unfinished.step_key}" is not closed yet — finish every step before locking.`,
    };
  }

  // C5: a formation ballot left open/unrevealed blocks event-day voting
  // (house-wide exclusivity in openVote). Refuse to lock over one.
  const { data: liveSessions } = await supabase
    .from("vote_sessions")
    .select("id")
    .eq("event_id", eventId)
    .in("status", ["open", "closed"])
    .limit(1);
  if (liveSessions && liveSessions.length > 0) {
    return {
      success: false,
      error:
        "A vote session is still open or unrevealed — close and reveal it before locking formation.",
    };
  }

  const locked = await lockAllocation(eventId);
  if (!locked.success) return { success: false, error: locked.error };

  const { error: stepErr } = await formationStepsTable(supabase)
    .update({ status: "locked", updated_at: new Date().toISOString() })
    .eq("event_id", eventId);
  if (stepErr) return { success: false, error: stepErr.message };

  revalidatePath(formationPath(eventId));
  return { success: true, data: null };
}

// ─── Unlock ─────────────────────────────────────────────────────────

/**
 * The way back from lockFormation, for the late change the lock cannot absorb
 * (a student drops out the night before). Reverses exactly what the lock did:
 * allocation is unlocked (the existing unlockAllocation) and every 'locked'
 * step returns to 'closed' — NOT 'pending', so each step keeps its window,
 * history and session_ids and the organiser re-runs only what they need.
 *
 * Unlocking does NOT undo any election: parliament_role rows written at reveal
 * stay exactly as they are. It reopens the checklist, nothing more.
 * canManage-gated; refuses when the House is not locked.
 */
export async function unlockFormation(
  eventId: string
): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }

  const supabase = await createServiceClient();
  const steps = await loadSteps(supabase, eventId);
  const lockStep = steps.find((s) => s.step_key === "lock");
  if (!lockStep || lockStep.status !== "locked") {
    return {
      success: false,
      error: "The House is not locked — there is nothing to unlock.",
    };
  }

  const unlocked = await unlockAllocation(eventId);
  if (!unlocked.success) return { success: false, error: unlocked.error };

  // Only rows the lock itself set are touched (status = 'locked').
  const { error: stepErr } = await formationStepsTable(supabase)
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("status", "locked");
  if (stepErr) return { success: false, error: stepErr.message };

  revalidatePath(formationPath(eventId));
  return { success: true, data: null };
}

// ─── Announcement (Oath list) ───────────────────────────────────────

/**
 * The formed House, for the printable announcement: Speaker + deputies,
 * per-party leaders, PM, LoP, Cabinet/Shadow (with primary ministry),
 * Deputy Ministers and officials. Read-only; canView-gated. The officials
 * roles are runtime-only strings until the RR enum script runs, so
 * parliament_role is compared as a plain string here.
 */
export async function getFormationAnnouncement(
  eventId: string
): Promise<ActionResult<FormationAnnouncement>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) {
    return { success: false, error: "Not authorized to view this event" };
  }

  const supabase = await createServiceClient();
  const [{ data: participants }, { data: parties }] = await Promise.all([
    supabase
      .from("participants")
      // select("*"): cabinet_portfolios post-dates the generated types (which
      // are never regenerated — house rule), so a typed column list rejects
      // it; the star select carries it at runtime and person() reads it via a
      // narrowing cast.
      .select("*")
      .eq("event_id", eventId)
      .order("full_name"),
    supabase
      .from("parties")
      .select("id, name, side, party_number, party_leader_id")
      .eq("event_id", eventId)
      .order("party_number"),
  ]);

  const people = participants ?? [];
  const person = (p: (typeof people)[number]): FormationAnnouncementPerson => ({
    id: p.id,
    full_name: p.full_name,
    school_name: p.school_name,
    // Primary ministry = first held portfolio (multi-ministry column is plural).
    ministry:
      (p as { cabinet_portfolios?: string[] | null }).cabinet_portfolios?.[0] ??
      null,
  });
  const roleOf = (p: (typeof people)[number]): string =>
    (p.parliament_role as string | null) ?? "";
  const byRole = (role: string) => people.filter((p) => roleOf(p) === role);
  const firstByRole = (role: string) => {
    const found = byRole(role);
    return found.length > 0 ? person(found[0]) : null;
  };
  const byId = new Map(people.map((p) => [p.id, p]));

  return {
    success: true,
    data: {
      speaker: firstByRole("speaker"),
      deputySpeakers: byRole("deputy_speaker").map(person),
      partyLeaders: (parties ?? []).map((party) => {
        const leaderRow = party.party_leader_id
          ? byId.get(party.party_leader_id)
          : undefined;
        return {
          partyId: party.id,
          partyName: party.name,
          side:
            party.side === "ruling" || party.side === "opposition"
              ? party.side
              : null,
          leader: leaderRow ? person(leaderRow) : null,
        };
      }),
      primeMinister: firstByRole("prime_minister"),
      leaderOfOpposition: firstByRole("leader_of_opposition"),
      cabinetMinisters: byRole("cabinet_minister").map(person),
      shadowMinisters: byRole("shadow_minister").map(person),
      deputyMinisters: byRole("deputy_minister").map(person),
      officials: [
        ...byRole("parliamentary_administrator").map((p) => ({
          ...person(p),
          role: "parliamentary_administrator",
        })),
        ...byRole("parliamentary_journalist").map((p) => ({
          ...person(p),
          role: "parliamentary_journalist",
        })),
      ],
    },
  };
}
