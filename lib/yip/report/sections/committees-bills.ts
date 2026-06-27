import "server-only";
import { clauseTexts } from "@/lib/yip/bill-provisions";

/**
 * YIP Chapter Round Report — Section 5 (Committees & Bills) + Section 8 (Draft
 * Bill annexures).
 *
 * Mirrors the reference data module (lib/yip/report/sections/overview.ts):
 *   1. `import "server-only"` — a data module, never a "use server" file, so it
 *      may export types + the async getter.
 *   2. gate with getYipEventAccess(eventId); if !canView return null so the
 *      section renders nothing rather than throwing.
 *   3. read yip.* via createServiceClient() (already schema-pinned to "yip").
 *
 * `yip.committee_meta` and `yip.bill_documents` are NOT in the generated
 * Database types (and the new `report_bill_outcome_override` column committee_meta
 * carries is shipped additively by this section), so both are read through a
 * per-call loose-cast client — the same escape-hatch idiom guests-jury.ts uses
 * for `event_chief_guests` and awards-zero-hour.ts uses for the not-yet-typed
 * `events.zero_hour_summary` column. All other tables (participants, bills) ARE
 * typed and use a plain `.from(...)`.
 *
 * What this section assembles, per committee:
 *   • Committee number (participants.committee_number — the bare number users
 *     see) + name (participants.committee_name — the ministry/topic title).
 *   • Committee Leader — the participant whose parliament_role='committee_chair'
 *     in that committee; else the free-text committee_meta.chair_lead.
 *   • Bill Drafted — bills.title for that committee_name (null if none).
 *   • Outcome — derived: bills.status 'passed' → "Passed", 'rejected' →
 *     "Rejected"; any other status (drafting/submitted/presented) or no bill row
 *     at all → "Not Presented". An organiser may OVERRIDE this report line via
 *     committee_meta.report_bill_outcome_override (report-only — never touches
 *     the live bills.status / vote tally).
 *
 * Section 8 (per-committee draft-bill annexures): full bill text (objective,
 * problem_statement, provisions[], expected_impact, implementation) + the list
 * of supporting bill_documents (file name + description) for each committee.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  getEventAiEnabled,
  listBillFeedbackForEvent,
} from "@/lib/yip/ai/drafts";

/** Report-only outcome a committee's bill may be set to. */
export type BillOutcome = "passed" | "rejected" | "not_presented";

/** One supporting document attached to a committee's bill. */
export type CommitteeBillDocument = {
  fileName: string;
  description: string | null;
};

/** A single committee row in the Section 5 table + its Section 8 annexure. */
export type CommitteeRow = {
  /** Bare committee number shown to users (participants.committee_number). */
  number: number | null;
  /** Ministry / topic name — also the join key for bills & meta. */
  name: string;
  /** Resolved committee leader name (chair participant or chair_lead text). */
  leader: string | null;
  /** Where the leader came from — drives the "set leader" fill-in visibility. */
  leaderSource: "participant" | "meta" | null;
  /** The committee's bill, if one exists. */
  bill: {
    title: string | null;
    preamble: string | null;
    definitions: string | null;
    objective: string | null;
    objectives: string[];
    problemStatement: string | null;
    provisions: string[];
    implementation: string | null;
    fundingBudget: string | null;
    expectedImpact: string | null;
    conclusion: string | null;
    votesFor: number | null;
    votesAgainst: number | null;
    votesAbstain: number | null;
  } | null;
  /** Final report outcome (override if set, else derived from bill status). */
  outcome: BillOutcome;
  /** Whether the outcome was set by an organiser override (vs auto-derived). */
  outcomeOverridden: boolean;
  /** Supporting documents uploaded for this committee's bill. */
  documents: CommitteeBillDocument[];
  /**
   * AI craft-feedback note on this committee's bill (kind='bill_feedback'),
   * present only when the chair has opted the event into AI AND a ready note
   * exists. Prose about the BILL's craft — never a score, rank, or person.
   */
  billFeedback: string | null;
};

export type CommitteesBillsData = {
  committees: CommitteeRow[];
};

/** Coerce any provisions shape ({id,text}[] | string[] | {clauses} | null) to
 *  a flat list of clause texts. */
function toProvisions(value: unknown): string[] {
  return clauseTexts(value);
}

/** Derive the auto outcome from a bill's stored status. */
function deriveOutcome(status: string | null | undefined): BillOutcome {
  if (status === "passed") return "passed";
  if (status === "rejected") return "rejected";
  // drafting / submitted / presented / null / unknown → never went to a final
  // recorded vote, so for the report it counts as Not Presented.
  return "not_presented";
}

/** Normalise an override value read back from committee_meta. */
function normaliseOverride(value: unknown): BillOutcome | null {
  if (value === "passed" || value === "rejected" || value === "not_presented") {
    return value;
  }
  return null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Fetch everything Sections 5 + 8 render. Returns `null` when the caller lacks
 * view access (the section component then renders nothing).
 */
export async function getCommitteesBillsData(
  eventId: string
): Promise<CommitteesBillsData | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const svc = await createServiceClient();

  // ── Committees + leaders: distinct committees come from the participant
  //    allocation (number + name). Chair participants give us a leader name.
  const { data: participants } = await svc
    .from("participants")
    .select("full_name, parliament_role, committee_name, committee_number")
    .eq("event_id", eventId);

  type PRow = {
    full_name: string | null;
    parliament_role: string | null;
    committee_name: string | null;
    committee_number: number | null;
  };
  const pRows = (participants ?? []) as unknown as PRow[];

  // Build the ordered distinct committee list (name → number). First number
  // seen for a name wins; order by number then name for a stable table.
  const numberByName = new Map<string, number | null>();
  const displayNameByKey = new Map<string, string>();
  const chairByKey = new Map<string, string>();

  for (const p of pRows) {
    const name = (p.committee_name ?? "").trim();
    if (!name) continue;
    const key = norm(name);
    if (!displayNameByKey.has(key)) {
      displayNameByKey.set(key, name);
      numberByName.set(key, p.committee_number ?? null);
    } else if (numberByName.get(key) == null && p.committee_number != null) {
      numberByName.set(key, p.committee_number);
    }
    if (p.parliament_role === "committee_chair" && p.full_name && !chairByKey.has(key)) {
      chairByKey.set(key, p.full_name);
    }
  }

  // ── committee_meta: free-text chair_lead + report outcome override.
  //    Not in generated types → per-call loose-cast client (same idiom as
  //    awards-zero-hour.ts's svcLoose / guests-jury.ts's guestsTable).
  const svcMeta = svc as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: unknown
        ) => Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  };
  const { data: metaRows } = await svcMeta
    .from("committee_meta")
    .select("committee_name, chair_lead, report_bill_outcome_override")
    .eq("event_id", eventId);

  type MetaRow = {
    committee_name: string | null;
    chair_lead: string | null;
    report_bill_outcome_override: string | null;
  };
  const chairLeadByKey = new Map<string, string>();
  const overrideByKey = new Map<string, BillOutcome>();
  for (const m of (metaRows ?? []) as unknown as MetaRow[]) {
    const key = norm(m.committee_name);
    if (!key) continue;
    if (m.chair_lead && m.chair_lead.trim()) {
      chairLeadByKey.set(key, m.chair_lead.trim());
    }
    const ov = normaliseOverride(m.report_bill_outcome_override);
    if (ov) overrideByKey.set(key, ov);
  }

  // ── bills: one per committee (objective…implementation, status, votes).
  const { data: billRows } = await svc
    .from("bills")
    .select(
      "id, committee_name, title, preamble, definitions, objective, objectives, problem_statement, provisions, expected_impact, implementation, funding_budget, conclusion, status, votes_for, votes_against, votes_abstain"
    )
    .eq("event_id", eventId);

  type BillRow = {
    id: string;
    committee_name: string | null;
    title: string | null;
    preamble: string | null;
    definitions: string | null;
    objective: string | null;
    objectives: unknown;
    problem_statement: string | null;
    provisions: unknown;
    expected_impact: string | null;
    implementation: string | null;
    funding_budget: string | null;
    conclusion: string | null;
    status: string | null;
    votes_for: number | null;
    votes_against: number | null;
    votes_abstain: number | null;
  };
  const billByKey = new Map<string, BillRow>();
  for (const b of (billRows ?? []) as unknown as BillRow[]) {
    const key = norm(b.committee_name);
    if (!key) continue;
    // First bill per committee wins (there is at most one per committee).
    if (!billByKey.has(key)) billByKey.set(key, b);
  }

  // ── bill_feedback: AI craft note per committee, gated on events.ai_enabled.
  //    Joins kind='bill_feedback' drafts to committees by bill id (subject_id).
  //    Content-safe: prose about the bill's craft, never a score/rank/person.
  const feedbackByKey = new Map<string, string>();
  if (await getEventAiEnabled(eventId)) {
    const billIdToKey = new Map<string, string>();
    for (const [key, b] of billByKey) billIdToKey.set(b.id, key);
    if (billIdToKey.size > 0) {
      const drafts = await listBillFeedbackForEvent(eventId);
      for (const d of drafts) {
        if (d.status !== "ready" && d.status !== "approved") continue;
        const key = d.subject_id ? billIdToKey.get(d.subject_id) : undefined;
        if (!key) continue;
        const text = (d.approved_text ?? d.draft_text ?? "").trim();
        if (text) feedbackByKey.set(key, text);
      }
    }
  }

  // ── bill_documents: file name + description grouped by committee.
  //    Also not in generated types → per-call loose-cast client.
  const svcDocs = svc as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: unknown
        ) => {
          order: (
            c: string,
            o: { ascending: boolean }
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{ data: Array<Record<string, unknown>> | null }>;
          };
        };
      };
    };
  };
  const { data: docRows } = await svcDocs
    .from("bill_documents")
    .select("committee_name, file_name, description")
    .eq("event_id", eventId)
    .order("committee_name", { ascending: true })
    .order("created_at", { ascending: false });

  type DocRow = {
    committee_name: string | null;
    file_name: string | null;
    description: string | null;
  };
  const docsByKey = new Map<string, CommitteeBillDocument[]>();
  for (const d of (docRows ?? []) as unknown as DocRow[]) {
    const key = norm(d.committee_name);
    if (!key) continue;
    const arr = docsByKey.get(key) ?? [];
    arr.push({
      fileName: (d.file_name ?? "").trim() || "Document",
      description: d.description && d.description.trim() ? d.description.trim() : null,
    });
    docsByKey.set(key, arr);
  }

  // ── Assemble one CommitteeRow per distinct committee.
  const committees: CommitteeRow[] = [];
  for (const [key, name] of displayNameByKey) {
    const chairParticipant = chairByKey.get(key) ?? null;
    const chairLead = chairLeadByKey.get(key) ?? null;
    const leader = chairParticipant ?? chairLead;
    const leaderSource: CommitteeRow["leaderSource"] = chairParticipant
      ? "participant"
      : chairLead
        ? "meta"
        : null;

    const bill = billByKey.get(key) ?? null;
    const override = overrideByKey.get(key) ?? null;
    const outcome = override ?? deriveOutcome(bill?.status);

    committees.push({
      number: numberByName.get(key) ?? null,
      name,
      leader,
      leaderSource,
      bill: bill
        ? {
            title: bill.title && bill.title.trim() ? bill.title.trim() : null,
            preamble: bill.preamble,
            definitions: bill.definitions,
            objective: bill.objective,
            objectives: toProvisions(bill.objectives),
            problemStatement: bill.problem_statement,
            provisions: toProvisions(bill.provisions),
            implementation: bill.implementation,
            fundingBudget: bill.funding_budget,
            expectedImpact: bill.expected_impact,
            conclusion: bill.conclusion,
            votesFor: bill.votes_for,
            votesAgainst: bill.votes_against,
            votesAbstain: bill.votes_abstain,
          }
        : null,
      outcome,
      outcomeOverridden: override != null,
      documents: docsByKey.get(key) ?? [],
      billFeedback: feedbackByKey.get(key) ?? null,
    });
  }

  // Stable order: by committee number (nulls last), then name.
  committees.sort((a, b) => {
    const an = a.number ?? Number.MAX_SAFE_INTEGER;
    const bn = b.number ?? Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name);
  });

  return { committees };
}
