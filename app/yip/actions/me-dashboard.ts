"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";

/**
 * Participant-facing reads for the student dashboard (Change Request §3).
 *
 * The student (participant) session is a custom cookie, NOT a Supabase auth
 * session — so the organizer-gated helpers (getYipEventAccess) deny it. These
 * reads use the service-role client directly, but every query is scoped to the
 * participant's OWN event / party so a student can only ever see their own
 * data. Mirrors how the dashboard page itself reads via createServiceClient.
 */

// ─── YUVA + chapter-organiser contact ────────────────────────────

export type MeYuvaContact = {
  /** "party" | "committee" — which assignment matched the student */
  scope: "party" | "committee";
  /** Party or committee display name the YUVA is handling */
  scopeName: string;
  volunteer_name: string;
  volunteer_phone: string | null;
};

export type MeOrganiserContact = {
  chapter_name: string | null;
  organiser_name: string;
  organiser_phone: string | null;
  organiser_email: string | null;
};

export type MeContactInfo = {
  yuva: MeYuvaContact[];
  organisers: MeOrganiserContact[];
};

// yip.yuva_assignments is not in the generated DB types yet — a narrow local
// cast keeps tsc happy without a types regen (the typed `.from()` overloads
// resolve the unknown table name to `never` otherwise).
type RawYuvaRow = {
  id: string;
  volunteer_id: string;
  party_id: string | null;
  committee_name: string | null;
};

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

type AnyTable = {
  select: (cols?: string) => AnyTable;
  eq: (col: string, val: unknown) => AnyTable;
  then: Promise<{
    data: RawYuvaRow[] | null;
    error: { message: string } | null;
  }>["then"];
};

function yuvaTable(supabase: ServiceClient): AnyTable {
  return (supabase as unknown as { from: (t: string) => AnyTable }).from(
    "yuva_assignments"
  );
}

/**
 * The YUVA volunteer(s) handling THIS student's party and/or committee, plus
 * the event chapter's organiser contact(s) when available.
 *
 * Matching:
 *   participant.party_id        → yuva_assignments.party_id
 *   participant.committee_name  → yuva_assignments.committee_name
 *
 * Scoped strictly to the participant's own event + own party/committee.
 */
export async function getMeContacts(
  participantId: string
): Promise<MeContactInfo> {
  const supabase = await createServiceClient();

  // 1. Resolve the participant (own row only).
  const { data: participant } = await supabase
    .from("participants")
    .select("id, event_id, party_id, committee_name")
    .eq("id", participantId)
    .maybeSingle();

  if (!participant) return { yuva: [], organisers: [] };

  // 2. YUVA assignments for the participant's event, then keep only the rows
  //    that match the student's own party_id or committee_name.
  const { data: rows } = await yuvaTable(supabase)
    .select("id, volunteer_id, party_id, committee_name")
    .eq("event_id", participant.event_id);

  const all = (rows ?? []) as RawYuvaRow[];

  const matched = all.filter((r) => {
    if (participant.party_id && r.party_id === participant.party_id) return true;
    if (
      participant.committee_name &&
      r.committee_name &&
      r.committee_name === participant.committee_name
    )
      return true;
    return false;
  });

  let yuva: MeYuvaContact[] = [];

  if (matched.length > 0) {
    const volunteerIds = [...new Set(matched.map((r) => r.volunteer_id))];
    const { data: vols } = await supabase
      .from("volunteers")
      .select("id, full_name, phone")
      .in("id", volunteerIds);

    const volById = new Map(
      (vols ?? []).map((v) => [
        v.id,
        v as { id: string; full_name: string; phone: string | null },
      ])
    );

    yuva = matched.map((r) => {
      const isParty = !!(participant.party_id && r.party_id === participant.party_id);
      return {
        scope: isParty ? ("party" as const) : ("committee" as const),
        scopeName: isParty
          ? "Your Party"
          : r.committee_name ?? participant.committee_name ?? "Your Committee",
        volunteer_name: volById.get(r.volunteer_id)?.full_name ?? "(unknown)",
        volunteer_phone: volById.get(r.volunteer_id)?.phone ?? null,
      };
    });
  }

  // 3. Chapter ORGANISER contact(s) — the canonical chapter contact for a
  //    student (replaces the chapter chair; product-owner decision 2026-06-13).
  //    Sourced from yi_directory.role_assignments (app='yip',
  //    role='chapter_organizer', is_active) for the event's chapter, joined to
  //    yi_directory.people for name + email + phone. Mirrors listChapterRoles
  //    in app/yip/actions/chapter-roles.ts. Degrades to [] when none provisioned.
  let organisers: MeOrganiserContact[] = [];

  const { data: event } = await supabase
    .from("events")
    .select("chapter_name")
    .eq("id", participant.event_id)
    .maybeSingle();

  const chapterName = (event as { chapter_name?: string | null } | null)
    ?.chapter_name;

  if (chapterName) {
    const { data: roleRows } = await supabase
      .schema("yi_directory")
      .from("role_assignments")
      .select("person:people!inner(full_name, email, phone)")
      .eq("app", "yip")
      .eq("role", "chapter_organizer")
      .eq("yi_chapter", chapterName)
      .eq("is_active", true);

    organisers = (roleRows ?? [])
      .map((r) => {
        const p = (
          r as unknown as {
            person: {
              full_name: string | null;
              email: string | null;
              phone: string | null;
            };
          }
        ).person;
        return {
          chapter_name: chapterName,
          organiser_name: p?.full_name?.trim() || "Chapter Organiser",
          organiser_phone: p?.phone ?? null,
          organiser_email: p?.email ?? null,
        };
      })
      // Keep only rows with at least one reachable channel (phone or email).
      .filter((o) => o.organiser_phone || o.organiser_email);
  }

  return { yuva, organisers };
}

// ─── Privacy-safe party roster ───────────────────────────────────

export type MeRosterMember = {
  id: string;
  /** Member's name (shown in the roster so a student knows who is in their party). */
  full_name: string;
  /** Roster serial number (internal ordering only — not displayed). */
  serial_no: number | null;
  /** Constituency (seat) number — the canonical participant number shown as #N. */
  constituency_number: number | null;
  constituency_name: string | null;
  constituency_state: string | null;
  /** Whether this row is the requesting student (to highlight "You") */
  isSelf: boolean;
};

/**
 * The student's OWN party members. Returns name + constituency so a member can
 * see who is in their own party. PRIVACY-CRITICAL: contact PII is NEVER fetched
 * — the SELECT below deliberately omits `phone`, `parent_phone`, `email`, and
 * `school_name`.
 */
export async function getMyPartyRoster(
  participantId: string
): Promise<MeRosterMember[]> {
  const supabase = await createServiceClient();

  const { data: me } = await supabase
    .from("participants")
    .select("id, event_id, party_id")
    .eq("id", participantId)
    .maybeSingle();

  if (!me || !me.party_id) return [];

  // NOTE: SELECT includes the member's name but is intentionally limited to
  // NON-CONTACT columns. Do NOT add phone / parent_phone / email / school_name.
  const { data: members } = await supabase
    .from("participants")
    .select("id, full_name, serial_no, constituency_number, constituency_name, constituency_state")
    .eq("event_id", me.event_id)
    .eq("party_id", me.party_id)
    .order("constituency_number", { ascending: true, nullsFirst: false });

  return (members ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name ?? "",
    serial_no: m.serial_no,
    constituency_number: m.constituency_number,
    constituency_name: m.constituency_name,
    constituency_state: m.constituency_state,
    isSelf: m.id === participantId,
  }));
}
