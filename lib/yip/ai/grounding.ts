import "server-only";

/**
 * Assemble the grounding payloads handed to the out-of-band routine.
 *
 * HARD RULE (Director, non-negotiable): the participant_story payload contains
 * ZERO scores, ZERO rank, ZERO comparison to other participants. round_narrative
 * is event-level facts only (counts, topics, committees, the saved zero-hour
 * summary) — also no scores.
 *
 * session_feedback is the ONE grounding that carries score-derived signal. It is
 * built ONLY here and reached ONLY from the bearer endpoint
 * (app/yip/api/ai-drafts/route.ts) — NEVER from a participant component. Even
 * then it carries no raw score and no rank: only a per-criterion ratio of the
 * participant against THEIR OWN other criteria (self-referential), so the
 * routine can pick a relatively-stronger and relatively-weaker criterion and
 * coach warmly. The participant card never reads this — it reads draft_text
 * alone (see app/yip/me/your-growth-card.tsx).
 *
 * Reads via createServiceClient() (schema-pinned to "yip"). Mirrors the topic /
 * scheme lookup used by app/yip/me/page.tsx and the report section helpers.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { ROLE_LABELS } from "@/lib/yip/constants";
import {
  parentScoreByKey,
  type RubricCriterionShape,
} from "@/lib/yip/rubric";
import type {
  AiSourceRef,
  ParticipantStoryGrounding,
  RoundNarrativeGrounding,
  SessionCriterionPattern,
  SessionFeedbackGrounding,
} from "./types";

function roleLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const found = (ROLE_LABELS as Record<string, string>)[slug];
  if (found) return found;
  // Fallback: title-case the slug.
  return slug
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Resolve the event's national/central debate topic(s): event_topics joined to
 * topics where is_central, ordered by sequence. Same join used by
 * app/yip/actions/topics.ts getEventTopics.
 */
async function getCentralTopics(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string
): Promise<{ title: string; scheme: string | null; id: string }[]> {
  const { data } = await svc
    .from("event_topics")
    .select("is_central, sequence, topic:topics(id, title, linked_scheme)")
    .eq("event_id", eventId)
    .order("sequence");
  if (!data) return [];
  return (data as unknown as Array<{
    is_central: boolean | null;
    topic: { id: string; title: string; linked_scheme: string | null } | null;
  }>)
    .filter((r) => r.is_central && r.topic)
    .map((r) => ({
      id: r.topic!.id,
      title: r.topic!.title,
      scheme: r.topic!.linked_scheme ?? null,
    }));
}

/**
 * Build the participant_story grounding for one participant. Returns null when
 * the participant or event is missing (the routine then skips this request).
 *
 * NEVER reads yip.scores / yip.results — see HARD RULE above.
 */
export async function buildParticipantStoryGrounding(
  eventId: string,
  participantId: string
): Promise<ParticipantStoryGrounding | null> {
  const svc = await createServiceClient();

  const { data: p } = await svc
    .from("participants")
    .select(
      "id, full_name, parliament_role, ministry, committee_name, committee_number, party_side, party_id, party_number, constituency_name, constituency_number"
    )
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!p) return null;

  const { data: event } = await svc
    .from("events")
    .select("id, name, chapter_name, level")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  const refs: AiSourceRef[] = [
    { type: "participant", id: p.id, label: p.full_name },
    { type: "event", id: event.id, label: event.name },
  ];

  // ── Party name ──────────────────────────────────────────────────────
  let partyName: string | null = null;
  if (p.party_id) {
    const { data: party } = await svc
      .from("parties")
      .select("name")
      .eq("id", p.party_id)
      .maybeSingle();
    partyName = party?.name ?? null;
  }
  if (!partyName && p.party_number != null) {
    const { data: party } = await svc
      .from("parties")
      .select("name")
      .eq("event_id", eventId)
      .eq("party_number", p.party_number)
      .maybeSingle();
    partyName = party?.name ?? null;
  }
  if (partyName) refs.push({ type: "party", id: p.party_id, label: partyName });

  // ── Committee → ministry topic + linked scheme ──────────────────────
  // Same lookup as app/yip/me/page.tsx: topics where category='committee'
  // AND title = participant.committee_name AND is_active.
  let ministry: ParticipantStoryGrounding["ministry"] = null;
  if (p.committee_name) {
    const { data: ct } = await svc
      .from("topics")
      .select("id, description, linked_scheme")
      .eq("category", "committee")
      .eq("title", p.committee_name)
      .eq("is_active", true)
      .maybeSingle();
    ministry = {
      topic: ct?.description ?? null,
      scheme: ct?.linked_scheme ?? null,
    };
    refs.push({
      type: "committee_topic",
      id: ct?.id ?? null,
      label: p.committee_name,
    });
  }

  // ── National/central topic(s) ───────────────────────────────────────
  const central = await getCentralTopics(svc, eventId);
  for (const t of central) {
    refs.push({ type: "central_topic", id: t.id, label: t.title });
  }

  return {
    kind: "participant_story",
    participant: {
      id: p.id,
      fullName: p.full_name,
      roleLabel: roleLabel(p.parliament_role),
      roleSlug: p.parliament_role ?? null,
      partyName,
      partySide: p.party_side ?? null,
      constituencyName: p.constituency_name ?? null,
      constituencyNumber: p.constituency_number ?? null,
      committeeName: p.committee_name ?? null,
      committeeNumber: p.committee_number ?? null,
    },
    ministry,
    nationalTopics: central.map((t) => ({ title: t.title, scheme: t.scheme })),
    event: {
      id: event.id,
      name: event.name,
      chapterName: event.chapter_name ?? null,
      level: event.level,
    },
    sourceRefs: refs,
  };
}

/**
 * Build the round_narrative grounding for an event (event-level facts only, NO
 * scores). Returns null when the event is missing.
 */
export async function buildRoundNarrativeGrounding(
  eventId: string
): Promise<RoundNarrativeGrounding | null> {
  const svc = await createServiceClient();

  // events.zero_hour_summary + ai_enabled are not-yet-typed → loose read.
  const dbLoose = svc as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: unknown) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> };
      };
    };
  };
  const { data: evLoose } = await dbLoose
    .from("events")
    .select(
      "id, name, chapter_name, city, state, level, day1_date, day2_date, zero_hour_summary"
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!evLoose) return null;
  const event = evLoose as {
    id: string;
    name: string;
    chapter_name: string | null;
    city: string | null;
    state: string | null;
    level: string;
    day1_date: string | null;
    day2_date: string | null;
    zero_hour_summary: string | null;
  };

  const refs: AiSourceRef[] = [
    { type: "event", id: event.id, label: event.name },
  ];

  const { count: participantCount } = await svc
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  const { count: partyCount } = await svc
    .from("parties")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  // National/central topic(s).
  const central = await getCentralTopics(svc, eventId);
  for (const t of central) {
    refs.push({ type: "central_topic", id: t.id, label: t.title });
  }

  // Distinct committees that sat → ministry topic + scheme. Read the distinct
  // committee_name values off participants, then resolve each topic.
  const { data: cParts } = await svc
    .from("participants")
    .select("committee_name")
    .eq("event_id", eventId)
    .not("committee_name", "is", null);
  const committeeNames = Array.from(
    new Set(
      ((cParts as Array<{ committee_name: string | null }>) ?? [])
        .map((r) => r.committee_name)
        .filter((n): n is string => !!n)
    )
  );
  const committees: RoundNarrativeGrounding["committees"] = [];
  for (const name of committeeNames) {
    const { data: ct } = await svc
      .from("topics")
      .select("id, description, linked_scheme")
      .eq("category", "committee")
      .eq("title", name)
      .eq("is_active", true)
      .maybeSingle();
    committees.push({
      name,
      topic: ct?.description ?? null,
      scheme: ct?.linked_scheme ?? null,
    });
    refs.push({ type: "committee_topic", id: ct?.id ?? null, label: name });
  }

  return {
    kind: "round_narrative",
    event: {
      id: event.id,
      name: event.name,
      chapterName: event.chapter_name,
      city: event.city,
      state: event.state,
      level: event.level,
      day1Date: event.day1_date,
      day2Date: event.day2_date,
    },
    participantCount: participantCount ?? 0,
    partyCount: partyCount ?? 0,
    nationalTopics: central.map((t) => ({ title: t.title, scheme: t.scheme })),
    committees,
    zeroHourSummary: event.zero_hour_summary ?? null,
    sourceRefs: refs,
  };
}

// ─── session_feedback (the self-improving growth loop) ───────────────────────
//
// ROUTINE-ONLY. Reached exclusively from the bearer endpoint. Carries a
// per-criterion SELF-REFERENTIAL ratio so the routine coaches the participant
// against their OWN profile — never another participant, never a rank.

/** Loose handle for not-yet-typed reads (scores/agenda/rubrics shapes vary). */
type LooseSvc = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A scored agenda item plus its ordering. */
type ScoreableSession = {
  id: string;
  title: string;
  day: number | null;
  sequence_order: number | null;
};

/** A raw scores row we care about for the pattern. */
type ScoreRow = {
  participant_id: string;
  jury_assignment_id: string;
  rubric_id: string;
  agenda_item_id: string | null;
  criteria_scores: Record<string, number> | null;
  status: string | null;
  is_mock: boolean | null;
};

/**
 * Aggregate one participant's per-criterion pattern for ONE session, averaged
 * across judges and normalised to each criterion's own max_score.
 *
 * SELF-REFERENTIAL: every number is the participant against their own ceilings.
 * No other participant's rows enter this function. Returns the criteria list
 * plus the own-strongest / own-weakest pick.
 */
function aggregateCriteriaPattern(
  rows: ScoreRow[],
  rubricCriteriaById: Map<string, RubricCriterionShape[]>
): {
  criteria: SessionCriterionPattern[];
  strength: SessionCriterionPattern | null;
  growthFocus: SessionCriterionPattern | null;
} {
  // Sum + count per (criterion key) so we average across judges; keep the
  // criterion's max + label from the rubric.
  const acc = new Map<
    string,
    { label: string; max: number; ratioSum: number; n: number }
  >();

  for (const row of rows) {
    const criteria = rubricCriteriaById.get(row.rubric_id);
    if (!criteria) continue;
    const breakdown = row.criteria_scores ?? {};
    for (const c of criteria) {
      const max = Number(c.max_score) || 0;
      if (max <= 0) continue;
      // parentScoreByKey sums the parent's own key AND any "parent.sub" keys,
      // so it reads BOTH flat parent totals (e.g. content: 22.5 — how the
      // scoring UI actually stores them) AND nested sub-criterion breakdowns.
      // (parentScore returned 0 for flat totals when the rubric declared
      // sub_criteria — the all-zero-ratio bug this fixes.)
      const earned = parentScoreByKey(breakdown, c.key);
      const ratio = Math.max(0, Math.min(1, earned / max));
      const prev = acc.get(c.key);
      if (prev) {
        prev.ratioSum += ratio;
        prev.n += 1;
      } else {
        acc.set(c.key, { label: c.label, max, ratioSum: ratio, n: 1 });
      }
    }
  }

  const criteria: SessionCriterionPattern[] = [];
  for (const [key, v] of acc) {
    if (v.n === 0) continue;
    criteria.push({
      key,
      label: v.label,
      ratio: v.ratioSum / v.n,
      max: v.max,
    });
  }

  // Rank the participant's OWN criteria against EACH OTHER (self-referential).
  let strength: SessionCriterionPattern | null = null;
  let growthFocus: SessionCriterionPattern | null = null;
  for (const c of criteria) {
    if (!strength || c.ratio > strength.ratio) strength = c;
    if (!growthFocus || c.ratio < growthFocus.ratio) growthFocus = c;
  }
  // If only one criterion exists, strength === growthFocus — the routine then
  // acknowledges it as a strength and gives the generic next-session nudge.

  return { criteria, strength, growthFocus };
}

/**
 * Build the session_feedback grounding for ONE (participant, scored session).
 * Returns null when the session, event, or participant is missing, or when no
 * usable scores exist (the caller then skips it).
 *
 * ROUTINE-ONLY — carries normalised own-criterion ratios. Never invoked from a
 * participant component.
 */
export async function buildSessionFeedbackGrounding(
  eventId: string,
  participantId: string,
  agendaItemId: string
): Promise<SessionFeedbackGrounding | null> {
  const svc = await createServiceClient();
  const loose = svc as unknown as LooseSvc;

  // Event (name + chapter for warm framing).
  const { data: event } = await svc
    .from("events")
    .select("id, name, chapter_name")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  // Participant (name + role for the role-tied nudge).
  const { data: p } = await svc
    .from("participants")
    .select("id, full_name, parliament_role")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!p) return null;

  // The session (this agenda item) — must be scoreable.
  const { data: session } = await loose
    .from("agenda")
    .select("id, title, day, sequence_order, is_scoreable")
    .eq("id", agendaItemId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!session || !session.is_scoreable) return null;

  // This participant's submitted scores for THIS session, across all judges.
  const { data: scoreData } = await loose
    .from("scores")
    .select(
      "participant_id, jury_assignment_id, rubric_id, agenda_item_id, criteria_scores, status, is_mock"
    )
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .eq("agenda_item_id", agendaItemId)
    .eq("status", "submitted");
  const rows = ((scoreData as ScoreRow[]) ?? []).filter(
    (r) => r.criteria_scores && Object.keys(r.criteria_scores).length > 0
  );
  if (rows.length === 0) return null;

  // Resolve each distinct rubric's criteria shape (key → label + max + sub).
  const rubricIds = Array.from(new Set(rows.map((r) => r.rubric_id)));
  const rubricCriteriaById = new Map<string, RubricCriterionShape[]>();
  if (rubricIds.length > 0) {
    const { data: rubricRows } = await loose
      .from("rubrics")
      .select("id, criteria")
      .in("id", rubricIds);
    for (const rr of (rubricRows as Array<{ id: string; criteria: unknown }>) ??
      []) {
      const crit = Array.isArray(rr.criteria)
        ? (rr.criteria as RubricCriterionShape[])
        : [];
      rubricCriteriaById.set(rr.id, crit);
    }
  }

  const { criteria, strength, growthFocus } = aggregateCriteriaPattern(
    rows,
    rubricCriteriaById
  );
  if (criteria.length === 0) return null;

  // Prior session_feedback notes for THIS participant, in session order, for
  // continuity. Their own notes only.
  const priorNotes: SessionFeedbackGrounding["priorNotes"] = [];
  {
    const { data: priorRows } = await loose
      .from("ai_drafts")
      .select("draft_text, agenda_item_id, status")
      .eq("event_id", eventId)
      .eq("kind", "session_feedback")
      .eq("subject_id", participantId)
      .in("status", ["ready", "approved"]);
    const priors = (priorRows as Array<{
      draft_text: string | null;
      agenda_item_id: string | null;
    }>) ?? [];
    if (priors.length > 0) {
      // Resolve the prior sessions' titles + order.
      const priorAgendaIds = Array.from(
        new Set(priors.map((r) => r.agenda_item_id).filter((x): x is string => !!x))
      );
      const order = new Map<string, ScoreableSession>();
      if (priorAgendaIds.length > 0) {
        const { data: ags } = await loose
          .from("agenda")
          .select("id, title, day, sequence_order")
          .in("id", priorAgendaIds);
        for (const a of (ags as ScoreableSession[]) ?? []) order.set(a.id, a);
      }
      const sortable = priors
        .filter(
          (r) => r.agenda_item_id && r.agenda_item_id !== agendaItemId && r.draft_text
        )
        .map((r) => ({
          a: order.get(r.agenda_item_id as string),
          note: (r.draft_text ?? "").trim(),
        }))
        .filter((x) => x.a && x.note);
      sortable.sort((x, y) => {
        const ax = x.a!;
        const ay = y.a!;
        const d = (ax.day ?? 0) - (ay.day ?? 0);
        if (d !== 0) return d;
        return (ax.sequence_order ?? 0) - (ay.sequence_order ?? 0);
      });
      for (const s of sortable) {
        priorNotes.push({
          sessionTitle: s.a!.title,
          // Trim to keep the payload light; the routine only needs the gist.
          note: s.note.length > 280 ? s.note.slice(0, 280) + "…" : s.note,
        });
      }
    }
  }

  const refs: AiSourceRef[] = [
    { type: "participant", id: p.id, label: p.full_name },
    { type: "event", id: event.id, label: event.name },
    { type: "session", id: session.id, label: session.title },
  ];
  if (strength && growthFocus) {
    refs.push({
      type: "criteria_pattern",
      id: null,
      label:
        strength.key === growthFocus.key
          ? `strength: ${strength.label}`
          : `strength: ${strength.label}; focus: ${growthFocus.label}`,
    });
  }

  return {
    kind: "session_feedback",
    participant: {
      id: p.id,
      fullName: p.full_name,
      roleLabel: roleLabel(p.parliament_role),
      roleSlug: p.parliament_role ?? null,
    },
    session: {
      id: session.id,
      title: session.title,
      day: session.day ?? null,
      sequenceOrder: session.sequence_order ?? null,
    },
    event: {
      id: event.id,
      name: event.name,
      chapterName: event.chapter_name ?? null,
    },
    criteria,
    strength,
    growthFocus,
    priorNotes,
    sourceRefs: refs,
  };
}

/**
 * Candidate events for the self-running session_feedback detector: every event
 * the chair has opted into AI for (events.ai_enabled = true). This is an
 * intentionally small, opt-in set, so the sweep never scans the whole events or
 * scores table; getSessionFeedbackWork() then no-ops for any of these that have
 * no submitted scores yet. Reads stay confined to this server-only module,
 * reachable only behind the bearer endpoint.
 */
export async function listAiEnabledEventIds(): Promise<string[]> {
  const svc = await createServiceClient();
  const loose = svc as unknown as LooseSvc;
  const { data } = await loose
    .from("events")
    .select("id")
    .eq("ai_enabled", true);
  return ((data as Array<{ id: string }> | null) ?? []).map((e) => e.id);
}

/**
 * SELF-RUNNING DETECTOR. For an ai_enabled event, find every (participant,
 * scored session) that HAS submitted scores but does NOT yet have a
 * session_feedback ai_draft row, and return the (participantId, agendaItemId)
 * pairs that need a note generated.
 *
 * The endpoint uses this to enqueue + ground new work each hour — no per-session
 * manual button is required. Cross-participant data never mixes: each pair is
 * grounded independently via buildSessionFeedbackGrounding.
 *
 * Returns [] for events that are not ai_enabled (the endpoint also gates).
 */
export async function getSessionFeedbackWork(
  eventId: string
): Promise<{ participantId: string; agendaItemId: string }[]> {
  const svc = await createServiceClient();
  const loose = svc as unknown as LooseSvc;

  // ai_enabled gate (loose — column not in generated types).
  const { data: ev } = await loose
    .from("events")
    .select("id, ai_enabled")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || !ev.ai_enabled) return [];

  // Scoreable agenda items for this event.
  const { data: agendaRows } = await loose
    .from("agenda")
    .select("id, is_scoreable")
    .eq("event_id", eventId)
    .eq("is_scoreable", true);
  const scoreableIds = new Set(
    ((agendaRows as Array<{ id: string }>) ?? []).map((a) => a.id)
  );
  if (scoreableIds.size === 0) return [];

  // Distinct (participant, agenda_item) pairs that have submitted scores in a
  // scoreable session. Read the lean projection; dedupe in memory.
  const { data: scored } = await loose
    .from("scores")
    .select("participant_id, agenda_item_id")
    .eq("event_id", eventId)
    .eq("status", "submitted")
    .not("agenda_item_id", "is", null);
  const scoredPairs = new Set<string>();
  for (const r of (scored as Array<{
    participant_id: string | null;
    agenda_item_id: string | null;
  }>) ?? []) {
    if (!r.participant_id || !r.agenda_item_id) continue;
    if (!scoreableIds.has(r.agenda_item_id)) continue;
    scoredPairs.add(`${r.participant_id}::${r.agenda_item_id}`);
  }
  if (scoredPairs.size === 0) return [];

  // Existing session_feedback drafts (any status) — so we never re-enqueue.
  const { data: existing } = await loose
    .from("ai_drafts")
    .select("subject_id, agenda_item_id")
    .eq("event_id", eventId)
    .eq("kind", "session_feedback");
  const have = new Set<string>();
  for (const r of (existing as Array<{
    subject_id: string | null;
    agenda_item_id: string | null;
  }>) ?? []) {
    if (r.subject_id && r.agenda_item_id) {
      have.add(`${r.subject_id}::${r.agenda_item_id}`);
    }
  }

  const work: { participantId: string; agendaItemId: string }[] = [];
  for (const key of scoredPairs) {
    if (have.has(key)) continue;
    const [participantId, agendaItemId] = key.split("::");
    work.push({ participantId, agendaItemId });
  }
  return work;
}
