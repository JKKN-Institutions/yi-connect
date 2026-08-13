import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { requireFutureNationalAdmin } from "@/lib/yi-future/auth/require-access";
import { ChapterTransferPanel } from "@/components/yi-future/admin/ChapterTransferPanel";
import type {
  TransferableCollege,
  TransferableTeam,
} from "@/lib/yi-future/chapter-transfer";

export const dynamic = "force-dynamic";

type ChapterRow = { id: string; name: string; city: string | null };

// A chapter's delegate list is read in one go and grouped in memory rather than
// issuing one count per college. PostgREST caps a plain select at 1000 rows, so
// the range is set explicitly well above any real chapter and the ceiling is
// surfaced rather than silently truncating the counts (the row-cap trap).
const DELEGATE_SCAN_LIMIT = 10000;

async function loadChapters(): Promise<ChapterRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, city")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data as ChapterRow[] | null) ?? [];
}

/**
 * Colleges in the destination, keyed by name+city, resolved through
 * `merged_into` to the surviving record.
 *
 * A college cannot always move: (chapter, name, city) is unique, and that
 * constraint counts soft-merged rows too. So the screen has to know, before
 * the admin clicks, which of their selections are really merges.
 */
function buildDestinationIndex(
  rows: { id: string; name: string; city: string | null; merged_into: string | null }[]
): Map<string, string> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const key = (n: string, c: string | null) =>
    `${n.trim().toLowerCase()}|${(c ?? "").trim().toLowerCase()}`;

  const index = new Map<string, string>();
  for (const row of rows) {
    let cur = row;
    for (let hop = 0; hop < 5 && cur.merged_into; hop++) {
      const next = byId.get(cur.merged_into);
      if (!next) break;
      cur = next;
    }
    index.set(key(row.name, row.city), cur.name);
  }
  return index;
}

async function loadMovable(
  fromChapterId: string,
  toChapterId: string | null
): Promise<{
  colleges: TransferableCollege[];
  teams: TransferableTeam[];
  truncated: boolean;
}> {
  const svc = await createServiceClient();

  let destIndex = new Map<string, string>();
  if (toChapterId) {
    const { data: destRows } = await svc
      .schema("future")
      .from("colleges")
      .select("id, name, city, merged_into")
      .eq("chapter_id", toChapterId)
      .range(0, DELEGATE_SCAN_LIMIT);
    destIndex = buildDestinationIndex(
      (destRows as {
        id: string;
        name: string;
        city: string | null;
        merged_into: string | null;
      }[] | null) ?? []
    );
  }

  const { data: colRows } = await svc
    .schema("future")
    .from("colleges")
    .select("id, name, city")
    .eq("chapter_id", fromChapterId)
    .order("name", { ascending: true })
    .range(0, DELEGATE_SCAN_LIMIT);
  const colleges = (colRows as { id: string; name: string; city: string | null }[] | null) ?? [];

  const { data: delRows } = await svc
    .schema("future")
    .from("delegates")
    .select("id, college_id")
    .eq("chapter_id", fromChapterId)
    .range(0, DELEGATE_SCAN_LIMIT);
  const delegates = (delRows as { id: string; college_id: string | null }[] | null) ?? [];
  const truncated = delegates.length > DELEGATE_SCAN_LIMIT;

  const { data: memberRows } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id, team_id")
    .range(0, DELEGATE_SCAN_LIMIT);
  const members = (memberRows as { delegate_id: string; team_id: string }[] | null) ?? [];
  const onATeam = new Set(members.map((m) => m.delegate_id));

  const byCollege = new Map<string, { total: number; onTeams: number }>();
  for (const d of delegates) {
    if (!d.college_id) continue;
    const cur = byCollege.get(d.college_id) ?? { total: 0, onTeams: 0 };
    cur.total += 1;
    if (onATeam.has(d.id)) cur.onTeams += 1;
    byCollege.set(d.college_id, cur);
  }

  const { data: teamRows } = await svc
    .schema("future")
    .from("teams")
    .select("id, team_name")
    .eq("chapter_id", fromChapterId)
    .order("team_name", { ascending: true })
    .range(0, DELEGATE_SCAN_LIMIT);
  const teamList = (teamRows as { id: string; team_name: string }[] | null) ?? [];

  const memberCount = new Map<string, number>();
  for (const m of members) {
    memberCount.set(m.team_id, (memberCount.get(m.team_id) ?? 0) + 1);
  }

  return {
    truncated,
    colleges: colleges.map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      delegates: byCollege.get(c.id)?.total ?? 0,
      delegatesOnTeams: byCollege.get(c.id)?.onTeams ?? 0,
    })),
    teams: teamList.map((t) => ({
      id: t.id,
      name: t.team_name,
      members: memberCount.get(t.id) ?? 0,
    })),
  };
}

export default async function ChapterTransferPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireFutureNationalAdmin();
  const { from } = await searchParams;

  const chapters = await loadChapters();
  const fromChapter = from ? chapters.find((c) => c.id === from) ?? null : null;
  const movable = fromChapter ? await loadMovable(fromChapter.id) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/yi-future/national/admin"
        className="text-sm text-navy/60 hover:text-navy inline-flex items-center min-h-[44px]"
      >
        ← National admin
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-navy tracking-tight">
        Move a college or team to another chapter
      </h1>
      <p className="mt-2 text-sm text-navy/60 leading-relaxed">
        Students choose their chapter when they register, and sometimes they
        choose the wrong one. Moving a <strong>college</strong> also moves its
        students, so the next person who registers from that college lands in the
        right chapter. Moving a <strong>team</strong> moves every member with it,
        so a team is never split across two chapters.
      </p>

      {/* Step 1 — pick the chapter to move things OUT of. */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="from"
            className="block text-xs font-semibold text-navy mb-1.5"
          >
            Chapter to move from
          </label>
          <select
            id="from"
            name="from"
            defaultValue={from ?? ""}
            className="px-3 py-2 border border-navy/20 rounded-md text-sm min-w-[16rem]"
          >
            <option value="">Choose a chapter…</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.city ? ` — ${c.city}` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 min-h-[44px] rounded-md bg-navy text-white text-sm font-semibold"
        >
          Show what can move
        </button>
      </form>

      {fromChapter && movable && (
        <>
          {movable.truncated && (
            <p
              role="alert"
              className="mt-4 text-xs font-semibold text-red-600"
            >
              This chapter has more students than this page can count in one go,
              so the numbers below may be low. Move in smaller batches and
              re-check afterwards.
            </p>
          )}
          <ChapterTransferPanel
            fromChapter={{ id: fromChapter.id, name: fromChapter.name }}
            chapters={chapters
              .filter((c) => c.id !== fromChapter.id)
              .map((c) => ({ id: c.id, name: c.name }))}
            colleges={movable.colleges}
            teams={movable.teams}
          />
        </>
      )}

      {fromChapter && movable && movable.colleges.length === 0 && movable.teams.length === 0 && (
        <p className="mt-6 text-sm text-navy/60">
          {fromChapter.name} has no colleges or teams on file, so there is
          nothing to move.
        </p>
      )}
    </div>
  );
}
