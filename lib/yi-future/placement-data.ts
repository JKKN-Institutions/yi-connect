// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — data loading for the team placement screen (server-only).
//
// Split from lib/yi-future/placement.ts so the pure scoring engine stays free
// of `next/headers` and can be imported anywhere, including by a client
// component for its types.
//
// ROW-CAP DISCIPLINE (this is the whole reason this file is careful)
// PostgREST caps ONE response at ~1000 rows whether or not `.limit()` is set —
// `.limit(50000)` does NOT beat the server cap. Counting the returned array in
// JS therefore silently truncates: Visakhapatnam's 1,923 active delegates and
// Bhopal's 1,221 would both read as 1,000, every delegate past the cap would be
// mis-classified as "already teamed", and the screen would look fine. Both
// reads below page with `fetchAllRows` + a stable `.order()` so pages neither
// overlap nor skip. Any new query added here must do the same.
// ═══════════════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { isInviteExpired } from "@/lib/yi-future/invite-expiry";
import { TRACK_LABELS } from "@/lib/yi-future/constants";
import type { PlacementDelegate, PlacementTeam } from "@/lib/yi-future/placement";

export type PlacementEdition = { id: string; name: string };
export type PlacementChapter = { id: string; name: string; region: string | null };

type DelegateJoin = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  college_id: string | null;
  course: string | null;
  year_of_study: number | null;
  preferred_track_slug: string | null;
  colleges: { name: string } | null;
  team_members: { team_id: string }[] | null;
};

type TeamJoin = {
  id: string;
  team_name: string;
  is_frozen: boolean | null;
  captain_id: string | null;
  leader_delegate_id: string | null;
  problem_statements: {
    title: string | null;
    tracks: { slug: string | null; name: string | null } | null;
  } | null;
  team_members:
    | {
        delegate_id: string;
        delegates: {
          college_id: string | null;
          course: string | null;
          year_of_study: number | null;
        } | null;
      }[]
    | null;
  team_invitations:
    | { invited_delegate_id: string; status: string | null; created_at: string }[]
    | null;
};

export async function getActivePlacementEdition(): Promise<PlacementEdition | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();
  return (data as PlacementEdition | null) ?? null;
}

export async function getPlacementChapter(
  chapterId: string
): Promise<PlacementChapter | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, region")
    .eq("id", chapterId)
    .maybeSingle();
  return (data as PlacementChapter | null) ?? null;
}

/**
 * Every ACTIVE delegate of the chapter who is on no team.
 *
 * "On a team" is read from the embedded `team_members` rather than a second
 * query, because filtering `team_members` by a 1,900-id `.in(...)` list would
 * overflow the request URL — the same reason the team detail page embeds it.
 */
export async function getUnteamedForPlacement(
  chapterId: string,
  editionId: string
): Promise<PlacementDelegate[]> {
  const svc = await createServiceClient();
  const rows = await fetchAllRows<DelegateJoin>((from, to) =>
    svc
      .schema("future")
      .from("delegates")
      .select(
        "id, full_name, email, phone, college_id, course, year_of_study, preferred_track_slug, colleges(name), team_members(team_id)"
      )
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId)
      .eq("is_active", true)
      .order("full_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: DelegateJoin[] | null;
      error: unknown;
    }>
  );

  return rows
    .filter((r) => (r.team_members ?? []).length === 0)
    .map((r) => ({
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone,
      college_id: r.college_id,
      college_name: r.colleges?.name ?? null,
      course: r.course,
      year_of_study: r.year_of_study,
      preferred_track_slug: r.preferred_track_slug,
    }));
}

/**
 * Every team of the chapter with the roster facts the ranking needs, plus its
 * pending invites so a student mid-flight is not invited twice.
 */
export async function getTeamsForPlacement(
  chapterId: string,
  editionId: string
): Promise<PlacementTeam[]> {
  const svc = await createServiceClient();
  // future.team_invitations is not in the generated types (same as everywhere
  // else it is read) → loose client for this one select.
  const loose = svc as any;

  const rows = await fetchAllRows<TeamJoin>((from, to) =>
    loose
      .schema("future")
      .from("teams")
      .select(
        "id, team_name, is_frozen, captain_id, leader_delegate_id, problem_statements(title, tracks(slug, name)), team_members(delegate_id, delegates(college_id, course, year_of_study)), team_invitations(invited_delegate_id, status, created_at)"
      )
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId)
      .order("team_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: TeamJoin[] | null;
      error: unknown;
    }>
  );

  return rows.map((t) => {
    const members = t.team_members ?? [];
    const slug = t.problem_statements?.tracks?.slug ?? null;
    return {
      id: t.id,
      team_name: t.team_name,
      is_frozen: t.is_frozen === true,
      has_leader: !!(t.captain_id ?? t.leader_delegate_id),
      problem_title: t.problem_statements?.title ?? null,
      track_slug: slug,
      track_label:
        (slug && TRACK_LABELS[slug as keyof typeof TRACK_LABELS]) ??
        t.problem_statements?.tracks?.name ??
        null,
      member_count: members.length,
      member_college_ids: members.map((m) => m.delegates?.college_id ?? null),
      member_courses: members.map((m) => m.delegates?.course ?? null),
      member_years: members.map((m) => m.delegates?.year_of_study ?? null),
      pending_invite_delegate_ids: (t.team_invitations ?? [])
        .filter((i) => i.status === "pending" && !isInviteExpired(i.created_at))
        .map((i) => i.invited_delegate_id),
    };
  });
}
