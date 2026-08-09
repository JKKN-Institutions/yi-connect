"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

// Organiser-side scoring grid (chapter ask, Director-approved 2026-08):
// a matrix overview — rows = participants (by Const. No., NEVER names),
// columns = jurors of the selected session, cells = score status — so an
// organiser running the event can spot scoring gaps live.
//
// Two locked constraints honoured here:
//  1. NUMBERS ONLY. Participant names are never even SELECTed from the DB in
//     this file — the grid can be safely projected without creating a
//     re-identification surface (jury blindness doctrine).
//  2. SCORE VALUES stay behind canViewScores (super-admin / chapter chair,
//     product-owner decision 2026-06-13). Everyone with canView (organisers)
//     sees COVERAGE (scored / draft / missing); the numeric totals are masked
//     SERVER-SIDE (null in the payload) for roles without canViewScores.
//
// Performance: ONE action call returns the whole event matrix (every session)
// so the client switches sessions with zero extra queries. Reads are batched
// with Promise.all and the scores read is paged past the PostgREST 1000-row
// cap (heavy events: 170+ participants × jurors × sessions).

export type GridSession = {
  id: string;
  day: number;
  sequence_order: number;
  title: string;
};

export type GridJuror = {
  id: string;
  jury_name: string;
};

// NO name fields on purpose — numbers-only doctrine (see header comment).
export type GridParticipant = {
  id: string;
  constituency_number: number | null;
  serial_no: number | null;
  parliament_role: string | null;
  party_side: string | null;
  party_number: number | null;
};

export type GridCellStatus = "submitted" | "draft";

export type GridCell = {
  participant_id: string;
  jury_assignment_id: string;
  /** submitted (incl. locked) beats draft when both turns exist. */
  status: GridCellStatus;
  /** Latest turn's total — null when the viewer's role may not see values. */
  total: number | null;
  /** Number of score rows (turns) behind this cell. */
  turns: number;
};

export type SessionGrid = {
  session_id: string;
  /** Columns: jurors assigned to this session ∪ jurors who already scored it. */
  juror_ids: string[];
  cells: GridCell[];
};

export type ScoreGridData = {
  event: { id: string; scores_locked: boolean };
  /** Whether numeric totals are included (super-admin / chapter chair only). */
  revealScores: boolean;
  participants: GridParticipant[];
  jurors: GridJuror[];
  sessions: GridSession[];
  grids: SessionGrid[];
  fetched_at: string;
};

/** Synthetic bucket for legacy scores recorded without a session. */
const GENERAL_SESSION_ID = "__general__";

type ScoreRow = {
  participant_id: string;
  jury_assignment_id: string;
  agenda_item_id: string | null;
  occurrence: number | null;
  total_score: number | null;
  status: string | null;
};

/** Page past the PostgREST row cap — heavy events exceed 1000 score rows. */
async function fetchAllScores(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
): Promise<ScoreRow[]> {
  const PAGE = 1000;
  const all: ScoreRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("scores")
      .select(
        "participant_id, jury_assignment_id, agenda_item_id, occurrence, total_score, status"
      )
      .eq("event_id", eventId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) break;
    const rows = (data ?? []) as ScoreRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

export async function getScoreGrid(
  eventId: string
): Promise<ScoreGridData | null> {
  // Organiser dashboard surface: any event viewer may see COVERAGE; numeric
  // totals additionally require canViewScores (masked below). Fail closed.
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const supabase = await createServiceClient();

  const [
    { data: event },
    { data: participants },
    { data: juries },
    { data: sessions },
    { data: sessionAssignments },
    scoreRows,
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, scores_locked")
      .eq("id", eventId)
      .maybeSingle(),
    // Roster = role-holders (same definition as the Scoring page). Names are
    // deliberately NOT selected — numbers-only doctrine.
    supabase
      .from("participants")
      .select(
        "id, constituency_number, serial_no, parliament_role, party_side, party_number"
      )
      .eq("event_id", eventId)
      .not("parliament_role", "is", null)
      .order("constituency_number", { nullsFirst: false }),
    supabase
      .from("jury_assignments")
      .select("id, jury_name")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("created_at"),
    supabase
      .from("agenda")
      .select("id, day, sequence_order, title")
      .eq("event_id", eventId)
      .eq("is_scoreable", true)
      .order("day")
      .order("sequence_order"),
    supabase
      .from("jury_session_assignments")
      .select("jury_assignment_id, agenda_item_id")
      .eq("event_id", eventId),
    fetchAllScores(supabase, eventId),
  ]);

  if (!event) return null;

  const participantList = (participants ?? []) as GridParticipant[];
  const juryList = (juries ?? []) as GridJuror[];
  const sessionList = (sessions ?? []) as GridSession[];
  const participantIds = new Set(participantList.map((p) => p.id));
  const juryIds = new Set(juryList.map((j) => j.id));

  // Session → assigned juror ids (the columns each session starts from).
  const assignedBySession = new Map<string, Set<string>>();
  for (const a of sessionAssignments ?? []) {
    if (!juryIds.has(a.jury_assignment_id)) continue;
    let set = assignedBySession.get(a.agenda_item_id);
    if (!set) {
      set = new Set<string>();
      assignedBySession.set(a.agenda_item_id, set);
    }
    set.add(a.jury_assignment_id);
  }

  // Aggregate score rows into one cell per (session, participant, juror).
  // Later turns win within the same status tier; submitted/locked beats draft.
  type Agg = {
    status: GridCellStatus;
    total: number;
    turns: number;
    bestOccurrence: number;
  };
  const cellsBySession = new Map<string, Map<string, Agg>>();
  const scoredJurorsBySession = new Map<string, Set<string>>();
  let hasGeneral = false;

  for (const s of scoreRows) {
    // Ignore rows for inactive jurors or non-roster participants — they would
    // create columns/rows the organiser cannot act on.
    if (!juryIds.has(s.jury_assignment_id)) continue;
    if (!participantIds.has(s.participant_id)) continue;

    const sessionId = s.agenda_item_id ?? GENERAL_SESSION_ID;
    if (sessionId === GENERAL_SESSION_ID) hasGeneral = true;

    const submitted = s.status === "submitted" || s.status === "locked";
    const isDraft = s.status === "draft";
    if (!submitted && !isDraft) continue;

    let byKey = cellsBySession.get(sessionId);
    if (!byKey) {
      byKey = new Map<string, Agg>();
      cellsBySession.set(sessionId, byKey);
    }
    let scoredSet = scoredJurorsBySession.get(sessionId);
    if (!scoredSet) {
      scoredSet = new Set<string>();
      scoredJurorsBySession.set(sessionId, scoredSet);
    }
    scoredSet.add(s.jury_assignment_id);

    const key = `${s.participant_id}|${s.jury_assignment_id}`;
    const occ = s.occurrence ?? 1;
    const total = Number(s.total_score) || 0;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        status: submitted ? "submitted" : "draft",
        total,
        turns: 1,
        bestOccurrence: occ,
      });
      continue;
    }
    existing.turns += 1;
    const tier = submitted ? 1 : 0;
    const existingTier = existing.status === "submitted" ? 1 : 0;
    if (tier > existingTier || (tier === existingTier && occ >= existing.bestOccurrence)) {
      existing.status = submitted ? "submitted" : "draft";
      existing.total = total;
      existing.bestOccurrence = occ;
    }
  }

  // Sessions shown = scoreable agenda rows, plus the synthetic "General"
  // bucket when legacy no-session scores exist.
  const allSessions: GridSession[] = [...sessionList];
  if (hasGeneral) {
    allSessions.push({
      id: GENERAL_SESSION_ID,
      day: 0,
      sequence_order: 0,
      title: "General (no session)",
    });
  }

  const reveal = access.canViewScores;
  const grids: SessionGrid[] = allSessions.map((sess) => {
    // Columns: jurors assigned to the session ∪ jurors who already scored it.
    // A session with NO assignment rows falls back to ALL active jurors
    // (pre-assignment-era events where every juror scores every session).
    const assigned = assignedBySession.get(sess.id);
    const scored = scoredJurorsBySession.get(sess.id);
    let columnSet: Set<string>;
    if (sess.id === GENERAL_SESSION_ID) {
      columnSet = new Set(juryList.map((j) => j.id));
    } else if (assigned && assigned.size > 0) {
      columnSet = new Set(assigned);
      for (const id of scored ?? []) columnSet.add(id);
    } else {
      columnSet = new Set(juryList.map((j) => j.id));
    }
    // Keep the jury roster's stable ordering.
    const juror_ids = juryList
      .filter((j) => columnSet.has(j.id))
      .map((j) => j.id);

    const byKey = cellsBySession.get(sess.id);
    const cells: GridCell[] = [];
    if (byKey) {
      for (const [key, agg] of byKey) {
        const [participant_id, jury_assignment_id] = key.split("|");
        cells.push({
          participant_id,
          jury_assignment_id,
          status: agg.status,
          // Mask numeric totals server-side for roles without canViewScores —
          // the value must not even reach the browser payload.
          total: reveal ? agg.total : null,
          turns: agg.turns,
        });
      }
    }
    return { session_id: sess.id, juror_ids, cells };
  });

  return {
    event: { id: event.id, scores_locked: Boolean(event.scores_locked) },
    revealScores: reveal,
    participants: participantList,
    jurors: juryList,
    sessions: allSessions,
    grids,
    fetched_at: new Date().toISOString(),
  };
}
