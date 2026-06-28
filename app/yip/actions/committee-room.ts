"use server";

/**
 * YIP Committee Room — server actions.
 *
 * One phase-aware surface where a committee drafts its bill, debates it
 * per-clause, votes amendments in/out, picks presenters and ships it. Wraps the
 * EXISTING bill (yip.bills) + committee chat (yip.chat_*) and adds amendment
 * proposals/votes (yip.bill_amendments / yip.bill_amendment_votes) and stable
 * clause ids on yip.bills.provisions.
 *
 * AUTHORIZATION — two caller kinds, both fail closed (see resolveRoomAuth):
 *   • participant — access-code yip_session; `participantId` passed + verified
 *     via requireParticipantSession. Membership = committee_name match.
 *   • organiser  — Supabase Auth; no participantId; gated by
 *     getYipEventAccess(eventId).canManage.
 * The yip.* write policies are open/none, so THESE actions are the only auth
 * layer. Sign-off decisions (2026-06-27):
 *   - edit bill / clauses / resolve amendments / submit → chair | lead_drafter | organiser
 *   - assign roles → chair | organiser
 *   - propose / vote / discuss → any committee member
 *   - no chair AND no lead_drafter set → organiser-only (the gates above already
 *     yield this, plus a "needs a chair" prompt surfaced to the UI).
 *   - amendment carry → chair/lead DECIDES; the for/against tally is advice only.
 *   - submit readiness → problem + objective + >= 3 provisions + presenters chosen.
 */

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import {
  requireParticipantSession,
  requireVolunteerSession,
} from "@/lib/yip/auth/yip-session";
import { isCommitteeEligible } from "@/lib/yip/committee-assignment";
import { isCommitteeReportSubmitted } from "@/app/yip/actions/committee-reports";
import { normalizeProvisions, type Clause } from "@/lib/yip/bill-provisions";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const MIN_PROVISIONS = 3;
const MIN_OBJECTIVES = 2;
const MAX_OBJECTIVES = 4;

// ─── Untyped access for the new tables (not in generated types yet) ──────
type AnyTable = {
  select: (cols?: string) => AnyTable;
  insert: (row: Record<string, unknown> | Record<string, unknown>[]) => AnyTable;
  update: (row: Record<string, unknown>) => AnyTable;
  delete: () => AnyTable;
  upsert: (
    row: Record<string, unknown>,
    opts?: Record<string, unknown>
  ) => AnyTable;
  eq: (col: string, val: unknown) => AnyTable;
  in: (col: string, vals: unknown[]) => AnyTable;
  order: (col: string, opts?: Record<string, unknown>) => AnyTable;
  maybeSingle: () => Promise<{ data: RawAny | null; error: PgError | null }>;
  single: () => Promise<{ data: RawAny | null; error: PgError | null }>;
  then: Promise<{ data: RawAny[] | null; error: PgError | null }>["then"];
};
type RawAny = Record<string, unknown>;
type PgError = { code?: string; message: string };
type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;
function t(sb: ServiceClient, name: string): AnyTable {
  return (sb as unknown as { from: (n: string) => AnyTable }).from(name);
}
const trim = (s: unknown) => (typeof s === "string" ? s.trim() : "");

// ─── Public shapes ──────────────────────────────────────────────────────

export interface RoomBill {
  id: string;
  title: string;
  // Official Mock Parliament Bill Template sections (2026-06-27):
  preamble: string;
  definitions: string;
  objectives: Clause[]; // 2-4 objectives (the official list)
  objective: string; // legacy joined mirror (kept for old readers)
  problemStatement: string; // legacy — folded into preamble
  expectedImpact: string;
  implementation: string;
  fundingBudget: string;
  conclusion: string;
  status: string;
  clauses: Clause[]; // Key Provisions
  leadDrafter: string | null;
  presenter1: string | null;
  presenter2: string | null;
  policyResearcher: string | null;
  oppositionResponse: string | null;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
}

export interface RoomMember {
  id: string;
  name: string;
  role: string | null;
  partySide: string | null;
  isChair: boolean;
}

export interface RoomAmendment {
  id: string;
  clauseId: string | null;
  clauseText: string | null; // resolved text of the targeted clause (if any)
  kind: "edit" | "add" | "remove";
  proposedText: string | null;
  proposedBy: string | null;
  proposedByName: string;
  status: "open" | "accepted" | "rejected" | "withdrawn";
  votesFor: number;
  votesAgainst: number;
  myVote: "for" | "against" | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface RoomPermissions {
  isOrganiser: boolean;
  isMember: boolean;
  isChair: boolean;
  isLeadDrafter: boolean;
  canEditBill: boolean;
  canDiscuss: boolean;
  canPropose: boolean;
  canVote: boolean;
  canResolve: boolean;
  canAssignRoles: boolean;
  canSubmit: boolean;
  /** No chair AND no lead drafter set — the UI nudges assigning a chair. */
  needsChair: boolean;
}

export interface CommitteeRoom {
  eventId: string;
  committeeName: string;
  topic: string | null;
  scheme: string | null;
  /** Derived phase for the header badge. */
  phase: "drafting" | "presentation" | "submitted" | "voted" | "locked";
  /** Current live agenda item's type (null when not live). */
  currentAgendaType: string | null;
  /** Day-2 presentation prep mode (bill read-only). */
  presentationMode: boolean;
  reportSubmitted: boolean;
  bill: RoomBill | null;
  members: RoomMember[];
  amendments: RoomAmendment[];
  readiness: {
    hasTitle: boolean;
    hasPreamble: boolean;
    objectiveCount: number;
    minObjectives: number;
    provisionCount: number;
    minProvisions: number;
    hasPresenters: boolean;
    ready: boolean;
  };
  /** Committee chat channel id for the Discussion tab (null if not seeded). */
  chatChannelId: string | null;
  permissions: RoomPermissions;
}

// ─── Auth resolution (fail closed) ───────────────────────────────────────

interface RoomAuth {
  committeeName: string;
  isOrganiser: boolean;
  isMember: boolean;
  isChair: boolean;
  participantId: string | null;
  participantRole: string | null;
}

/**
 * Resolve the caller against (event, committee). A participantId routes to the
 * access-code path (must own the session AND be a member of the committee); its
 * absence routes to the organiser path (canManage). Returns the committee name
 * (resolved from the participant when not supplied) and the membership flags.
 */
async function resolveRoomAuth(
  sb: ServiceClient,
  input: { eventId: string; committeeName?: string; participantId?: string | null }
): Promise<{ ok: true; auth: RoomAuth } | { ok: false; error: string }> {
  if (input.participantId) {
    const sess = await requireParticipantSession(input.participantId, input.eventId);
    if (!sess.ok) return { ok: false, error: sess.error };

    const { data: p } = await sb
      .from("participants")
      .select("parliament_role, committee_name")
      .eq("id", input.participantId)
      .maybeSingle();
    if (!p) return { ok: false, error: "Participant not found." };

    const myCommittee = trim(p.committee_name);
    const want = trim(input.committeeName) || myCommittee;
    // Fail closed: a blank committee never matches, and the caller can only act
    // on their OWN committee.
    if (!want || want !== myCommittee || !isCommitteeEligible(p.parliament_role)) {
      return { ok: false, error: "You are not a member of this committee." };
    }
    const isChair =
      p.parliament_role === "committee_chair" && myCommittee === want;
    return {
      ok: true,
      auth: {
        committeeName: want,
        isOrganiser: false,
        isMember: true,
        isChair,
        participantId: input.participantId,
        participantRole: p.parliament_role ?? null,
      },
    };
  }

  // Manager path (organiser OR assigned YUVA volunteer) — must name the
  // committee explicitly. Both get chair-equivalent powers, but ONLY for the
  // committee named here.
  const want = trim(input.committeeName);
  if (!want) return { ok: false, error: "Missing committee." };

  const managerAuth: RoomAuth = {
    committeeName: want,
    isOrganiser: true,
    isMember: false,
    isChair: false,
    participantId: null,
    participantRole: null,
  };

  // (a) Organiser / chair / admin — getYipEventAccess.canManage.
  const access = await getYipEventAccess(input.eventId);
  if (access.canManage) {
    return { ok: true, auth: managerAuth };
  }

  // (b) YUVA volunteer assigned to THIS committee — chair-equivalent powers,
  // STRICTLY scoped to their own committee + event (director decision
  // 2026-06-28). Fail-closed: the assignment row must match volunteer + event +
  // committee exactly; any mismatch falls through to the deny below.
  const vol = await requireVolunteerSession(input.eventId);
  if (vol.ok) {
    const { data: assigned } = await sb
      .from("yuva_assignments")
      .select("id")
      .eq("volunteer_id", vol.volunteerId)
      .eq("event_id", input.eventId)
      .eq("committee_name", want)
      .maybeSingle();
    if (assigned) {
      return { ok: true, auth: managerAuth };
    }
  }

  return { ok: false, error: "Not authorized for this committee." };
}

// ─── Bill helpers ────────────────────────────────────────────────────────

interface BillRow {
  id: string;
  event_id: string;
  committee_name: string | null;
  status: string | null;
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
  lead_drafter: string | null;
  presenter_1: string | null;
  presenter_2: string | null;
  policy_researcher: string | null;
  opposition_response: string | null;
  votes_for: number | null;
  votes_against: number | null;
  votes_abstain: number | null;
}

const BILL_COLS =
  "id, event_id, committee_name, status, title, preamble, definitions, objective, objectives, problem_statement, provisions, expected_impact, implementation, funding_budget, conclusion, lead_drafter, presenter_1, presenter_2, policy_researcher, opposition_response, votes_for, votes_against, votes_abstain";

async function loadBill(
  sb: ServiceClient,
  eventId: string,
  committeeName: string
): Promise<BillRow | null> {
  const { data } = (await t(sb, "bills")
    .select(BILL_COLS)
    .eq("event_id", eventId)
    .eq("committee_name", committeeName)
    .maybeSingle()) as { data: RawAny | null };
  return (data as BillRow | null) ?? null;
}

/** Report gate: bill editing is open once the Committee Report is submitted OR
 *  the organiser flipped the per-event early-unlock toggle. */
async function reportUnlocked(
  sb: ServiceClient,
  eventId: string,
  committeeName: string,
  isManager = false
): Promise<boolean> {
  // Managers (organiser / chapter admin / assigned volunteer) bypass the report
  // gate entirely — they can draft and submit the bill without waiting for a
  // member to file the report (director decision 2026-06-28).
  if (isManager) return true;
  if (await isCommitteeReportSubmitted(eventId, committeeName)) return true;
  const { data: ev } = await sb
    .from("events")
    .select("allow_bill_before_report")
    .eq("id", eventId)
    .maybeSingle();
  return Boolean(ev?.allow_bill_before_report);
}

const isLeadDrafterOf = (auth: RoomAuth, bill: BillRow | null) =>
  Boolean(auth.participantId && bill && bill.lead_drafter === auth.participantId);

/** Bill content is editable only while drafting AND after the report unlock. */
const billEditable = (bill: BillRow | null, reportSubmitted: boolean) =>
  reportSubmitted && (!bill || (bill.status ?? "drafting") === "drafting");

const canEdit = (auth: RoomAuth, bill: BillRow | null) =>
  auth.isOrganiser || auth.isChair || isLeadDrafterOf(auth, bill);

/** Ensure a drafting bill row exists for this committee; create on first write. */
async function ensureBill(
  sb: ServiceClient,
  eventId: string,
  committeeName: string
): Promise<{ ok: true; bill: BillRow } | { ok: false; error: string }> {
  const existing = await loadBill(sb, eventId, committeeName);
  if (existing) return { ok: true, bill: existing };
  const { data, error } = (await t(sb, "bills")
    .insert({
      event_id: eventId,
      committee_name: committeeName,
      status: "drafting",
      title: "Untitled Bill",
      provisions: [],
      objectives: [],
      updated_at: new Date().toISOString(),
    })
    .select(BILL_COLS)
    .single()) as { data: RawAny | null; error: PgError | null };
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not start the bill." };
  }
  return { ok: true, bill: data as unknown as BillRow };
}

async function writeProvisions(
  sb: ServiceClient,
  billId: string,
  clauses: Clause[]
): Promise<ActionResult> {
  const { error } = (await t(sb, "bills")
    .update({
      provisions: clauses as unknown as RawAny,
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId)) as { error: PgError | null };
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ─── 1. Read the whole room ──────────────────────────────────────────────

export async function getCommitteeRoom(input: {
  eventId: string;
  committeeName?: string;
  participantId?: string | null;
}): Promise<ActionResult<CommitteeRoom>> {
  const sb = await createServiceClient();
  const authed = await resolveRoomAuth(sb, input);
  if (!authed.ok) return { success: false, error: authed.error };
  const auth = authed.auth;
  const eventId = input.eventId;
  const committeeName = auth.committeeName;

  const bill = await loadBill(sb, eventId, committeeName);
  // Managers (organiser / chapter admin / assigned volunteer) bypass the report
  // gate — they can draft and submit the bill without waiting for a committee
  // member to file the report (director decision 2026-06-28).
  const reportSubmitted =
    auth.isOrganiser || (await reportUnlocked(sb, eventId, committeeName));

  // Members of this committee (presiding officers never carry a committee_name).
  const { data: memberRows } = await sb
    .from("participants")
    .select("id, full_name, parliament_role, party_side")
    .eq("event_id", eventId)
    .eq("committee_name", committeeName)
    .order("full_name");
  const members: RoomMember[] = (memberRows ?? []).map((m) => ({
    id: m.id as string,
    name: (m.full_name as string) ?? "—",
    role: (m.parliament_role as string | null) ?? null,
    partySide: (m.party_side as string | null) ?? null,
    isChair: m.parliament_role === "committee_chair",
  }));
  const hasChair = members.some((m) => m.isChair);

  // Topic + linked scheme (yip.topics, category='committee', title=committee).
  let topic: string | null = null;
  let scheme: string | null = null;
  {
    const { data: ct } = await sb
      .from("topics")
      .select("description, linked_scheme")
      .eq("category", "committee")
      .eq("title", committeeName)
      .eq("is_active", true)
      .maybeSingle();
    topic = (ct?.description as string | null) ?? null;
    scheme = (ct?.linked_scheme as string | null) ?? null;
  }

  // Current live agenda item → phase.
  let currentAgendaType: string | null = null;
  {
    const { data: ev } = await sb
      .from("events")
      .select("current_agenda_item_id")
      .eq("id", eventId)
      .maybeSingle();
    const curId = ev?.current_agenda_item_id as string | null;
    if (curId) {
      const { data: ag } = await sb
        .from("agenda")
        .select("agenda_type, session_key")
        .eq("id", curId)
        .maybeSingle();
      currentAgendaType =
        (ag?.agenda_type as string | null) ??
        (ag?.session_key as string | null) ??
        null;
    }
  }
  const presentationMode = currentAgendaType === "bill_presentation";

  // Committee chat channel id (for the Discussion tab).
  let chatChannelId: string | null = null;
  {
    const { data: ch } = (await t(sb, "chat_channels")
      .select("id")
      .eq("event_id", eventId)
      .eq("kind", "committee")
      .eq("committee_name", committeeName)
      .maybeSingle()) as { data: RawAny | null };
    chatChannelId = (ch?.id as string | null) ?? null;
  }

  // Key Provisions (clauses) + Objectives (the official 2-4 list) + amendments.
  const clauses = bill ? normalizeProvisions(bill.provisions) : [];
  const objectives = bill ? normalizeProvisions(bill.objectives) : [];
  const clauseTextById = new Map(clauses.map((c) => [c.id, c.text]));
  let amendments: RoomAmendment[] = [];
  if (bill) {
    const { data: amRows } = (await t(sb, "bill_amendments")
      .select(
        "id, clause_id, kind, proposed_text, proposed_by, status, resolution_note, created_at, resolved_at"
      )
      .eq("bill_id", bill.id)
      .order("created_at", { ascending: false })) as { data: RawAny[] | null };
    const rows = amRows ?? [];
    const amIds = rows.map((r) => String(r.id));

    // Vote tallies + my vote.
    const forCount = new Map<string, number>();
    const againstCount = new Map<string, number>();
    const myVote = new Map<string, "for" | "against">();
    if (amIds.length > 0) {
      const { data: voteRows } = (await t(sb, "bill_amendment_votes")
        .select("amendment_id, participant_id, vote")
        .in("amendment_id", amIds)) as { data: RawAny[] | null };
      for (const v of voteRows ?? []) {
        const aid = String(v.amendment_id);
        if (v.vote === "for")
          forCount.set(aid, (forCount.get(aid) ?? 0) + 1);
        else if (v.vote === "against")
          againstCount.set(aid, (againstCount.get(aid) ?? 0) + 1);
        if (auth.participantId && v.participant_id === auth.participantId) {
          myVote.set(aid, v.vote as "for" | "against");
        }
      }
    }

    // Proposer names.
    const proposerIds = [
      ...new Set(
        rows.map((r) => r.proposed_by).filter((v): v is string => Boolean(v))
      ),
    ];
    const nameById = new Map<string, string>();
    if (proposerIds.length > 0) {
      const { data: pn } = await sb
        .from("participants")
        .select("id, full_name")
        .in("id", proposerIds);
      for (const r of pn ?? []) nameById.set(r.id as string, r.full_name as string);
    }

    amendments = rows.map((r): RoomAmendment => {
      const id = String(r.id);
      const clauseId = (r.clause_id as string | null) ?? null;
      const proposedBy = (r.proposed_by as string | null) ?? null;
      return {
        id,
        clauseId,
        clauseText: clauseId ? clauseTextById.get(clauseId) ?? null : null,
        kind: r.kind as RoomAmendment["kind"],
        proposedText: (r.proposed_text as string | null) ?? null,
        proposedBy,
        proposedByName:
          (proposedBy ? nameById.get(proposedBy) : null) ?? "A member",
        status: r.status as RoomAmendment["status"],
        votesFor: forCount.get(id) ?? 0,
        votesAgainst: againstCount.get(id) ?? 0,
        myVote: myVote.get(id) ?? null,
        resolutionNote: (r.resolution_note as string | null) ?? null,
        createdAt: String(r.created_at),
        resolvedAt: (r.resolved_at as string | null) ?? null,
      };
    });
  }

  // Permissions.
  const editable = billEditable(bill, reportSubmitted);
  const isLead = isLeadDrafterOf(auth, bill);
  const canEditBill = canEdit(auth, bill) && editable && !presentationMode;
  const hasTitle =
    Boolean(trim(bill?.title)) && trim(bill?.title) !== "Untitled Bill";
  const hasPreamble = Boolean(trim(bill?.preamble));
  const objectiveCount = objectives.length;
  const provisionCount = clauses.length;
  const hasPresenters = Boolean(bill?.presenter_1);
  const ready =
    hasTitle &&
    hasPreamble &&
    objectiveCount >= MIN_OBJECTIVES &&
    provisionCount >= MIN_PROVISIONS &&
    hasPresenters;

  const phase: CommitteeRoom["phase"] = presentationMode
    ? "presentation"
    : !bill || (bill.status ?? "drafting") === "drafting"
    ? "drafting"
    : ["passed", "rejected", "presented"].includes(bill.status ?? "")
    ? "voted"
    : "submitted";

  const permissions: RoomPermissions = {
    isOrganiser: auth.isOrganiser,
    isMember: auth.isMember,
    isChair: auth.isChair,
    isLeadDrafter: isLead,
    canEditBill,
    canDiscuss: auth.isMember,
    canPropose: auth.isMember && editable && !presentationMode,
    canVote: auth.isMember && !presentationMode,
    canResolve: canEdit(auth, bill) && editable && !presentationMode,
    canAssignRoles:
      (auth.isOrganiser || auth.isChair) && editable && !presentationMode,
    canSubmit: canEdit(auth, bill) && editable && !presentationMode,
    needsChair: !hasChair && !bill?.lead_drafter,
  };

  const room: CommitteeRoom = {
    eventId,
    committeeName,
    topic,
    scheme,
    phase,
    currentAgendaType,
    presentationMode,
    reportSubmitted,
    bill: bill
      ? {
          id: bill.id,
          title: bill.title ?? "",
          preamble: bill.preamble ?? "",
          definitions: bill.definitions ?? "",
          objectives,
          objective: bill.objective ?? "",
          problemStatement: bill.problem_statement ?? "",
          expectedImpact: bill.expected_impact ?? "",
          implementation: bill.implementation ?? "",
          fundingBudget: bill.funding_budget ?? "",
          conclusion: bill.conclusion ?? "",
          status: bill.status ?? "drafting",
          clauses,
          leadDrafter: bill.lead_drafter,
          presenter1: bill.presenter_1,
          presenter2: bill.presenter_2,
          policyResearcher: bill.policy_researcher,
          oppositionResponse: bill.opposition_response,
          votesFor: bill.votes_for ?? 0,
          votesAgainst: bill.votes_against ?? 0,
          votesAbstain: bill.votes_abstain ?? 0,
        }
      : null,
    members,
    amendments,
    readiness: {
      hasTitle,
      hasPreamble,
      objectiveCount,
      minObjectives: MIN_OBJECTIVES,
      provisionCount,
      minProvisions: MIN_PROVISIONS,
      hasPresenters,
      ready,
    },
    chatChannelId,
    permissions,
  };
  return { success: true, data: room };
}

// ─── 2. Edit bill scalar fields ──────────────────────────────────────────

// The official-template scalar sections. (Objectives + Key Provisions are
// lists, handled by their own actions; Problem Statement is folded into the
// Preamble and mirrored below.)
const BILL_FIELDS = {
  title: "title",
  preamble: "preamble",
  definitions: "definitions",
  expected_impact: "expected_impact",
  implementation: "implementation",
  funding_budget: "funding_budget",
  conclusion: "conclusion",
} as const;
type BillField = keyof typeof BILL_FIELDS;

export async function saveBillField(input: {
  eventId: string;
  committeeName: string;
  participantId?: string | null;
  field: BillField;
  value: string;
}): Promise<ActionResult<{ billId: string }>> {
  if (!(input.field in BILL_FIELDS)) {
    return { success: false, error: "Unknown field." };
  }
  const sb = await createServiceClient();
  const authed = await resolveRoomAuth(sb, input);
  if (!authed.ok) return { success: false, error: authed.error };
  const auth = authed.auth;

  if (!(await reportUnlocked(sb, input.eventId, auth.committeeName))) {
    return { success: false, error: "Submit your Committee Report first." };
  }
  const ensured = await ensureBill(sb, input.eventId, auth.committeeName);
  if (!ensured.ok) return { success: false, error: ensured.error };
  const bill = ensured.bill;

  if (!billEditable(bill, true) ) {
    return { success: false, error: "The bill is locked — it has been submitted." };
  }
  if (!canEdit(auth, bill)) {
    return {
      success: false,
      error: "Only the chair or lead drafter can edit the bill.",
    };
  }

  const value = input.field === "title" ? input.value.trim() : input.value;
  const update: Record<string, unknown> = {
    [input.field]: value || null,
    updated_at: new Date().toISOString(),
  };
  // Mirror the Preamble into the legacy problem_statement column so old readers
  // (dashboard/control/projector) keep showing it without separate changes.
  if (input.field === "preamble") update.problem_statement = value || null;
  const { error } = (await t(sb, "bills")
    .update(update)
    .eq("id", bill.id)) as { error: PgError | null };
  if (error) return { success: false, error: error.message };

  revalidatePath("/yip/me/committee");
  return { success: true, data: { billId: bill.id } };
}

// ─── 3. Clause edit / add / remove ───────────────────────────────────────

async function editGate(
  sb: ServiceClient,
  input: { eventId: string; committeeName: string; participantId?: string | null }
): Promise<
  | { ok: true; auth: RoomAuth; bill: BillRow; clauses: Clause[] }
  | { ok: false; error: string }
> {
  const authed = await resolveRoomAuth(sb, input);
  if (!authed.ok) return { ok: false, error: authed.error };
  const auth = authed.auth;
  if (!(await reportUnlocked(sb, input.eventId, auth.committeeName))) {
    return { ok: false, error: "Submit your Committee Report first." };
  }
  const ensured = await ensureBill(sb, input.eventId, auth.committeeName);
  if (!ensured.ok) return { ok: false, error: ensured.error };
  const bill = ensured.bill;
  if (!billEditable(bill, true)) {
    return { ok: false, error: "The bill is locked — it has been submitted." };
  }
  if (!canEdit(auth, bill)) {
    return {
      ok: false,
      error: "Only the chair or lead drafter can edit the bill.",
    };
  }
  return { ok: true, auth, bill, clauses: normalizeProvisions(bill.provisions) };
}

export async function saveClause(input: {
  eventId: string;
  committeeName: string;
  participantId?: string | null;
  clauseId: string;
  text: string;
}): Promise<ActionResult> {
  const sb = await createServiceClient();
  const gate = await editGate(sb, input);
  if (!gate.ok) return { success: false, error: gate.error };
  const text = input.text.trim();
  if (!text) return { success: false, error: "Clause text cannot be empty." };
  const next = gate.clauses.map((c) =>
    c.id === input.clauseId ? { ...c, text } : c
  );
  if (!next.some((c) => c.id === input.clauseId)) {
    return { success: false, error: "Clause not found." };
  }
  const res = await writeProvisions(sb, gate.bill.id, next);
  if (res.success) revalidatePath("/yip/me/committee");
  return res;
}

export async function addClause(input: {
  eventId: string;
  committeeName: string;
  participantId?: string | null;
  text: string;
}): Promise<ActionResult<{ clauseId: string }>> {
  const sb = await createServiceClient();
  const gate = await editGate(sb, input);
  if (!gate.ok) return { success: false, error: gate.error };
  const text = input.text.trim();
  if (!text) return { success: false, error: "Clause text cannot be empty." };
  if (gate.clauses.length >= 20) {
    return { success: false, error: "A bill can have at most 20 provisions." };
  }
  const clause: Clause = { id: randomUUID(), text };
  const res = await writeProvisions(sb, gate.bill.id, [...gate.clauses, clause]);
  if (!res.success) return res;
  revalidatePath("/yip/me/committee");
  return { success: true, data: { clauseId: clause.id } };
}

export async function removeClause(input: {
  eventId: string;
  committeeName: string;
  participantId?: string | null;
  clauseId: string;
}): Promise<ActionResult> {
  const sb = await createServiceClient();
  const gate = await editGate(sb, input);
  if (!gate.ok) return { success: false, error: gate.error };
  const next = gate.clauses.filter((c) => c.id !== input.clauseId);
  if (next.length === gate.clauses.length) {
    return { success: false, error: "Clause not found." };
  }
  const res = await writeProvisions(sb, gate.bill.id, next);
  if (res.success) revalidatePath("/yip/me/committee");
  return res;
}

// ─── 3b. Objectives (the official 2-4 list) ──────────────────────────────

async function writeObjectives(
  sb: ServiceClient,
  billId: string,
  objectives: Clause[]
): Promise<ActionResult> {
  // Mirror the joined objectives into the legacy single `objective` column so
  // old readers (dashboard/control/projector) keep working unchanged.
  const joined = objectives.map((o) => o.text).join("; ");
  const { error } = (await t(sb, "bills")
    .update({
      objectives: objectives as unknown as RawAny,
      objective: joined || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", billId)) as { error: PgError | null };
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function saveObjective(input: {
  eventId: string;
  committeeName: string;
  participantId?: string | null;
  objectiveId: string;
  text: string;
}): Promise<ActionResult> {
  const sb = await createServiceClient();
  const gate = await editGate(sb, input);
  if (!gate.ok) return { success: false, error: gate.error };
  const text = input.text.trim();
  if (!text) return { success: false, error: "Objective cannot be empty." };
  const objectives = normalizeProvisions(gate.bill.objectives);
  if (!objectives.some((o) => o.id === input.objectiveId)) {
    return { success: false, error: "Objective not found." };
  }
  const next = objectives.map((o) =>
    o.id === input.objectiveId ? { ...o, text } : o
  );
  const res = await writeObjectives(sb, gate.bill.id, next);
  if (res.success) revalidatePath("/yip/me/committee");
  return res;
}

export async function addObjective(input: {
  eventId: string;
  committeeName: string;
  participantId?: string | null;
  text: string;
}): Promise<ActionResult<{ objectiveId: string }>> {
  const sb = await createServiceClient();
  const gate = await editGate(sb, input);
  if (!gate.ok) return { success: false, error: gate.error };
  const text = input.text.trim();
  if (!text) return { success: false, error: "Objective cannot be empty." };
  const objectives = normalizeProvisions(gate.bill.objectives);
  if (objectives.length >= MAX_OBJECTIVES) {
    return {
      success: false,
      error: `The template allows at most ${MAX_OBJECTIVES} objectives.`,
    };
  }
  const obj: Clause = { id: randomUUID(), text };
  const res = await writeObjectives(sb, gate.bill.id, [...objectives, obj]);
  if (!res.success) return res;
  revalidatePath("/yip/me/committee");
  return { success: true, data: { objectiveId: obj.id } };
}

export async function removeObjective(input: {
  eventId: string;
  committeeName: string;
  participantId?: string | null;
  objectiveId: string;
}): Promise<ActionResult> {
  const sb = await createServiceClient();
  const gate = await editGate(sb, input);
  if (!gate.ok) return { success: false, error: gate.error };
  const objectives = normalizeProvisions(gate.bill.objectives);
  const next = objectives.filter((o) => o.id !== input.objectiveId);
  if (next.length === objectives.length) {
    return { success: false, error: "Objective not found." };
  }
  const res = await writeObjectives(sb, gate.bill.id, next);
  if (res.success) revalidatePath("/yip/me/committee");
  return res;
}

// ─── 4. Assign a bill role (chair | organiser) ───────────────────────────

const ROLE_COLS = {
  lead_drafter: "lead_drafter",
  presenter_1: "presenter_1",
  presenter_2: "presenter_2",
  policy_researcher: "policy_researcher",
} as const;
type RoleKey = keyof typeof ROLE_COLS;

export async function assignBillRole(input: {
  eventId: string;
  committeeName: string;
  participantId?: string | null;
  role: RoleKey;
  assigneeId: string | null;
}): Promise<ActionResult> {
  if (!(input.role in ROLE_COLS)) {
    return { success: false, error: "Unknown role." };
  }
  const sb = await createServiceClient();
  const authed = await resolveRoomAuth(sb, input);
  if (!authed.ok) return { success: false, error: authed.error };
  const auth = authed.auth;
  if (!(await reportUnlocked(sb, input.eventId, auth.committeeName))) {
    return { success: false, error: "Submit your Committee Report first." };
  }
  const bill = await loadBill(sb, input.eventId, auth.committeeName);
  if (!bill) return { success: false, error: "Start the bill draft first." };
  if (!billEditable(bill, true)) {
    return { success: false, error: "Roles are locked — the bill is submitted." };
  }
  // Assign roles → chair OR organiser only (lead drafter cannot reassign roles).
  if (!(auth.isOrganiser || auth.isChair)) {
    return { success: false, error: "Only the chair can assign roles." };
  }

  // The assignee must be a member of THIS committee (fail closed against a
  // foreign id — the only real guard given open write policies).
  if (input.assigneeId) {
    const { data: ok } = await sb
      .from("participants")
      .select("id")
      .eq("id", input.assigneeId)
      .eq("event_id", input.eventId)
      .eq("committee_name", auth.committeeName)
      .maybeSingle();
    if (!ok) {
      return { success: false, error: "That person isn't on this committee." };
    }
  }

  const { error } = (await t(sb, "bills")
    .update({
      [input.role]: input.assigneeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bill.id)) as { error: PgError | null };
  if (error) return { success: false, error: error.message };
  revalidatePath("/yip/me/committee");
  return { success: true, data: null };
}

// ─── 5. Amendments: propose / vote / resolve ─────────────────────────────

export async function proposeAmendment(input: {
  eventId: string;
  committeeName: string;
  participantId: string;
  kind: "edit" | "add" | "remove";
  clauseId?: string | null;
  proposedText?: string | null;
}): Promise<ActionResult<{ amendmentId: string }>> {
  const sb = await createServiceClient();
  const authed = await resolveRoomAuth(sb, input);
  if (!authed.ok) return { success: false, error: authed.error };
  const auth = authed.auth;
  if (!auth.isMember) {
    return { success: false, error: "Only committee members can propose amendments." };
  }
  if (!(await reportUnlocked(sb, input.eventId, auth.committeeName))) {
    return { success: false, error: "The bill isn't open yet." };
  }
  const bill = await loadBill(sb, input.eventId, auth.committeeName);
  if (!bill) return { success: false, error: "Start the bill draft first." };
  if (!billEditable(bill, true)) {
    return { success: false, error: "The bill is locked — no more amendments." };
  }

  const text = trim(input.proposedText);
  if (input.kind !== "remove" && !text) {
    return { success: false, error: "Describe the change you're proposing." };
  }
  const clauses = normalizeProvisions(bill.provisions);
  if (
    (input.kind === "edit" || input.kind === "remove") &&
    (!input.clauseId || !clauses.some((c) => c.id === input.clauseId))
  ) {
    return { success: false, error: "Pick a clause to amend." };
  }

  const { data, error } = (await t(sb, "bill_amendments")
    .insert({
      bill_id: bill.id,
      event_id: input.eventId,
      committee_name: auth.committeeName,
      clause_id: input.kind === "add" ? null : input.clauseId ?? null,
      kind: input.kind,
      proposed_text: input.kind === "remove" ? null : text,
      proposed_by: auth.participantId,
      status: "open",
    })
    .select("id")
    .single()) as { data: RawAny | null; error: PgError | null };
  if (error || !data) {
    return { success: false, error: error?.message ?? "Could not propose." };
  }
  revalidatePath("/yip/me/committee");
  return { success: true, data: { amendmentId: String(data.id) } };
}

export async function voteAmendment(input: {
  eventId: string;
  committeeName: string;
  participantId: string;
  amendmentId: string;
  vote: "for" | "against";
}): Promise<ActionResult> {
  const sb = await createServiceClient();
  const authed = await resolveRoomAuth(sb, input);
  if (!authed.ok) return { success: false, error: authed.error };
  const auth = authed.auth;
  if (!auth.isMember) {
    return { success: false, error: "Only committee members can vote." };
  }

  // The amendment must belong to THIS committee + event (fail closed).
  const { data: am } = (await t(sb, "bill_amendments")
    .select("id, event_id, committee_name, status")
    .eq("id", input.amendmentId)
    .maybeSingle()) as { data: RawAny | null };
  if (
    !am ||
    String(am.event_id) !== input.eventId ||
    trim(am.committee_name) !== auth.committeeName
  ) {
    return { success: false, error: "Amendment not found." };
  }
  if (am.status !== "open") {
    return { success: false, error: "Voting has closed on this amendment." };
  }

  // One vote per member — upsert on the unique (amendment_id, participant_id).
  const { error } = (await t(sb, "bill_amendment_votes")
    .upsert(
      {
        amendment_id: input.amendmentId,
        participant_id: auth.participantId,
        vote: input.vote,
      },
      { onConflict: "amendment_id,participant_id" }
    )) as { error: PgError | null };
  if (error) return { success: false, error: error.message };
  revalidatePath("/yip/me/committee");
  return { success: true, data: null };
}

export async function resolveAmendment(input: {
  eventId: string;
  committeeName: string;
  participantId?: string | null;
  amendmentId: string;
  decision: "accept" | "reject";
  note?: string | null;
}): Promise<ActionResult> {
  const sb = await createServiceClient();
  const authed = await resolveRoomAuth(sb, input);
  if (!authed.ok) return { success: false, error: authed.error };
  const auth = authed.auth;

  const bill = await loadBill(sb, input.eventId, auth.committeeName);
  if (!bill) return { success: false, error: "Bill not found." };
  // Resolve → chair | lead drafter | organiser.
  if (!canEdit(auth, bill)) {
    return {
      success: false,
      error: "Only the chair or lead drafter can decide an amendment.",
    };
  }
  if (!billEditable(bill, true)) {
    return { success: false, error: "The bill is locked." };
  }

  const { data: am } = (await t(sb, "bill_amendments")
    .select("id, bill_id, event_id, committee_name, status, kind, clause_id, proposed_text")
    .eq("id", input.amendmentId)
    .maybeSingle()) as { data: RawAny | null };
  if (
    !am ||
    String(am.bill_id) !== bill.id ||
    trim(am.committee_name) !== auth.committeeName
  ) {
    return { success: false, error: "Amendment not found." };
  }
  if (am.status !== "open") {
    return { success: false, error: "This amendment is already resolved." };
  }

  // ACCEPT folds the change into the bill's clauses. (REJECT only records.)
  if (input.decision === "accept") {
    const clauses = normalizeProvisions(bill.provisions);
    const kind = am.kind as "edit" | "add" | "remove";
    const clauseId = (am.clause_id as string | null) ?? null;
    const proposed = trim(am.proposed_text);
    let next: Clause[];
    if (kind === "add") {
      next = [...clauses, { id: randomUUID(), text: proposed }];
    } else if (kind === "edit") {
      if (!clauseId || !clauses.some((c) => c.id === clauseId)) {
        return { success: false, error: "The target clause no longer exists." };
      }
      next = clauses.map((c) =>
        c.id === clauseId ? { ...c, text: proposed } : c
      );
    } else {
      // remove
      next = clauses.filter((c) => c.id !== clauseId);
    }
    const w = await writeProvisions(sb, bill.id, next);
    if (!w.success) return w;
  }

  const { error } = (await t(sb, "bill_amendments")
    .update({
      status: input.decision === "accept" ? "accepted" : "rejected",
      resolved_by: auth.participantId,
      resolution_note: trim(input.note) || null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.amendmentId)) as { error: PgError | null };
  if (error) return { success: false, error: error.message };
  revalidatePath("/yip/me/committee");
  return { success: true, data: null };
}

// ─── 6. Submit the bill (readiness-checked + chair|lead|organiser) ────────

export async function submitCommitteeBill(input: {
  eventId: string;
  committeeName: string;
  participantId?: string | null;
}): Promise<ActionResult> {
  const sb = await createServiceClient();
  const authed = await resolveRoomAuth(sb, input);
  if (!authed.ok) return { success: false, error: authed.error };
  const auth = authed.auth;

  if (!(await reportUnlocked(sb, input.eventId, auth.committeeName))) {
    return { success: false, error: "Submit your Committee Report first." };
  }
  const bill = await loadBill(sb, input.eventId, auth.committeeName);
  if (!bill) return { success: false, error: "Start the bill draft first." };
  if (!canEdit(auth, bill)) {
    return {
      success: false,
      error: "Only the chair or lead drafter can submit the bill.",
    };
  }
  if ((bill.status ?? "drafting") !== "drafting") {
    return { success: false, error: "The bill has already been submitted." };
  }

  // Readiness (official template) — title + preamble + >= 2 objectives +
  // >= 3 provisions + a presenter.
  const clauses = normalizeProvisions(bill.provisions);
  const objectives = normalizeProvisions(bill.objectives);
  if (!trim(bill.title) || trim(bill.title) === "Untitled Bill") {
    return { success: false, error: "Give the bill a title first." };
  }
  if (!trim(bill.preamble)) {
    return { success: false, error: "Write the preamble first." };
  }
  if (objectives.length < MIN_OBJECTIVES) {
    return {
      success: false,
      error: `Add at least ${MIN_OBJECTIVES} objectives before submitting.`,
    };
  }
  if (clauses.length < MIN_PROVISIONS) {
    return {
      success: false,
      error: `Add at least ${MIN_PROVISIONS} provisions before submitting.`,
    };
  }
  if (!bill.presenter_1) {
    return { success: false, error: "Choose who presents the bill first." };
  }

  const { error } = (await t(sb, "bills")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("id", bill.id)) as { error: PgError | null };
  if (error) return { success: false, error: error.message };
  revalidatePath("/yip/me/committee");
  return { success: true, data: null };
}
