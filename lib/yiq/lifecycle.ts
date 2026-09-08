/**
 * YIQ round lifecycle — pure decision functions, NO I/O.
 *
 * Each of the 65 Yi chapters runs its own `yiq.chapter_events` row up one
 * linear ladder:
 *
 *   draft → registration_open → registration_closed → online_round_live
 *         → online_round_closed → finals_scheduled → finals_live
 *         → finals_complete
 *
 * The CLOCK owns only the first four rungs. Everything at or past
 * `finals_scheduled` is an on-stage stage that a human schedules and runs —
 * no cron may move it.
 *
 * Windows live on `yiq.editions` and may be overridden per event on
 * `yiq.chapter_events`; a NULL on the event means "inherit the edition"
 * (the same rule app/yiq/actions/register.ts already applies at the door).
 *
 * EVERY rule here FAILS CLOSED. A missing, blank or unparseable timestamp
 * means "do nothing", never "do it now" — a malformed window must not close
 * a live round early and strand students mid-paper. Being unsure always
 * costs a delay a human can fix, never a round a student cannot re-sit.
 *
 * Pure by design so the rules are testable without a database:
 *   npx tsx lib/yiq/__tests__/lifecycle.check.ts
 */

import {
  CHAPTER_EVENT_STATUSES,
  type ChapterEventStatus,
} from "./constants";

/** The four window columns carried by BOTH editions and chapter_events. */
export type WindowKey =
  | "registration_opens_at"
  | "registration_closes_at"
  | "online_round_opens_at"
  | "online_round_closes_at";

/** Only the columns the decision needs — kept structural so any row shape fits. */
export type LifecycleWindows = {
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  online_round_opens_at?: string | null;
  online_round_closes_at?: string | null;
};

export type LifecycleEvent = LifecycleWindows & {
  id: string;
  chapter_name?: string | null;
  /** Raw DB value: typed `string`, so it is validated here, never trusted. */
  status: string;
};

export type LifecycleEdition = LifecycleWindows & {
  id?: string;
};

/** An effective window: when it fires, and which row it came from. */
export type ResolvedWindow = {
  /** Epoch milliseconds — what `now` is compared against. */
  ms: number;
  /** The timestamp exactly as stored, for logging the "why". */
  raw: string;
  /** Which row won: the per-event override, or the edition default. */
  source: "event" | "edition";
};

/**
 * The clock-owned rungs, in ladder order. A rung fires when `now` reaches its
 * window. `online_round_closed` is deliberately terminal for the clock:
 * scheduling the finals is an organiser's decision.
 */
export const LIFECYCLE_LADDER: {
  from: ChapterEventStatus;
  to: ChapterEventStatus;
  window: WindowKey;
}[] = [
  { from: "draft", to: "registration_open", window: "registration_opens_at" },
  {
    from: "registration_open",
    to: "registration_closed",
    window: "registration_closes_at",
  },
  {
    from: "registration_closed",
    to: "online_round_live",
    window: "online_round_opens_at",
  },
  {
    from: "online_round_live",
    to: "online_round_closed",
    window: "online_round_closes_at",
  },
];

/**
 * Statuses the clock must never touch, whatever the calendar says. The house
 * lights are a human's call.
 */
export const HUMAN_ONLY_STATUSES: ChapterEventStatus[] = [
  "finals_scheduled",
  "finals_live",
  "finals_complete",
];

export function isChapterEventStatus(v: unknown): v is ChapterEventStatus {
  return (
    typeof v === "string" &&
    (CHAPTER_EVENT_STATUSES as readonly string[]).includes(v)
  );
}

/** Ladder position; -1 for anything unrecognised. */
export function statusRank(status: string): number {
  return (CHAPTER_EVENT_STATUSES as readonly string[]).indexOf(status);
}

/**
 * Parse a stored timestamp to epoch ms, or null when it cannot be trusted.
 *
 * PostgREST hands back ISO 8601 with an offset. The space-separated form
 * (`2026-09-15 18:29:59+00`) is what psql prints, and it is normalised here so
 * a row copied from a SQL console still behaves. Anything that does not parse
 * to a finite instant returns null — which every caller reads as "no window",
 * i.e. do nothing.
 */
export function parseWindowTs(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;

  let normalised = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)
    ? trimmed.replace(" ", "T")
    : trimmed;
  // psql also prints a whole-hour offset as `+00`, which is not valid ISO 8601
  // (JS wants `Z` or `±HH:mm`); widen it rather than reject the row.
  // (Anchored on the time part, so a bare date like `2026-09-19` — whose last
  // two characters also look like an offset — is left exactly as it is.)
  if (/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?[+-]\d{2}$/.test(normalised)) {
    normalised += ":00";
  }

  const ms = Date.parse(normalised);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The effective window for `key`: the event's own value when it has one,
 * otherwise the edition's. Null means "no window", so nothing auto-transitions
 * on it.
 *
 * A per-event value that is PRESENT BUT MALFORMED resolves to null — it does
 * NOT silently fall through to the edition. The organiser said something about
 * this window; we cannot read it, so we refuse to guess and leave the event to
 * a human instead of applying a date they did not choose.
 */
export function resolveWindow(
  event: LifecycleWindows,
  edition: LifecycleEdition | null | undefined,
  key: WindowKey
): ResolvedWindow | null {
  const own = event?.[key];
  const hasOwn = typeof own === "string" && own.trim() !== "";

  if (hasOwn) {
    const ms = parseWindowTs(own);
    return ms === null ? null : { ms, raw: own, source: "event" };
  }

  const inherited = edition?.[key];
  if (typeof inherited !== "string" || inherited.trim() === "") return null;

  const ms = parseWindowTs(inherited);
  return ms === null ? null : { ms, raw: inherited, source: "edition" };
}

export type LifecyclePlan =
  /** Nothing to do — the common case. */
  | { kind: "none"; status: ChapterEventStatus | null; reason: string }
  /** Exactly one rung is due. */
  | {
      kind: "transition";
      from: ChapterEventStatus;
      to: ChapterEventStatus;
      window: WindowKey;
      /** The timestamp that fired, as stored. */
      dueAt: string;
      windowSource: "event" | "edition";
      /**
       * Set only on online_round_live → online_round_closed. The chapter's
       * standings can now be computed — a fact to LOG, never an instruction to
       * act on: publishing a result is the organiser's decision.
       */
      standingsReady: boolean;
      reason: string;
    }
  /** Something a human must look at; the clock refuses to move it. */
  | {
      kind: "attention";
      status: ChapterEventStatus | null;
      /** Where the calendar says it should be — reported, never applied. */
      clockSays: ChapterEventStatus | null;
      /** How many rungs behind the calendar it is. */
      rungsBehind: number;
      reason: string;
    };

/**
 * Decide what should happen to ONE event.
 *
 * The rules, in the order they are applied:
 *  1. An unrecognised status is never moved (fail closed).
 *  2. finals_scheduled and beyond are never touched.
 *  3. Walk the ladder up from the current status, counting the rungs whose
 *     window has fired. The walk stops at the first rung that has not fired,
 *     so a null window can never be leapfrogged by a later one.
 *  4. Exactly one rung due  → transition.
 *     Two or more rungs due → ATTENTION, and nothing moves. This is the rule
 *     that stops a forgotten `draft` chapter from jumping straight to
 *     `online_round_closed` when its round window has already passed: opening
 *     a registration that closed weeks ago, or closing a round that never
 *     opened, are both worse than a human being asked.
 *
 * The walk only ever goes UP, so a status can never move backwards — an event
 * an organiser has already advanced by hand stays where they put it.
 */
export function planTransition(
  event: LifecycleEvent,
  edition: LifecycleEdition | null | undefined,
  now: Date | number
): LifecyclePlan {
  const nowMs = now instanceof Date ? now.getTime() : now;

  if (!Number.isFinite(nowMs)) {
    return {
      kind: "none",
      status: isChapterEventStatus(event.status) ? event.status : null,
      reason: "The current time could not be read; refusing to act.",
    };
  }

  if (!isChapterEventStatus(event.status)) {
    return {
      kind: "attention",
      status: null,
      clockSays: null,
      rungsBehind: 0,
      reason: `Unrecognised status "${event.status}" — the clock will not move it.`,
    };
  }

  const status = event.status;

  if (HUMAN_ONLY_STATUSES.includes(status)) {
    return {
      kind: "none",
      status,
      reason: "At or past finals_scheduled — the on-stage stages are a human's call.",
    };
  }

  // Walk up the ladder from where the event is now.
  let cursor = status;
  let due = 0;
  let firstRung: (typeof LIFECYCLE_LADDER)[number] | null = null;
  let firstWindow: ResolvedWindow | null = null;
  let stopReason = "";

  for (;;) {
    const rung = LIFECYCLE_LADDER.find((r) => r.from === cursor);
    if (!rung) {
      if (due === 0) {
        stopReason =
          "No clock-driven step from this status; the next move is a human's.";
      }
      break;
    }

    const win = resolveWindow(event, edition, rung.window);
    if (win === null) {
      if (due === 0) {
        stopReason = `No usable ${rung.window} on the event or the edition.`;
      }
      break;
    }

    if (nowMs < win.ms) {
      if (due === 0) {
        stopReason = `${rung.window} has not been reached yet.`;
      }
      break;
    }

    if (due === 0) {
      firstRung = rung;
      firstWindow = win;
    }
    due++;
    cursor = rung.to;
  }

  if (due === 0 || firstRung === null || firstWindow === null) {
    return { kind: "none", status, reason: stopReason || "Nothing is due." };
  }

  if (due > 1) {
    return {
      kind: "attention",
      status,
      clockSays: cursor,
      rungsBehind: due,
      reason: `Behind by ${due} steps — the calendar says ${cursor}. Refusing to skip a step; an organiser should set the status by hand.`,
    };
  }

  return {
    kind: "transition",
    from: status,
    to: firstRung.to,
    window: firstRung.window,
    dueAt: firstWindow.raw,
    windowSource: firstWindow.source,
    standingsReady: firstRung.to === "online_round_closed",
    reason: `${firstRung.window} (${firstWindow.source}) passed at ${firstWindow.raw}.`,
  };
}

/**
 * The status this event SHOULD move to right now, or null when it should stay
 * put. A thin read of planTransition() — `attention` cases return null,
 * because "a human must look at this" is never a status to write.
 */
export function dueTransition(
  event: LifecycleEvent,
  edition: LifecycleEdition | null | undefined,
  now: Date | number
): ChapterEventStatus | null {
  const plan = planTransition(event, edition, now);
  return plan.kind === "transition" ? plan.to : null;
}

/** Per-event plan, carried with its event so callers can batch by target. */
export type PlannedEvent = { event: LifecycleEvent; plan: LifecyclePlan };

/** Plan a whole edition in one pass. Pure; ordering is preserved. */
export function planEdition(
  events: LifecycleEvent[],
  edition: LifecycleEdition | null | undefined,
  now: Date | number
): PlannedEvent[] {
  return events.map((event) => ({
    event,
    plan: planTransition(event, edition, now),
  }));
}

/**
 * Group due transitions by (from → to) so a caller can apply each group as one
 * compare-and-set UPDATE instead of 65 round-trips.
 */
export function groupTransitions(planned: PlannedEvent[]): {
  from: ChapterEventStatus;
  to: ChapterEventStatus;
  window: WindowKey;
  standingsReady: boolean;
  eventIds: string[];
}[] {
  const groups = new Map<
    string,
    {
      from: ChapterEventStatus;
      to: ChapterEventStatus;
      window: WindowKey;
      standingsReady: boolean;
      eventIds: string[];
    }
  >();

  for (const { event, plan } of planned) {
    if (plan.kind !== "transition") continue;
    const key = `${plan.from}→${plan.to}`;
    const existing = groups.get(key);
    if (existing) {
      existing.eventIds.push(event.id);
      continue;
    }
    groups.set(key, {
      from: plan.from,
      to: plan.to,
      window: plan.window,
      standingsReady: plan.standingsReady,
      eventIds: [event.id],
    });
  }

  return [...groups.values()];
}

/** Human-readable one-liner for a plan — used by logs and the dry run. */
export function describePlan(plan: LifecyclePlan): string {
  if (plan.kind === "transition") {
    return `${plan.from} → ${plan.to}: ${plan.reason}`;
  }
  if (plan.kind === "attention") {
    return `${plan.status ?? "unknown"}: ${plan.reason}`;
  }
  return `${plan.status ?? "unknown"}: ${plan.reason}`;
}
