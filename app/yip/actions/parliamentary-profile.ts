"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import {
  KEY_MAX,
  classifyAxis,
  readNumber,
  type SkillAxis,
} from "@/lib/yip/skill-axes";
import { countTurns, type TurnRow } from "@/lib/yip/turn-count";
import { effectiveMinistries } from "@/lib/yip/cabinet";
import {
  coerceStoredMinistries,
  coerceStoredRoles,
  selfNominationRoleLabel,
} from "@/lib/yip/self-nomination";

/**
 * The Parliamentary Profile — what a member did, set against the House.
 *
 * /me already carries a four-axis skill profile: four numbers out of 100 with
 * nothing to measure them against. A 62 means nothing to a sixteen-year-old on
 * its own. This adds the missing half — where that 62 sits among everyone who
 * sat in the same House, and what the member actually DID to earn it.
 *
 * DELIBERATELY NOT A LEAGUE TABLE. It reports percentile BANDS ("top quarter"),
 * never a rank, never another member's name or number, and never anybody else's
 * score. A member learns where they stand without the House learning where
 * everyone stands — the same line PR #1009 drew when it made marks chair-only.
 * A band also cannot be reverse-engineered into someone else's position.
 *
 * NO LLM. YIP production never calls one (minors, dispute-proofing, cost), so
 * every sentence this produces is arithmetic over the member's own record. The
 * insight comes from the comparison, not from generated prose.
 *
 * SELF-SHARPENING. Everything is derived at read time from whatever scores
 * exist right now, so a profile opened mid-event is honest about being early
 * and the same page gets sharper as jurors submit, with nothing to re-run.
 */

export interface AxisStanding {
  axis: SkillAxis;
  label: string;
  /** This member's score on the axis, 0..100. */
  you: number;
  /** The House's median on the same axis, 0..100. */
  houseMedian: number;
  /** Share of scored members at or below this member, 0..100. */
  percentile: number;
  band: string;
}

export interface FootprintLine {
  key: string;
  label: string;
  you: number;
  houseMedian: number;
  /** How many members did this at all — context for a median of zero. */
  houseDidAny: number;
}

/** One post this member stood for, with how contested it was. */
export interface NominationChoice {
  role: string;
  label: string;
  /**
   * Members of this House who stood for the same post, THIS MEMBER INCLUDED.
   * A count of a group, never a position within it — see the note on
   * NominationStanding.
   */
  houseWanted: number;
}

/**
 * What this member PUT THEIR HAND UP FOR — intent, not outcome.
 *
 * Deliberately says nothing about whether they got the post or who did. This
 * page is about one member's own record; naming winners would turn it into a
 * result sheet about the House, which is the line PR #1009 drew.
 *
 * `houseWanted` is safe for the same reason `houseDidAny` is: it is the size
 * of a group, so it cannot be read back as anybody's rank.
 */
export interface NominationStanding {
  /** False when this member never filed a nomination. */
  filed: boolean;
  /** The posts they stood for, in catalogue order. */
  roles: NominationChoice[];
  /** Portfolio labels, when a Cabinet/Shadow role is on the nomination. */
  ministries: string[];
  /** Members of the House who filed a nomination at all. */
  houseFiled: number;
}

export interface ParliamentaryProfile {
  /** False when no juror has submitted a score for this member yet. */
  scored: boolean;
  /** Submitted score rows behind the axes — low means treat gently. */
  sampleSize: number;
  /** Distinct jurors who scored this member. */
  juryCount: number;
  /** Members in the House with at least one submitted score. */
  houseScored: number;
  axes: AxisStanding[];
  /** The axis where this member stands highest against the House. */
  signature: AxisStanding | null;
  footprint: FootprintLine[];
  /** Things this member did more of than most of the House. */
  standsOutFor: string[];
  /** What this member stood for at this round. */
  nominations: NominationStanding;
}

const AXIS_LABEL: Record<SkillAxis, string> = {
  research: "Research & preparation",
  speaking: "Speaking & delivery",
  policy: "Policy & argument",
  process: "Conduct & teamwork",
};

const AXES: SkillAxis[] = ["research", "speaking", "policy", "process"];

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Percentile band. Bands, never a rank — see the file header. */
function bandFor(percentile: number): string {
  if (percentile >= 90) return "Top tenth of the House";
  if (percentile >= 75) return "Top quarter of the House";
  if (percentile >= 50) return "Above the House median";
  if (percentile >= 25) return "Around the House median";
  return "Building";
}

/**
 * Returns the CALLING member's own profile. Takes no id ON PURPOSE.
 *
 * This file is "use server", so every export here is a callable endpoint. An
 * earlier draft took `participantId` as an argument and read on the service
 * client, which bypasses RLS — meaning anyone could have posted any id and read
 * any student's standing. The subject is therefore resolved from the signed
 * participant cookie and from nowhere else; there is no id to tamper with.
 *
 * A member seeing their own comparison is the whole point of the feature and is
 * safe. A member seeing somebody else's is the thing PR #1009 was opened to
 * stop, when named marks for 345 minors turned out to be readable.
 */
export async function getParliamentaryProfile(): Promise<ParliamentaryProfile | null> {
  const session = await getYipSession();
  if (!session || session.type !== "participant") return null;
  const participantId = session.id;

  const supabase = await createServiceClient();

  const { data: me } = await supabase
    .from("participants")
    .select("id, event_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!me?.event_id) return null;
  const eventId = me.event_id as string;

  // ── Live dimension → max registry (same source the /me profile uses) ──
  const dimMax = new Map<string, number>();
  const looseDb = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: unknown
        ) => Promise<{ data: Array<{ parameters: unknown }> | null }>;
      };
    };
  };
  const { data: spRows } = await looseDb
    .from("session_parameters")
    .select("parameters")
    .eq("is_active", true);
  for (const sp of spRows ?? []) {
    const params = Array.isArray(sp.parameters)
      ? (sp.parameters as Array<{
          key?: string;
          max_score?: number;
          kind?: string;
        }>)
      : [];
    for (const p of params) {
      if (p.kind && p.kind !== "evaluation") continue;
      if (p.key && Number(p.max_score) > 0) dimMax.set(p.key, Number(p.max_score));
    }
  }
  for (const [k, v] of Object.entries(KEY_MAX)) {
    if (!dimMax.has(k)) dimMax.set(k, v);
  }

  // ── ONE read for the whole House, aggregated in memory ──
  // Computing each member's profile with its own query would be 185 round
  // trips to render one page. The House distribution is the point of this
  // screen, so it is read once and shared across every comparison below.
  const { data: allScores } = await supabase
    .from("scores")
    .select("participant_id, criteria_scores, jury_assignment_id")
    .eq("event_id", eventId)
    .eq("status", "submitted");
  const rows = allScores ?? [];

  type Acc = { sum: number; count: number };
  const byMember = new Map<string, Record<SkillAxis, Acc>>();
  const rowsFor = new Map<string, number>();
  const juryFor = new Map<string, Set<string>>();

  for (const r of rows) {
    const pid = r.participant_id as string | null;
    if (!pid) continue;
    rowsFor.set(pid, (rowsFor.get(pid) ?? 0) + 1);
    if (r.jury_assignment_id) {
      if (!juryFor.has(pid)) juryFor.set(pid, new Set());
      juryFor.get(pid)!.add(String(r.jury_assignment_id));
    }
    if (!byMember.has(pid)) {
      byMember.set(pid, {
        research: { sum: 0, count: 0 },
        speaking: { sum: 0, count: 0 },
        policy: { sum: 0, count: 0 },
        process: { sum: 0, count: 0 },
      });
    }
    const acc = byMember.get(pid)!;
    const cs = r.criteria_scores as Record<string, unknown> | null;
    if (!cs || typeof cs !== "object") continue;
    for (const [key, value] of Object.entries(cs)) {
      const raw = readNumber(value);
      const max = dimMax.get(key);
      if (raw === null || !max) continue;
      const axis = classifyAxis(key);
      if (!axis) continue;
      // An unscored sub-criterion is not a zero — skipped, never counted.
      acc[axis].sum += Math.max(0, Math.min(1, raw / max));
      acc[axis].count += 1;
    }
  }

  const scoreOf = (pid: string, axis: SkillAxis): number | null => {
    const a = byMember.get(pid)?.[axis];
    if (!a || a.count === 0) return null;
    return Math.round((a.sum / a.count) * 100);
  };

  const myRows = rowsFor.get(participantId) ?? 0;
  const scored = myRows > 0;

  const axes: AxisStanding[] = AXES.map((axis) => {
    const you = scoreOf(participantId, axis) ?? 0;
    const houseValues: number[] = [];
    for (const pid of byMember.keys()) {
      const v = scoreOf(pid, axis);
      if (v !== null) houseValues.push(v);
    }
    const atOrBelow = houseValues.filter((v) => v <= you).length;
    const percentile =
      houseValues.length > 0
        ? Math.round((atOrBelow / houseValues.length) * 100)
        : 0;
    return {
      axis,
      label: AXIS_LABEL[axis],
      you,
      houseMedian: median(houseValues),
      percentile,
      band: bandFor(percentile),
    };
  });

  // The one line worth leading with: not the highest SCORE, but the axis where
  // this member stands furthest ahead of the House. A 55 that beats three
  // quarters of the room says more about them than a 70 that does not.
  const signature = scored
    ? [...axes].sort((a, b) => b.percentile - a.percentile)[0] ?? null
    : null;

  // ── What they actually DID ──
  // Four bulk reads, then medians in memory. Counted for the whole House so a
  // member sees their own footprint against the room, not in a vacuum.
  const countBy = (
    list: Array<{ pid: string | null }>
  ): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of list) {
      if (!r.pid) continue;
      m.set(r.pid, (m.get(r.pid) ?? 0) + 1);
    }
    return m;
  };

  const { data: agendaRows } = await supabase
    .from("agenda")
    .select("id")
    .eq("event_id", eventId);
  const itemIds = (agendaRows ?? []).map((a) => a.id as string);

  // Turns must be counted by the SAME rule the Chair's speaking board uses, or
  // a member reads one number on their phone and the Chair sees another. This
  // file used to count only agenda_speakers and so under-reported anyone whose
  // turn was recorded as a 'spoken' hand-raise with no mirrored row.
  let formalRows: TurnRow[] = [];
  if (itemIds.length > 0) {
    const { data } = await supabase
      .from("agenda_speakers")
      .select("participant_id, agenda_item_id")
      .in("agenda_item_id", itemIds)
      .eq("status", "completed");
    formalRows = (data ?? []) as TurnRow[];
  }
  const { data: spokenReqRows } = await supabase
    .from("speaking_requests")
    .select("participant_id, agenda_item_id")
    .eq("event_id", eventId)
    .eq("status", "spoken");
  const turnsByMember = countTurns(formalRows, (spokenReqRows ?? []) as TurnRow[]);
  const { data: qRows } = await supabase
    .from("questions")
    .select("submitted_by")
    .eq("event_id", eventId)
    .neq("status", "rejected");
  // motions records its mover as raised_by_id, not participant_id.
  const { data: mRows } = await supabase
    .from("motions")
    .select("raised_by_id")
    .eq("event_id", eventId);
  // bills.mover_participant_id has no FK (house style) and is absent from the
  // generated types, so it is read through a loose client — the same pattern
  // getBills uses for the identical column.
  const looseBills = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: unknown
        ) => Promise<{
          data: Array<{ mover_participant_id: string | null }> | null;
        }>;
      };
    };
  };
  const { data: bRows } = await looseBills
    .from("bills")
    .select("mover_participant_id")
    .eq("event_id", eventId);

  const turns = turnsByMember;
  const questions = countBy(
    (qRows ?? []).map((r) => ({ pid: r.submitted_by as string | null }))
  );
  const motions = countBy(
    (mRows ?? []).map((r) => ({ pid: r.raised_by_id as string | null }))
  );
  const bills = countBy(
    (bRows ?? []).map((r) => ({
      pid: r.mover_participant_id as string | null,
    }))
  );

  const line = (
    key: string,
    label: string,
    m: Map<string, number>
  ): FootprintLine => ({
    key,
    label,
    you: m.get(participantId) ?? 0,
    houseMedian: median([...m.values()]),
    houseDidAny: m.size,
  });

  const footprint: FootprintLine[] = [
    line("turns", "Times you took the floor", turns),
    line("questions", "Questions you tabled", questions),
    line("motions", "Motions you raised", motions),
    line("bills", "Bills you moved", bills),
  ];

  // Strictly ahead of the median AND ahead of most who did it at all — so a
  // median of zero cannot flatter someone who did one of something.
  const standsOutFor: string[] = [];
  for (const f of footprint) {
    if (f.you <= 0) continue;
    const values = [...(
      f.key === "turns"
        ? turns
        : f.key === "questions"
          ? questions
          : f.key === "motions"
            ? motions
            : bills
    ).values()];
    const beaten = values.filter((v) => v < f.you).length;
    if (f.you > f.houseMedian && beaten / Math.max(1, values.length) >= 0.6) {
      standsOutFor.push(f.label.toLowerCase());
    }
  }

  // ── What they PUT THEIR HAND UP FOR ────────────────────────────
  // A self-nomination is the one part of a member's record that is intent
  // rather than action, and this page showed none of it: at the SRTN
  // regional round 168 of the 196 members declared an ambition and could
  // not see it anywhere. Read for the WHOLE House in one query, so telling
  // a member how many others stood for the same post costs no extra trip.
  //
  // self_nominations is absent from the generated types, so it is read
  // through a loose client — the same pattern app/yip/actions/
  // self-nomination.ts uses for this very table, and the one getBills uses
  // for bills.mover_participant_id.
  const looseNominations = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: unknown
        ) => Promise<{
          data: Array<{
            participant_id: string | null;
            roles: unknown;
            ministries: unknown;
          }> | null;
        }>;
      };
    };
  };
  const { data: nomRows } = await looseNominations
    .from("self_nominations")
    .select("participant_id, roles, ministries")
    .eq("event_id", eventId);

  const houseWanted = new Map<string, number>();
  let myRoles: string[] = [];
  let myMinistriesRaw: unknown = null;
  let filed = false;
  for (const row of nomRows ?? []) {
    // coerceStoredRoles drops anything outside the catalogue, so a stale or
    // renamed role value cannot reach a student's screen as a raw key.
    const roles = coerceStoredRoles(row.roles);
    for (const role of roles) {
      houseWanted.set(role, (houseWanted.get(role) ?? 0) + 1);
    }
    if (row.participant_id === participantId) {
      filed = true;
      myRoles = roles;
      myMinistriesRaw = row.ministries;
    }
  }

  // Portfolios come from the EVENT's own cabinet list, so a chapter running
  // twelve ministries does not read its nominee's two back as raw values.
  //
  // The stored value is the LABEL, not the key. submitSelfNomination validates
  // the picks against readEventMinistries(), which returns
  // effectiveMinistries(...).map((m) => m.label), so that is what lands in the
  // column. Filtering here against keys instead would match nothing and render
  // an empty portfolio list while looking perfectly healthy — confirmed
  // against the live SRTN round, where the stored values read
  // "Ministry of Youth Affairs & Sports", not "ministry_of_youth_affairs_sports".
  const { data: eventRow } = await supabase
    .from("events")
    .select("cabinet_ministries")
    .eq("id", eventId)
    .maybeSingle();
  const portfolioLabels = effectiveMinistries(
    (eventRow as { cabinet_ministries?: unknown } | null)?.cabinet_ministries
  ).map((p) => p.label);

  const nominations: NominationStanding = {
    filed,
    roles: myRoles.map((role) => ({
      role,
      label: selfNominationRoleLabel(role),
      // Their own row is always counted, so this can never be 0 for a role
      // they actually stood for.
      houseWanted: houseWanted.get(role) ?? 1,
    })),
    // Already labels; returned in the event's own portfolio order.
    ministries: coerceStoredMinistries(myMinistriesRaw, portfolioLabels),
    houseFiled: (nomRows ?? []).length,
  };

  return {
    scored,
    sampleSize: myRows,
    juryCount: juryFor.get(participantId)?.size ?? 0,
    houseScored: byMember.size,
    axes,
    signature,
    footprint,
    standsOutFor,
    nominations,
  };
}
