"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { getPositionBonusConfigAdmin } from "@/app/yip/actions/positions";
import {
  effectiveCabinetCount,
  hasCabinetOverride,
} from "@/lib/yip/cabinet";

// ─── "Mission Control" readiness board ────────────────────────────
// A NON-BLOCKING, volunteer-facing readiness report for the live control
// panel. It reads the event's real data and reports each step as ready/⚠ with
// a deep-link to the page that fixes it, grouped by event phase, plus a single
// "your next step" pointer. It NEVER blocks any action — it only informs.
//
// All checks are cheap head:true counts (+ one config read) run in parallel.

export type ReadinessItem = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  href: string | null;
};

export type ReadinessPhase = {
  name: string;
  items: ReadinessItem[];
};

export type EventReadiness = {
  phases: ReadinessPhase[];
  nextStep: { phase: string; label: string; href: string | null } | null;
  okCount: number;
  totalCount: number;
};

export async function getEventReadiness(
  eventId: string
): Promise<EventReadiness | null> {
  // Same gate as the control panel — organiser-only. Returns null for viewers
  // so the overlay simply does not render.
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) return null;

  const supabase = await createServiceClient();
  const base = `/yip/dashboard/events/${eventId}`;

  const [
    ev,
    pTotal,
    pWithCode,
    pMissingFields,
    partiesTotal,
    partiesNoSide,
    agendaDay1,
    agendaDay2,
    juryCount,
    cSpeaker,
    cPartyLeader,
    cPM,
    cLoP,
    cCabinet,
    openVotes,
    qTotal,
    qApproved,
    scoresSubmitted,
    posConfig,
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        "allocation_locked, scores_locked, cabinet_ministry_count, cabinet_ministries"
      )
      .eq("id", eventId)
      .single(),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("access_code", "is", null),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .or("constituency_number.is.null,committee_name.is.null"),
    supabase
      .from("parties")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("parties")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .is("side", null),
    supabase
      .from("agenda")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("day", 1),
    supabase
      .from("agenda")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("day", 2),
    supabase
      .from("jury_assignments")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("parliament_role", "speaker"),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("parliament_role", "party_leader"),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("parliament_role", "prime_minister"),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("parliament_role", "leader_of_opposition"),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("parliament_role", "cabinet_minister"),
    supabase
      .from("vote_sessions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "open"),
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "approved"),
    supabase
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "submitted"),
    getPositionBonusConfigAdmin().catch(() => ({ bonuses: {} })),
  ]);

  const total = pTotal.count ?? 0;
  const withCode = pWithCode.count ?? 0;
  const missingFields = pMissingFields.count ?? 0;
  const parties = partiesTotal.count ?? 0;
  const noSide = partiesNoSide.count ?? 0;
  const d1 = agendaDay1.count ?? 0;
  const d2 = agendaDay2.count ?? 0;
  const jurors = juryCount.count ?? 0;
  const speakers = cSpeaker.count ?? 0;
  const leaders = cPartyLeader.count ?? 0;
  const pms = cPM.count ?? 0;
  const lops = cLoP.count ?? 0;
  const cabinet = cCabinet.count ?? 0;
  const openVoteCount = openVotes.count ?? 0;
  const questionsTotal = qTotal.count ?? 0;
  const questionsApproved = qApproved.count ?? 0;
  const scored = scoresSubmitted.count ?? 0;

  const cabMinistries = ev.data?.cabinet_ministries ?? null;
  const cabCount = ev.data?.cabinet_ministry_count ?? null;
  const cabinetConfigured = hasCabinetOverride(cabCount, cabMinistries);
  const cabinetSeats = effectiveCabinetCount(cabCount, cabMinistries);
  const allocationLocked = ev.data?.allocation_locked === true;

  const posBonuses = (posConfig as { bonuses?: Record<string, number> }).bonuses ?? {};
  const positionConfigOk =
    Object.keys(posBonuses).length > 0 && (posBonuses.prime_minister ?? 0) > 0;

  const phases: ReadinessPhase[] = [
    {
      name: "Setup (before the event)",
      items: [
        {
          key: "participants",
          label: "Students added",
          ok: total > 0,
          detail: total > 0 ? `${total} students` : "no students yet",
          href: `${base}/participants`,
        },
        {
          key: "fields_complete",
          label: "Everyone has a constituency + committee",
          ok: total > 0 && missingFields === 0,
          detail:
            total === 0
              ? "add students first"
              : missingFields === 0
                ? "all complete"
                : `${missingFields} missing constituency or committee`,
          href: `${base}/allocation`,
        },
        {
          key: "allocation_locked",
          label: "Allocation locked",
          ok: allocationLocked,
          detail: allocationLocked ? "locked" : "not locked yet",
          href: `${base}/allocation`,
        },
        {
          key: "parties",
          label: "Parties created",
          ok: parties > 0,
          detail: parties > 0 ? `${parties} parties` : "no parties yet",
          href: `${base}/parties`,
        },
        {
          key: "cabinet",
          label: "Cabinet size set",
          ok: cabinetConfigured,
          detail: cabinetConfigured
            ? `${cabinetSeats} ministers`
            : `using default (${cabinetSeats}) — set your event's number`,
          href: `${base}/cabinet`,
        },
        {
          key: "agenda",
          label: "Agenda built for both days",
          ok: d1 > 0 && d2 > 0,
          detail: `Day 1: ${d1} items · Day 2: ${d2} items`,
          href: `${base}/agenda`,
        },
        {
          key: "jurors",
          label: "Jurors added",
          ok: jurors > 0,
          detail: jurors > 0 ? `${jurors} jurors` : "no jurors yet",
          href: `${base}/jury`,
        },
        {
          key: "access_codes",
          label: "Access codes generated",
          ok: total > 0 && withCode === total,
          detail:
            total === 0 ? "add students first" : `${withCode}/${total} have a code`,
          href: `${base}/participants`,
        },
      ],
    },
    {
      name: "Pre-event voting",
      items: [
        {
          key: "speaker",
          label: "Speaker elected",
          ok: speakers > 0,
          detail: speakers > 0 ? "Speaker seated" : "no Speaker yet",
          href: `${base}/control`,
        },
        {
          key: "party_leaders",
          label: "Party leaders chosen",
          ok: parties > 0 && leaders >= parties,
          detail:
            parties === 0
              ? "create parties first"
              : `${leaders} of ${parties} parties have a leader`,
          href: `${base}/control`,
        },
        {
          key: "no_open_votes",
          label: "No vote left open",
          ok: openVoteCount === 0,
          detail:
            openVoteCount === 0
              ? "no open votes"
              : `${openVoteCount} vote(s) still open — close & reveal them`,
          href: `${base}/control`,
        },
      ],
    },
    {
      name: "Day 1 — government formation",
      items: [
        {
          key: "sides",
          label: "Parties marked Ruling / Opposition",
          ok: parties > 0 && noSide === 0,
          detail:
            parties === 0
              ? "create parties first"
              : noSide === 0
                ? "all parties have a side"
                : `${noSide} party(ies) with no side yet`,
          href: `${base}/control`,
        },
        {
          key: "pm",
          label: "Prime Minister elected",
          ok: pms > 0,
          detail: pms > 0 ? "PM seated" : "no PM yet",
          href: `${base}/positions`,
        },
        {
          key: "lop",
          label: "Leader of Opposition elected",
          ok: lops > 0,
          detail: lops > 0 ? "LoP seated" : "no LoP yet",
          href: `${base}/positions`,
        },
        {
          key: "cabinet_filled",
          label: "Cabinet filled",
          ok: cabinet >= cabinetSeats && cabinetSeats > 0,
          detail: `${cabinet} of ${cabinetSeats} cabinet seats filled`,
          href: `${base}/positions`,
        },
      ],
    },
    {
      name: "Day 2 & results",
      items: [
        {
          key: "questions",
          label: "Question Hour questions shortlisted",
          ok: questionsApproved > 0,
          detail:
            questionsTotal === 0
              ? "no questions submitted yet"
              : `${questionsApproved} approved of ${questionsTotal} submitted`,
          href: `${base}/questions`,
        },
        {
          key: "position_bonus_config",
          label: "Leadership bonus points configured",
          ok: positionConfigOk,
          detail: positionConfigOk
            ? "bonuses set"
            : "⚠ missing — ex-leader points may compute as 0 (fix before publishing)",
          href: `/yip/dashboard/admin/scoring-config`,
        },
        {
          key: "scores_in",
          label: "Scores being submitted",
          ok: scored > 0,
          detail: scored > 0 ? `${scored} scores submitted` : "no scores yet",
          href: `${base}/scoring`,
        },
      ],
    },
  ];

  // "Next step" = the first not-ready item in phase/list order.
  let nextStep: EventReadiness["nextStep"] = null;
  let okCount = 0;
  let totalCount = 0;
  for (const phase of phases) {
    for (const it of phase.items) {
      totalCount += 1;
      if (it.ok) okCount += 1;
      else if (!nextStep)
        nextStep = { phase: phase.name, label: it.label, href: it.href };
    }
  }

  return { phases, nextStep, okCount, totalCount };
}
