import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { SopDownloadCard } from "@/components/yi-future/SopDownloadCard";

const REGIONS = ["ER", "NER", "NR", "SRTKKA", "SRTN", "WR"] as const;
const REGION_LABELS: Record<string, string> = {
  ER: "East",
  NER: "North-East",
  NR: "North",
  SRTKKA: "South (TN/KKA)",
  SRTN: "South (TN)",
  WR: "West",
};

type Region = (typeof REGIONS)[number];

interface ScopeDef {
  scope: string;
  title: string;
  description: string;
  /** Whether this scope respects the region filter when downloading/counting. */
  regional: boolean;
}

const SCOPES: ScopeDef[] = [
  {
    scope: "chapters",
    title: "Chapters",
    description:
      "All Yi chapters with chair contact + finale-host flags. Region filter narrows the list.",
    regional: true,
  },
  {
    scope: "delegates",
    title: "Delegates",
    description:
      "Every registered delegate with college, chapter, and region joined for spreadsheet use.",
    regional: true,
  },
  {
    scope: "teams",
    title: "Teams",
    description:
      "All teams with chapter, track, problem statement, captain, and member count.",
    regional: true,
  },
  {
    scope: "chapter_progress",
    title: "Chapter Progress",
    description:
      "One row per chapter: total delegates, in a team, without a team, in a team with captain, in a team with problem picked.",
    regional: true,
  },
  {
    scope: "problem_matrix",
    title: "Problem Statement Matrix",
    description:
      "One row per chapter, one column per problem statement (P1–P12 in track order) — cell = teams that picked it.",
    regional: true,
  },
  {
    scope: "colleges",
    title: "Colleges",
    description:
      "All colleges captured during registration — approved + pending, with Yi YUVA flag.",
    regional: true,
  },
  {
    scope: "mentors",
    title: "Mentors",
    description:
      "Chapter mentors with expertise, organization, and access code. Region filter narrows by chapter.",
    regional: true,
  },
  {
    scope: "jury",
    title: "Jury",
    description:
      "All jury (chapter + national) with archetype, scope, contact, and access code.",
    regional: false,
  },
  {
    scope: "partners",
    title: "Corporate Partners",
    description:
      "Event partners with jury/sponsor/internship flags, contact, and access code.",
    regional: false,
  },
  {
    scope: "evaluations",
    title: "Evaluations",
    description:
      "Submitted juror scores with team, chapter, problem, archetype, and per-criterion columns.",
    regional: false,
  },
  {
    scope: "editions",
    title: "Editions",
    description:
      "All editions with current stage and finale visibility cutoffs. Audit reference.",
    regional: false,
  },
  {
    scope: "chair_credentials_template",
    title: "Chair credentials template",
    description:
      "Empty CSV with the right column headers for batching chair login provisioning. No passwords included.",
    regional: false,
  },
];

async function getActiveEdition(): Promise<{
  id: string;
  name: string;
  slug: string;
} | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, name, slug")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string; name: string; slug: string } | null) ?? null;
}

async function getChapterIdsForRegion(region: Region): Promise<string[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id")
    .eq("region", region);
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id);
}

async function countScope(
  scope: string,
  ctx: { editionId: string | null; chapterIds: string[] | null }
): Promise<number> {
  const svc = await createServiceClient();
  const { editionId, chapterIds } = ctx;

  // chapter_progress / problem_matrix — one row per chapter
  if (scope === "chapter_progress" || scope === "problem_matrix") {
    let q = svc
      .schema("yi")
      .from("chapters")
      .select("id", { count: "exact", head: true });
    if (chapterIds) {
      if (chapterIds.length === 0) return 0;
      q = q.in("id", chapterIds);
    }
    const { count } = await q;
    return count ?? 0;
  }

  // chapters
  if (scope === "chapters") {
    let q = svc
      .schema("yi")
      .from("chapters")
      .select("id", { count: "exact", head: true });
    if (chapterIds) {
      if (chapterIds.length === 0) return 0;
      q = q.in("id", chapterIds);
    }
    const { count } = await q;
    return count ?? 0;
  }

  // delegates
  if (scope === "delegates") {
    if (!editionId) return 0;
    let q = svc
      .schema("future")
      .from("delegates")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", editionId);
    if (chapterIds) {
      if (chapterIds.length === 0) return 0;
      q = q.in("chapter_id", chapterIds);
    }
    const { count } = await q;
    return count ?? 0;
  }

  // teams
  if (scope === "teams") {
    if (!editionId) return 0;
    let q = svc
      .schema("future")
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", editionId);
    if (chapterIds) {
      if (chapterIds.length === 0) return 0;
      q = q.in("chapter_id", chapterIds);
    }
    const { count } = await q;
    return count ?? 0;
  }

  // colleges
  if (scope === "colleges") {
    let q = svc
      .schema("future")
      .from("colleges")
      .select("id", { count: "exact", head: true });
    if (chapterIds) {
      if (chapterIds.length === 0) return 0;
      q = q.in("chapter_id", chapterIds);
    }
    const { count } = await q;
    return count ?? 0;
  }

  // mentors
  if (scope === "mentors") {
    if (!editionId) return 0;
    let q = svc
      .schema("future")
      .from("mentors")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", editionId);
    if (chapterIds) {
      if (chapterIds.length === 0) return 0;
      q = q.in("chapter_id", chapterIds);
    }
    const { count } = await q;
    return count ?? 0;
  }

  // jury (non-regional)
  if (scope === "jury") {
    if (!editionId) return 0;
    const { count } = await svc
      .schema("future")
      .from("jury_assignments")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", editionId);
    return count ?? 0;
  }

  // partners (non-regional, edition-scoped via events)
  if (scope === "partners") {
    if (!editionId) return 0;
    const { data: eventRows } = await svc
      .schema("future")
      .from("events")
      .select("id")
      .eq("edition_id", editionId);
    const eventIds = ((eventRows as { id: string }[] | null) ?? []).map(
      (e) => e.id
    );
    if (eventIds.length === 0) return 0;
    const { count } = await svc
      .schema("future")
      .from("corporate_partners")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds);
    return count ?? 0;
  }

  // evaluations
  if (scope === "evaluations") {
    if (!editionId) return 0;
    const { data: eventRows } = await svc
      .schema("future")
      .from("events")
      .select("id")
      .eq("edition_id", editionId);
    const eventIds = ((eventRows as { id: string }[] | null) ?? []).map(
      (e) => e.id
    );
    if (eventIds.length === 0) return 0;
    const { count } = await svc
      .schema("future")
      .from("evaluations")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds);
    return count ?? 0;
  }

  // editions
  if (scope === "editions") {
    const { count } = await svc
      .schema("future")
      .from("editions")
      .select("id", { count: "exact", head: true });
    return count ?? 0;
  }

  // template — single header row, no data rows
  if (scope === "chair_credentials_template") {
    return 0;
  }

  return 0;
}

export default async function NationalDownloadsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const params = await searchParams;
  const rawRegion = params.region ?? "";
  const region: Region | null = (REGIONS as readonly string[]).includes(
    rawRegion
  )
    ? (rawRegion as Region)
    : null;

  const edition = await getActiveEdition();
  const chapterIds = region ? await getChapterIdsForRegion(region) : null;

  // Compute counts in parallel
  const counts = await Promise.all(
    SCOPES.map((s) =>
      countScope(s.scope, {
        editionId: edition?.id ?? null,
        chapterIds: s.regional ? chapterIds : null,
      })
    )
  );

  function downloadUrl(s: ScopeDef): string {
    const sp = new URLSearchParams();
    if (s.regional && region) sp.set("region", region);
    if (edition && s.scope !== "editions" && s.scope !== "chapters" && s.scope !== "colleges" && s.scope !== "chair_credentials_template") {
      sp.set("edition", edition.slug);
    }
    const qs = sp.toString();
    return `/api/csv/${s.scope}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Downloads</h2>
          <p className="mt-1 text-sm text-navy/60">
            CSV exports for every major dataset. Filter by region to scope
            delegates, teams, colleges, mentors, and chapters.
          </p>
        </div>
      </div>

      <SopDownloadCard note="The official Solution Submission Format for delegates — circulate it to chapters and teams." />

      {/* Region filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 mr-1">
          Region
        </span>
        <Link
          href="/yi-future/national/admin/downloads"
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${
            region === null
              ? "bg-navy text-ivory border-navy"
              : "bg-white text-navy border-navy/20 hover:border-navy/40"
          }`}
        >
          All
        </Link>
        {REGIONS.map((r) => (
          <Link
            key={r}
            href={`/national/admin/downloads?region=${r}`}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${
              region === r
                ? "bg-navy text-ivory border-navy"
                : "bg-white text-navy border-navy/20 hover:border-navy/40"
            }`}
            title={REGION_LABELS[r]}
          >
            {r}
          </Link>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCOPES.map((s, i) => {
          const count = counts[i];
          const filtered = s.regional && region !== null;
          return (
            <div
              key={s.scope}
              className="bg-white border border-navy/10 rounded-lg p-4 flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-yi-gold">
                    {s.scope}
                  </div>
                  <h3 className="mt-0.5 text-base font-bold text-navy">
                    {s.title}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-navy leading-none">
                    {count}
                  </div>
                  <div className="text-[10px] text-navy/40 mt-1">
                    rows{filtered ? ` · ${region}` : ""}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-navy/60 flex-1">
                {s.description}
              </p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-[10px] text-navy/40 font-mono truncate">
                  {downloadUrl(s)}
                </span>
                <a
                  href={downloadUrl(s)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy bg-yi-gold/10 hover:bg-yi-gold/20 border border-yi-gold/30 rounded px-3 py-1.5"
                >
                  <span>↓</span> Download
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-xs text-navy/50 bg-navy/[0.02] border border-navy/10 rounded-md p-3">
        Exports respect the active edition
        {edition ? (
          <>
            {" "}
            (<span className="font-semibold text-navy/70">{edition.name}</span>,
            slug <span className="font-mono">{edition.slug}</span>)
          </>
        ) : (
          " (no active edition found)"
        )}
        . Region-aware exports (delegates, teams, colleges, mentors, chapters)
        will limit rows to the selected region; the others always return the
        full edition-scoped set. The chair credentials template is structure
        only — fill it in offline before importing.
      </div>
    </div>
  );
}
