"use server";

import { cookies } from "next/headers";
import {
  createClient,
  createServiceClient,
} from "@/lib/yip/supabase/server";
import { DEMO_ORG_EMAIL, DEMO_ORG_PASSWORD } from "@/lib/yip/demo-credentials";
import { mintYipSession } from "@/lib/yip/auth/yip-session";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Directory of test accounts derived from mock data ───────────

export type TestAccount = {
  kind: "student" | "jury" | "organizer" | "volunteer";
  id: string; // participant_id / jury_assignment_id / 'organizer'
  label: string;
  sublabel: string;
  event_name: string | null;
  event_level: string | null;
  access_code: string | null;
  badges: string[];
  highlight?: "journey" | "leader" | "default";
};

export async function listTestAccounts(): Promise<{
  students: TestAccount[];
  jury: TestAccount[];
  volunteers: TestAccount[];
  organizer: TestAccount;
  hasMockData: boolean;
}> {
  const supabase = await createServiceClient();

  // Find mock events for context
  const { data: events } = await supabase
    .from("events")
    .select("id, name, level, status")
    .eq("is_mock", true);

  const eventMap = new Map(
    (events ?? []).map((e) => [e.id, e as { id: string; name: string; level: string }])
  );

  // Mock participants — pull a diverse selection
  const { data: participants } = await supabase
    .from("participants")
    .select(
      "id, full_name, school_name, parliament_role, party_side, access_code, event_id, person_id, serial_no"
    )
    .eq("is_mock", true)
    .not("access_code", "is", null)
    .order("serial_no", { nullsFirst: false })
    .limit(200);

  const pList = participants ?? [];

  // Group participants by person_id — the ones appearing in >1 event are "journey" threaded
  const byPerson = new Map<string, typeof pList>();
  for (const p of pList) {
    if (!p.person_id) continue;
    const arr = byPerson.get(p.person_id) ?? [];
    arr.push(p);
    byPerson.set(p.person_id, arr);
  }

  // Pick 1 journey-threaded participant (first event instance — chapter)
  let journeyPick: (typeof pList)[number] | null = null;
  for (const [, arr] of byPerson.entries()) {
    if (arr.length > 1) {
      // Pick the chapter-level instance
      const chapterInstance = arr.find((p) => {
        const ev = eventMap.get(p.event_id);
        return ev?.level === "chapter";
      }) ?? arr[0];
      journeyPick = chapterInstance;
      break;
    }
  }

  const leaderRoles = new Set([
    "speaker",
    "deputy_speaker",
    "prime_minister",
    "deputy_prime_minister",
    "leader_of_opposition",
    "cabinet_minister",
    "shadow_minister",
    "party_leader",
  ]);

  // One login per parliamentary role so every persona is testable live
  // (Speaker, Deputy Speaker, PM, Deputy PM, LoP, a Cabinet Minister, a Shadow
  // Minister, a Party Leader, an Independent, a Bill Committee member, an MP).
  const ROLE_ORDER = [
    "speaker",
    "deputy_speaker",
    "prime_minister",
    "deputy_prime_minister",
    "leader_of_opposition",
    "cabinet_minister",
    "shadow_minister",
    "party_leader",
    "independent_mp",
    "bill_committee",
    "mp",
  ];
  const pickedIds = new Set<string>();
  if (journeyPick) pickedIds.add(journeyPick.id);
  const rolePicks: typeof pList = [];
  for (const role of ROLE_ORDER) {
    const p = pList.find(
      (x) => x.parliament_role === role && !pickedIds.has(x.id)
    );
    if (p) {
      rolePicks.push(p);
      pickedIds.add(p.id);
    }
  }

  const studentPicks: typeof pList = [];
  if (journeyPick) studentPicks.push(journeyPick);
  studentPicks.push(...rolePicks);

  const students: TestAccount[] = studentPicks.map((p) => {
    const ev = eventMap.get(p.event_id);
    const isJourney = p.id === journeyPick?.id;
    const isLeader =
      p.parliament_role !== null && leaderRoles.has(p.parliament_role);
    const badges: string[] = [];
    if (isJourney) badges.push("Journey: Chapter → Regional → National");
    if (p.parliament_role) badges.push(p.parliament_role.replace(/_/g, " "));
    if (p.party_side) badges.push(p.party_side);

    return {
      kind: "student",
      id: p.id,
      label: p.full_name.replace(/^\[MOCK\]\s*/i, ""),
      sublabel: p.school_name ?? "",
      event_name: ev?.name ?? null,
      event_level: ev?.level ?? null,
      access_code: p.access_code,
      badges,
      highlight: isJourney ? "journey" : isLeader ? "leader" : "default",
    };
  });

  // Mock jury members
  const { data: juries } = await supabase
    .from("jury_assignments")
    .select("id, jury_name, access_code, event_id, is_active")
    .eq("is_mock", true)
    .eq("is_active", true)
    .limit(4);

  const jury: TestAccount[] = (juries ?? []).map((j) => {
    const ev = eventMap.get(j.event_id);
    return {
      kind: "jury",
      id: j.id,
      label: j.jury_name.replace(/^\[MOCK\]\s*/i, ""),
      sublabel: "Jury member",
      event_name: ev?.name ?? null,
      event_level: ev?.level ?? null,
      access_code: j.access_code,
      badges: ["Scoring console"],
    };
  });

  // Mock volunteers (YUVA kiosks) — for testing the kiosk vote-capture path.
  // Scoped to MOCK EVENTS only (eventMap) so we never surface a [MOCK]
  // volunteer that sits on a real event (logging in there could pollute it).
  const mockEventIds = [...eventMap.keys()];
  const { data: vols } = mockEventIds.length
    ? await supabase
        .from("volunteers")
        .select("id, full_name, access_code, event_id, is_mock")
        .eq("is_mock", true)
        .in("event_id", mockEventIds)
        .not("access_code", "is", null)
        .limit(6)
    : { data: [] as { id: string; full_name: string; access_code: string | null; event_id: string; is_mock: boolean }[] };

  const volunteers: TestAccount[] = (vols ?? []).map((v) => {
    const ev = eventMap.get(v.event_id);
    return {
      kind: "volunteer",
      id: v.id,
      label: v.full_name.replace(/^\[MOCK\]\s*/i, ""),
      sublabel: "YUVA volunteer (kiosk)",
      event_name: ev?.name ?? null,
      event_level: ev?.level ?? null,
      access_code: v.access_code,
      badges: ["Kiosk voting"],
    };
  });

  const organizer: TestAccount = {
    kind: "organizer",
    id: "organizer",
    label: "Demo Organizer",
    sublabel: DEMO_ORG_EMAIL,
    event_name: null,
    event_level: null,
    access_code: null,
    badges: ["Full dashboard", "Admin + pipeline", "All events"],
  };

  return {
    students,
    jury,
    volunteers,
    organizer,
    hasMockData: (events?.length ?? 0) > 0,
  };
}

// ─── One-click login ─────────────────────────────────────────────

export async function loginAsStudent(
  participantId: string
): Promise<ActionResult<{ redirect: string }>> {
  const supabase = await createServiceClient();
  const { data: p } = await supabase
    .from("participants")
    .select("id, full_name, event_id, is_mock")
    .eq("id", participantId)
    .single();

  if (!p) return { success: false, error: "Participant not found" };
  // SECURITY: only mint a session for MOCK/demo participants. Without this, this
  // action grants a valid session for ANY participant id — including a real
  // Speaker / PM / Minister — letting anyone who obtains the action id
  // impersonate a leader and act through the role gates. (Caught by ultracheck.)
  if (!p.is_mock) {
    return { success: false, error: "One-click login is only available for demo (mock) accounts." };
  }

  await mintYipSession({
    type: "participant",
    id: p.id,
    name: p.full_name,
    eventId: p.event_id,
  });

  return { success: true, data: { redirect: "/me" } };
}

export async function loginAsVolunteer(
  volunteerId: string
): Promise<ActionResult<{ redirect: string }>> {
  const supabase = await createServiceClient();
  const { data: v } = await supabase
    .from("volunteers")
    .select("id, full_name, event_id, is_mock")
    .eq("id", volunteerId)
    .single();

  if (!v) return { success: false, error: "Volunteer not found" };
  // SECURITY: demo login is for mock volunteers only (see loginAsStudent).
  if (!v.is_mock) {
    return { success: false, error: "One-click login is only available for demo (mock) accounts." };
  }

  await mintYipSession({
    type: "volunteer",
    id: v.id,
    name: v.full_name,
    eventId: v.event_id,
  });

  return { success: true, data: { redirect: "/volunteer" } };
}

export async function loginAsJury(
  juryAssignmentId: string
): Promise<ActionResult<{ redirect: string }>> {
  const supabase = await createServiceClient();
  const { data: j } = await supabase
    .from("jury_assignments")
    .select("id, jury_name, event_id, is_active, is_mock")
    .eq("id", juryAssignmentId)
    .single();

  if (!j) return { success: false, error: "Jury not found" };
  if (!j.is_active) return { success: false, error: "Jury deactivated" };
  // SECURITY: demo login is for mock jurors only (see loginAsStudent).
  if (!j.is_mock) {
    return { success: false, error: "One-click login is only available for demo (mock) accounts." };
  }

  await mintYipSession({
    type: "jury",
    id: j.id,
    name: j.jury_name,
    eventId: j.event_id,
  });

  return { success: true, data: { redirect: "/jury" } };
}

export async function loginAsOrganizer(): Promise<
  ActionResult<{ redirect: string }>
> {
  // Ensure the demo user exists (idempotent)
  const admin = await createServiceClient();

  // admin.listUsers is the way to check — but the API is paginated. Simpler:
  // try create. If it errors "User already registered" that's fine.
  try {
    const { error: createErr } = await admin.auth.admin.createUser({
      email: DEMO_ORG_EMAIL,
      password: DEMO_ORG_PASSWORD,
      email_confirm: true,
      user_metadata: { is_mock: true, demo: true },
    });
    // Ignore "already exists" style errors silently
    if (
      createErr &&
      !/already|exist|registered|duplicate/i.test(createErr.message ?? "")
    ) {
      return {
        success: false,
        error: "Could not provision demo user: " + createErr.message,
      };
    }
  } catch {
    // fall through — might already be in auth
  }

  // Now sign in via the normal (cookie-setting) client
  const client = await createClient();
  const { error } = await client.auth.signInWithPassword({
    email: DEMO_ORG_EMAIL,
    password: DEMO_ORG_PASSWORD,
  });

  if (error) {
    return {
      success: false,
      error:
        "Sign-in failed: " +
        error.message +
        ". Try running the mock seeder first at /dashboard/admin/mock-data.",
    };
  }

  return { success: true, data: { redirect: "/dashboard" } };
}

// Allow the existing logout action to clear the yip_session cookie too.
// Exported here so client can import a single symbol.
export async function clearTestSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("yip_session");
}
