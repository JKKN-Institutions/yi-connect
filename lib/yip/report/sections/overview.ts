import "server-only";

/**
 * REFERENCE data helper for the YIP Chapter Round Report — Section 1 (Overview).
 *
 * Every other section helper (lib/yip/report/sections/<kebab>.ts) copies this
 * shape EXACTLY:
 *   1. `import "server-only"` (this is a data module, never a "use server" file —
 *      it may export types + sync getters).
 *   2. gate with getYipEventAccess(eventId); if !canView return a null/empty
 *      payload so the section renders nothing rather than throwing.
 *   3. read yip.* via createServiceClient() (already schema-pinned to "yip");
 *      cross-schema reads (yi_directory.*) use the `.schema("yi_directory" as never)`
 *      loose-cast (the generated types don't include yi_directory — same cast
 *      used by app/yip/actions/admin-team.ts).
 *
 * Section 1 assembles: chapter name, dates, venue, Chapter Leadership (from
 * yi_directory.role_assignments → people, for the event chapter), and the YIP
 * Moderator Team (from yip.organizers scoped to the event chapter + the event's
 * zone RM).
 *
 * NOTE on chapter matching: yi_directory.role_assignments has NO chapter-id
 * column — it only stores the chapter NAME in `yi_chapter` (verified against the
 * live DB). So chapter leadership is matched purely by chapter name
 * (case/space-insensitive) against events.chapter_name. events.yi_chapter_id is
 * a valid column on events but there is nothing in the directory to compare it
 * to, so it is not used here.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

export type ChapterLeader = {
  name: string;
  email: string | null;
  role: string;
  /** Optional directory title, e.g. "Chapter Chair 2026". */
  title: string | null;
};

export type ModeratorMember = {
  name: string;
  email: string | null;
  role: string;
  zone: string | null;
};

export type OverviewData = {
  eventName: string;
  chapterName: string | null;
  city: string | null;
  state: string | null;
  level: string;
  status: string;
  zone: string | null;
  yiZoneCode: string | null;
  day1Date: string | null;
  day2Date: string | null;
  venueName: string | null;
  venueAddress: string | null;
  oathText: string | null;
  resultsPublishedAt: string | null;
  participantCount: number;
  chapterLeaders: ChapterLeader[];
  moderatorTeam: ModeratorMember[];
};

/** Human-friendly label for a directory / moderator role slug. */
function prettyRole(role: string): string {
  return role
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Fetch everything Section 1 renders. Returns `null` when the caller lacks view
 * access (the section component then renders nothing).
 */
export async function getOverviewData(
  eventId: string
): Promise<OverviewData | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const svc = await createServiceClient();

  const { data: event } = await svc
    .from("events")
    .select(
      "id, name, level, status, chapter_name, city, state, zone, yi_zone_code, yi_chapter_id, day1_date, day2_date, venue_name, venue_address, oath_text, results_published_at"
    )
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return null;

  const { count: participantCount } = await svc
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  // ── Chapter Leadership (yi_directory) ───────────────────────────────
  // Source of truth for who leads the chapter. Matched by chapter NAME
  // (case/space-insensitive) — the directory stores only the name, not an id.
  // Leadership roles = chair / co-chair (app='yi').
  const chapterLeaders = await getChapterLeaders(svc, event.chapter_name);

  // ── YIP Moderator Team (yi_directory, app='yip') ────────────────────
  // The chapter's OWN YIP team that ran this round — chapter_admin +
  // chapter_organizer for the event's chapter (same source as the Team tab).
  // NOT the national Yi team / zone RM.
  const moderatorTeam = await getModeratorTeam(svc, event.chapter_name);

  return {
    eventName: event.name,
    chapterName: event.chapter_name,
    city: event.city,
    state: event.state,
    level: event.level,
    status: event.status,
    zone: event.zone,
    yiZoneCode: event.yi_zone_code,
    day1Date: event.day1_date,
    day2Date: event.day2_date,
    venueName: event.venue_name,
    venueAddress: event.venue_address,
    oathText: event.oath_text,
    resultsPublishedAt: event.results_published_at,
    participantCount: participantCount ?? 0,
    chapterLeaders,
    moderatorTeam,
  };
}

/**
 * Directory chapter leadership for the event chapter (chair + co-chair).
 * Matched by chapter NAME — yi_directory.role_assignments has no chapter-id
 * column, only `yi_chapter` (the chapter name).
 */
async function getChapterLeaders(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  chapterName: string | null | undefined
): Promise<ChapterLeader[]> {
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const chapNorm = norm(chapterName);
  if (!chapNorm) return [];

  // yi_directory is not in the generated types — same loose cast as admin-team.ts.
  const dir = svc.schema("yi_directory" as never) as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: unknown
        ) => Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  };

  // Pull active assignments for app='yi' (chapter leadership lives there) and
  // filter to leadership roles + this chapter in JS (loose cast can't chain
  // multiple filters cleanly).
  const { data: rows } = await dir
    .from("role_assignments")
    .select("person_id, app, role, yi_chapter, title, is_active")
    .eq("app", "yi");

  const LEAD_ROLES = new Set(["chapter_chair", "chapter_co_chair"]);

  const matched = (rows ?? []).filter((r) => {
    if (r.is_active === false) return false;
    if (!LEAD_ROLES.has(String(r.role))) return false;
    return norm(String(r.yi_chapter ?? "")) === chapNorm;
  });

  if (matched.length === 0) return [];

  const personIds = Array.from(
    new Set(
      matched
        .map((r) => (r.person_id ? String(r.person_id) : null))
        .filter((x): x is string => Boolean(x))
    )
  );
  const personById = new Map<string, { full_name: string; email: string | null }>();

  if (personIds.length > 0) {
    const dirIn = svc.schema("yi_directory" as never) as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<{ data: Array<Record<string, unknown>> | null }>;
        };
      };
    };
    const { data: people } = await dirIn
      .from("people")
      .select("id, full_name, email, is_active")
      .in("id", personIds);
    for (const p of people ?? []) {
      if (p.is_active === false) continue;
      personById.set(String(p.id), {
        full_name: String(p.full_name ?? ""),
        email: p.email ? String(p.email) : null,
      });
    }
  }

  const leaders: ChapterLeader[] = [];
  for (const r of matched) {
    const pid = r.person_id ? String(r.person_id) : null;
    const person = pid ? personById.get(pid) : null;
    if (!person || !person.full_name) continue;
    leaders.push({
      name: person.full_name,
      email: person.email,
      role: prettyRole(String(r.role)),
      title: r.title ? String(r.title) : null,
    });
  }

  // Stable order: chair first, then co-chair, then by name.
  const rank = (role: string) =>
    /co.?chair/i.test(role) ? 1 : /chair/i.test(role) ? 0 : 2;
  leaders.sort(
    (a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name)
  );
  return leaders;
}

/**
 * YIP Moderator Team for this event's chapter — the chapter's OWN YIP team
 * (chapter_admin + chapter_organizer in yi_directory, app='yip'), matched by
 * chapter NAME, active only, one row per person. Same source as the event Team
 * tab. Deliberately NOT the national Yi team or the zone RM (that was the bug:
 * national leads were shown on every chapter report).
 */
async function getModeratorTeam(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  chapterName: string | null | undefined
): Promise<ModeratorMember[]> {
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const chapNorm = norm(chapterName);
  if (!chapNorm) return [];

  // yi_directory is not in the generated types — same loose cast as getChapterLeaders.
  const dir = svc.schema("yi_directory" as never) as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: unknown
        ) => Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  };

  const { data: rows } = await dir
    .from("role_assignments")
    .select("person_id, app, role, yi_chapter, title, is_active")
    .eq("app", "yip");

  const TEAM_ROLES = new Set(["chapter_admin", "chapter_organizer"]);

  const matched = (rows ?? []).filter((r) => {
    if (r.is_active === false) return false;
    if (!TEAM_ROLES.has(String(r.role))) return false;
    return norm(String(r.yi_chapter ?? "")) === chapNorm;
  });

  if (matched.length === 0) return [];

  const personIds = Array.from(
    new Set(
      matched
        .map((r) => (r.person_id ? String(r.person_id) : null))
        .filter((x): x is string => Boolean(x))
    )
  );
  const personById = new Map<
    string,
    { full_name: string; email: string | null }
  >();

  if (personIds.length > 0) {
    const dirIn = svc.schema("yi_directory" as never) as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (
            k: string,
            v: string[]
          ) => Promise<{ data: Array<Record<string, unknown>> | null }>;
        };
      };
    };
    const { data: people } = await dirIn
      .from("people")
      .select("id, full_name, email, is_active")
      .in("id", personIds);
    for (const p of people ?? []) {
      if (p.is_active === false) continue;
      personById.set(String(p.id), {
        full_name: String(p.full_name ?? ""),
        email: p.email ? String(p.email) : null,
      });
    }
  }

  // One entry per person; prefer their chapter_admin role over organizer.
  const roleByPerson = new Map<string, string>();
  for (const r of matched) {
    const pid = r.person_id ? String(r.person_id) : null;
    if (!pid) continue;
    const role = String(r.role);
    const existing = roleByPerson.get(pid);
    if (!existing || role === "chapter_admin") roleByPerson.set(pid, role);
  }

  const team: ModeratorMember[] = [];
  for (const [pid, role] of roleByPerson) {
    const person = personById.get(pid);
    if (!person || !person.full_name) continue;
    team.push({
      name: person.full_name,
      email: person.email,
      role: prettyRole(role),
      zone: null,
    });
  }

  // Order: chapter admin(s) first, then organisers, then by name.
  const rank = (role: string) => (/admin|chair/i.test(role) ? 0 : 1);
  team.sort(
    (a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name)
  );
  return team;
}
