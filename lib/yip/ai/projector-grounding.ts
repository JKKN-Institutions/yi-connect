import "server-only";

/**
 * Grounding builders for the DIRECTOR-TRIGGERED projector-moment kinds.
 *
 * Same doctrine as lib/yip/ai/grounding.ts (which these deliberately do not
 * bloat): payloads carry ONLY the House's own words and factual event context —
 * NEVER yip.scores / yip.results, never a rank, never a comparison between
 * participants. Every projector kind lands as pending_review and reaches the
 * venue screen only after the director's explicit "Project" tap (see
 * lib/yip/ai/projector-moments.ts).
 *
 * projector_quotes is SELECTION-ONLY: the routine picks question ids from this
 * grounding and echoes them via sourceRefs; the server later copies the verbatim
 * text from yip.questions. The model never writes a word that is projected.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { effectiveMinistries, ministryLabel } from "@/lib/yip/cabinet";
import { clauseTexts } from "@/lib/yip/bill-provisions";
import type {
  AiSourceRef,
  ProjectorBillSummaryGrounding,
  ProjectorFramingGrounding,
  ProjectorHouseMindGrounding,
  ProjectorQhThemesGrounding,
  ProjectorQuotesGrounding,
} from "./types";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

/** Loose accessor for columns/tables that lag the generated types. */
type LooseSvc = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => Promise<{ data: unknown }>;
        neq: (col: string, val: unknown) => Promise<{ data: unknown }>;
        maybeSingle: () => Promise<{ data: unknown }>;
        order: (
          col: string,
          opts?: { ascending?: boolean }
        ) => { limit: (n: number) => Promise<{ data: unknown }> };
      };
    };
  };
};

async function getEventBasics(
  svc: Svc,
  eventId: string
): Promise<{
  id: string;
  name: string;
  chapterName: string | null;
  ministries: { key: string; label: string }[];
} | null> {
  // cabinet_ministries lags the generated types → loose cast.
  const { data } = await (svc as unknown as LooseSvc)
    .from("events")
    .select("id, name, chapter_name, cabinet_ministries")
    .eq("id", eventId)
    .maybeSingle();
  const ev = data as {
    id: string;
    name: string;
    chapter_name: string | null;
    cabinet_ministries: unknown;
  } | null;
  if (!ev) return null;
  return {
    id: ev.id,
    name: ev.name,
    chapterName: ev.chapter_name ?? null,
    ministries: effectiveMinistries(ev.cabinet_ministries),
  };
}

/** The House's own non-rejected questions, oldest first, capped. */
async function getHouseQuestions(
  svc: Svc,
  eventId: string,
  cap: number
): Promise<
  { id: string; text: string; ministryKey: string | null; status: string }[]
> {
  const { data } = await svc
    .from("questions")
    .select("id, question_text, directed_to_ministry, status, created_at")
    .eq("event_id", eventId)
    .neq("status", "rejected")
    .order("created_at", { ascending: true })
    .limit(cap);
  return ((data as Array<{
    id: string;
    question_text: string | null;
    directed_to_ministry: string | null;
    status: string | null;
  }>) ?? [])
    .filter((q) => (q.question_text ?? "").trim().length > 0)
    .map((q) => ({
      id: q.id,
      text: (q.question_text ?? "").trim(),
      ministryKey: q.directed_to_ministry ?? null,
      status: q.status ?? "submitted",
    }));
}

async function getCentralTopics(
  svc: Svc,
  eventId: string
): Promise<{ title: string; scheme: string | null }[]> {
  const { data } = await svc
    .from("event_topics")
    .select("is_central, sequence, topic:topics(id, title, linked_scheme)")
    .eq("event_id", eventId)
    .order("sequence");
  if (!data) return [];
  return (data as unknown as Array<{
    is_central: boolean | null;
    topic: { title: string; linked_scheme: string | null } | null;
  }>)
    .filter((r) => r.is_central && r.topic)
    .map((r) => ({
      title: r.topic!.title,
      scheme: r.topic!.linked_scheme ?? null,
    }));
}

/**
 * projector_quotes — hand the routine every usable question so it can CURATE.
 * Returns null when the event is missing or the House has asked nothing yet
 * (the routine then skips the request instead of inventing content).
 */
export async function buildProjectorQuotesGrounding(
  eventId: string
): Promise<ProjectorQuotesGrounding | null> {
  const svc = await createServiceClient();
  const event = await getEventBasics(svc, eventId);
  if (!event) return null;

  const questions = await getHouseQuestions(svc, eventId, 150);
  if (questions.length === 0) return null; // nothing to curate — skip, don't invent

  const sourceRefs: AiSourceRef[] = [
    { type: "event", id: event.id, label: event.name },
    { type: "question_pool", id: null, label: "House questions (own words)" },
  ];

  return {
    kind: "projector_quotes",
    event: {
      id: event.id,
      name: event.name,
      chapterName: event.chapterName,
    },
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      ministryLabel: q.ministryKey
        ? ministryLabel(q.ministryKey, event.ministries)
        : null,
      status: q.status,
    })),
    sourceRefs,
  };
}

/** projector_bill_summary — ONE bill's own fields, ready to distill. */
export async function buildProjectorBillSummaryGrounding(
  eventId: string,
  billId: string
): Promise<ProjectorBillSummaryGrounding | null> {
  const svc = await createServiceClient();
  const event = await getEventBasics(svc, eventId);
  if (!event) return null;

  // The bill's own craft fields only — people columns intentionally omitted.
  const { data: bill } = await svc
    .from("bills")
    .select(
      "id, title, committee_name, party_side, problem_statement, objective, provisions, expected_impact, implementation"
    )
    .eq("id", billId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!bill) return null;

  let ministry: ProjectorBillSummaryGrounding["ministry"] = null;
  if (bill.committee_name) {
    const { data: ct } = await svc
      .from("topics")
      .select("description, linked_scheme")
      .eq("category", "committee")
      .eq("title", bill.committee_name)
      .eq("is_active", true)
      .maybeSingle();
    if (ct) {
      ministry = {
        topic: ct.description ?? null,
        scheme: ct.linked_scheme ?? null,
      };
    }
  }

  return {
    kind: "projector_bill_summary",
    bill: {
      id: bill.id,
      title: bill.title ?? null,
      committeeName: bill.committee_name ?? null,
      partySide: (bill.party_side as string | null) ?? null,
      problemStatement: bill.problem_statement ?? null,
      objective: bill.objective ?? null,
      provisions: clauseTexts(bill.provisions),
      expectedImpact: bill.expected_impact ?? null,
      implementation: bill.implementation ?? null,
    },
    ministry,
    event: {
      id: event.id,
      name: event.name,
      chapterName: event.chapterName,
    },
    sourceRefs: [
      { type: "bill", id: bill.id, label: bill.title ?? "Untitled Bill" },
      { type: "event", id: event.id, label: event.name },
    ],
  };
}

/**
 * projector_house_mind — everything the House said (questions + bill problem
 * framings) so the routine can find the 3 recurring concerns. Null when the
 * House has produced too little to synthesize honestly.
 */
export async function buildProjectorHouseMindGrounding(
  eventId: string
): Promise<ProjectorHouseMindGrounding | null> {
  const svc = await createServiceClient();
  const event = await getEventBasics(svc, eventId);
  if (!event) return null;

  const [questions, topics] = await Promise.all([
    getHouseQuestions(svc, eventId, 200),
    getCentralTopics(svc, eventId),
  ]);

  const { data: billRows } = await svc
    .from("bills")
    .select("title, problem_statement")
    .eq("event_id", eventId);
  const bills = ((billRows as Array<{
    title: string | null;
    problem_statement: string | null;
  }>) ?? []).filter(
    (b) => (b.title ?? "").trim() || (b.problem_statement ?? "").trim()
  );

  // Minimum-signal threshold: synthesizing "what the House cared about" from a
  // handful of lines would be over-reading. Skip rather than invent.
  if (questions.length + bills.length < 8) return null;

  return {
    kind: "projector_house_mind",
    event: {
      id: event.id,
      name: event.name,
      chapterName: event.chapterName,
    },
    questions: questions.map((q) => ({
      text: q.text,
      ministryLabel: q.ministryKey
        ? ministryLabel(q.ministryKey, event.ministries)
        : null,
    })),
    bills: bills.map((b) => ({
      title: b.title ?? null,
      problemStatement: b.problem_statement ?? null,
    })),
    nationalTopics: topics,
    sourceRefs: [
      { type: "event", id: event.id, label: event.name },
      { type: "question_pool", id: null, label: "House questions (own words)" },
      { type: "bill_pool", id: null, label: "House bills (own framing)" },
    ],
  };
}

/** projector_framing — one agenda item + the event's central topics. */
export async function buildProjectorFramingGrounding(
  eventId: string,
  agendaItemId: string
): Promise<ProjectorFramingGrounding | null> {
  const svc = await createServiceClient();
  const event = await getEventBasics(svc, eventId);
  if (!event) return null;

  const { data: item } = await svc
    .from("agenda")
    .select("id, title, agenda_type, day")
    .eq("id", agendaItemId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!item) return null;

  const topics = await getCentralTopics(svc, eventId);

  return {
    kind: "projector_framing",
    agendaItem: {
      id: item.id,
      title: item.title,
      agendaType: (item.agenda_type as string | null) ?? null,
      day: (item.day as number | null) ?? null,
    },
    nationalTopics: topics,
    event: {
      id: event.id,
      name: event.name,
      chapterName: event.chapterName,
    },
    sourceRefs: [
      { type: "session", id: item.id, label: item.title },
      { type: "event", id: event.id, label: event.name },
    ],
  };
}

/**
 * projector_qh_themes — questions grouped by ministry so the routine can write
 * "the House is asking about…". Null below a minimum signal.
 */
export async function buildProjectorQhThemesGrounding(
  eventId: string
): Promise<ProjectorQhThemesGrounding | null> {
  const svc = await createServiceClient();
  const event = await getEventBasics(svc, eventId);
  if (!event) return null;

  const questions = await getHouseQuestions(svc, eventId, 200);
  if (questions.length < 5) return null;

  const grouped = new Map<string, string[]>();
  for (const q of questions) {
    const label = q.ministryKey
      ? ministryLabel(q.ministryKey, event.ministries)
      : "General";
    const arr = grouped.get(label) ?? [];
    arr.push(q.text);
    grouped.set(label, arr);
  }

  return {
    kind: "projector_qh_themes",
    event: {
      id: event.id,
      name: event.name,
      chapterName: event.chapterName,
    },
    byMinistry: Array.from(grouped.entries()).map(
      ([label, qs]) => ({ ministryLabel: label, questions: qs })
    ),
    sourceRefs: [
      { type: "event", id: event.id, label: event.name },
      { type: "question_pool", id: null, label: "House questions (own words)" },
    ],
  };
}
