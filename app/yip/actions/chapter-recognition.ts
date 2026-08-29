"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { ALL_AWARD_LABELS } from "@/lib/yip/awards";
import { fetchAllRows } from "@/lib/pagination";
import {
  emptyChapterRecognitionView,
  rankChapterPerformers,
  type ChapterPerformerRow,
  type ChapterRecognitionView,
} from "@/lib/yip/chapter-recognition";

/**
 * Best Chapter Performer — the read side.
 *
 * READ-ONLY BY DESIGN. computeResults() is not touched: this reads the results
 * it already wrote and derives one recognition per chapter over them. See
 * lib/yip/chapter-recognition.ts for why folding this into the award pass would
 * break Best Parliamentarian.
 */

/** A results row joined to just enough of its participant. */
type ResultsJoinRow = {
  participant_id: string;
  avg_score: number | null;
  rank: number | null;
  award_category: string | null;
  participant: {
    full_name: string | null;
  } | null;
};

/**
 * Every string that counts as "holds one of the awards".
 *
 * Built as the UNION of the code's allowlist and the live award_definitions
 * labels, because failing to recognise a label is the dangerous direction: an
 * unrecognised award would let a student who already has one ALSO take the
 * chapter recognition, which is exactly what the Director's ruling forbids.
 * Over-recognising only ever passes the recognition to the next name down.
 */
async function awardLabelVocabulary(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const vocabulary = new Set<string>(ALL_AWARD_LABELS);

  const { data } = await supabase.from("award_definitions").select("label");
  for (const row of (data ?? []) as { label: string | null }[]) {
    if (row.label) vocabulary.add(row.label);
  }

  return vocabulary;
}

/**
 * Split results.award_category into real award labels.
 *
 * That column is overloaded: computeResults also parks a "Not ranked — absent
 * Day 2" style reason there for day-incomplete students. Matching against the
 * vocabulary is what keeps a reason string from being read as an award.
 */
function parseAwardLabels(
  awardCategory: string | null,
  vocabulary: ReadonlySet<string>
): string[] {
  if (!awardCategory) return [];
  return awardCategory
    .split(", ")
    .map((label) => label.trim())
    .filter((label) => vocabulary.has(label));
}

/**
 * Resolve chapter ids to human names.
 *
 * yip.participants.yi_chapter_id is being added by a migration that has not been
 * applied yet, so which key it points at is not yet settled: yi.chapters.id or
 * that table's own yi_chapter_id. Try the primary key, and fall back to the
 * external one only if nothing resolved — an organiser reading raw UUIDs cannot
 * act on this screen. Names are cosmetic here; the ranking never depends on them.
 */
async function resolveChapterNames(
  supabase: SupabaseClient,
  chapterIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (chapterIds.length === 0) return names;

  const byPrimaryKey = await supabase
    .schema("yi")
    .from("chapters")
    .select("id, name")
    .in("id", chapterIds);

  for (const row of (byPrimaryKey.data ?? []) as {
    id: string;
    name: string | null;
  }[]) {
    if (row.name) names.set(row.id, row.name);
  }

  if (names.size > 0) return names;

  const byExternalId = await supabase
    .schema("yi")
    .from("chapters")
    .select("name, yi_chapter_id")
    .in("yi_chapter_id", chapterIds);

  for (const row of (byExternalId.data ?? []) as {
    name: string | null;
    yi_chapter_id: string | null;
  }[]) {
    if (row.name && row.yi_chapter_id) names.set(row.yi_chapter_id, row.name);
  }

  return names;
}

/**
 * The per-chapter recognition for one event.
 *
 * Gated on canView so the organisers who run the round can verify the shortlist
 * (Director, 2026-08-29: the top five is theirs to check). The raw marks stay
 * behind canViewScores — organisers get the ORDER and the designated name, not
 * the numbers — so this screen does not widen the 2026-06-13 score-visibility
 * ruling while still satisfying the newer one.
 *
 * Never throws and never redirects: every refusal and every empty case comes
 * back as a named state the page can explain.
 */
export async function getChapterRecognition(
  eventId: string
): Promise<ChapterRecognitionView> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return emptyChapterRecognitionView("forbidden");

  const supabase = (await createServiceClient()) as unknown as SupabaseClient;

  // Does participants.yi_chapter_id exist yet? Ask for one row and see. Probing
  // first matters because a missing column fails the WHOLE select, and a failed
  // select returns no rows — indistinguishable from "nobody qualified" unless we
  // find out which it is before reading.
  const probe = await supabase
    .from("results")
    .select("participant_id, participant:participants(yi_chapter_id)")
    .eq("event_id", eventId)
    .limit(1);

  const hasChapterColumn = !probe.error;

  const selectClause = hasChapterColumn
    ? "participant_id, avg_score, rank, award_category, participant:participants(full_name, yi_chapter_id)"
    : "participant_id, avg_score, rank, award_category, participant:participants(full_name)";

  // Paged: a regional round can carry well over the ~1000-row PostgREST cap, and
  // a truncated read here would quietly drop whole chapters off the screen.
  //
  // The cast is the same one getResults() makes: the client infers an embed as
  // an ARRAY, but results → participants is many-to-one, so PostgREST returns a
  // single object at runtime.
  const rows = await fetchAllRows<ResultsJoinRow>(
    (from, to) =>
      supabase
        .from("results")
        .select(selectClause)
        .eq("event_id", eventId)
        .order("participant_id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: ResultsJoinRow[] | null;
        error: unknown;
      }>
  );

  if (rows.length === 0) return emptyChapterRecognitionView("no-results");

  const vocabulary = await awardLabelVocabulary(supabase);

  // Award labels drive DISPLAY; the id set drives the skip rule. Keeping them
  // apart is what stops an overloaded column from deciding who is recognised.
  const alreadyAwarded = new Set<string>();
  const performerRows: ChapterPerformerRow[] = rows.map((row) => {
    const awardLabels = parseAwardLabels(row.award_category, vocabulary);
    if (awardLabels.length > 0) alreadyAwarded.add(row.participant_id);

    const chapterId = hasChapterColumn
      ? ((row.participant as { yi_chapter_id?: string | null } | null)
          ?.yi_chapter_id ?? null)
      : null;

    return {
      participantId: row.participant_id,
      participantName: row.participant?.full_name ?? null,
      chapterId,
      chapterName: null, // filled in below, once names are resolved
      score: row.avg_score,
      // computeResults leaves rank null for anyone it kept out of the House
      // ranking (incomplete attendance). They hold no award and take no
      // recognition either.
      rankedInHouse: row.rank !== null,
      awardLabels,
    };
  });

  const assignedChapterIds = [
    ...new Set(
      performerRows
        .map((row) => row.chapterId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  // No participant carries a chapter: say so. Returning an empty list here would
  // read as "nobody qualified" when the truth is "nobody has been assigned yet".
  if (assignedChapterIds.length === 0) {
    return {
      ...emptyChapterRecognitionView("chapters-not-assigned"),
      scoresVisible: access.canViewScores,
    };
  }

  const chapterNames = await resolveChapterNames(supabase, assignedChapterIds);
  for (const row of performerRows) {
    row.chapterName = row.chapterId
      ? (chapterNames.get(row.chapterId) ?? null)
      : null;
  }

  const result = rankChapterPerformers(performerRows, alreadyAwarded);

  // Withhold the marks themselves from viewers without score clearance. The
  // number is stripped from what is RETURNED rather than from what is rendered,
  // so it never reaches the browser at all.
  if (!access.canViewScores) {
    for (const chapter of result.chapters) {
      for (const standing of chapter.topFive) standing.score = null;
      if (chapter.winner) chapter.winner.score = null;
    }
  }

  return { state: "ok", scoresVisible: access.canViewScores, result };
}
