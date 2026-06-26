import "server-only";

/**
 * YIP Chapter Round Report — Section 2 (Chief Guests & Jury) data helper.
 *
 * Mirrors lib/yip/report/sections/overview.ts EXACTLY:
 *   1. `import "server-only"` — this is a data module, never a "use server"
 *      file, so it may export types + this async getter.
 *   2. gate with getYipEventAccess(eventId); !canView ⇒ return null so the
 *      section component renders nothing rather than throwing.
 *   3. read yip.* via createServiceClient() (already schema-pinned to "yip");
 *      plain `.from(...)` — no `.schema()` needed for yip tables.
 *
 * Section 2 assembles:
 *   - Chief Guests (yip.event_chief_guests, ordered by display_order) —
 *     split into the main chief-guest list + the valedictory guest(s)
 *     (is_valedictory = true; new additive column shipped by this section).
 *   - Jury Details per Session — one row per SCORED agenda session
 *     (yip.agenda where is_scoreable = true), with the jurors assigned to it
 *     (yip.jury_session_assignments → yip.jury_assignments). Sessions with no
 *     assigned jurors still appear (so the report shows the full session list).
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

export type ChiefGuest = {
  id: string;
  name: string;
  designation: string | null;
  organization: string | null;
  displayOrder: number;
  isValedictory: boolean;
};

export type SessionJuror = {
  name: string;
  isActive: boolean;
};

export type SessionJury = {
  agendaItemId: string;
  day: number;
  sequenceOrder: number;
  title: string;
  jurors: SessionJuror[];
};

export type GuestsJuryData = {
  /** Main chief guests (is_valedictory = false), ordered. */
  chiefGuests: ChiefGuest[];
  /** Guest(s) at the valedictory session (is_valedictory = true), ordered. */
  valedictoryGuests: ChiefGuest[];
  /** Per scored-session juror rosters, in agenda order. */
  sessions: SessionJury[];
};

/**
 * Fetch everything Section 2 renders. Returns `null` when the caller lacks view
 * access (the section component then renders nothing).
 */
export async function getGuestsJuryData(
  eventId: string
): Promise<GuestsJuryData | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const svc = await createServiceClient();

  // ── Chief guests (ordered) ──────────────────────────────────────────
  // yip.event_chief_guests + its new `is_valedictory` column are not in the
  // generated Database types yet (additive migration shipped by this section),
  // so read the table through a per-call loose cast — same escape-hatch idiom
  // overview.ts uses for yi_directory.* (the row data is validated in JS below).
  const guestsTable = svc.from("event_chief_guests" as never) as unknown as {
    select: (c: string) => {
      eq: (
        k: string,
        v: unknown
      ) => {
        order: (c: string) => {
          order: (
            c: string
          ) => Promise<{ data: Array<Record<string, unknown>> | null }>;
        };
      };
    };
  };

  const { data: guestRows } = await guestsTable
    .select("id, name, designation, organization, display_order, is_valedictory")
    .eq("event_id", eventId)
    .order("display_order")
    .order("created_at");

  const allGuests: ChiefGuest[] = (guestRows ?? []).map((g) => ({
    id: String(g.id),
    name: String(g.name ?? ""),
    designation: g.designation ? String(g.designation) : null,
    organization: g.organization ? String(g.organization) : null,
    displayOrder: typeof g.display_order === "number" ? g.display_order : 0,
    isValedictory: g.is_valedictory === true,
  }));

  const chiefGuests = allGuests.filter((g) => !g.isValedictory);
  const valedictoryGuests = allGuests.filter((g) => g.isValedictory);

  // ── Jury per scored session ─────────────────────────────────────────
  // Scored sessions = agenda rows flagged is_scoreable, in (day, sequence) order.
  const { data: agendaRows } = await svc
    .from("agenda")
    .select("id, day, sequence_order, title")
    .eq("event_id", eventId)
    .eq("is_scoreable", true)
    .order("day")
    .order("sequence_order");

  const sessions: SessionJury[] = (agendaRows ?? []).map((a) => ({
    agendaItemId: String(a.id),
    day: typeof a.day === "number" ? a.day : 0,
    sequenceOrder: typeof a.sequence_order === "number" ? a.sequence_order : 0,
    title: String(a.title ?? ""),
    jurors: [],
  }));

  if (sessions.length > 0) {
    // session_assignments → which juror scores which agenda item.
    const { data: assignRows } = await svc
      .from("jury_session_assignments")
      .select("jury_assignment_id, agenda_item_id")
      .eq("event_id", eventId);

    // jurors of this event (name + active flag).
    const { data: jurorRows } = await svc
      .from("jury_assignments")
      .select("id, jury_name, is_active")
      .eq("event_id", eventId);

    const jurorById = new Map<string, SessionJuror>();
    for (const j of jurorRows ?? []) {
      if (!j.jury_name) continue;
      jurorById.set(String(j.id), {
        name: String(j.jury_name),
        isActive: j.is_active !== false,
      });
    }

    const sessionByItem = new Map<string, SessionJury>();
    for (const s of sessions) sessionByItem.set(s.agendaItemId, s);

    for (const row of assignRows ?? []) {
      const session = sessionByItem.get(String(row.agenda_item_id));
      const juror = jurorById.get(String(row.jury_assignment_id));
      if (session && juror) session.jurors.push(juror);
    }

    // Stable juror order within each session: active first, then by name.
    for (const s of sessions) {
      s.jurors.sort(
        (a, b) =>
          Number(b.isActive) - Number(a.isActive) ||
          a.name.localeCompare(b.name)
      );
    }
  }

  return {
    chiefGuests,
    valedictoryGuests,
    sessions,
  };
}
