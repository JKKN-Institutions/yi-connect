/**
 * GET /api/csv/[scope]
 *
 * Generic CSV export endpoint for admin tables [PRD §9].
 *
 * Scopes:
 *   - delegates                 ?chapter_id=xxx (legacy) | ?chapter=<id>&region=<code>&edition=<slug>
 *   - teams                     ?chapter_id=xxx (legacy) | ?chapter=<id>&region=<code>&edition=<slug>
 *   - scoring                   ?chapter_id=xxx (legacy)
 *   - chapters                  ?region=<code>
 *   - editions                  (national admin)
 *   - colleges                  ?chapter=<id>&region=<code>
 *   - mentors                   ?chapter=<id>&region=<code>&edition=<slug>
 *   - jury                      ?edition=<slug>
 *   - partners                  ?edition=<slug>
 *   - evaluations               ?edition=<slug>
 *   - chair_credentials_template  (CSV structure, no values)
 *
 * Filters:
 *   - `edition` matches future.editions.slug. If omitted, the active edition is used.
 *   - `chapter` is a yi.chapters.id (UUID). Applied where applicable.
 *   - `region` is a yi.chapters.region code (ER/NER/NR/SRTKKA/SRTN/WR).
 *
 * Auth & scoping (2026-06-01 — closes a broken-object-level-authorization
 * gap where ANY signed-in admin, including a chapter-level admin, could
 * export NATIONAL-scope PII and access codes via the service client):
 *
 *   • NATIONAL-scope exports — `editions`, `chapters` (all chapter chair
 *     emails/mobiles), `jury`, `partners`, `chair_credentials_template`,
 *     and any roster export requested WITHOUT a single-chapter constraint
 *     — require the STRICT platform/super tier (isCurrentUserPlatformAdmin).
 *     Non-platform admins get 403.
 *   • CHAPTER-scope exports — `delegates`, `teams`, `scoring`, `colleges`,
 *     `mentors` for one chapter — are allowed for a chapter core-team
 *     admin, but the query is FORCED to their OWN chapter_id (resolved via
 *     getChapterContext()); any chapter/region param they pass is ignored.
 *     Platform/super admins may export across chapters / nationally.
 *   • access_code columns are EXCLUDED from non-platform (chapter-admin)
 *     exports — credentials are a national/super concern only.
 */

import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { toCSV, csvResponse } from "@/lib/yi-future/csv";
import {
  aggregateEvaluations,
  type CriteriaScores,
} from "@/lib/yi-future/rubric";
import { isCurrentUserPlatformAdmin } from "@/app/yi-future/actions/national-admins";
import { getChapterContext } from "@/lib/yi-future/chapter-context";

export const runtime = "nodejs";

const SCOPES = [
  "delegates",
  "teams",
  "scoring",
  "chapters",
  "editions",
  "colleges",
  "mentors",
  "jury",
  "partners",
  "evaluations",
  "chair_credentials_template",
  "chapter_progress",
  "problem_matrix",
] as const;
type Scope = (typeof SCOPES)[number];

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Resolve edition by slug (?edition=2026) or fall back to the active edition.
 * Returns null if no edition exists.
 */
async function resolveEdition(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  slug: string | null
): Promise<{ id: string; slug: string; name: string } | null> {
  if (slug) {
    const { data } = await svc
      .schema("future")
      .from("editions")
      .select("id, slug, name")
      .eq("slug", slug)
      .maybeSingle();
    if (data) return data as { id: string; slug: string; name: string };
  }
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, slug, name")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string; slug: string; name: string } | null) ?? null;
}

/**
 * Get the set of chapter IDs that match the region filter. If `region` is null,
 * returns null (caller should skip the chapter-id IN filter).
 */
async function chapterIdsForRegion(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  region: string | null
): Promise<string[] | null> {
  if (!region) return null;
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id")
    .eq("region", region);
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id);
}

/**
 * Map of teamId -> mentor full names, scoped to a chapter or an edition via
 * the mentors table (mentor_team_assignments itself has no scope columns).
 */
async function mentorNamesByTeam(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  filter: { chapterId?: string; editionId?: string }
): Promise<Map<string, string[]>> {
  let q = svc
    .schema("future")
    .from("mentor_team_assignments" as never)
    .select("team_id, mentors!inner(full_name, chapter_id, edition_id)");
  if (filter.chapterId) q = q.eq("mentors.chapter_id", filter.chapterId);
  if (filter.editionId) q = q.eq("mentors.edition_id", filter.editionId);
  const { data } = await q;
  const map = new Map<string, string[]>();
  for (const r of ((data as unknown as {
    team_id: string;
    mentors: { full_name: string } | null;
  }[]) ?? [])) {
    if (!r.mentors?.full_name) continue;
    const list = map.get(r.team_id) ?? [];
    list.push(r.mentors.full_name);
    map.set(r.team_id, list);
  }
  return map;
}

/**
 * Build a map of chapterId -> {name, region} for display joining.
 */
async function chapterDisplayMap(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<Map<string, { name: string; region: string | null }>> {
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, region");
  const map = new Map<string, { name: string; region: string | null }>();
  for (const r of (data as { id: string; name: string; region: string | null }[] | null) ?? []) {
    map.set(r.id, { name: r.name, region: r.region });
  }
  return map;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ scope: string }> }
) {
  const { scope: rawScope } = await params;
  if (!(SCOPES as readonly string[]).includes(rawScope)) {
    return jsonError(404, "Unknown scope");
  }
  const scope = rawScope as Scope;

  // Auth: any signed-in Supabase user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Unauthorized");

  const url = new URL(req.url);
  // Legacy single-chapter export param
  let legacyChapterId = url.searchParams.get("chapter_id");
  // New filter params
  let chapterFilter = url.searchParams.get("chapter");
  let regionFilter = url.searchParams.get("region");
  const editionSlug = url.searchParams.get("edition");

  // ────────────────────────────────────────────────────────────────────
  // Role / chapter scoping (BOLA fix, 2026-06-01)
  //
  // Until now this route gated only `if (!user) 401`, then read everything
  // through the service client (RLS bypassed). That let ANY signed-in admin
  // — including a chapter-level core-team admin — export national-scope PII
  // and access codes. We now split scopes into two classes and enforce:
  //
  //   1. NATIONAL_ONLY scopes → require the STRICT platform/super tier.
  //   2. CHAPTER_SCOPABLE scopes → allowed for a chapter admin, but the
  //      query is FORCED to their own chapter (params overridden); platform
  //      admins keep cross-chapter / national reach.
  //
  // We resolve the platform tier ONCE here (strict predicate from PR #274)
  // and resolve the caller's chapter from the canonical getChapterContext()
  // helper — the same mechanism every /chapter page uses — rather than
  // inventing a parallel chapter-resolution path.
  // ────────────────────────────────────────────────────────────────────

  // Scopes that expose all-chapters PII / access codes / national config.
  // Always require the strict platform/super tier.
  const NATIONAL_ONLY_SCOPES: ReadonlySet<Scope> = new Set<Scope>([
    "chapters", // every chapter's chair email + mobile
    "editions", // national structural config
    "jury", // national jury roster incl. access codes
    "partners", // corporate partners incl. access codes
    "evaluations", // cross-chapter evaluation dump
    "chair_credentials_template", // template for seeding chair credentials
    "chapter_progress", // all-chapter delegate funnel counts
    "problem_matrix", // all-chapter × problem-statement team counts
  ]);

  // Scopes a chapter admin may export, constrained to their own chapter.
  const CHAPTER_SCOPABLE_SCOPES: ReadonlySet<Scope> = new Set<Scope>([
    "delegates",
    "teams",
    "scoring",
    "colleges",
    "mentors",
  ]);

  const { isPlatform } = await isCurrentUserPlatformAdmin();

  // `true` when the export is being served to a non-platform chapter admin
  // (used downstream to strip access_code columns from chapter exports).
  let isChapterScopedExport = false;

  if (!isPlatform) {
    // National-only scope requested by a non-platform admin → hard 403.
    if (NATIONAL_ONLY_SCOPES.has(scope)) {
      return jsonError(
        403,
        "Forbidden: national-scope exports require a platform/super admin."
      );
    }

    if (CHAPTER_SCOPABLE_SCOPES.has(scope)) {
      // Resolve the caller's own chapter via the canonical helper. A
      // non-platform admin with no chapter core-team membership cannot
      // export anything.
      const ctx = await getChapterContext();
      if (!ctx) {
        return jsonError(
          403,
          "Forbidden: you are not a chapter admin for the active edition."
        );
      }
      // Force the query to the caller's own chapter and discard any
      // chapter/region the request tried to pass (no cross-chapter reach).
      // We set BOTH params because the scopes branch differently:
      //   • scoring only honours the legacy `chapter_id`;
      //   • colleges/mentors only honour the new `chapter` filter;
      //   • delegates/teams honour the new `chapter` filter when present
      //     (and that branch omits the access_code column).
      // Setting both guarantees every chapter-scopable scope is constrained.
      legacyChapterId = ctx.chapterId;
      chapterFilter = ctx.chapterId;
      regionFilter = null;
      isChapterScopedExport = true;
    } else {
      // Any future scope not explicitly classified is denied by default.
      return jsonError(403, "Forbidden");
    }
  }

  const svc = await createServiceClient();

  // ────────────────────────────────────────────────────────────────────
  // chair_credentials_template — structure only, no values
  // ────────────────────────────────────────────────────────────────────
  if (scope === "chair_credentials_template") {
    const columns = [
      { key: "chapter_name", label: "Chapter Name" },
      { key: "chair_name", label: "Chair Name" },
      { key: "email", label: "Email" },
      { key: "temp_password", label: "Temp Password" },
      { key: "notes", label: "Notes (optional)" },
    ];
    // Empty body — header row only — admins fill it in manually.
    const csv = toCSV([], columns);
    return csvResponse(
      `chair-credentials-template-${todayStamp()}.csv`,
      csv
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // delegates
  // ────────────────────────────────────────────────────────────────────
  if (scope === "delegates") {
    // Legacy single-chapter path (preserves behaviour for /chapter pages)
    if (legacyChapterId && !chapterFilter && !regionFilter) {
      type Row = {
        id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        course: string | null;
        year_of_study: number | null;
        home_state: string | null;
        access_code: string;
        registered_at: string | null;
        profile_completion_pct: number | null;
        points: number | null;
        team_members: {
          role_in_team: string | null;
          teams: {
            team_name: string;
            problem_statements: { title: string } | null;
          } | null;
        }[];
      };

      const { data } = await svc
        .schema("future")
        .from("delegates")
        .select(
          "id, full_name, email, phone, course, year_of_study, home_state, access_code, registered_at, profile_completion_pct, points, team_members(role_in_team, teams(team_name, problem_statements(title)))"
        )
        .eq("chapter_id", legacyChapterId)
        .order("full_name", { ascending: true });

      const rows = ((data as unknown as Row[]) ?? []).map((d) => {
        const tm = d.team_members?.[0];
        return {
          id: d.id,
          full_name: d.full_name,
          email: d.email ?? "",
          phone: d.phone ?? "",
          college: d.course ?? "",
          year_of_study: d.year_of_study != null ? String(d.year_of_study) : "",
          home_state: d.home_state ?? "",
          access_code: d.access_code,
          // Field request 2026-07-17: teamed/unteamed + team + problem,
          // delegate-wise, straight from this CSV.
          has_team: tm ? "yes" : "no",
          team_name: tm?.teams?.team_name ?? "",
          role_in_team: tm?.role_in_team ?? "",
          problem_title: tm?.teams?.problem_statements?.title ?? "",
          registered_at: d.registered_at ?? "",
          profile_completion_pct:
            d.profile_completion_pct != null
              ? String(d.profile_completion_pct)
              : "",
          points: d.points != null ? String(d.points) : "0",
        };
      });

      const columns = [
        { key: "id", label: "ID" },
        { key: "full_name", label: "Full Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "college", label: "College/Course" },
        { key: "year_of_study", label: "Year of Study" },
        { key: "home_state", label: "Home State" },
        { key: "access_code", label: "Access Code" },
        { key: "has_team", label: "Has Team" },
        { key: "team_name", label: "Team" },
        { key: "role_in_team", label: "Team Role" },
        { key: "problem_title", label: "Problem Statement" },
        { key: "registered_at", label: "Registered At" },
        { key: "profile_completion_pct", label: "Profile %" },
        { key: "points", label: "Points" },
      ];

      return csvResponse(
        `delegates-${todayStamp()}.csv`,
        toCSV(rows, columns)
      );
    }

    // National export with filters
    const edition = await resolveEdition(svc, editionSlug);
    if (!edition) return jsonError(404, "No edition found");

    type Row = {
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      whatsapp: string | null;
      gender: string | null;
      age: number | null;
      course: string | null;
      year_of_study: number | null;
      home_state: string | null;
      registered_at: string | null;
      chapter_id: string;
      colleges: { name: string; city: string | null } | null;
      team_members: {
        role_in_team: string | null;
        teams: {
          team_name: string;
          problem_statements: { title: string } | null;
        } | null;
      }[];
    };

    let regionChapterIds: string[] | null = null;
    if (regionFilter) {
      regionChapterIds = (await chapterIdsForRegion(svc, regionFilter)) ?? [];
      if (regionChapterIds.length === 0) {
        return csvResponse(
          `delegates-${todayStamp()}.csv`,
          toCSV([], [{ key: "id", label: "ID" }])
        );
      }
    }

    // PostgREST caps a single response at ~1000 rows; a national export already
    // exceeds that, so a bare select would silently truncate the CSV. Page
    // through in full batches (id is the unique tiebreaker for stable paging).
    const data = await fetchAllRows<Row>((from, to) => {
      let q = svc
        .schema("future")
        .from("delegates")
        .select(
          "id, full_name, email, phone, whatsapp, gender, age, course, year_of_study, home_state, registered_at, chapter_id, colleges(name, city), team_members(role_in_team, teams(team_name, problem_statements(title)))"
        )
        .eq("edition_id", edition.id);
      if (chapterFilter) q = q.eq("chapter_id", chapterFilter);
      if (regionChapterIds) q = q.in("chapter_id", regionChapterIds);
      return q
        .order("full_name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: Row[] | null;
        error: unknown;
      }>;
    });
    const chMap = await chapterDisplayMap(svc);

    const rows = data.map((d) => {
      const ch = chMap.get(d.chapter_id);
      const tm = d.team_members?.[0];
      return {
        id: d.id,
        full_name: d.full_name,
        email: d.email ?? "",
        phone: d.phone ?? "",
        whatsapp: d.whatsapp ?? "",
        gender: d.gender ?? "",
        age: d.age != null ? String(d.age) : "",
        course: d.course ?? "",
        year_of_study: d.year_of_study != null ? String(d.year_of_study) : "",
        home_state: d.home_state ?? "",
        college_name: d.colleges?.name ?? "",
        college_city: d.colleges?.city ?? "",
        chapter_name: ch?.name ?? "",
        region: ch?.region ?? "",
        has_team: tm ? "yes" : "no",
        team_name: tm?.teams?.team_name ?? "",
        role_in_team: tm?.role_in_team ?? "",
        problem_title: tm?.teams?.problem_statements?.title ?? "",
        registered_at: d.registered_at ?? "",
      };
    });

    const columns = [
      { key: "id", label: "ID" },
      { key: "full_name", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "gender", label: "Gender" },
      { key: "age", label: "Age" },
      { key: "course", label: "Course" },
      { key: "year_of_study", label: "Year of Study" },
      { key: "home_state", label: "Home State" },
      { key: "college_name", label: "College" },
      { key: "college_city", label: "College City" },
      { key: "chapter_name", label: "Chapter" },
      { key: "region", label: "Region" },
      { key: "has_team", label: "Has Team" },
      { key: "team_name", label: "Team" },
      { key: "role_in_team", label: "Team Role" },
      { key: "problem_title", label: "Problem Statement" },
      { key: "registered_at", label: "Registered At" },
    ];

    return csvResponse(
      `delegates-${todayStamp()}.csv`,
      toCSV(rows, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // teams
  // ────────────────────────────────────────────────────────────────────
  if (scope === "teams") {
    // Legacy single-chapter path
    if (legacyChapterId && !chapterFilter && !regionFilter) {
      type Row = {
        id: string;
        team_name: string;
        is_frozen: boolean | null;
        frozen_at: string | null;
        status: string | null;
        leader: { full_name: string } | null;
        captain: { full_name: string } | null;
        problem_statements: { title: string } | null;
        team_members: {
          delegate_id: string;
          delegates: { full_name: string } | null;
        }[];
      };

      const { data } = await svc
        .schema("future")
        .from("teams")
        .select(
          // Phase E fix 2026-05-23: the FK constraint is named
          // `teams_leader_delegate_id_fkey` (column is leader_delegate_id),
          // not `teams_leader_id_fkey`. Using the wrong constraint name
          // makes PostgREST drop the leader column silently.
          "id, team_name, is_frozen, frozen_at, status, leader:delegates!teams_leader_delegate_id_fkey(full_name), captain:delegates!teams_captain_id_fkey(full_name), problem_statements(title), team_members(delegate_id, delegates(full_name))"
        )
        .eq("chapter_id", legacyChapterId)
        .order("team_name", { ascending: true });

      // Mentor names per team (chapter-scoped). Yi Puducherry field request
      // 2026-07-17: admins need member NAMES and mentor status in this CSV,
      // not just a member count.
      const mentorsByTeam = await mentorNamesByTeam(svc, {
        chapterId: legacyChapterId,
      });

      const rows = ((data as unknown as Row[]) ?? []).map((t) => ({
        id: t.id,
        team_name: t.team_name,
        leader_name: t.leader?.full_name ?? "",
        captain_name: t.captain?.full_name ?? "",
        problem_title: t.problem_statements?.title ?? "",
        is_frozen: t.is_frozen ? "yes" : "no",
        frozen_at: t.frozen_at ?? "",
        status: t.status ?? "",
        member_count: String(t.team_members.length),
        member_names: t.team_members
          .map((m) => m.delegates?.full_name ?? "")
          .filter(Boolean)
          .join("; "),
        mentor_names: (mentorsByTeam.get(t.id) ?? []).join("; "),
        mentor_assigned: (mentorsByTeam.get(t.id) ?? []).length > 0 ? "yes" : "no",
      }));

      const columns = [
        { key: "id", label: "ID" },
        { key: "team_name", label: "Team Name" },
        { key: "leader_name", label: "Leader" },
        { key: "captain_name", label: "Captain" },
        { key: "problem_title", label: "Problem Statement" },
        { key: "is_frozen", label: "Frozen" },
        { key: "frozen_at", label: "Frozen At" },
        { key: "status", label: "Status" },
        { key: "member_count", label: "Members" },
        { key: "member_names", label: "Member Names" },
        { key: "mentor_names", label: "Mentor(s)" },
        { key: "mentor_assigned", label: "Mentor Assigned" },
      ];

      return csvResponse(
        `teams-${todayStamp()}.csv`,
        toCSV(rows, columns)
      );
    }

    // National export with filters
    const edition = await resolveEdition(svc, editionSlug);
    if (!edition) return jsonError(404, "No edition found");

    type Row = {
      id: string;
      team_name: string;
      status: string | null;
      created_at: string | null;
      chapter_id: string;
      captain: { full_name: string } | null;
      problem_statements:
        | {
            title: string;
            tracks: { name: string } | null;
          }
        | null;
      team_members: {
        delegate_id: string;
        delegates: { full_name: string } | null;
      }[];
    };

    let q = svc
      .schema("future")
      .from("teams")
      .select(
        "id, team_name, status, created_at, chapter_id, captain:delegates!teams_captain_id_fkey(full_name), problem_statements(title, tracks(name)), team_members(delegate_id, delegates(full_name))"
      )
      .eq("edition_id", edition.id)
      .order("team_name", { ascending: true });

    if (chapterFilter) q = q.eq("chapter_id", chapterFilter);
    if (regionFilter) {
      const ids = (await chapterIdsForRegion(svc, regionFilter)) ?? [];
      if (ids.length === 0) {
        return csvResponse(
          `teams-${todayStamp()}.csv`,
          toCSV([], [{ key: "id", label: "ID" }])
        );
      }
      q = q.in("chapter_id", ids);
    }

    const { data } = await q;
    const chMap = await chapterDisplayMap(svc);
    const mentorsByTeam = await mentorNamesByTeam(svc, {
      editionId: edition.id,
    });

    const rows = ((data as unknown as Row[]) ?? []).map((t) => {
      const ch = chMap.get(t.chapter_id);
      return {
        id: t.id,
        team_name: t.team_name,
        chapter_name: ch?.name ?? "",
        region: ch?.region ?? "",
        track_name: t.problem_statements?.tracks?.name ?? "",
        problem_title: t.problem_statements?.title ?? "",
        status: t.status ?? "",
        captain_name: t.captain?.full_name ?? "",
        member_count: String(t.team_members?.length ?? 0),
        member_names: (t.team_members ?? [])
          .map((m) => m.delegates?.full_name ?? "")
          .filter(Boolean)
          .join("; "),
        mentor_names: (mentorsByTeam.get(t.id) ?? []).join("; "),
        mentor_assigned: (mentorsByTeam.get(t.id) ?? []).length > 0 ? "yes" : "no",
        created_at: t.created_at ?? "",
      };
    });

    const columns = [
      { key: "id", label: "ID" },
      { key: "team_name", label: "Team Name" },
      { key: "chapter_name", label: "Chapter" },
      { key: "region", label: "Region" },
      { key: "track_name", label: "Track" },
      { key: "problem_title", label: "Problem Statement" },
      { key: "status", label: "Status" },
      { key: "captain_name", label: "Captain" },
      { key: "member_count", label: "Members" },
      { key: "member_names", label: "Member Names" },
      { key: "mentor_names", label: "Mentor(s)" },
      { key: "mentor_assigned", label: "Mentor Assigned" },
      { key: "created_at", label: "Created At" },
    ];

    return csvResponse(
      `teams-${todayStamp()}.csv`,
      toCSV(rows, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // scoring (legacy — chapter-scoped only)
  // ────────────────────────────────────────────────────────────────────
  if (scope === "scoring") {
    if (!legacyChapterId) return jsonError(400, "chapter_id required");

    type TeamRow = { id: string; team_name: string };
    type EvalRow = {
      team_id: string;
      jury_id: string;
      criteria_scores: CriteriaScores;
      total_score: number;
      status: string | null;
      teams: { chapter_id: string } | null;
    };

    const { data: teamsRaw } = await svc
      .schema("future")
      .from("teams")
      .select("id, team_name")
      .eq("chapter_id", legacyChapterId)
      .order("team_name", { ascending: true });

    const teams = (teamsRaw as unknown as TeamRow[]) ?? [];

    const { data: evalsRaw } = await svc
      .schema("future")
      .from("evaluations")
      .select(
        "team_id, jury_id, criteria_scores, total_score, status, teams!inner(chapter_id)"
      )
      .eq("teams.chapter_id", legacyChapterId);

    const evals = ((evalsRaw as unknown as EvalRow[]) ?? []).filter(
      (e) => e.status === "submitted"
    );

    const byTeam = new Map<string, EvalRow[]>();
    for (const e of evals) {
      if (!byTeam.has(e.team_id)) byTeam.set(e.team_id, []);
      byTeam.get(e.team_id)!.push(e);
    }

    const rows = teams.map((t) => {
      const list = byTeam.get(t.id) ?? [];
      const agg = aggregateEvaluations(list);
      return {
        team_name: t.team_name,
        average_score: agg.count > 0 ? String(agg.averageTotal) : "",
        juror_count: String(agg.count),
        status: agg.count > 0 ? "scored" : "pending",
      };
    });

    const columns = [
      { key: "team_name", label: "Team Name" },
      { key: "average_score", label: "Average Score" },
      { key: "juror_count", label: "Juror Count" },
      { key: "status", label: "Status" },
    ];

    return csvResponse(
      `scoring-${todayStamp()}.csv`,
      toCSV(rows, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // chapters — supports region filter
  // ────────────────────────────────────────────────────────────────────
  if (scope === "chapters") {
    type Row = {
      id: string;
      name: string;
      city: string;
      state: string | null;
      region: string | null;
      finale_region: string | null;
      is_finale_host: boolean | null;
      is_active: boolean | null;
      programme_duration_days: number | null;
      chair_name: string | null;
      chair_email: string | null;
      chair_mobile: string | null;
    };

    let q = svc
      .schema("yi")
      .from("chapters")
      .select(
        "id, name, city, state, region, finale_region, is_finale_host, is_active, programme_duration_days, chair_name, chair_email, chair_mobile"
      )
      .order("name", { ascending: true });

    if (regionFilter) q = q.eq("region", regionFilter);

    const { data } = await q;

    const rows = ((data as unknown as Row[]) ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      state: c.state ?? "",
      region: c.region ?? "",
      finale_region: c.finale_region ?? "",
      is_finale_host: c.is_finale_host ? "yes" : "no",
      is_active: c.is_active ? "yes" : "no",
      programme_duration_days:
        c.programme_duration_days != null
          ? String(c.programme_duration_days)
          : "",
      chair_name: c.chair_name ?? "",
      chair_email: c.chair_email ?? "",
      chair_mobile: c.chair_mobile ?? "",
    }));

    const columns = [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "region", label: "Region" },
      { key: "finale_region", label: "Finale Region" },
      { key: "is_finale_host", label: "Finale Host" },
      { key: "is_active", label: "Active" },
      { key: "programme_duration_days", label: "Programme Days" },
      { key: "chair_name", label: "Chair Name" },
      { key: "chair_email", label: "Chair Email" },
      { key: "chair_mobile", label: "Chair Mobile" },
    ];

    return csvResponse(
      `chapters-${todayStamp()}.csv`,
      toCSV(rows, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // editions
  // ────────────────────────────────────────────────────────────────────
  if (scope === "editions") {
    type Row = {
      id: string;
      name: string;
      slug: string;
      current_stage: string | null;
      kickoff_date: string | null;
      finale_visibility_cutoff: string | null;
    };

    const { data } = await svc
      .schema("future")
      .from("editions")
      .select(
        "id, name, slug, current_stage, kickoff_date, finale_visibility_cutoff"
      )
      .order("kickoff_date", { ascending: false });

    const rows = ((data as unknown as Row[]) ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      stage: e.current_stage ?? "",
      kickoff_date: e.kickoff_date ?? "",
      finale_visibility_cutoff: e.finale_visibility_cutoff ?? "",
    }));

    const columns = [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "stage", label: "Stage" },
      { key: "kickoff_date", label: "Kickoff Date" },
      {
        key: "finale_visibility_cutoff",
        label: "Finale Visibility Cutoff",
      },
    ];

    return csvResponse(
      `editions-${todayStamp()}.csv`,
      toCSV(rows, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // colleges
  // ────────────────────────────────────────────────────────────────────
  if (scope === "colleges") {
    type Row = {
      id: string;
      name: string;
      city: string | null;
      state: string | null;
      chapter_id: string | null;
      is_approved: boolean | null;
      is_yuva: boolean | null;
      website_url: string | null;
      primary_contact_name: string | null;
      primary_contact_email: string | null;
      primary_contact_phone: string | null;
      created_at: string | null;
    };

    let q = svc
      .schema("future")
      .from("colleges")
      .select(
        "id, name, city, state, chapter_id, is_approved, is_yuva, website_url, primary_contact_name, primary_contact_email, primary_contact_phone, created_at"
      )
      .order("name", { ascending: true });

    if (chapterFilter) q = q.eq("chapter_id", chapterFilter);
    if (regionFilter) {
      const ids = (await chapterIdsForRegion(svc, regionFilter)) ?? [];
      if (ids.length === 0) {
        return csvResponse(
          `colleges-${todayStamp()}.csv`,
          toCSV([], [{ key: "id", label: "ID" }])
        );
      }
      q = q.in("chapter_id", ids);
    }

    const { data } = await q;
    const chMap = await chapterDisplayMap(svc);

    const rows = ((data as unknown as Row[]) ?? []).map((c) => {
      const ch = c.chapter_id ? chMap.get(c.chapter_id) : undefined;
      return {
        id: c.id,
        name: c.name,
        city: c.city ?? "",
        state: c.state ?? "",
        chapter_name: ch?.name ?? "",
        region: ch?.region ?? "",
        is_approved: c.is_approved ? "yes" : "no",
        is_yuva: c.is_yuva ? "yes" : "no",
        website_url: c.website_url ?? "",
        primary_contact_name: c.primary_contact_name ?? "",
        primary_contact_email: c.primary_contact_email ?? "",
        primary_contact_phone: c.primary_contact_phone ?? "",
        created_at: c.created_at ?? "",
      };
    });

    const columns = [
      { key: "id", label: "ID" },
      { key: "name", label: "Name" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "chapter_name", label: "Chapter" },
      { key: "region", label: "Region" },
      { key: "is_approved", label: "Approved" },
      { key: "is_yuva", label: "Yi YUVA" },
      { key: "website_url", label: "Website" },
      { key: "primary_contact_name", label: "Primary Contact" },
      { key: "primary_contact_email", label: "Primary Email" },
      { key: "primary_contact_phone", label: "Primary Phone" },
      { key: "created_at", label: "Created At" },
    ];

    return csvResponse(
      `colleges-${todayStamp()}.csv`,
      toCSV(rows, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // mentors
  // ────────────────────────────────────────────────────────────────────
  if (scope === "mentors") {
    const edition = await resolveEdition(svc, editionSlug);
    if (!edition) return jsonError(404, "No edition found");

    type Row = {
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      expertise: string | null;
      organization: string | null;
      title: string | null;
      access_code: string;
      is_active: boolean | null;
      chapter_id: string | null;
      created_at: string | null;
    };

    let q = svc
      .schema("future")
      .from("mentors")
      .select(
        "id, full_name, email, phone, expertise, organization, title, access_code, is_active, chapter_id, created_at"
      )
      .eq("edition_id", edition.id)
      .order("full_name", { ascending: true });

    if (chapterFilter) q = q.eq("chapter_id", chapterFilter);
    if (regionFilter) {
      const ids = (await chapterIdsForRegion(svc, regionFilter)) ?? [];
      if (ids.length === 0) {
        return csvResponse(
          `mentors-${todayStamp()}.csv`,
          toCSV([], [{ key: "id", label: "ID" }])
        );
      }
      q = q.in("chapter_id", ids);
    }

    const { data } = await q;
    const chMap = await chapterDisplayMap(svc);

    const rows = ((data as unknown as Row[]) ?? []).map((m) => {
      const ch = m.chapter_id ? chMap.get(m.chapter_id) : undefined;
      return {
        id: m.id,
        full_name: m.full_name,
        email: m.email ?? "",
        phone: m.phone ?? "",
        title: m.title ?? "",
        organization: m.organization ?? "",
        expertise: m.expertise ?? "",
        chapter_name: ch?.name ?? "",
        region: ch?.region ?? "",
        access_code: m.access_code,
        is_active: m.is_active ? "yes" : "no",
        created_at: m.created_at ?? "",
      };
    });

    const columns = [
      { key: "id", label: "ID" },
      { key: "full_name", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "title", label: "Title" },
      { key: "organization", label: "Organization" },
      { key: "expertise", label: "Expertise" },
      { key: "chapter_name", label: "Chapter" },
      { key: "region", label: "Region" },
      // Access codes are a national/super concern — drop the column for
      // non-platform (chapter-admin) exports so a chapter admin can manage
      // their own mentors without harvesting login credentials.
      ...(isChapterScopedExport
        ? []
        : [{ key: "access_code", label: "Access Code" }]),
      { key: "is_active", label: "Active" },
      { key: "created_at", label: "Created At" },
    ];

    return csvResponse(
      `mentors-${todayStamp()}.csv`,
      toCSV(rows, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // jury — uses future.jury_assignments (scope handles chapter + national)
  // ────────────────────────────────────────────────────────────────────
  if (scope === "jury") {
    const edition = await resolveEdition(svc, editionSlug);
    if (!edition) return jsonError(404, "No edition found");

    type Row = {
      id: string;
      jury_name: string;
      jury_title: string | null;
      organization: string | null;
      archetype: string;
      scope: string;
      access_code: string;
      phone: string | null;
      email: string | null;
      is_active: boolean | null;
      event_id: string | null;
      created_at: string | null;
    };

    const { data } = await svc
      .schema("future")
      .from("jury_assignments")
      .select(
        "id, jury_name, jury_title, organization, archetype, scope, access_code, phone, email, is_active, event_id, created_at"
      )
      .eq("edition_id", edition.id)
      .order("jury_name", { ascending: true });

    const rows = ((data as unknown as Row[]) ?? []).map((j) => ({
      id: j.id,
      jury_name: j.jury_name,
      jury_title: j.jury_title ?? "",
      organization: j.organization ?? "",
      archetype: j.archetype,
      scope: j.scope,
      email: j.email ?? "",
      phone: j.phone ?? "",
      access_code: j.access_code,
      is_active: j.is_active ? "yes" : "no",
      event_id: j.event_id ?? "",
      created_at: j.created_at ?? "",
    }));

    const columns = [
      { key: "id", label: "ID" },
      { key: "jury_name", label: "Jury Name" },
      { key: "jury_title", label: "Title" },
      { key: "organization", label: "Organization" },
      { key: "archetype", label: "Archetype" },
      { key: "scope", label: "Scope" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "access_code", label: "Access Code" },
      { key: "is_active", label: "Active" },
      { key: "event_id", label: "Event ID" },
      { key: "created_at", label: "Created At" },
    ];

    return csvResponse(
      `jury-${todayStamp()}.csv`,
      toCSV(rows, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // partners — corporate_partners is event-scoped; we filter by events in
  // the active edition.
  // ────────────────────────────────────────────────────────────────────
  if (scope === "partners") {
    const edition = await resolveEdition(svc, editionSlug);
    if (!edition) return jsonError(404, "No edition found");

    // Pull event IDs for this edition first so we can filter partners.
    const { data: eventRows } = await svc
      .schema("future")
      .from("events")
      .select("id")
      .eq("edition_id", edition.id);
    const eventIds = ((eventRows as { id: string }[] | null) ?? []).map(
      (e) => e.id
    );

    type Row = {
      id: string;
      organization: string;
      contact_name: string | null;
      contact_email: string | null;
      contact_phone: string | null;
      website_url: string | null;
      access_code: string;
      is_jury: boolean | null;
      is_sponsor: boolean | null;
      is_internship_provider: boolean | null;
      notes: string | null;
      event_id: string;
      created_at: string | null;
    };

    let rows: Row[] = [];
    if (eventIds.length > 0) {
      const { data } = await svc
        .schema("future")
        .from("corporate_partners")
        .select(
          "id, organization, contact_name, contact_email, contact_phone, website_url, access_code, is_jury, is_sponsor, is_internship_provider, notes, event_id, created_at"
        )
        .in("event_id", eventIds)
        .order("organization", { ascending: true });
      rows = (data as unknown as Row[]) ?? [];
    }

    const mapped = rows.map((p) => ({
      id: p.id,
      organization: p.organization,
      contact_name: p.contact_name ?? "",
      contact_email: p.contact_email ?? "",
      contact_phone: p.contact_phone ?? "",
      website_url: p.website_url ?? "",
      access_code: p.access_code,
      is_jury: p.is_jury ? "yes" : "no",
      is_sponsor: p.is_sponsor ? "yes" : "no",
      is_internship_provider: p.is_internship_provider ? "yes" : "no",
      notes: p.notes ?? "",
      event_id: p.event_id,
      created_at: p.created_at ?? "",
    }));

    const columns = [
      { key: "id", label: "ID" },
      { key: "organization", label: "Organization" },
      { key: "contact_name", label: "Contact" },
      { key: "contact_email", label: "Contact Email" },
      { key: "contact_phone", label: "Contact Phone" },
      { key: "website_url", label: "Website" },
      { key: "access_code", label: "Access Code" },
      { key: "is_jury", label: "Jury" },
      { key: "is_sponsor", label: "Sponsor" },
      { key: "is_internship_provider", label: "Internships" },
      { key: "notes", label: "Notes" },
      { key: "event_id", label: "Event ID" },
      { key: "created_at", label: "Created At" },
    ];

    return csvResponse(
      `partners-${todayStamp()}.csv`,
      toCSV(mapped, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // evaluations — flatten criteria_scores JSONB into columns
  // ────────────────────────────────────────────────────────────────────
  if (scope === "evaluations") {
    const edition = await resolveEdition(svc, editionSlug);
    if (!edition) return jsonError(404, "No edition found");

    // Resolve event IDs in this edition (to scope evaluations).
    const { data: eventRows } = await svc
      .schema("future")
      .from("events")
      .select("id")
      .eq("edition_id", edition.id);
    const eventIds = ((eventRows as { id: string }[] | null) ?? []).map(
      (e) => e.id
    );

    // Discover criteria keys by reading the default chapter rubric for this
    // edition (HPB §4 Day 2 B — 5 criteria × 20 = 100). If unavailable,
    // criteria_scores will be dumped as a JSON string fallback.
    type RubricRow = {
      criteria: { key: string; label: string; max: number }[];
    };
    const { data: rubricData } = await svc
      .schema("future")
      .from("rubrics")
      .select("criteria")
      .eq("edition_id", edition.id)
      .eq("scope", "chapter")
      .eq("is_default", true)
      .maybeSingle();
    const criteriaKeys =
      ((rubricData as unknown as RubricRow | null)?.criteria ?? []).map(
        (c) => c.key
      );

    type Row = {
      id: string;
      total_score: number;
      status: string | null;
      submitted_at: string | null;
      criteria_scores: CriteriaScores;
      team_id: string;
      jury_id: string;
      event_id: string;
      teams: {
        team_name: string;
        chapter_id: string;
        problem_statements: { title: string } | null;
      } | null;
      jury_assignments: {
        jury_name: string;
        archetype: string;
      } | null;
    };

    let rows: Row[] = [];
    if (eventIds.length > 0) {
      const { data } = await svc
        .schema("future")
        .from("evaluations")
        .select(
          "id, total_score, status, submitted_at, criteria_scores, team_id, jury_id, event_id, teams(team_name, chapter_id, problem_statements(title)), jury_assignments(jury_name, archetype)"
        )
        .in("event_id", eventIds)
        .order("submitted_at", { ascending: false });
      rows = (data as unknown as Row[]) ?? [];
    }

    const chMap = await chapterDisplayMap(svc);

    const mapped = rows.map((e) => {
      const chapterId = e.teams?.chapter_id ?? "";
      const ch = chapterId ? chMap.get(chapterId) : undefined;
      const base: Record<string, string> = {
        id: e.id,
        team_name: e.teams?.team_name ?? "",
        chapter_name: ch?.name ?? "",
        region: ch?.region ?? "",
        problem_title: e.teams?.problem_statements?.title ?? "",
        jury_name: e.jury_assignments?.jury_name ?? "",
        jury_archetype: e.jury_assignments?.archetype ?? "",
        total_score: String(e.total_score ?? ""),
        status: e.status ?? "",
        submitted_at: e.submitted_at ?? "",
      };
      if (criteriaKeys.length > 0) {
        for (const k of criteriaKeys) {
          const v = e.criteria_scores?.[k];
          base[`criterion_${k}`] = v != null ? String(v) : "";
        }
      } else {
        base.criteria_scores_json = JSON.stringify(e.criteria_scores ?? {});
      }
      return base;
    });

    const columns: { key: string; label: string }[] = [
      { key: "id", label: "ID" },
      { key: "team_name", label: "Team" },
      { key: "chapter_name", label: "Chapter" },
      { key: "region", label: "Region" },
      { key: "problem_title", label: "Problem" },
      { key: "jury_name", label: "Juror" },
      { key: "jury_archetype", label: "Juror Archetype" },
      { key: "total_score", label: "Total Score" },
      { key: "status", label: "Status" },
      { key: "submitted_at", label: "Submitted At" },
    ];
    if (criteriaKeys.length > 0) {
      for (const k of criteriaKeys) {
        columns.push({ key: `criterion_${k}`, label: `Criterion: ${k}` });
      }
    } else {
      columns.push({
        key: "criteria_scores_json",
        label: "Criteria Scores (JSON)",
      });
    }

    return csvResponse(
      `evaluations-${todayStamp()}.csv`,
      toCSV(mapped, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // chapter_progress — one row per chapter: delegate funnel counts
  // (registered → on a team → team has captain → team picked a problem)
  // ────────────────────────────────────────────────────────────────────
  if (scope === "chapter_progress") {
    const edition = await resolveEdition(svc, editionSlug);
    if (!edition) return jsonError(404, "No edition found");

    let cq = svc
      .schema("yi")
      .from("chapters")
      .select("id, name, region")
      .order("name", { ascending: true });
    if (regionFilter) cq = cq.eq("region", regionFilter);
    const { data: chapterRows } = await cq;
    const chapters =
      (chapterRows as { id: string; name: string; region: string | null }[] | null) ?? [];

    // National row sets exceed the ~1000-row PostgREST cap — page through.
    const delegates = await fetchAllRows<{ id: string; chapter_id: string }>(
      (from, to) =>
        svc
          .schema("future")
          .from("delegates")
          .select("id, chapter_id")
          .eq("edition_id", edition.id)
          .order("id", { ascending: true })
          .range(from, to)
    );
    const teams = await fetchAllRows<{
      id: string;
      chapter_id: string;
      captain_id: string | null;
      problem_statement_id: string | null;
    }>((from, to) =>
      svc
        .schema("future")
        .from("teams")
        .select("id, chapter_id, captain_id, problem_statement_id")
        .eq("edition_id", edition.id)
        .order("id", { ascending: true })
        .range(from, to)
    );
    const members = await fetchAllRows<{ delegate_id: string; team_id: string }>(
      (from, to) =>
        svc
          .schema("future")
          .from("team_members")
          .select("delegate_id, team_id")
          .order("delegate_id", { ascending: true })
          .range(from, to)
    );

    const delegateChapter = new Map(delegates.map((d) => [d.id, d.chapter_id]));
    const teamById = new Map(teams.map((t) => [t.id, t]));

    type Stat = {
      total: number;
      inTeam: number;
      withCaptain: number;
      withProblem: number;
    };
    const stats = new Map<string, Stat>();
    const stat = (chapterId: string): Stat => {
      let s = stats.get(chapterId);
      if (!s) {
        s = { total: 0, inTeam: 0, withCaptain: 0, withProblem: 0 };
        stats.set(chapterId, s);
      }
      return s;
    };

    for (const d of delegates) stat(d.chapter_id).total += 1;
    for (const m of members) {
      const chapterId = delegateChapter.get(m.delegate_id);
      const team = teamById.get(m.team_id);
      // Skip members whose delegate/team is outside this edition.
      if (!chapterId || !team) continue;
      const s = stat(chapterId);
      s.inTeam += 1;
      if (team.captain_id) s.withCaptain += 1;
      if (team.problem_statement_id) s.withProblem += 1;
    }

    const rows = chapters.map((c) => {
      const s = stats.get(c.id) ?? {
        total: 0,
        inTeam: 0,
        withCaptain: 0,
        withProblem: 0,
      };
      return {
        chapter: c.name,
        region: c.region ?? "",
        total_delegates: String(s.total),
        delegates_in_team: String(s.inTeam),
        delegates_without_team: String(s.total - s.inTeam),
        delegates_with_captain: String(s.withCaptain),
        delegates_with_problem: String(s.withProblem),
      };
    });

    const columns = [
      { key: "chapter", label: "Chapter" },
      { key: "region", label: "Region" },
      { key: "total_delegates", label: "Total Delegates" },
      { key: "delegates_in_team", label: "Delegates In A Team" },
      { key: "delegates_without_team", label: "Delegates Without Team" },
      { key: "delegates_with_captain", label: "Delegates In A Team With Captain" },
      { key: "delegates_with_problem", label: "Delegates In A Team With Problem Picked" },
    ];

    return csvResponse(
      `chapter-progress-${todayStamp()}.csv`,
      toCSV(rows, columns)
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // problem_matrix — one row per chapter, one column per problem statement
  // (P1..Pn in track order), cell = number of teams that picked it.
  // ────────────────────────────────────────────────────────────────────
  if (scope === "problem_matrix") {
    const edition = await resolveEdition(svc, editionSlug);
    if (!edition) return jsonError(404, "No edition found");

    const { data: problemRows } = await svc
      .schema("future")
      .from("problem_statements")
      .select("id, title, display_order, tracks!inner(edition_id, display_order)")
      .eq("tracks.edition_id", edition.id)
      .eq("is_active", true);
    const problems = (
      (problemRows as unknown as {
        id: string;
        title: string;
        display_order: number | null;
        tracks: { display_order: number | null } | null;
      }[]) ?? []
    ).sort(
      (a, b) =>
        (a.tracks?.display_order ?? 0) - (b.tracks?.display_order ?? 0) ||
        (a.display_order ?? 0) - (b.display_order ?? 0)
    );

    let cq = svc
      .schema("yi")
      .from("chapters")
      .select("id, name, region")
      .order("name", { ascending: true });
    if (regionFilter) cq = cq.eq("region", regionFilter);
    const { data: chapterRows } = await cq;
    const chapters =
      (chapterRows as { id: string; name: string; region: string | null }[] | null) ?? [];

    const teams = await fetchAllRows<{
      chapter_id: string;
      problem_statement_id: string | null;
    }>((from, to) =>
      svc
        .schema("future")
        .from("teams")
        .select("id, chapter_id, problem_statement_id")
        .eq("edition_id", edition.id)
        .order("id", { ascending: true })
        .range(from, to)
    );

    const counts = new Map<string, number>();
    for (const t of teams) {
      if (!t.problem_statement_id) continue;
      const key = `${t.chapter_id}|${t.problem_statement_id}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const rows = chapters.map((c) => {
      const row: Record<string, string> = {
        chapter: c.name,
        region: c.region ?? "",
      };
      problems.forEach((p, i) => {
        row[`p${i + 1}`] = String(counts.get(`${c.id}|${p.id}`) ?? 0);
      });
      return row;
    });

    const columns = [
      { key: "chapter", label: "Chapter" },
      { key: "region", label: "Region" },
      ...problems.map((p, i) => ({
        key: `p${i + 1}`,
        label: `P${i + 1}: ${p.title}`,
      })),
    ];

    return csvResponse(
      `problem-matrix-${todayStamp()}.csv`,
      toCSV(rows, columns)
    );
  }

  return jsonError(404, "Unknown scope");
}
