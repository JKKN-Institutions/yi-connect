"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/yi-future/constants";

// ─── LIVE COUNTERS (safe for public SSR/client) ────────────────────
export type LiveCounts = {
  delegatesTotal: number;
  delegatesThisWeek: number;
  chaptersActive: number;
  teamsCount: number;
  problemsPicked: number;
};

export async function getLiveCounts(editionSlug = "2026"): Promise<LiveCounts> {
  const svc = await createServiceClient();
  const { data: edition } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("slug", editionSlug)
    .maybeSingle();
  if (!edition) {
    return {
      delegatesTotal: 0,
      delegatesThisWeek: 0,
      chaptersActive: 0,
      teamsCount: 0,
      problemsPicked: 0,
    };
  }
  const editionId = (edition as { id: string }).id;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString();

  const [
    { count: delegatesTotal },
    { count: delegatesThisWeek },
    chaptersRes,
    { count: teamsCount },
    { count: problemsPicked },
  ] = await Promise.all([
    svc
      .schema("future")
      .from("delegates")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", editionId),
    svc
      .schema("future")
      .from("delegates")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", editionId)
      .gte("created_at", sevenDaysAgo),
    svc
      .schema("future")
      .from("delegates")
      .select("chapter_id")
      .eq("edition_id", editionId)
      .not("chapter_id", "is", null),
    svc
      .schema("future")
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", editionId),
    svc
      .schema("future")
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", editionId)
      .not("problem_statement_id", "is", null),
  ]);

  const chapterIds = new Set(
    (chaptersRes.data ?? []).map((r: { chapter_id: string | null }) => r.chapter_id)
  );

  return {
    delegatesTotal: delegatesTotal ?? 0,
    delegatesThisWeek: delegatesThisWeek ?? 0,
    chaptersActive: chapterIds.size,
    teamsCount: teamsCount ?? 0,
    problemsPicked: problemsPicked ?? 0,
  };
}

// ─── CHAPTER CONTEXT FOR A DELEGATE ────────────────────────────────
export type DelegateContext = {
  id: string;
  full_name: string;
  edition_id: string;
  chapter_id: string;
  chapter_name: string | null;
  serial_in_chapter: number;
  serial_in_edition: number;
  preferred_track_slug: string | null;
  profile_completion_pct: number;
  why_statement: string | null;
  points: number;
  badges: string[];
  team_id: string | null;
  team_name: string | null;
  track_slug: string | null;
  track_name: string | null;
  track_color: string | null;
};

export async function getDelegateContext(
  delegateId: string
): Promise<DelegateContext | null> {
  const svc = await createServiceClient();
  const { data: delegate } = await svc
    .schema("future")
    .from("delegates")
    .select(
      "id, full_name, edition_id, chapter_id, preferred_track_slug, profile_completion_pct, why_statement, points, badges, created_at"
    )
    .eq("id", delegateId)
    .maybeSingle();
  if (!delegate) return null;

  const [chapterRes, serialChRes, serialEdRes, teamRes] = await Promise.all([
    svc
      .schema("yi")
      .from("chapters")
      .select("name")
      .eq("id", delegate.chapter_id)
      .maybeSingle(),
    svc
      .schema("future")
      .from("delegates")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", delegate.edition_id)
      .eq("chapter_id", delegate.chapter_id)
      .lte("created_at", delegate.created_at ?? new Date().toISOString()),
    svc
      .schema("future")
      .from("delegates")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", delegate.edition_id)
      .lte("created_at", delegate.created_at ?? new Date().toISOString()),
    svc
      .schema("future")
      .from("team_members")
      .select(
        "team_id, teams!inner(id, team_name, problem_statement_id, problem_statements(track_id, tracks(slug, name, color_hex)))"
      )
      .eq("delegate_id", delegate.id)
      .maybeSingle(),
  ]);

  const chapterName = (chapterRes.data as { name: string } | null)?.name ?? null;
  const serialChapter = serialChRes.count ?? 0;
  const serialEdition = serialEdRes.count ?? 0;

  const team = teamRes.data as
    | {
        team_id: string;
        teams: {
          id: string;
          team_name: string;
          problem_statement_id: string | null;
          problem_statements: {
            track_id: string;
            tracks: { slug: string; name: string; color_hex: string | null };
          } | null;
        };
      }
    | null;

  return {
    id: delegate.id,
    full_name: delegate.full_name,
    edition_id: delegate.edition_id,
    chapter_id: delegate.chapter_id,
    chapter_name: chapterName,
    serial_in_chapter: serialChapter,
    serial_in_edition: serialEdition,
    preferred_track_slug: delegate.preferred_track_slug,
    profile_completion_pct: delegate.profile_completion_pct ?? 0,
    why_statement: delegate.why_statement,
    points: delegate.points ?? 0,
    badges: Array.isArray(delegate.badges) ? (delegate.badges as string[]) : [],
    team_id: team?.team_id ?? null,
    team_name: team?.teams.team_name ?? null,
    track_slug: team?.teams.problem_statements?.tracks.slug ?? null,
    track_name: team?.teams.problem_statements?.tracks.name ?? null,
    track_color: team?.teams.problem_statements?.tracks.color_hex ?? null,
  };
}

// ─── PROFILE COMPLETION ────────────────────────────────────────────
export type CompleteProfileInput = {
  full_name?: string;
  course?: string;
  year_of_study?: number;
  home_state?: string;
  why_statement?: string;
  preferred_track_slug?: string;
  phone?: string;
  email?: string;
};

type SessionPayload = { type: string; id: string; edition_id: string };

async function readDelegateSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SessionPayload;
    if (s.type !== "delegate") return null;
    return s;
  } catch {
    return null;
  }
}

export type CompleteProfileResult =
  | { ok: true; profile_completion_pct: number; points: number; badges: string[] }
  | { ok: false; error: string };

export async function completeProfile(
  input: CompleteProfileInput
): Promise<CompleteProfileResult> {
  const session = await readDelegateSession();
  if (!session) return { ok: false, error: "Session expired. Re-enter your code." };

  const svc = await createServiceClient();
  const { data: row } = await svc
    .schema("future")
    .from("delegates")
    .select(
      "id, full_name, email, phone, course, year_of_study, home_state, why_statement, preferred_track_slug, badges, points, registered_at"
    )
    .eq("id", session.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Delegate not found." };

  // Merge inbound; ignore blank strings so the form doesn't null-out existing fields.
  const merged = {
    full_name:
      input.full_name?.trim() || row.full_name || "",
    email: input.email?.trim() || row.email,
    phone: input.phone?.trim() || row.phone,
    course: input.course?.trim() || row.course,
    year_of_study: input.year_of_study ?? row.year_of_study,
    home_state: input.home_state?.trim() || row.home_state,
    why_statement: input.why_statement?.trim() || row.why_statement,
    preferred_track_slug:
      input.preferred_track_slug?.trim() || row.preferred_track_slug,
  };

  // Score profile completion: 5 fields count, why_statement weighted 2x.
  const fields: Array<string | number | null | undefined> = [
    merged.full_name,
    merged.course,
    merged.year_of_study,
    merged.home_state,
    merged.preferred_track_slug,
  ];
  const baseFilled = fields.filter((v) => v !== null && v !== undefined && v !== "").length;
  const whyFilled = merged.why_statement ? 2 : 0;
  const pct = Math.round(((baseFilled + whyFilled) / 7) * 100);

  // Badges
  const oldBadges: string[] = Array.isArray(row.badges) ? (row.badges as string[]) : [];
  const badges = new Set<string>(oldBadges);
  badges.add("joined");
  if (pct >= 100) badges.add("profile_complete");
  if (merged.why_statement) badges.add("voice_heard");

  // Points: 10 joined + 5 per field filled (base) + 20 for why + 25 for 100%
  let points = 10;
  points += baseFilled * 5;
  if (merged.why_statement) points += 20;
  if (pct >= 100) points += 25;

  const registeredAt = row.registered_at ?? new Date().toISOString();

  const { error } = await svc
    .schema("future")
    .from("delegates")
    .update({
      full_name: merged.full_name,
      email: merged.email,
      phone: merged.phone,
      course: merged.course,
      year_of_study: merged.year_of_study,
      home_state: merged.home_state,
      why_statement: merged.why_statement,
      preferred_track_slug: merged.preferred_track_slug,
      profile_completion_pct: pct,
      badges: Array.from(badges),
      points,
      registered_at: registeredAt,
    })
    .eq("id", session.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/me");
  revalidatePath("/join");
  return {
    ok: true,
    profile_completion_pct: pct,
    points,
    badges: Array.from(badges),
  };
}

// ─── QUIZ RESULT PERSISTENCE ───────────────────────────────────────
export type SaveQuizResultInput = {
  winner: string;
  scores: Record<string, number>;
};
export type SaveQuizResultResult = { ok: true } | { ok: false; error: string };

export async function saveQuizResult(
  input: SaveQuizResultInput
): Promise<SaveQuizResultResult> {
  const session = await readDelegateSession();
  if (!session) return { ok: false, error: "no session" };

  const svc = await createServiceClient();
  const { data: row } = await svc
    .schema("future")
    .from("delegates")
    .select("id, badges, points")
    .eq("id", session.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "delegate not found" };

  const oldBadges: string[] = Array.isArray(row.badges)
    ? (row.badges as string[])
    : [];
  const badges = new Set<string>(oldBadges);
  const hadBadge = badges.has("track_matched");
  badges.add("track_matched");

  // Only award +10 points on first-time badge acquisition to avoid abuse via retake.
  const points = hadBadge ? row.points : row.points + 10;

  const { error } = await svc
    .schema("future")
    .from("delegates")
    .update({
      preferred_track_slug: input.winner,
      badges: Array.from(badges),
      points,
    })
    .eq("id", session.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/yi-future/me");
  revalidatePath("/join");
  return { ok: true };
}
