import "server-only";

/**
 * Assemble the NON-SCORE grounding payloads handed to the out-of-band routine.
 *
 * HARD RULE (Director, non-negotiable): the participant_story payload contains
 * ZERO scores, ZERO rank, ZERO comparison to other participants. It carries
 * ONLY the participant's own factual participation (role, party, committee →
 * ministry + scheme, constituency, the national topic). round_narrative is
 * event-level facts only (counts, topics, committees, the saved zero-hour
 * summary) — also no scores.
 *
 * Reads via createServiceClient() (schema-pinned to "yip"). Mirrors the topic /
 * scheme lookup used by app/yip/me/page.tsx and the report section helpers.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { ROLE_LABELS } from "@/lib/yip/constants";
import type {
  AiSourceRef,
  ParticipantStoryGrounding,
  RoundNarrativeGrounding,
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
