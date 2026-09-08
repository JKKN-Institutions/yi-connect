"use server";

/**
 * YIP global search — one box that finds everything the CURRENT viewer is
 * allowed to see, and nothing else.
 *
 * Search is a uniquely leaky surface: it lets someone type a guess and learn
 * from the result whether the guess was right. Every blindness rule YIP
 * enforces on a page therefore has to be re-enforced here, or the search box
 * becomes the way around it. The rules live in lib/yip/search/ — `viewer.ts`
 * decides WHO may see WHAT, this file only executes that decision.
 *
 * Three invariants hold for EVERY viewer, including national super-admins:
 *   • no access codes are searched or returned (a search box that matches on a
 *     credential is a credential-guessing oracle);
 *   • no emails, phones or school names are searched or returned (the
 *     participants are minors);
 *   • no scores anywhere — those are canViewScores-gated and belong on the
 *     Results page, so a search snippet can never leak a named minor's mark.
 *
 * Replaces the earlier `searchEverything`, which covered three groups on one
 * dashboard page and — because it only understood Supabase Auth — answered
 * "Not authenticated" to every juror and student.
 */

import { createServiceClient } from "@/lib/yip/supabase/server";
import { effectiveMinistries } from "@/lib/yip/cabinet";
import { juryLabel } from "@/lib/yip/pii";
import { matchPages } from "@/lib/yip/search/pages";
import {
  resolveSearchViewer,
  scopedEventIds,
  viewerAllowsGroup,
} from "@/lib/yip/search/viewer";
import {
  sanitizeSearchQuery,
  SEARCH_GROUP_LIMIT,
  SEARCH_GROUP_ORDER,
  SEARCH_MIN_QUERY,
  SEARCH_TOTAL_LIMIT,
  type SearchGroupKey,
  type SearchHit,
  type SearchResponse,
  type SearchViewer,
} from "@/lib/yip/search/types";

/**
 * The only tables the search may read. Declared as a literal union rather than
 * `string` so a typo, or a future edit pointing at a table that holds
 * credentials, fails at compile time instead of at runtime.
 */
type SearchableTable =
  | "participants"
  | "parties"
  | "agenda"
  | "bills"
  | "questions"
  | "motions"
  | "jury_assignments"
  | "volunteers";

/** One searchable table, reduced to what the search actually needs. */
type GroupSpec = {
  group: SearchGroupKey;
  table: SearchableTable;
  /** Columns selected. NEVER add a credential or contact column here. */
  select: string;
  /** Columns matched with ILIKE. Must be a subset of `select`. */
  match: readonly string[];
  /**
   * Columns matched for a viewer who may NOT see names (`canSeeNames: false`).
   * Omit when the group carries no name at all.
   *
   * Redacting only the DISPLAYED title is not enough. If a juror can type
   * "Ashmitha" and get back "Participant 115", they have just learned the
   * name→number mapping, and blind scoring is defeated by the search box even
   * though no name was ever rendered. A match is an answer. So for those
   * viewers the name column is removed from the QUERY, not just from the output.
   */
  matchWhenBlind?: readonly string[];
  toHit: (row: Record<string, unknown>, ctx: HitContext) => SearchHit | null;
};

type HitContext = {
  viewer: SearchViewer;
  eventNameById: Map<string, string>;
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const eventNameOf = (row: Record<string, unknown>, ctx: HitContext) =>
  ctx.eventNameById.get(str(row.event_id)) ?? null;

/**
 * Truncate free text used as a result title. Bills, questions and motions carry
 * long prose; an untrimmed row would blow out the palette and, worse, could
 * spill more of a document into a hover than the viewer needs.
 */
function snippet(text: string, max = 90): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

const GROUP_SPECS: readonly GroupSpec[] = [
  {
    group: "participants",
    table: "participants",
    // full_name is selected because STAFF are allowed to see it. For a juror we
    // deliberately drop it below and render the blind number label instead —
    // the same rule the jury quick-jump already follows.
    select: "id, full_name, constituency_name, constituency_number, event_id",
    match: ["full_name", "constituency_name"],
    // A juror searches by the same handles their quick-jump bar already uses —
    // constituency name and number — and by nothing that could reveal who a
    // number belongs to.
    matchWhenBlind: ["constituency_name"],
    toHit: (row, ctx) => {
      const eventId = str(row.event_id);
      const num = typeof row.constituency_number === "number"
        ? row.constituency_number
        : null;
      // A juror must never be shown a delegate's real name, and search is not
      // an exception to that. They get the same "Participant 115" label the
      // scoring screen uses.
      const title = ctx.viewer.canSeeNames
        ? str(row.full_name)
        : juryLabel(num, str(row.id));
      if (!title) return null;
      return {
        group: "participants",
        id: `participant:${str(row.id)}`,
        title,
        subtitle: ctx.viewer.canSeeNames
          ? [str(row.constituency_name), eventNameOf(row, ctx)]
              .filter(Boolean)
              .join(" · ") || null
          : null,
        // Jurors have no participant detail page; send them to their scoring
        // screen, which is the only place they may act on a delegate.
        href:
          ctx.viewer.kind === "jury"
            ? "/yip/jury"
            : `/yip/dashboard/events/${eventId}/participants`,
      };
    },
  },
  {
    group: "parties",
    table: "parties",
    select: "id, name, party_number, tagline, event_id",
    match: ["name", "tagline"],
    toHit: (row, ctx) => ({
      group: "parties",
      id: `party:${str(row.id)}`,
      title: str(row.name) || "Party",
      subtitle: eventNameOf(row, ctx),
      href:
        ctx.viewer.kind === "participant"
          ? "/yip/me"
          : `/yip/dashboard/events/${str(row.event_id)}/parties`,
    }),
  },
  {
    group: "agenda",
    table: "agenda",
    select: "id, title, session_key, day, event_id",
    match: ["title"],
    toHit: (row, ctx) => {
      const day = typeof row.day === "number" ? row.day : null;
      const dayLabel = day === 0 ? "Pre-Event" : day != null ? `Day ${day}` : null;
      return {
        group: "agenda",
        id: `agenda:${str(row.id)}`,
        title: str(row.title) || "Session",
        subtitle: [dayLabel, eventNameOf(row, ctx)].filter(Boolean).join(" · ") || null,
        // Everyone lands somewhere they may actually stand: staff on the
        // agenda editor, a juror on their scoring screen, a student on the
        // running order they can read.
        href:
          ctx.viewer.kind === "staff"
            ? `/yip/dashboard/events/${str(row.event_id)}/agenda`
            : ctx.viewer.kind === "jury"
              ? "/yip/jury"
              : "/yip/me",
      };
    },
  },
  {
    group: "bills",
    table: "bills",
    select: "id, title, committee_name, event_id",
    match: ["title", "committee_name"],
    toHit: (row, ctx) => ({
      group: "bills",
      id: `bill:${str(row.id)}`,
      title: snippet(str(row.title)) || "Bill",
      subtitle: [str(row.committee_name), eventNameOf(row, ctx)]
        .filter(Boolean)
        .join(" · ") || null,
      href: `/yip/dashboard/events/${str(row.event_id)}/bills`,
    }),
  },
  {
    group: "questions",
    table: "questions",
    select: "id, question_text, directed_to_ministry, event_id",
    match: ["question_text"],
    toHit: (row, ctx) => ({
      group: "questions",
      id: `question:${str(row.id)}`,
      title: snippet(str(row.question_text)) || "Question",
      subtitle: [str(row.directed_to_ministry), eventNameOf(row, ctx)]
        .filter(Boolean)
        .join(" · ") || null,
      href: `/yip/dashboard/events/${str(row.event_id)}/questions`,
    }),
  },
  {
    group: "motions",
    table: "motions",
    // raised_by_name is a denormalised participant name, so it is matched and
    // shown only where the viewer may see names at all (staff-only group).
    select: "id, subject, motion_type, raised_by_name, event_id",
    match: ["subject", "raised_by_name"],
    // Same rule: raised_by_name is a delegate's real name. Never matched for a
    // viewer who is not allowed to see names.
    matchWhenBlind: ["subject"],
    toHit: (row, ctx) => ({
      group: "motions",
      id: `motion:${str(row.id)}`,
      title: snippet(str(row.subject)) || "Motion",
      subtitle: [str(row.motion_type).replace(/_/g, " "), eventNameOf(row, ctx)]
        .filter(Boolean)
        .join(" · ") || null,
      href: `/yip/dashboard/events/${str(row.event_id)}/motions`,
    }),
  },
  {
    group: "jury",
    table: "jury_assignments",
    // jury_name ONLY. The table also holds access_code and email; selecting
    // either here would put a login credential one keystroke from a text box.
    select: "id, jury_name, event_id",
    match: ["jury_name"],
    toHit: (row, ctx) => ({
      group: "jury",
      id: `jury:${str(row.id)}`,
      title: str(row.jury_name) || "Jury member",
      subtitle: eventNameOf(row, ctx),
      href: `/yip/dashboard/events/${str(row.event_id)}/jury`,
    }),
  },
  {
    group: "volunteers",
    table: "volunteers",
    // full_name ONLY — same reasoning as jury above (phone / access_code exist
    // on this table and must never be searchable).
    select: "id, full_name, event_id",
    match: ["full_name"],
    toHit: (row, ctx) => ({
      group: "volunteers",
      id: `volunteer:${str(row.id)}`,
      title: str(row.full_name) || "Volunteer",
      subtitle: eventNameOf(row, ctx),
      href: `/yip/dashboard/events/${str(row.event_id)}/volunteers`,
    }),
  },
] as const;

export async function searchYip(query: string): Promise<SearchResponse> {
  const raw = (query ?? "").trim();
  if (raw.length < SEARCH_MIN_QUERY) return { success: true, hits: [] };

  // WHO is asking, and what may they see? Fail closed: no session by either
  // mechanism means no search at all.
  const viewer = await resolveSearchViewer();
  if (!viewer) return { success: false, error: "Not signed in" };

  const scope = scopedEventIds(viewer);
  // A viewer scoped to an EMPTY set sees nothing. This must never fall through
  // to an unfiltered query.
  if (scope === null) return { success: true, hits: [] };

  const safe = sanitizeSearchQuery(raw);
  if (safe.length < SEARCH_MIN_QUERY) return { success: true, hits: [] };
  const like = `%${safe}%`;
  const qLower = safe.toLowerCase();

  const svc = await createServiceClient();

  // ── Events the viewer may see, fetched once and reused as the scope for
  // every other group (and as the name lookup for subtitles) ───────────────
  let eventsQuery = svc
    .from("events")
    .select("id, name, chapter_name, status, cabinet_ministries");
  if (scope !== "all") eventsQuery = eventsQuery.in("id", scope);
  const { data: eventRows, error: eventsError } = await eventsQuery;
  if (eventsError) return { success: false, error: eventsError.message };

  const allowed = eventRows ?? [];
  if (allowed.length === 0) return { success: true, hits: [] };

  const allowedIds = allowed.map((e) => e.id);
  const eventNameById = new Map(allowed.map((e) => [e.id, e.name as string]));
  const ctx: HitContext = { viewer, eventNameById };

  const byGroup = new Map<SearchGroupKey, SearchHit[]>();
  const put = (hits: SearchHit[]) => {
    for (const h of hits) {
      const arr = byGroup.get(h.group) ?? [];
      if (arr.length >= SEARCH_GROUP_LIMIT) continue;
      arr.push(h);
      byGroup.set(h.group, arr);
    }
  };

  // ── Events (matched in memory over the already-authorized set) ───────────
  if (viewerAllowsGroup(viewer, "events")) {
    put(
      allowed
        .filter(
          (e) =>
            String(e.name ?? "").toLowerCase().includes(qLower) ||
            String(e.chapter_name ?? "").toLowerCase().includes(qLower)
        )
        .slice(0, SEARCH_GROUP_LIMIT)
        .map((e) => ({
          group: "events" as const,
          id: `event:${e.id}`,
          title: String(e.name ?? "Event"),
          subtitle:
            [e.chapter_name, e.status].filter(Boolean).join(" · ") || null,
          href: `/yip/dashboard/events/${e.id}`,
        }))
    );
  }

  // ── Ministries (derived per event, not a table) ──────────────────────────
  if (viewerAllowsGroup(viewer, "ministries")) {
    const hits: SearchHit[] = [];
    for (const e of allowed) {
      if (hits.length >= SEARCH_GROUP_LIMIT) break;
      for (const m of effectiveMinistries(e.cabinet_ministries)) {
        if (hits.length >= SEARCH_GROUP_LIMIT) break;
        if (
          m.label.toLowerCase().includes(qLower) ||
          m.key.toLowerCase().includes(qLower)
        ) {
          hits.push({
            group: "ministries",
            id: `ministry:${e.id}:${m.key}`,
            title: m.label,
            subtitle: String(e.name ?? ""),
            href: `/yip/dashboard/events/${e.id}/cabinet`,
          });
        }
      }
    }
    put(hits);
  }

  // ── Table-backed groups, run concurrently ───────────────────────────────
  const specs = GROUP_SPECS.filter((s) => viewerAllowsGroup(viewer, s.group));
  const results = await Promise.all(
    specs.map(async (spec) => {
      // Which columns this VIEWER may match on. A viewer who cannot see names
      // must not be able to probe for them either — see `matchWhenBlind`.
      const matchCols = viewer.canSeeNames
        ? spec.match
        : (spec.matchWhenBlind ?? spec.match);
      // A group whose only searchable columns were names has nothing left to
      // match on for this viewer; skip it rather than querying for everything.
      if (matchCols.length === 0) return [] as SearchHit[];

      const { data, error } = await svc
        .from(spec.table)
        .select(spec.select)
        .in("event_id", allowedIds)
        .or(matchCols.map((c) => `${c}.ilike.${like}`).join(","))
        .limit(SEARCH_GROUP_LIMIT);
      // One failing group must not take the whole palette down with it.
      if (error) return [] as SearchHit[];
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      return rows
        .map((row) => spec.toHit(row, ctx))
        .filter((h): h is SearchHit => h !== null);
    })
  );
  for (const r of results) put(r);

  // ── Pages / screens (pure, in-memory, viewer-filtered) ───────────────────
  if (viewerAllowsGroup(viewer, "pages")) {
    put(matchPages(safe, viewer));
  }

  // Flatten in the canonical display order so the client renders groups the
  // same way every time regardless of which query resolved first.
  const hits: SearchHit[] = [];
  for (const g of SEARCH_GROUP_ORDER) {
    for (const h of byGroup.get(g) ?? []) {
      if (hits.length >= SEARCH_TOTAL_LIMIT) break;
      hits.push(h);
    }
  }

  return { success: true, hits };
}
