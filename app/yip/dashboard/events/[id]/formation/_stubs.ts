// TODO wire-up: DELETE this file at integration; replace imports with
//   @/lib/yip/formation            (FormationStepKey, FORMATION_STEPS, FORMATION_APPOINTED_ROLES, …)
//   @/lib/yip/formation-email-types (FormationQuotaCheck, invite plan types)
//   @/app/yip/actions/formation              (step lifecycle actions — Lane A)
//   @/app/yip/actions/formation-appointments (appoint/clear — Lane A)
//   @/app/yip/actions/formation-emails       (invites/reminders/re-issue — Lane B)
//
// Lane C (organiser UI) builds against these typed stubs so the whole tab is a
// single-file import swap at integration. Signatures mirror the formation plan
// §3.1–§3.3 + §3.5 EXACTLY. Every mutation body returns a structured failure —
// the UI surfaces the "not wired yet" error instead of pretending success.
//
// NOTE: the three new RR roles (deputy_minister, parliamentary_administrator,
// parliamentary_journalist) appear ONLY as runtime strings here — never typed
// as ParliamentRole, never imported from OFFICIAL_DUTY_ROLES (PR-#872-only).

const TODO_ERROR = "TODO wire-up (Lane A/B)";

// ─── Shared result type (per-file idiom, cf. app/yip/actions/admin-team.ts) ──

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── lib/yip/formation mirrors (Lane A §3.1) ────────────────────────────────

export type FormationStepKey =
  | "allocation"
  | "speaker_ballot"
  | "party_leader_ballots"
  | "pm_ballot"
  | "lop_ballot"
  | "appointments"
  | "lock";

export type FormationStepStatus = "pending" | "open" | "closed" | "locked";

export const FORMATION_STEPS: {
  key: FormationStepKey;
  order: number;
  label: string;
  mode: "organiser" | "election";
  voteType?: string;
}[] = [
  { key: "allocation", order: 1, label: "Random Allocation & Parties", mode: "organiser" },
  {
    key: "speaker_ballot",
    order: 2,
    label: "Speaker Election",
    mode: "election",
    voteType: "speaker_election",
  },
  {
    key: "party_leader_ballots",
    order: 3,
    label: "Party Leader Elections",
    mode: "election",
    voteType: "party_leader",
  },
  {
    key: "pm_ballot",
    order: 4,
    label: "Prime Minister Election",
    mode: "election",
    voteType: "prime_minister",
  },
  {
    key: "lop_ballot",
    order: 5,
    label: "Leader of Opposition Election",
    mode: "election",
    voteType: "leader_of_opposition",
  },
  { key: "appointments", order: 6, label: "Appointments", mode: "organiser" },
  { key: "lock", order: 7, label: "Lock the House", mode: "organiser" },
];

export const FORMATION_ANCHOR_SESSION_KEY = "online_formation";

/** Appointed (non-elected) roles. Role keys are RUNTIME STRINGS by design (C3). */
export const FORMATION_APPOINTED_ROLES: {
  key: string;
  label: string;
  needsMinistry: boolean;
  side: "ruling" | "opposition" | null;
}[] = [
  { key: "cabinet_minister", label: "Cabinet Minister", needsMinistry: true, side: "ruling" },
  { key: "shadow_minister", label: "Shadow Minister", needsMinistry: true, side: "opposition" },
  // Ministry is OPTIONAL for Deputy Minister (plan §3.1).
  { key: "deputy_minister", label: "Deputy Minister", needsMinistry: false, side: "ruling" },
  {
    key: "parliamentary_administrator",
    label: "Parliamentary Administrator",
    needsMinistry: false,
    side: null,
  },
  {
    key: "parliamentary_journalist",
    label: "Parliamentary Journalist",
    needsMinistry: false,
    side: null,
  },
];

export type FormationStepRow = {
  id: string;
  event_id: string;
  step_key: FormationStepKey;
  step_order: number;
  status: FormationStepStatus;
  opens_at: string | null;
  closes_at: string | null;
  session_ids: string[];
  config: Record<string, unknown>;
};

/** True when an OPEN step's window has passed (pure helper, real implementation). */
export function stepDeadlinePassed(
  step: Pick<FormationStepRow, "closes_at" | "status">,
  now: Date = new Date()
): boolean {
  return (
    step.status === "open" &&
    !!step.closes_at &&
    now.getTime() > Date.parse(step.closes_at)
  );
}

/** The first not-yet-started step in order, or null when all are underway/done. */
export function nextPendingStep(steps: FormationStepRow[]): FormationStepRow | null {
  return (
    [...steps]
      .sort((a, b) => a.step_order - b.step_order)
      .find((s) => s.status === "pending") ?? null
  );
}

// ─── app/yip/actions/formation shapes (Lane A §3.2) ─────────────────────────

export type FormationTurnoutSummary = { eligible: number; voted: number };

export type FormationState = {
  steps: FormationStepRow[];
  /** Per-step turnout summary keyed by step_key (election steps only). */
  turnout: Partial<Record<FormationStepKey, FormationTurnoutSummary>>;
  /** events.allocation_locked — set by the final Lock step. */
  allocationLocked: boolean;
  /** events.day1_date — every window must close before this. */
  day1Date: string | null;
};

export type FormationPendingParticipant = {
  id: string;
  full_name: string;
  emailMasked: string | null;
};

export type FormationTurnout = {
  eligible: number;
  voted: number;
  pendingParticipants: FormationPendingParticipant[];
};

export type FormationTie = {
  sessionId: string;
  tiedCandidateIds: string[];
  tiedCount: number;
};

export type CloseFormationStepData = {
  closed: boolean;
  /** Present when a top-count tie kept the step open (UI offers a runoff). */
  tie: FormationTie | null;
  runoffOffered: boolean;
};

export type AnnouncementPerson = {
  id: string;
  full_name: string;
  constituency_name: string | null;
  party_name: string | null;
  /** Ministry labels (cabinet/shadow/deputy holders). */
  ministries: string[];
};

export type FormationAnnouncement = {
  eventName: string;
  chapterName: string | null;
  speaker: AnnouncementPerson | null;
  deputySpeakers: AnnouncementPerson[];
  partyLeaders: {
    partyName: string;
    side: string | null;
    leader: AnnouncementPerson | null;
  }[];
  primeMinister: AnnouncementPerson | null;
  leaderOfOpposition: AnnouncementPerson | null;
  cabinetMinisters: AnnouncementPerson[];
  shadowMinisters: AnnouncementPerson[];
  deputyMinisters: AnnouncementPerson[];
  officials: { roleKey: string; roleLabel: string; person: AnnouncementPerson }[];
};

export async function getFormationState(
  eventId: string
): Promise<ActionResult<FormationState>> {
  void eventId;
  return { success: false, error: TODO_ERROR };
}

export async function runFormationAllocation(
  eventId: string,
  opts: { partyCount: number }
): Promise<ActionResult<null>> {
  void eventId;
  void opts;
  return { success: false, error: TODO_ERROR };
}

export async function openFormationStep(
  eventId: string,
  stepKey: FormationStepKey,
  opts: { closesAt: string; candidateIds?: string[] }
): Promise<ActionResult<null>> {
  void eventId;
  void stepKey;
  void opts;
  return { success: false, error: TODO_ERROR };
}

export async function extendFormationStep(
  eventId: string,
  stepKey: FormationStepKey,
  newClosesAt: string
): Promise<ActionResult<null>> {
  void eventId;
  void stepKey;
  void newClosesAt;
  return { success: false, error: TODO_ERROR };
}

export async function closeFormationStep(
  eventId: string,
  stepKey: FormationStepKey
): Promise<ActionResult<CloseFormationStepData>> {
  void eventId;
  void stepKey;
  return { success: false, error: TODO_ERROR };
}

export async function sweepFormationDeadlines(
  eventId: string
): Promise<ActionResult<null>> {
  void eventId;
  return { success: false, error: TODO_ERROR };
}

export async function getFormationTurnout(
  eventId: string,
  stepKey: FormationStepKey
): Promise<ActionResult<FormationTurnout>> {
  void eventId;
  void stepKey;
  return { success: false, error: TODO_ERROR };
}

export async function lockFormation(eventId: string): Promise<ActionResult<null>> {
  void eventId;
  return { success: false, error: TODO_ERROR };
}

export async function getFormationAnnouncement(
  eventId: string
): Promise<ActionResult<FormationAnnouncement>> {
  void eventId;
  return { success: false, error: TODO_ERROR };
}

// ─── app/yip/actions/formation-appointments shapes (Lane A §3.3) ────────────

export async function appointFormationRole(
  eventId: string,
  participantId: string,
  roleKey: string,
  ministryLabel?: string
): Promise<ActionResult<null>> {
  void eventId;
  void participantId;
  void roleKey;
  void ministryLabel;
  return { success: false, error: TODO_ERROR };
}

export async function clearFormationRole(
  eventId: string,
  participantId: string
): Promise<ActionResult<null>> {
  void eventId;
  void participantId;
  return { success: false, error: TODO_ERROR };
}

// ─── lib/yip/formation-email-types mirrors (Lane B §3.1/§3.5) ───────────────

export type FormationQuotaCheck = {
  ok: boolean;
  reason?: string;
  plannedCount: number;
  sentToday: number;
  dailyCap: number;
};

/** Mirrors YipEmailRecipient (lib/yip/email-codes-types.ts). */
export type FormationEmailRecipient = {
  participantId: string;
  serialNo: number | null;
  fullName: string;
  emailMasked: string | null;
  hasEmail: boolean;
};

/** Mirrors YipEmailSendPlan. */
export type FormationInvitePlan = {
  total: number;
  withEmail: number;
  recipients: FormationEmailRecipient[];
};

/** Mirrors YipEmailBatchItemResult. */
export type FormationEmailBatchItemResult = {
  participantId: string;
  fullName: string;
  success: boolean;
  error?: string;
};

// ─── app/yip/actions/formation-emails shapes (Lane B §3.5) ──────────────────

/** Plan wording: "Returns FormationQuotaCheck" — direct, not ActionResult. */
export async function checkFormationEmailQuota(
  eventId: string,
  plannedCount: number
): Promise<FormationQuotaCheck> {
  void eventId;
  // Plan-shaped refusal so any pre-flight caller fails CLOSED until wired.
  return { ok: false, reason: TODO_ERROR, plannedCount, sentToday: 0, dailyCap: 0 };
}

export async function getFormationInvitePlan(
  eventId: string
): Promise<ActionResult<FormationInvitePlan>> {
  void eventId;
  return { success: false, error: TODO_ERROR };
}

export async function sendFormationInvites(
  eventId: string,
  participantIds: string[]
): Promise<
  ActionResult<{ quota: FormationQuotaCheck; results: FormationEmailBatchItemResult[] }>
> {
  void eventId;
  void participantIds;
  return { success: false, error: TODO_ERROR };
}

export async function sendFormationReminders(
  eventId: string,
  stepKey: FormationStepKey
): Promise<
  ActionResult<{ quota: FormationQuotaCheck; results: FormationEmailBatchItemResult[] }>
> {
  void eventId;
  void stepKey;
  return { success: false, error: TODO_ERROR };
}

export async function reissueFormationCode(
  eventId: string,
  participantId: string
): Promise<ActionResult<null>> {
  void eventId;
  void participantId;
  return { success: false, error: TODO_ERROR };
}
