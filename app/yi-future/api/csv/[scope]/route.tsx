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
 * Auth: requires Supabase auth user (v1). Refine to chapter membership / role
 * checks once the admin RBAC settles.
 */

import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { toCSV, csvResponse } from "@/lib/yi-future/csv";
import {
  aggregateEvaluations,
  type CriteriaScores,
} from "@/lib/yi-future/rubric";

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
  const legacyChapterId = url.searchParams.get("chapter_id");
  // New filter params
  const chapterFilter = url.searchParams.get("chapter");
  const regionFilter = url.searchParams.get("region");
  const editionSlug = url.searchParams.get("edition");

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
      };

      const { data } = await svc
        .schema("future")
        .from("delegates")
        .select(
          "id, full_name, email, phone, course, year_of_study, home_state, access_code, registered_at, profile_completion_pct, points"
        )
        .eq("chapter_id", legacyChapterId)
        .order("full_name", { ascending: true });

      const rows = ((data as unknown as Row[]) ?? []).map((d) => ({
        id: d.id,
        full_name: d.full_name,
        email: d.email ?? "",
        phone: d.phone ?? "",
        college: d.course ?? "",
        year_of_study: d.year_of_study != null ? String(d.year_of_study) : "",
        home_state: d.home_state ?? "",
        access_code: d.access_code,
        registered_at: d.registered_at ?? "",
        profile_completion_pct:
          d.profile_completion_pct != null
            ? String(d.profile_completion_pct)
            : "",
        points: d.points != null ? String(d.points) : "0",
      }));

      const columns = [
        { key: "id", label: "ID" },
        { key: "full_name", label: "Full Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "college", label: "College/Course" },
        { key: "year_of_study", label: "Year of Study" },
        { key: "home_state", label: "Home State" },
        { key: "access_code", label: "Access Code" },
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
    };

    let q = svc
      .schema("future")
      .from("delegates")
      .select(
        "id, full_name, email, phone, whatsapp, gender, age, course, year_of_study, home_state, registered_at, chapter_id, colleges(name, city)"
      )
      .eq("edition_id", edition.id)
      .order("full_name", { ascending: true });

    if (chapterFilter) q = q.eq("chapter_id", chapterFilter);

    if (regionFilter) {
      const ids = (await chapterIdsForRegion(svc, regionFilter)) ?? [];
      if (ids.length === 0) {
        return csvResponse(
          `delegates-${todayStamp()}.csv`,
          toCSV([], [{ key: "id", label: "ID" }])
        );
      }
      q = q.in("chapter_id", ids);
    }

    const { data } = await q;
    const chMap = await chapterDisplayMap(svc);

    const rows = ((data as unknown as Row[]) ?? []).map((d) => {
      const ch = chMap.get(d.chapter_id);
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
        team_members: { delegate_id: string }[];
      };

      const { data } = await svc
        .schema("future")
        .from("teams")
        .select(
          // Phase E fix 2026-05-23: the FK constraint is named
          // `teams_leader_delegate_id_fkey` (column is leader_delegate_id),
          // not `teams_leader_id_fkey`. Using the wrong constraint name
          // makes PostgREST drop the leader column silently.
          "id, team_name, is_frozen, frozen_at, status, leader:delegates!teams_leader_delegate_id_fkey(full_name), captain:delegates!teams_captain_id_fkey(full_name), problem_statements(title), team_members(delegate_id)"
        )
        .eq("chapter_id", legacyChapterId)
        .order("team_name", { ascending: true });

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
      team_members: { delegate_id: string }[];
    };

    let q = svc
      .schema("future")
      .from("teams")
      .select(
        "id, team_name, status, created_at, chapter_id, captain:delegates!teams_captain_id_fkey(full_name), problem_statements(title, tracks(name)), team_members(delegate_id)"
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
      { key: "access_code", label: "Access Code" },
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

  return jsonError(404, "Unknown scope");
}
