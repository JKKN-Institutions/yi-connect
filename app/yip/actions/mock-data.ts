"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";
import {
  FEMALE_NAMES,
  MALE_NAMES,
  MOCK_CHAPTER_EVENT_NAME,
  MOCK_CHAPTER_VENUE,
  MOCK_JURY_NAMES,
  MOCK_MARKER,
  MOCK_NATIONAL_EVENT_NAME,
  MOCK_NATIONAL_VENUE,
  MOCK_OATH_TEXT,
  MOCK_REGIONAL_EVENT_NAME,
  MOCK_REGIONAL_VENUE,
  MOCK_SCHOOLS,
  MOCK_SEASON_NAME,
  MOCK_SEASON_YEAR,
  MOCK_VOLUNTEER_NAMES,
  makeRng,
  mockNote,
  mockPhone,
} from "@/lib/yip/mock-data";
import { HANDBOOK_AWARDS } from "@/lib/yip/constants";
import { DEMO_ORG_EMAIL, DEMO_ORG_PASSWORD } from "@/lib/yip/demo-credentials";
import type { Database } from "@/types/yip/database";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * NOTE — type-safety escape hatch:
 * The generated `Database` type in `src/types/database.ts` does not yet know
 * about the `is_mock` column added by migration 020 (types are regenerated
 * centrally after the migration pushes). To keep this module readable while
 * still using the real service client everywhere else, we route all queries
 * that touch `is_mock` through this untyped alias. Runtime safety is
 * unaffected — the column exists in the DB once 020 is applied. Remove this
 * alias (and its usages) after the next `supabase gen types` run.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;
function db(client: ServiceClient): AnyClient {
  return client as AnyClient;
}

/**
 * `is_mock` column isn't in generated types yet (see note above). This
 * helper extends a generated Insert type with it so our insert arrays are
 * still readably typed, while the runtime call goes through `db()`
 * (untyped) so Supabase doesn't reject the extra field.
 */
type WithMock<T> = T & { is_mock?: boolean };

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Types ──────────────────────────────────────────────────────────────

export type MockDataCounts = {
  seasons: number;
  events: number;
  schools: number;
  people: number;
  participants: number;
  parties: number;
  jury_assignments: number;
  scores: number;
  parliamentary_motions: number;
  bills: number;
  questions: number;
  participant_fees: number;
  volunteers: number;
  feedback_responses: number;
  event_media: number;
  branding_compliance_checks: number;
  invitation_approvals: number;
  promotions: number;
  registrations: number;
  organizer_profiles: number;
  results: number;
  organizer_checklist: number;
  event_topic_assignments: number;
};

export type MockEventSummary = {
  id: string;
  name: string;
  level: Database["public"]["Enums"]["event_level"];
  chapter_name: string | null;
  status: Database["public"]["Enums"]["event_status"];
  day1_date: string;
  day2_date: string;
  participants: number;
};

export type MockDataStats = {
  counts: MockDataCounts;
  events: MockEventSummary[];
  seeded: boolean;
};

const ADMIN_PATH = "/dashboard/admin/mock-data";

// ─── Shared helpers ─────────────────────────────────────────────────────

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genAccessCode(rng: () => number, prefix: string): string {
  // Prefix "M" (for MOCK) + 5 random = still 6 chars, still looks valid,
  // but is visually distinguishable if you squint.
  let rest = "";
  for (let i = 0; i < 5; i++) {
    rest += ACCESS_CODE_ALPHABET.charAt(
      Math.floor(rng() * ACCESS_CODE_ALPHABET.length)
    );
  }
  return `${prefix}${rest}`;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// ─── Stats ──────────────────────────────────────────────────────────────

/**
 * Returns current mock row counts across every table the seeder touches.
 * Used by the admin surface to render live counts + the proof-of-safety
 * panel.
 */
export async function getMockDataStats(): Promise<MockDataStats> {
  const supabaseTyped = await createServiceClient();
  const supabase = db(supabaseTyped);

  const [
    seasons,
    events,
    schools,
    people,
    participants,
    parties,
    jury,
    scores,
    motions,
    bills,
    questions,
    fees,
    volunteers,
    feedback,
    media,
    brandingChecks,
    invitations,
    promotions,
    registrations,
    organizers,
  ] = await Promise.all([
    supabase.schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */.select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("is_mock", true),
    // Post-absorption: schools live in yi.institutions, no is_mock column.
    // Seeder no longer inserts mock institutions; report 0 for stats.
    Promise.resolve({ count: 0 }),
    supabase.from("contestants").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("participants").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("parties").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("jury_assignments").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("scores").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("motions").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("bills").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("fees").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("volunteers").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("feedback").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("media").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("brand_checks").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("invitations").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("promotions").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("is_mock", true),
    supabase.from("organizers").select("id", { count: "exact", head: true }).eq("is_mock", true),
  ]);

  // Transitively derived (no is_mock column): results, organizer_checklist,
  // event_topic_assignments — counted via FK to mock events.
  const mockEventIds = await listMockEventIds(supabase);

  const [resultsRes, checklistRes, topicsRes] =
    mockEventIds.length === 0
      ? [{ count: 0 }, { count: 0 }, { count: 0 }]
      : await Promise.all([
          supabase
            .from("results")
            .select("id", { count: "exact", head: true })
            .in("event_id", mockEventIds),
          supabase
            .from("checklist")
            .select("id", { count: "exact", head: true })
            .in("event_id", mockEventIds),
          supabase
            .from("event_topics")
            .select("id", { count: "exact", head: true })
            .in("event_id", mockEventIds),
        ]);

  const counts: MockDataCounts = {
    seasons: seasons.count ?? 0,
    events: events.count ?? 0,
    schools: schools.count ?? 0,
    people: people.count ?? 0,
    participants: participants.count ?? 0,
    parties: parties.count ?? 0,
    jury_assignments: jury.count ?? 0,
    scores: scores.count ?? 0,
    parliamentary_motions: motions.count ?? 0,
    bills: bills.count ?? 0,
    questions: questions.count ?? 0,
    participant_fees: fees.count ?? 0,
    volunteers: volunteers.count ?? 0,
    feedback_responses: feedback.count ?? 0,
    event_media: media.count ?? 0,
    branding_compliance_checks: brandingChecks.count ?? 0,
    invitation_approvals: invitations.count ?? 0,
    promotions: promotions.count ?? 0,
    registrations: registrations.count ?? 0,
    organizer_profiles: organizers.count ?? 0,
    results: resultsRes.count ?? 0,
    organizer_checklist: checklistRes.count ?? 0,
    event_topic_assignments: topicsRes.count ?? 0,
  };

  // Event summaries for per-event wipe UI
  const eventRows = await supabase
    .from("events")
    .select("id, name, level, chapter_name, status, day1_date, day2_date")
    .eq("is_mock", true)
    .order("level", { ascending: true })
    .order("day1_date", { ascending: true });

  const summaries: MockEventSummary[] = [];
  for (const e of eventRows.data ?? []) {
    const { count } = await supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", e.id)
      .eq("is_mock", true);
    summaries.push({
      id: e.id,
      name: e.name,
      level: e.level,
      chapter_name: e.chapter_name,
      status: e.status,
      day1_date: e.day1_date,
      day2_date: e.day2_date,
      participants: count ?? 0,
    });
  }

  return {
    counts,
    events: summaries,
    seeded: (events.count ?? 0) > 0,
  };
}

async function listMockEventIds(client: ServiceClient | AnyClient): Promise<string[]> {
  const { data } = await db(client as ServiceClient)
    .from("events")
    .select("id")
    .eq("is_mock", true);
  return ((data as Array<{ id: string }> | null) ?? []).map((r) => r.id);
}

async function listMockPersonIds(client: ServiceClient | AnyClient): Promise<string[]> {
  const { data } = await db(client as ServiceClient)
    .from("contestants")
    .select("id")
    .eq("is_mock", true);
  return ((data as Array<{ id: string }> | null) ?? []).map((r) => r.id);
}

/**
 * Ensures the demo-organizer auth user exists and returns its id.
 * Idempotent: creates if missing, otherwise looks up via admin.listUsers.
 * Returns null on hard failure (events still get seeded with created_by=null
 * — same behavior as before).
 */
async function ensureDemoOrganizerUserId(admin: AnyClient): Promise<string | null> {
  // Try create first — handles fresh DB. Errors are tolerated when user
  // already exists.
  try {
    const { data: createData, error: createErr } = await admin.auth.admin.createUser({
      email: DEMO_ORG_EMAIL,
      password: DEMO_ORG_PASSWORD,
      email_confirm: true,
      user_metadata: { is_mock: true, demo: true },
    });
    if (!createErr && createData?.user?.id) {
      return createData.user.id as string;
    }
    if (createErr && !/already|exist|registered|duplicate/i.test(createErr.message ?? "")) {
      return null;
    }
  } catch {
    // fall through
  }

  // User already exists — list and find by email.
  try {
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error || !data) return null;
    const target = DEMO_ORG_EMAIL.toLowerCase();
    const found = (data.users ?? []).find(
      (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === target
    );
    return found?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Seed ───────────────────────────────────────────────────────────────

/**
 * Idempotent: if a mock chapter event already exists, returns the current
 * stats without inserting anything. Safe to call multiple times.
 */
export async function seedMockData(): Promise<ActionResult<MockDataStats>> {
  const supabaseTyped = await createServiceClient();
  const supabase = db(supabaseTyped);

  // Resolve demo organizer auth.users.id so /dashboard isn't empty after
  // /test-login → "Demo Organizer". Falls back to null on failure (matches
  // pre-existing behavior).
  const demoOrgUserId = await ensureDemoOrganizerUserId(supabase);

  // Idempotency guard
  const existing = await supabase
    .from("events")
    .select("id")
    .eq("is_mock", true)
    .limit(1);
  if ((existing.data ?? []).length > 0) {
    // Self-heal: previous seeds left created_by=null, which makes
    // /dashboard empty for the demo org. Backfill any orphans.
    if (demoOrgUserId) {
      await supabase
        .from("events")
        .update({ created_by: demoOrgUserId })
        .eq("is_mock", true)
        .is("created_by", null);
    }
    const stats = await getMockDataStats();
    return { success: true, data: stats };
  }

  const rng = makeRng(20260418);

  try {
    // 1. Mock season ─────────────────────────────────────────────────────
    const { data: season, error: seasonErr } = await supabase
      .schema("yi").from("years")
      .insert({
        display_name: MOCK_SEASON_NAME,
        year: MOCK_SEASON_YEAR,
        is_active: false,
        is_mock: true,
      })
      .select("id")
      .single();
    if (seasonErr || !season) {
      return { success: false, error: seasonErr?.message ?? "Season insert failed" };
    }

    // 2. Mock organizer profile (Chapter EM) ─────────────────────────────
    const { data: organizer } = await supabase
      .from("organizers")
      .insert({
        full_name: "Shri Muthukumar Ranganathan",
        email: "muthukumar.mock@yi-erode.example",
        role: "chapter_em",
        chapter_name: MOCK_CHAPTER_VENUE.chapter,
        zone: "SRTN",
        title: "Chapter EM — Erode (Mock)",
        is_active: true,
        is_mock: true,
      })
      .select("id")
      .single();

    // 3. Schools ────────────────────────────────────────────────────────
    // Post-absorption: schools live in yi.institutions (canonical Yi-wide
    // institution registry). Use existing thalir-affiliated rows for the
    // mock event's city rather than inserting more — yi.institutions has
    // no is_mock column and we don't want mock rows polluting the shared
    // cross-app table.
    const { data: schoolsRaw, error: schoolsErr } = await supabase
      .schema("yi")
      .from("institutions")
      .select("id, name, city, is_thalir")
      .eq("city", MOCK_CHAPTER_VENUE.city)
      .order("name")
      .limit(MOCK_SCHOOLS.length);
    if (schoolsErr || !schoolsRaw || schoolsRaw.length === 0) {
      return {
        success: false,
        error:
          schoolsErr?.message ??
          `No institutions found in yi.institutions for city ${MOCK_CHAPTER_VENUE.city}. Seed yi.institutions first or change MOCK_CHAPTER_VENUE.city.`,
      };
    }
    const schools = schoolsRaw;

    // 4. Chapter event ──────────────────────────────────────────────────
    const chapterDay1 = daysFromToday(-1);
    const chapterDay2 = daysFromToday(0);

    const { data: chapterEvent, error: chapterEventErr } = await supabase
      .from("events")
      .insert({
        yi_year_id: season.id,
        name: MOCK_CHAPTER_EVENT_NAME,
        level: "chapter",
        status: "day2_live",
        chapter_name: MOCK_CHAPTER_VENUE.chapter,
        city: MOCK_CHAPTER_VENUE.city,
        state: MOCK_CHAPTER_VENUE.state,
        zone: "SRTN",
        day1_date: chapterDay1,
        day2_date: chapterDay2,
        venue_name: MOCK_CHAPTER_VENUE.name,
        venue_address: MOCK_CHAPTER_VENUE.address,
        central_agenda:
          "Youth-led Climate Resilience in Tamil Nadu — a demo central agenda topic",
        oath_text: MOCK_OATH_TEXT,
        max_participants: 170,
        allocation_locked: true,
        ingestion_enabled: true,
        fee_per_participant_inr: 399,
        chapter_em_id: organizer?.id ?? null,
        created_by: demoOrgUserId,
        is_mock: true,
      })
      .select("id")
      .single();
    if (chapterEventErr || !chapterEvent) {
      return {
        success: false,
        error: chapterEventErr?.message ?? "Chapter event insert failed",
      };
    }

    // 5. 30 people + 30 participants ────────────────────────────────────
    const people: Array<{ id: string; full_name: string; phone: string; school_idx: number }> =
      [];
    const peopleInserts: Array<WithMock<Database["yip"]["Tables"]["contestants"]["Insert"]>> =
      [];
    for (let i = 0; i < 30; i++) {
      const isMale = i % 2 === 0;
      const name = isMale
        ? MALE_NAMES[i % MALE_NAMES.length]!
        : FEMALE_NAMES[i % FEMALE_NAMES.length]!;
      const schoolIdx = i % schools.length;
      const school = schools[schoolIdx]!;
      const phone = mockPhone(i + 1);
      peopleInserts.push({
        full_name: `${MOCK_MARKER} ${name}`,
        phone,
        parent_phone: mockPhone(i + 1001),
        email: `student${i + 1}.mock@example.test`,
        class: 9 + (i % 4),
        section: ["A", "B", "C"][i % 3],
        school_id: school.id,
        school_name: school.name,
        home_state: "Tamil Nadu",
        city: school.city ?? MOCK_CHAPTER_VENUE.city,
        is_active: true,
        notes: mockNote(`Seeded participant #${i + 1}`),
        is_mock: true,
      });
    }
    const { data: peopleRows, error: peopleErr } = await supabase
      .from("contestants")
      .insert(peopleInserts)
      .select("id, full_name, phone");
    if (peopleErr || !peopleRows) {
      return { success: false, error: peopleErr?.message ?? "People insert failed" };
    }
    for (let i = 0; i < peopleRows.length; i++) {
      people.push({
        id: peopleRows[i]!.id,
        full_name: peopleRows[i]!.full_name,
        phone: peopleRows[i]!.phone ?? mockPhone(i + 1),
        school_idx: i % schools.length,
      });
    }

    // 6. Build participants with roles ─────────────────────────────────
    // Role/side plan: 30 slots. 1 Speaker, 1 Deputy Speaker,
    // 1 PM, 1 Dep PM, 3 Cabinet Ministers, 9 Ruling MPs = 16 Ruling
    // 1 LoO, 3 Shadow Ministers, 9 Opposition MPs, 1 Independent MP = 14 Opposition-side(ish)
    type ParticipantPlan = {
      role: Database["public"]["Enums"]["parliament_role"];
      side: Database["public"]["Enums"]["party_side"] | null;
      ministry: Database["public"]["Enums"]["ministry_type"] | null;
    };
    const MINISTRIES: Database["public"]["Enums"]["ministry_type"][] = [
      "home",
      "finance",
      "education",
      "health",
      "women_child",
      "disaster_management",
      "youth_sports",
      "it_digital",
    ];
    const plan: ParticipantPlan[] = [
      { role: "speaker", side: null, ministry: null },
      { role: "deputy_speaker", side: null, ministry: null },
      { role: "prime_minister", side: "ruling", ministry: null },
      { role: "deputy_prime_minister", side: "ruling", ministry: null },
      { role: "cabinet_minister", side: "ruling", ministry: "home" },
      { role: "cabinet_minister", side: "ruling", ministry: "finance" },
      { role: "cabinet_minister", side: "ruling", ministry: "education" },
      { role: "mp", side: "ruling", ministry: null },
      { role: "mp", side: "ruling", ministry: null },
      { role: "mp", side: "ruling", ministry: null },
      { role: "mp", side: "ruling", ministry: null },
      { role: "mp", side: "ruling", ministry: null },
      { role: "mp", side: "ruling", ministry: null },
      { role: "mp", side: "ruling", ministry: null },
      { role: "mp", side: "ruling", ministry: null },
      { role: "mp", side: "ruling", ministry: null },
      { role: "leader_of_opposition", side: "opposition", ministry: null },
      { role: "shadow_minister", side: "opposition", ministry: "home" },
      { role: "shadow_minister", side: "opposition", ministry: "finance" },
      { role: "shadow_minister", side: "opposition", ministry: "education" },
      { role: "mp", side: "opposition", ministry: null },
      { role: "mp", side: "opposition", ministry: null },
      { role: "mp", side: "opposition", ministry: null },
      { role: "mp", side: "opposition", ministry: null },
      { role: "mp", side: "opposition", ministry: null },
      { role: "mp", side: "opposition", ministry: null },
      { role: "mp", side: "opposition", ministry: null },
      { role: "mp", side: "opposition", ministry: null },
      { role: "mp", side: "opposition", ministry: null },
      { role: "independent_mp", side: null, ministry: null },
    ];

    const TN_CONSTITUENCIES = [
      "Chennai Central",
      "Coimbatore",
      "Erode",
      "Salem",
      "Madurai",
      "Tiruchirappalli",
      "Vellore",
      "Tirunelveli",
      "Dindigul",
      "Thanjavur",
      "Krishnagiri",
      "Namakkal",
      "Karur",
      "Pollachi",
      "Perambalur",
    ];
    const COMMITTEES = [
      "Ministry of Education",
      "Ministry of Finance",
      "Ministry of Health & Family Welfare",
      "Ministry of Environment",
      "Ministry of Electronics & IT",
    ];

    const participantInserts: Array<
      WithMock<Database["yip"]["Tables"]["participants"]["Insert"]>
    > = [];
    for (let i = 0; i < 30; i++) {
      const p = plan[i]!;
      const person = people[i]!;
      const school = schools[person.school_idx]!;
      const committeeIdx = i % COMMITTEES.length;
      participantInserts.push({
        event_id: chapterEvent.id,
        person_id: person.id,
        full_name: person.full_name,
        school_name: school.name,
        school_id: school.id,
        class: 9 + (i % 4),
        section: ["A", "B", "C"][i % 3],
        phone: person.phone,
        parent_phone: mockPhone(i + 1001),
        email: `student${i + 1}.mock@example.test`,
        city: school.city ?? MOCK_CHAPTER_VENUE.city,
        home_state: "Tamil Nadu",
        access_code: genAccessCode(rng, "M"),
        party_side: p.side,
        parliament_role: p.role,
        ministry: p.ministry,
        constituency_name:
          p.role === "mp" || p.role === "independent_mp"
            ? TN_CONSTITUENCIES[i % TN_CONSTITUENCIES.length]
            : null,
        constituency_state:
          p.role === "mp" || p.role === "independent_mp" ? "Tamil Nadu" : null,
        committee_name: COMMITTEES[committeeIdx],
        committee_number: committeeIdx + 1,
        serial_no: i + 1,
        checked_in: true,
        checked_in_at: new Date(Date.now() - 3600_000 * (2 + (i % 8))).toISOString(),
        qualified_for_next: false,
        is_mock: true,
      });
    }
    type MockParticipantRow = {
      id: string;
      person_id: string | null;
      full_name: string;
      parliament_role: Database["public"]["Enums"]["parliament_role"] | null;
      party_side: Database["public"]["Enums"]["party_side"] | null;
      ministry: Database["public"]["Enums"]["ministry_type"] | null;
      serial_no: number | null;
      school_name: string;
    };
    const { data: rawParticipantsRows, error: participantsErr } = await supabase
      .from("participants")
      .insert(participantInserts)
      .select(
        "id, person_id, full_name, parliament_role, party_side, ministry, serial_no, school_name"
      );
    if (participantsErr || !rawParticipantsRows) {
      return {
        success: false,
        error: participantsErr?.message ?? "Participants insert failed",
      };
    }
    const participantsRows: MockParticipantRow[] = rawParticipantsRows as MockParticipantRow[];

    // 7. Parties ───────────────────────────────────────────────────────
    const rulingLeader = participantsRows.find(
      (p) => p.parliament_role === "prime_minister"
    );
    const oppositionLeader = participantsRows.find(
      (p) => p.parliament_role === "leader_of_opposition"
    );

    const { data: parties, error: partiesErr } = await supabase
      .from("parties")
      .insert([
        {
          event_id: chapterEvent.id,
          name: "Bharat Progressive Front",
          side: "ruling",
          party_number: 1,
          tagline: "Building a stronger, greener Bharat",
          manifesto: {
            pillars: [
              "Jobs for every youth — skill to scale",
              "Green growth — net-zero Tamil Nadu by 2045",
              "Digital villages — broadband to every panchayat",
            ],
            note: `${MOCK_MARKER} Demo manifesto for presentation`,
          },
          symbol_url: null,
          party_leader_id: rulingLeader?.id ?? null,
          is_mock: true,
        },
        {
          event_id: chapterEvent.id,
          name: "National Unity Alliance",
          side: "opposition",
          party_number: 2,
          tagline: "Unity. Dignity. Opportunity.",
          manifesto: {
            pillars: [
              "Transparent governance — citizen audits for every scheme",
              "Education first — double the teacher-student ratio",
              "Farmer welfare — MSP guarantee and crop insurance",
            ],
            note: `${MOCK_MARKER} Demo manifesto for presentation`,
          },
          symbol_url: null,
          party_leader_id: oppositionLeader?.id ?? null,
          is_mock: true,
        },
      ])
      .select("id, side, name");
    if (partiesErr || !parties) {
      return { success: false, error: partiesErr?.message ?? "Parties insert failed" };
    }
    type PartyRow = {
      id: string;
      side: Database["public"]["Enums"]["party_side"];
      name: string;
    };
    const partyRows: PartyRow[] = parties as PartyRow[];
    const rulingParty = partyRows.find((p) => p.side === "ruling")!;
    const oppositionParty = partyRows.find((p) => p.side === "opposition")!;

    // Back-link participants to their parties
    await supabase
      .from("participants")
      .update({ party_id: rulingParty.id, party_number: 1 })
      .eq("event_id", chapterEvent.id)
      .eq("party_side", "ruling");
    await supabase
      .from("participants")
      .update({ party_id: oppositionParty.id, party_number: 2 })
      .eq("event_id", chapterEvent.id)
      .eq("party_side", "opposition");

    // 8. Jury assignments ──────────────────────────────────────────────
    const juryInserts = MOCK_JURY_NAMES.map((name, idx) => ({
      event_id: chapterEvent.id,
      jury_name: `${MOCK_MARKER} ${name}`,
      access_code: genAccessCode(rng, "J"),
      is_active: true,
      is_mock: true,
    }));
    const { data: rawJurors, error: juryErr } = await supabase
      .from("jury_assignments")
      .insert(juryInserts)
      .select("id, jury_name");
    if (juryErr || !rawJurors) {
      return { success: false, error: juryErr?.message ?? "Jury insert failed" };
    }
    type JurorRow = { id: string; jury_name: string };
    const jurors: JurorRow[] = rawJurors as JurorRow[];

    // 9. Rubrics ────────────────────────────────────────────────────────
    // Pull already-seeded rubrics (one per role). We'll just grab active ones.
    const { data: rubricRows } = await supabase
      .from("rubrics")
      .select("id, target_role, total_max, criteria")
      .eq("is_active", true);
    type RubricRow = {
      id: string;
      target_role: Database["public"]["Enums"]["parliament_role"];
      total_max: number;
      criteria: Array<{ key: string; label: string; max_score: number }>;
    };
    const rubricsByRole = new Map<string, RubricRow>();
    for (const r of rubricRows ?? []) {
      rubricsByRole.set(r.target_role as string, {
        id: r.id,
        target_role: r.target_role,
        total_max: r.total_max,
        criteria: (r.criteria as RubricRow["criteria"]) ?? [],
      });
    }
    // Fallback: MP rubric for any role we don't have a rubric for.
    const fallbackRubric =
      rubricsByRole.get("mp") ?? rubricsByRole.values().next().value ?? null;

    // 10. Scored agenda sessions + per-session scores ────────────────────
    // The /90 academic model (results.ts) attributes each score to a SCOREABLE
    // agenda session and weights it via yip.session_parameters (resolved by
    // session_key). The old seeder wrote scores with NO agenda_item_id, so
    // seeded events computed to ZERO. Fix: create the academic sessions with
    // REAL session_keys (so weights + namespaced dims resolve) and score every
    // delegate across them, stamping agenda_item_id + the session's own dims.
    const { data: sessionParamRows } = await supabase
      .from("session_parameters")
      .select("session_key, agenda_type, total_max, session_weight, parameters")
      .eq("is_active", true)
      .order("display_order");
    type SpRow = {
      session_key: string;
      agenda_type: string | null;
      total_max: number;
      session_weight: number;
      parameters: Array<{ key: string; max_score: number }> | null;
    };
    // Academic sessions = real weight (>1). The two weight-1 leadership sessions
    // feed position points, not the academic /90, so they're left out here.
    const academicSessions = ((sessionParamRows ?? []) as SpRow[]).filter(
      (s) => Number(s.session_weight) > 1
    );
    const titleize = (k: string) =>
      k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

    const { data: agendaCreated } = await supabase
      .from("agenda")
      .insert(
        academicSessions.map((s, i) => ({
          event_id: chapterEvent.id,
          day: 1,
          sequence_order: i + 1,
          title: titleize(s.session_key),
          agenda_type: s.agenda_type ?? "general",
          session_key: s.session_key,
          is_scoreable: true,
        }))
      )
      .select("id, session_key");

    // Pair each created session with its scoring dims (from session_parameters).
    const spByKey = new Map(academicSessions.map((s) => [s.session_key, s]));
    const scoredSessions = (
      (agendaCreated ?? []) as Array<{ id: string; session_key: string }>
    ).map((a) => {
      const sp = spByKey.get(a.session_key);
      const dims = (sp?.parameters ?? []).filter(
        (p) => p && typeof p.key === "string" && Number(p.max_score) > 0
      );
      return { id: a.id, total_max: sp?.total_max ?? 0, dims };
    });

    const scoreInserts: Array<WithMock<Database["yip"]["Tables"]["scores"]["Insert"]>> =
      [];
    const participantAvg = new Map<string, number>();
    for (let pIdx = 0; pIdx < participantsRows.length; pIdx++) {
      const participant = participantsRows[pIdx]!;
      // rubric_id stays populated from the role rubric (the column is kept) even
      // though the /90 model now resolves dims + weights from session_parameters.
      const rubric =
        rubricsByRole.get(participant.parliament_role ?? "mp") ?? fallbackRubric;
      if (!rubric) continue;

      // Per-participant "ability" modifier — some are stronger, some weaker.
      const ability = 0.75 + rng() * 0.2; // 0.75 .. 0.95

      let fracSum = 0;
      let fracCount = 0;
      for (let sIdx = 0; sIdx < scoredSessions.length; sIdx++) {
        const sess = scoredSessions[sIdx]!;
        if (sess.dims.length === 0) continue;
        for (let jIdx = 0; jIdx < jurors.length; jIdx++) {
          const juror = jurors[jIdx]!;
          const criteriaScores: Record<string, number> = {};
          let total = 0;
          for (const d of sess.dims) {
            // Jitter each dimension ±10% around ability, clamped.
            const jitter = (rng() - 0.5) * 0.2;
            const pct = Math.min(1, Math.max(0.4, ability + jitter));
            const raw = Number(d.max_score) * pct;
            const rounded = Math.round(raw * 2) / 2; // half-points for realism
            criteriaScores[d.key] = rounded;
            total += rounded;
          }
          total = Math.round(total * 100) / 100;
          if (sess.total_max > 0) {
            fracSum += total / sess.total_max;
            fracCount += 1;
          }

          // ~15% drafts on one juror+session combo so the "N drafts" indicator
          // has something to show.
          const isDraft = jIdx === 3 && (pIdx + sIdx) % 9 === 0;
          scoreInserts.push({
            event_id: chapterEvent.id,
            participant_id: participant.id,
            jury_assignment_id: juror.id,
            agenda_item_id: sess.id,
            rubric_id: rubric.id,
            criteria_scores: criteriaScores,
            total_score: total,
            status: isDraft ? "draft" : "submitted",
            submitted_at: isDraft
              ? null
              : new Date(Date.now() - 3600_000 * (6 - jIdx)).toISOString(),
            comments:
              isDraft || rng() > 0.6
                ? null
                : `${MOCK_MARKER} ${
                    [
                      "Strong grasp of the issue.",
                      "Could improve delivery confidence.",
                      "Very articulate — well researched.",
                      "Needed to engage more with opposition.",
                      "Excellent parliamentary decorum.",
                    ][Math.floor(rng() * 5)]
                  }`,
            is_mock: true,
          });
        }
      }
      participantAvg.set(
        participant.id,
        fracCount > 0 ? (fracSum / fracCount) * 100 : 0
      );
    }
    const { error: scoresErr } = await supabase
      .from("scores")
      .insert(scoreInserts);
    if (scoresErr) {
      return { success: false, error: `Scores insert: ${scoresErr.message}` };
    }

    // 11. Results ──────────────────────────────────────────────────────
    // Rank by avg (descending) and assign qualifies_next to top 10.
    const sortedParticipants = [...participantsRows].sort((a, b) => {
      const av = participantAvg.get(a.id) ?? 0;
      const bv = participantAvg.get(b.id) ?? 0;
      return bv - av;
    });
    const awardMap = new Map<string, string>(); // participant_id -> "award1, award2"
    for (let i = 0; i < HANDBOOK_AWARDS.length && i < sortedParticipants.length; i++) {
      const award = HANDBOOK_AWARDS[i]!;
      const participant = sortedParticipants[i]!;
      awardMap.set(participant.id, award.label);
    }

    const resultInserts: Array<Database["yip"]["Tables"]["results"]["Insert"]> =
      sortedParticipants.map((p, idx) => ({
        event_id: chapterEvent.id,
        participant_id: p.id,
        rank: idx + 1,
        avg_score: Number((participantAvg.get(p.id) ?? 0).toFixed(2)),
        jury_count: jurors.length,
        award_category: awardMap.get(p.id) ?? null,
        qualifies_next: idx < 10,
        score_breakdown: { note: `${MOCK_MARKER} demo` },
        computed_at: new Date().toISOString(),
      }));
    await supabase.from("results").insert(resultInserts);

    // Mark top 10 qualified_for_next=true
    const top10Ids = sortedParticipants.slice(0, 10).map((p) => p.id);
    if (top10Ids.length > 0) {
      await supabase
        .from("participants")
        .update({ qualified_for_next: true })
        .in("id", top10Ids);
    }

    // Also stamp event results_published
    await supabase
      .from("events")
      .update({ results_published_at: new Date().toISOString(), scores_locked: true })
      .eq("id", chapterEvent.id);

    // 12. Parliamentary motions (5) ─────────────────────────────────────
    const opposMp = participantsRows.find(
      (p) => p.parliament_role === "mp" && p.party_side === "opposition"
    );
    const rulingMp = participantsRows.find(
      (p) => p.parliament_role === "mp" && p.party_side === "ruling"
    );
    const speaker = participantsRows.find(
      (p) => p.parliament_role === "speaker"
    );
    const pm = participantsRows.find(
      (p) => p.parliament_role === "prime_minister"
    );

    const motionInserts: Array<
      WithMock<Database["yip"]["Tables"]["motions"]["Insert"]>
    > = [
      {
        event_id: chapterEvent.id,
        motion_type: "adjournment",
        subject: "Flood relief delays in Erode district",
        details: `${MOCK_MARKER} Urgent — demanding immediate discussion on delays in relief disbursal.`,
        raised_by_id: opposMp?.id ?? null,
        raised_by_name: opposMp?.full_name ?? null,
        raised_by_party_side: "opposition",
        raised_by_role: "mp",
        directed_to_ministry: "disaster_management",
        status: "rejected",
        outcome: "rejected",
        speaker_ruling: "Not admitted — matter already under debate tomorrow.",
        ruled_by: speaker?.id ?? null,
        ruled_at: new Date().toISOString(),
        is_mock: true,
      },
      {
        event_id: chapterEvent.id,
        motion_type: "calling_attention",
        subject: "Rising adolescent mental-health cases in Tamil Nadu",
        details: `${MOCK_MARKER} Seeking Minister's statement on helpline coverage.`,
        raised_by_id: rulingMp?.id ?? null,
        raised_by_name: rulingMp?.full_name ?? null,
        raised_by_party_side: "ruling",
        raised_by_role: "mp",
        directed_to_ministry: "health",
        status: "resolved",
        outcome: "resolved",
        minister_response:
          `${MOCK_MARKER} Minister noted the concern and committed to a state-wide expansion plan within 6 months.`,
        resolved_at: new Date().toISOString(),
        is_mock: true,
      },
      {
        event_id: chapterEvent.id,
        motion_type: "breach_of_privilege",
        subject: "Alleged misquoting of Opposition Leader in state media",
        details: `${MOCK_MARKER} Claim that a public broadcaster selectively edited a floor speech.`,
        raised_by_id: oppositionLeader?.id ?? null,
        raised_by_name: oppositionLeader?.full_name ?? null,
        raised_by_party_side: "opposition",
        raised_by_role: "leader_of_opposition",
        status: "admitted",
        outcome: null,
        speaker_note: "Referred to the Privileges Committee for review.",
        is_mock: true,
      },
      {
        event_id: chapterEvent.id,
        motion_type: "no_confidence",
        subject: "No-confidence motion against the Council of Ministers",
        details: `${MOCK_MARKER} Alleging failure on unemployment targets.`,
        raised_by_id: oppositionLeader?.id ?? null,
        raised_by_name: oppositionLeader?.full_name ?? null,
        raised_by_party_side: "opposition",
        raised_by_role: "leader_of_opposition",
        status: "resolved",
        outcome: "rejected",
        votes_for: 13,
        votes_against: 16,
        votes_abstain: 1,
        resolved_at: new Date().toISOString(),
        is_mock: true,
      },
      {
        event_id: chapterEvent.id,
        motion_type: "short_duration",
        subject: "Short-duration debate on digital literacy in rural schools",
        details: `${MOCK_MARKER} Requesting a 2-hour debate window.`,
        raised_by_id: rulingMp?.id ?? null,
        raised_by_name: rulingMp?.full_name ?? null,
        raised_by_party_side: "ruling",
        raised_by_role: "mp",
        directed_to_ministry: "it_digital",
        status: "discussing",
        outcome: null,
        is_mock: true,
      },
    ];
    await supabase.from("motions").insert(motionInserts);

    // 13. Bills (2) ──────────────────────────────────────────────────────
    const rulingMps = participantsRows.filter(
      (p) => p.party_side === "ruling" && p.parliament_role === "mp"
    );
    const oppMps = participantsRows.filter(
      (p) => p.party_side === "opposition" && p.parliament_role === "mp"
    );

    const billInserts: Array<WithMock<Database["yip"]["Tables"]["bills"]["Insert"]>> = [
      {
        event_id: chapterEvent.id,
        title: "The Young India Digital Literacy Bill, 2026",
        party_side: "ruling",
        problem_statement:
          "Rural youth lack structured access to digital skill-building programs.",
        objective:
          "Establish a tiered digital-literacy curriculum across government schools, funded by a 0.1% digital-services cess.",
        provisions: {
          clauses: [
            "Mandatory digital-literacy module from Class 6 onwards",
            "Free device access in government higher-secondary schools",
            "Teacher upskilling via a state Digital Academy",
          ],
          note: `${MOCK_MARKER}`,
        },
        expected_impact:
          "Estimated 2.8M students gain verified digital-literacy credentials in 3 years.",
        implementation:
          "Phased rollout: Year 1 pilot (5 districts), Year 2 state-wide Class 9-12, Year 3 Class 6-8.",
        lead_drafter: rulingMps[0]?.id ?? null,
        policy_researcher: rulingMps[1]?.id ?? null,
        presenter_1: pm?.id ?? null,
        presenter_2: rulingMps[2]?.id ?? null,
        status: "passed",
        votes_for: 17,
        votes_against: 12,
        votes_abstain: 1,
        is_mock: true,
      },
      {
        event_id: chapterEvent.id,
        title: "The Public Health Transparency Bill, 2026",
        party_side: "opposition",
        problem_statement:
          "Citizens lack visibility into district-level health scheme utilisation.",
        objective:
          "Mandate public dashboards for all centrally-sponsored health schemes at the district level.",
        provisions: {
          clauses: [
            "Monthly publication of scheme-wise utilisation",
            "Independent audit by a State Health Ombudsman",
            "Citizen grievance redressal within 15 days",
          ],
          note: `${MOCK_MARKER}`,
        },
        expected_impact: "Expected 30% improvement in scheme uptake through transparency.",
        implementation: "Rollout within 18 months; bi-annual public review.",
        lead_drafter: oppMps[0]?.id ?? null,
        policy_researcher: oppMps[1]?.id ?? null,
        presenter_1: oppositionLeader?.id ?? null,
        presenter_2: oppMps[2]?.id ?? null,
        status: "rejected",
        votes_for: 13,
        votes_against: 16,
        votes_abstain: 1,
        is_mock: true,
      },
    ];
    await supabase.from("bills").insert(billInserts);

    // 14. Questions (10) ────────────────────────────────────────────────
    const questionMinistries: Array<
      Database["public"]["Enums"]["ministry_type"]
    > = [
      "home",
      "finance",
      "education",
      "health",
      "women_child",
      "disaster_management",
      "youth_sports",
      "it_digital",
      "education",
      "health",
    ];
    const questionTemplates = [
      "What is the current backlog of police-recruitment vacancies in Tamil Nadu?",
      "Can the Minister detail the GST compensation received by the state in FY25?",
      "What steps are being taken to address teacher shortages in tribal districts?",
      "What is the status of the district-hospital upgrade programme?",
      "Can the Ministry share outcomes from the adolescent-girls nutrition scheme?",
      "How many flood-evacuation drills were conducted in coastal districts last year?",
      "What is the participation rate of girls in state-level sports scholarships?",
      "Can the Ministry share the broadband coverage percentage for panchayat offices?",
      "What is the district-wise dropout rate in Class 10 for 2025?",
      "What is the latest data on NCD screening coverage in rural areas?",
    ];
    const questionTypes = ["starred", "unstarred"];
    const questionStatuses = ["approved", "answered", "approved", "answered", "pending"];
    const questionInserts: Array<
      WithMock<Database["yip"]["Tables"]["questions"]["Insert"]>
    > = [];
    for (let i = 0; i < 10; i++) {
      const submitter = participantsRows[(i * 3 + 5) % participantsRows.length]!;
      const type = questionTypes[i % 2]!;
      const status = questionStatuses[i % questionStatuses.length]!;
      questionInserts.push({
        event_id: chapterEvent.id,
        submitted_by: submitter.id,
        question_text: `${MOCK_MARKER} ${questionTemplates[i]!}`,
        directed_to_ministry: questionMinistries[i]!,
        question_type: type,
        status,
        answer_summary:
          status === "answered"
            ? `${MOCK_MARKER} Minister tabled a written reply citing data up to Q3 FY25.`
            : null,
        queue_order: i + 1,
        is_mock: true,
      });
    }
    await supabase.from("questions").insert(questionInserts);

    // 15. Fees (30 — 20 paid, 10 unpaid) ───────────────────────────────
    const feeInserts: Array<
      WithMock<Database["yip"]["Tables"]["fees"]["Insert"]>
    > = participantsRows.map((p, idx) => {
      const paid = idx < 20;
      return {
        event_id: chapterEvent.id,
        participant_id: p.id,
        amount_inr: 399,
        includes_gst: true,
        is_paid: paid,
        paid_via: paid ? "MyCII" : null,
        paid_at: paid
          ? new Date(Date.now() - 86400_000 * (3 + (idx % 5))).toISOString()
          : null,
        payment_link: paid ? null : "https://members.cii.in/mock-payment-link",
        transaction_ref: paid ? `MOCK-TXN-${10000 + idx}` : null,
        note: mockNote(paid ? "Paid via MyCII (demo)" : "Pending payment (demo)"),
        is_mock: true,
      };
    });
    await supabase.from("fees").insert(feeInserts);

    // 16. Volunteers (10, 8 YUVA + 2 external) ─────────────────────────
    const stations: Array<Database["public"]["Enums"]["volunteer_station"]> = [
      "registration",
      "help_desk",
      "av_tech",
      "hospitality",
      "stage_manager",
      "photographer",
      "runner",
    ];
    const volInserts: Array<
      WithMock<Database["yip"]["Tables"]["volunteers"]["Insert"]>
    > = MOCK_VOLUNTEER_NAMES.map((name, idx) => ({
      event_id: chapterEvent.id,
      full_name: `${MOCK_MARKER} ${name}`,
      phone: mockPhone(idx + 2001),
      email: `volunteer${idx + 1}.mock@example.test`,
      station: stations[idx % stations.length]!,
      shift: idx < 5 ? "day1_morning" : "day2_morning",
      tshirt_size: ["S", "M", "L", "XL"][idx % 4],
      is_yuva: idx < 8,
      arrived: idx < 9,
      arrived_at:
        idx < 9
          ? new Date(Date.now() - 3600_000 * (12 + idx)).toISOString()
          : null,
      notes: mockNote(`Volunteer #${idx + 1}`),
      is_mock: true,
    }));
    await supabase.from("volunteers").insert(volInserts);

    // 17. Feedback (15) ────────────────────────────────────────────────
    const feedbackInserts: Array<
      WithMock<Database["yip"]["Tables"]["feedback"]["Insert"]>
    > = [];
    // 10 participants
    for (let i = 0; i < 10; i++) {
      const p = participantsRows[i * 3]!;
      feedbackInserts.push({
        event_id: chapterEvent.id,
        respondent_type: "participant",
        respondent_name: p.full_name,
        respondent_participant_id: p.id,
        overall_rating: 4 + (i % 2),
        content_rating: 4 + (i % 2),
        organization_rating: 4,
        nps_score: 8 + (i % 3),
        would_recommend: true,
        what_worked: `${MOCK_MARKER} Loved the jury feedback and the motion discussions.`,
        what_didnt_work: `${MOCK_MARKER} Lunch queue was long on Day 1.`,
        suggestions: `${MOCK_MARKER} More time for Zero Hour, please.`,
        biggest_takeaway: `${MOCK_MARKER} Learnt how to draft an amendment.`,
        learned_something: `${MOCK_MARKER} Procedural motions and their nuances.`,
        submitted_at: new Date().toISOString(),
        is_mock: true,
      });
    }
    // 2 volunteers
    for (let i = 0; i < 2; i++) {
      feedbackInserts.push({
        event_id: chapterEvent.id,
        respondent_type: "volunteer",
        respondent_name: `${MOCK_MARKER} ${MOCK_VOLUNTEER_NAMES[i]!}`,
        overall_rating: 5,
        content_rating: 5,
        organization_rating: 4,
        nps_score: 9,
        would_recommend: true,
        what_worked: `${MOCK_MARKER} Briefings were clear.`,
        suggestions: `${MOCK_MARKER} Provide station rotation to reduce fatigue.`,
        submitted_at: new Date().toISOString(),
        is_mock: true,
      });
    }
    // 2 organizers
    for (let i = 0; i < 2; i++) {
      feedbackInserts.push({
        event_id: chapterEvent.id,
        respondent_type: "organizer",
        respondent_name: `${MOCK_MARKER} Organizer ${i + 1}`,
        overall_rating: 5,
        content_rating: 5,
        organization_rating: 5,
        nps_score: 10,
        would_recommend: true,
        what_worked: `${MOCK_MARKER} Platform made control-panel easy.`,
        suggestions: `${MOCK_MARKER} Add a dark-mode for the projector view.`,
        submitted_at: new Date().toISOString(),
        is_mock: true,
      });
    }
    // 1 jury
    feedbackInserts.push({
      event_id: chapterEvent.id,
      respondent_type: "jury",
      respondent_name: `${MOCK_MARKER} ${MOCK_JURY_NAMES[0]!}`,
      overall_rating: 5,
      content_rating: 4,
      organization_rating: 5,
      nps_score: 9,
      would_recommend: true,
      what_worked: `${MOCK_MARKER} Mobile scoring was intuitive.`,
      suggestions: `${MOCK_MARKER} Add a 'needs-second-opinion' flag per criterion.`,
      submitted_at: new Date().toISOString(),
      is_mock: true,
    });
    await supabase.from("feedback").insert(feedbackInserts);

    // 18. Event media (5) ──────────────────────────────────────────────
    const mediaCaptions = [
      "Inaugural session — oath-taking",
      "Zero Hour — Opposition raises flood-relief concerns",
      "Question Hour — Minister for Education responds",
      "Bill presentation — Digital Literacy Bill debate",
      "Vote of Thanks — closing ceremony",
    ];
    const mediaInserts: Array<
      WithMock<Database["yip"]["Tables"]["media"]["Insert"]>
    > = mediaCaptions.map((caption, idx) => ({
      event_id: chapterEvent.id,
      kind: "photo",
      storage_path: `mock/event/${chapterEvent.id}/photo-${idx + 1}.jpg`,
      file_name: `mock-photo-${idx + 1}.jpg`,
      mime_type: "image/jpeg",
      public_url: null,
      caption: `${MOCK_MARKER} ${caption}`,
      photographer_name: `${MOCK_MARKER} ${MOCK_VOLUNTEER_NAMES[5]!}`,
      is_cover: idx === 0,
      sort_order: idx,
      tags: ["mock", idx === 0 ? "cover" : "proceedings"],
      visibility: idx < 2 ? "public" : "yi_internal",
      uploaded_at: new Date().toISOString(),
      is_mock: true,
    }));
    await supabase.from("media").insert(mediaInserts);

    // 19. Branding compliance checks (3) ────────────────────────────────
    await supabase.from("brand_checks").insert([
      {
        event_id: chapterEvent.id,
        rule_key: "yi_logo_placement",
        status: "verified",
        checked_at: new Date().toISOString(),
        notes: mockNote("Yi logo verified on all banners"),
        is_mock: true,
      },
      {
        event_id: chapterEvent.id,
        rule_key: "thalir_co_branding",
        status: "verified",
        checked_at: new Date().toISOString(),
        notes: mockNote("Thalir co-brand verified on registration desk"),
        is_mock: true,
      },
      {
        event_id: chapterEvent.id,
        rule_key: "cii_attribution",
        status: "pending_evidence",
        notes: mockNote("Awaiting stage backdrop photo"),
        is_mock: true,
      },
    ]);

    // 20. Invitation approvals (1) ──────────────────────────────────────
    await supabase.from("invitations").insert({
      event_id: chapterEvent.id,
      invitee_name: `${MOCK_MARKER} Hon. Mock MP`,
      invitee_role: "Chief Guest",
      invitation_category: "political",
      approval_status: "approved",
      approved_by_national: true,
      approval_note: mockNote("Approved for demo; real approvals go through Yi National."),
      submitted_for_approval_at: new Date(Date.now() - 86400_000 * 7).toISOString(),
      approved_at: new Date(Date.now() - 86400_000 * 5).toISOString(),
      is_mock: true,
    });

    // 21. Registrations (30 — approved, linked to participants) ─────────
    const registrationInserts: Array<
      WithMock<Database["yip"]["Tables"]["registrations"]["Insert"]>
    > = participantsRows.map((p, idx) => ({
      event_id: chapterEvent.id,
      participant_id: p.id,
      full_name: p.full_name,
      school_name: p.school_name,
      class: 9 + (idx % 4),
      section: ["A", "B", "C"][idx % 3],
      phone: mockPhone(idx + 1),
      parent_phone: mockPhone(idx + 1001),
      email: `student${idx + 1}.mock@example.test`,
      city: MOCK_CHAPTER_VENUE.city,
      home_state: "Tamil Nadu",
      source: "platform_direct",
      status: "approved",
      raw_payload: {
        marker: MOCK_MARKER,
        seeded_via: "mock-data-seeder",
      },
      submission_batch: "MOCK-BATCH-001",
      is_mock: true,
    }));
    await supabase.from("registrations").insert(registrationInserts);

    // 22. Regional event + 1 promoted participant ──────────────────────
    const { data: regionalEvent } = await supabase
      .from("events")
      .insert({
        yi_year_id: season.id,
        name: MOCK_REGIONAL_EVENT_NAME,
        level: "regional",
        status: "results_published",
        chapter_name: MOCK_REGIONAL_VENUE.chapter,
        city: MOCK_REGIONAL_VENUE.city,
        state: MOCK_REGIONAL_VENUE.state,
        zone: "SRTN",
        day1_date: daysFromToday(20),
        day2_date: daysFromToday(21),
        venue_name: MOCK_REGIONAL_VENUE.name,
        venue_address: MOCK_REGIONAL_VENUE.address,
        oath_text: MOCK_OATH_TEXT,
        max_participants: 170,
        allocation_locked: true,
        ingestion_enabled: true,
        created_by: demoOrgUserId,
        is_mock: true,
      })
      .select("id")
      .single();

    let regionalParticipant: { id: string; full_name: string } | null = null;
    let nationalParticipant: { id: string; full_name: string } | null = null;

    if (regionalEvent && sortedParticipants.length > 0) {
      const top1 = sortedParticipants[0]!;
      const rubric = rubricsByRole.get(top1.parliament_role ?? "mp") ?? fallbackRubric;

      const { data: rParts } = await supabase
        .from("participants")
        .insert({
          event_id: regionalEvent.id,
          person_id: top1.person_id,
          full_name: top1.full_name,
          school_name: top1.school_name,
          school_id: null,
          class: 10,
          section: "A",
          phone: mockPhone(9001),
          email: "regional1.mock@example.test",
          home_state: "Tamil Nadu",
          city: MOCK_REGIONAL_VENUE.city,
          access_code: genAccessCode(rng, "R"),
          party_side: "ruling",
          parliament_role: "mp",
          constituency_name: "Chennai Central",
          constituency_state: "Tamil Nadu",
          committee_name: "Ministry of Education",
          committee_number: 1,
          serial_no: 1,
          checked_in: true,
          qualified_for_next: true,
          is_mock: true,
        })
        .select("id, full_name")
        .single();
      regionalParticipant = rParts ?? null;

      await supabase.from("promotions").insert({
        source_event_id: chapterEvent.id,
        target_event_id: regionalEvent.id,
        source_participant_id: top1.id,
        target_participant_id: rParts?.id ?? null,
        yi_year_id: season.id,
        full_name: top1.full_name,
        school_name: top1.school_name,
        source_rank: 1,
        source_avg_score: participantAvg.get(top1.id) ?? null,
        source_awards: awardMap.get(top1.id) ?? null,
        promoted_at: new Date(Date.now() - 86400_000 * 2).toISOString(),
        reason: mockNote("Top rank at Chapter → promoted to Regional"),
        is_mock: true,
      });

      // Regional scores — 4 jurors score the promoted delegate across the same
      // academic sessions (with agenda_item_id, so the /90 model counts them).
      if (rParts && rubric && academicSessions.length > 0) {
        const { data: regionalJury } = await supabase
          .from("jury_assignments")
          .insert(
            MOCK_JURY_NAMES.map((name) => ({
              event_id: regionalEvent.id,
              jury_name: `${MOCK_MARKER} ${name}`,
              access_code: genAccessCode(rng, "J"),
              is_active: true,
              is_mock: true,
            }))
          )
          .select("id");

        // Scoreable sessions for the regional event (mirror the chapter set).
        const { data: rAgenda } = await supabase
          .from("agenda")
          .insert(
            academicSessions.map((s, i) => ({
              event_id: regionalEvent.id,
              day: 1,
              sequence_order: i + 1,
              title: titleize(s.session_key),
              agenda_type: s.agenda_type ?? "general",
              session_key: s.session_key,
              is_scoreable: true,
            }))
          )
          .select("id, session_key");
        const rScored = (
          (rAgenda ?? []) as Array<{ id: string; session_key: string }>
        ).map((a) => {
          const sp = spByKey.get(a.session_key);
          const dims = (sp?.parameters ?? []).filter(
            (p) => p && typeof p.key === "string" && Number(p.max_score) > 0
          );
          return { id: a.id, dims };
        });

        const regionalScoreInserts: Array<
          WithMock<Database["yip"]["Tables"]["scores"]["Insert"]>
        > = [];
        for (const j of (regionalJury ?? []) as Array<{ id: string }>) {
          for (const sess of rScored) {
            if (sess.dims.length === 0) continue;
            const criteriaScores: Record<string, number> = {};
            let total = 0;
            for (const d of sess.dims) {
              const pct = 0.85 + (rng() - 0.5) * 0.1;
              const raw = Number(d.max_score) * pct;
              criteriaScores[d.key] = Math.round(raw * 2) / 2;
              total += criteriaScores[d.key]!;
            }
            regionalScoreInserts.push({
              event_id: regionalEvent.id,
              participant_id: rParts.id,
              jury_assignment_id: j.id,
              agenda_item_id: sess.id,
              rubric_id: rubric.id,
              criteria_scores: criteriaScores,
              total_score: Math.round(total * 100) / 100,
              status: "submitted",
              submitted_at: new Date().toISOString(),
              is_mock: true,
            });
          }
        }
        if (regionalScoreInserts.length > 0) {
          await supabase.from("scores").insert(regionalScoreInserts);
        }
      }

      // 23. National event + promotion chain ────────────────────────────
      const { data: nationalEvent } = await supabase
        .from("events")
        .insert({
          yi_year_id: season.id,
          name: MOCK_NATIONAL_EVENT_NAME,
          level: "national",
          status: "registration_closed",
          chapter_name: MOCK_NATIONAL_VENUE.chapter,
          city: MOCK_NATIONAL_VENUE.city,
          state: MOCK_NATIONAL_VENUE.state,
          zone: "NR",
          day1_date: daysFromToday(45),
          day2_date: daysFromToday(46),
          venue_name: MOCK_NATIONAL_VENUE.name,
          venue_address: MOCK_NATIONAL_VENUE.address,
          oath_text: MOCK_OATH_TEXT,
          max_participants: 170,
          allocation_locked: false,
          ingestion_enabled: true,
          created_by: demoOrgUserId,
          is_mock: true,
        })
        .select("id")
        .single();

      if (nationalEvent && rParts) {
        const { data: nPart } = await supabase
          .from("participants")
          .insert({
            event_id: nationalEvent.id,
            person_id: top1.person_id,
            full_name: top1.full_name,
            school_name: top1.school_name,
            class: 10,
            section: "A",
            phone: mockPhone(9002),
            email: "national1.mock@example.test",
            home_state: "Tamil Nadu",
            city: MOCK_NATIONAL_VENUE.city,
            access_code: genAccessCode(rng, "N"),
            party_side: "ruling",
            parliament_role: "cabinet_minister",
            ministry: "education",
            committee_name: "Ministry of Education",
            committee_number: 1,
            serial_no: 1,
            checked_in: false,
            qualified_for_next: false,
            is_mock: true,
          })
          .select("id, full_name")
          .single();
        nationalParticipant = nPart ?? null;

        await supabase.from("promotions").insert({
          source_event_id: regionalEvent.id,
          target_event_id: nationalEvent.id,
          source_participant_id: rParts.id,
          target_participant_id: nPart?.id ?? null,
          yi_year_id: season.id,
          full_name: top1.full_name,
          school_name: top1.school_name,
          source_rank: 1,
          source_avg_score: 88.5,
          source_awards: "Best Parliamentarian",
          promoted_at: new Date().toISOString(),
          reason: mockNote("Top rank at Regional → promoted to National"),
          is_mock: true,
        });
      }
    }

    // 24. Organizer checklist (handful of items for the chapter event) ─
    const checklistInserts: Array<
      Database["yip"]["Tables"]["checklist"]["Insert"]
    > = [
      {
        event_id: chapterEvent.id,
        title: "Venue confirmation letter received",
        description: `${MOCK_MARKER} Demo item`,
        category: "pre_event",
        sequence_order: 1,
        is_completed: true,
        completed_at: new Date(Date.now() - 86400_000 * 10).toISOString(),
      },
      {
        event_id: chapterEvent.id,
        title: "Yi branding kit printed and mounted",
        description: `${MOCK_MARKER} Demo item`,
        category: "pre_event",
        sequence_order: 2,
        is_completed: true,
        completed_at: new Date(Date.now() - 86400_000 * 5).toISOString(),
      },
      {
        event_id: chapterEvent.id,
        title: "Jury briefing completed",
        description: `${MOCK_MARKER} Demo item`,
        category: "day_of",
        sequence_order: 3,
        is_completed: true,
        completed_at: new Date(Date.now() - 3600_000 * 36).toISOString(),
      },
      {
        event_id: chapterEvent.id,
        title: "Post-event media uploaded",
        description: `${MOCK_MARKER} Demo item`,
        category: "post_event",
        sequence_order: 4,
        is_completed: false,
      },
    ];
    await supabase.from("checklist").insert(checklistInserts);

    // 25. Event topic assignments — link any existing central topic ────
    const { data: centralTopic } = await supabase
      .from("topics")
      .select("id")
      .eq("is_active", true)
      .eq("category", "central")
      .limit(1)
      .maybeSingle();
    if (centralTopic) {
      await supabase.from("event_topics").insert({
        event_id: chapterEvent.id,
        topic_id: centralTopic.id,
        is_central: true,
        sequence: 1,
      });
    }

    // Mark person of top1 + regional + national as the "journey person"
    // (already done via person_id linkage).
    void regionalParticipant;
    void nationalParticipant;

    const stats = await getMockDataStats();
    await logAuditAction({
      action_type: "create",
      target_table: "mock_data",
      metadata: { stats, op: "seedMockData" },
    });
    revalidatePath(ADMIN_PATH);
    return { success: true, data: stats };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Seed failed: ${msg}` };
  }
}

// ─── Wipe (all mock) ────────────────────────────────────────────────────

/**
 * Deletes every row tagged is_mock=true, plus rows in tables without the
 * flag that transitively belong to a mock event or mock person.
 *
 * Safety contract:
 *   • Only rows where is_mock=true are deleted directly.
 *   • Child rows in tables without is_mock (results, organizer_checklist,
 *     event_topic_assignments, score_audit_log, agenda_items,
 *     agenda_speakers, votes, vote_sessions, notifications) are only
 *     deleted where their event_id resolves to an is_mock=true event.
 *   • FK order respected so no orphan rows are left behind.
 *   • No UPDATE or DELETE is ever issued without a WHERE clause scoped
 *     to mock rows — never a bare delete.
 */
export async function wipeMockData(): Promise<
  ActionResult<{ deleted: Record<string, number> }>
> {
  const supabaseTyped = await createServiceClient();
  const supabase = db(supabaseTyped);
  const mockEventIds = await listMockEventIds(supabase);
  const mockPersonIds = await listMockPersonIds(supabase);

  const deleted: Record<string, number> = {};

  // Helper: run delete and record count
  const wipe = async (
    table: string,
    action: () => Promise<{ count: number | null; error: { message: string } | null }>
  ) => {
    const { count, error } = await action();
    if (error) throw new Error(`${table}: ${error.message}`);
    deleted[table] = count ?? 0;
  };

  try {
    if (mockEventIds.length > 0) {
      await wipe("votes", async () =>
        supabase.from("votes").delete({ count: "exact" }).in("event_id", mockEventIds)
      );
      await wipe("vote_sessions", async () =>
        supabase
          .from("vote_sessions")
          .delete({ count: "exact" })
          .in("event_id", mockEventIds)
      );
    } else {
      deleted.votes = 0;
      deleted.vote_sessions = 0;
    }

    // score_audit_log → scores must go; audit log has FK to scores so it
    // must be wiped first. It has no event_id and no is_mock.
    // scores (and their audit log) are EVENT-scoped — transitively derived, NOT
    // is_mock-flagged. Collect + delete by mock event_id; filtering on is_mock
    // misses them, leaving event-scoped scores that then block the agenda delete
    // below via scores_agenda_item_id_fkey.
    const { data: mockScoreIds } = await supabase
      .from("scores")
      .select("id")
      .in("event_id", mockEventIds);
    const scoreIds = ((mockScoreIds ?? []) as Array<{ id: string }>).map((s) => s.id);
    if (scoreIds.length > 0) {
      await wipe("score_audit", async () =>
        supabase
          .from("score_audit")
          .delete({ count: "exact" })
          .in("score_id", scoreIds)
      );
    } else {
      deleted.score_audit_log = 0;
    }

    await wipe("scores", async () =>
      supabase.from("scores").delete({ count: "exact" }).in("event_id", mockEventIds)
    );

    if (mockEventIds.length > 0) {
      await wipe("agenda_speakers", async () => {
        const { data: agendaIds } = await supabase
          .from("agenda")
          .select("id")
          .in("event_id", mockEventIds);
        const ids = ((agendaIds ?? []) as Array<{ id: string }>).map((a) => a.id);
        if (ids.length === 0) return { count: 0, error: null };
        return supabase
          .from("agenda_speakers")
          .delete({ count: "exact" })
          .in("agenda_item_id", ids);
      });
      await wipe("agenda", async () =>
        supabase
          .from("agenda")
          .delete({ count: "exact" })
          .in("event_id", mockEventIds)
      );
      // notifications live in the yi_connect schema and carry no event_id /
      // is_mock column — there is nothing event-scoped to wipe here. The old
      // yip-scoped delete targeted a table that doesn't exist
      // ("could not find the table 'yip.notifications'") and aborted the whole
      // wipe mid-way, leaving mock data half-deleted.
      deleted.notifications = 0;
      await wipe("results", async () =>
        supabase
          .from("results")
          .delete({ count: "exact" })
          .in("event_id", mockEventIds)
      );
      await wipe("checklist", async () =>
        supabase
          .from("checklist")
          .delete({ count: "exact" })
          .in("event_id", mockEventIds)
      );
      await wipe("event_topics", async () =>
        supabase
          .from("event_topics")
          .delete({ count: "exact" })
          .in("event_id", mockEventIds)
      );
    } else {
      deleted.agenda_speakers = 0;
      deleted.agenda_items = 0;
      deleted.notifications = 0;
      deleted.results = 0;
      deleted.organizer_checklist = 0;
      deleted.event_topic_assignments = 0;
    }

    await wipe("motions", async () =>
      supabase
        .from("motions")
        .delete({ count: "exact" })
        .eq("is_mock", true)
    );
    await wipe("bills", async () =>
      supabase.from("bills").delete({ count: "exact" }).eq("is_mock", true)
    );
    await wipe("questions", async () =>
      supabase.from("questions").delete({ count: "exact" }).eq("is_mock", true)
    );
    await wipe("fees", async () =>
      supabase
        .from("fees")
        .delete({ count: "exact" })
        .eq("is_mock", true)
    );
    await wipe("volunteers", async () =>
      supabase.from("volunteers").delete({ count: "exact" }).eq("is_mock", true)
    );
    await wipe("feedback", async () =>
      supabase
        .from("feedback")
        .delete({ count: "exact" })
        .eq("is_mock", true)
    );
    await wipe("media", async () =>
      supabase
        .from("media")
        .delete({ count: "exact" })
        .eq("is_mock", true)
    );
    await wipe("promotions", async () =>
      supabase.from("promotions").delete({ count: "exact" }).eq("is_mock", true)
    );
    await wipe("invitations", async () =>
      supabase
        .from("invitations")
        .delete({ count: "exact" })
        .eq("is_mock", true)
    );
    await wipe("brand_checks", async () =>
      supabase
        .from("brand_checks")
        .delete({ count: "exact" })
        .eq("is_mock", true)
    );
    await wipe("jury_assignments", async () =>
      supabase
        .from("jury_assignments")
        .delete({ count: "exact" })
        .eq("is_mock", true)
    );
    await wipe("participants", async () =>
      supabase.from("participants").delete({ count: "exact" }).eq("is_mock", true)
    );
    await wipe("parties", async () =>
      supabase.from("parties").delete({ count: "exact" }).eq("is_mock", true)
    );
    await wipe("registrations", async () =>
      supabase
        .from("registrations")
        .delete({ count: "exact" })
        .eq("is_mock", true)
    );
    await wipe("events", async () =>
      supabase.from("events").delete({ count: "exact" }).eq("is_mock", true)
    );
    // Post-absorption: schools live in yi.institutions (shared, no is_mock).
    // Seeder no longer inserts there, so nothing to wipe. Keeping the named
    // step in the report for traceability.
    await wipe("schools", async () => ({ count: 0, error: null }));
    await wipe("contestants", async () =>
      supabase.from("contestants").delete({ count: "exact" }).eq("is_mock", true)
    );
    void mockPersonIds;
    await wipe("organizers", async () =>
      supabase
        .from("organizers")
        .delete({ count: "exact" })
        .eq("is_mock", true)
    );
    await wipe("years_TODO_SEASONS_DROPPED", async () =>
      supabase.schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */.delete({ count: "exact" }).eq("is_mock", true)
    );

    await logAuditAction({
      action_type: "wipe",
      target_table: "mock_data",
      metadata: { deleted, op: "wipeMockData" },
    });
    revalidatePath(ADMIN_PATH);
    return { success: true, data: { deleted } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Wipe failed after partial delete: ${msg}` };
  }
}

// ─── Wipe single mock event ─────────────────────────────────────────────

export async function wipeMockEvent(
  eventId: string
): Promise<ActionResult<{ deleted: Record<string, number> }>> {
  const supabaseTyped = await createServiceClient();
  const supabase = db(supabaseTyped);

  // Safety: event must be is_mock=true
  const { data: event } = await supabase
    .from("events")
    .select("id, is_mock")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { success: false, error: "Event not found" };
  if (!event.is_mock) {
    return { success: false, error: "Refusing to delete — event is not marked is_mock=true" };
  }

  const deleted: Record<string, number> = {};
  const wipe = async (
    table: string,
    action: () => Promise<{ count: number | null; error: { message: string } | null }>
  ) => {
    const { count, error } = await action();
    if (error) throw new Error(`${table}: ${error.message}`);
    deleted[table] = count ?? 0;
  };

  try {
    // Collect agenda item ids first
    const { data: agendaRows } = await supabase
      .from("agenda")
      .select("id")
      .eq("event_id", eventId);
    const agendaIds = ((agendaRows ?? []) as Array<{ id: string }>).map((a) => a.id);

    // Collect scores ids
    const { data: scoreRows } = await supabase
      .from("scores")
      .select("id")
      .eq("event_id", eventId);
    const scoreIds = ((scoreRows ?? []) as Array<{ id: string }>).map((s) => s.id);

    await wipe("votes", async () =>
      supabase.from("votes").delete({ count: "exact" }).eq("event_id", eventId)
    );
    await wipe("vote_sessions", async () =>
      supabase
        .from("vote_sessions")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    if (scoreIds.length > 0) {
      await wipe("score_audit", async () =>
        supabase
          .from("score_audit")
          .delete({ count: "exact" })
          .in("score_id", scoreIds)
      );
    } else {
      deleted.score_audit_log = 0;
    }
    await wipe("scores", async () =>
      supabase.from("scores").delete({ count: "exact" }).eq("event_id", eventId)
    );
    if (agendaIds.length > 0) {
      await wipe("agenda_speakers", async () =>
        supabase
          .from("agenda_speakers")
          .delete({ count: "exact" })
          .in("agenda_item_id", agendaIds)
      );
    } else {
      deleted.agenda_speakers = 0;
    }
    await wipe("agenda", async () =>
      supabase
        .from("agenda")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("notifications", async () =>
      supabase
        .from("notifications")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("motions", async () =>
      supabase
        .from("motions")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("bills", async () =>
      supabase.from("bills").delete({ count: "exact" }).eq("event_id", eventId)
    );
    await wipe("questions", async () =>
      supabase
        .from("questions")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("fees", async () =>
      supabase
        .from("fees")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("volunteers", async () =>
      supabase
        .from("volunteers")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("feedback", async () =>
      supabase
        .from("feedback")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("media", async () =>
      supabase
        .from("media")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("promotions", async () =>
      supabase
        .from("promotions")
        .delete({ count: "exact" })
        .or(`source_event_id.eq.${eventId},target_event_id.eq.${eventId}`)
    );
    await wipe("invitations", async () =>
      supabase
        .from("invitations")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("brand_checks", async () =>
      supabase
        .from("brand_checks")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("results", async () =>
      supabase
        .from("results")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("checklist", async () =>
      supabase
        .from("checklist")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("event_topics", async () =>
      supabase
        .from("event_topics")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("jury_assignments", async () =>
      supabase
        .from("jury_assignments")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("participants", async () =>
      supabase
        .from("participants")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("parties", async () =>
      supabase
        .from("parties")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("registrations", async () =>
      supabase
        .from("registrations")
        .delete({ count: "exact" })
        .eq("event_id", eventId)
    );
    await wipe("events", async () =>
      supabase.from("events").delete({ count: "exact" }).eq("id", eventId)
    );

    await logAuditAction({
      action_type: "wipe",
      target_table: "events",
      target_id: eventId,
      metadata: { deleted, op: "wipeMockEvent" },
    });
    revalidatePath(ADMIN_PATH);
    return { success: true, data: { deleted } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Event wipe failed: ${msg}` };
  }
}
