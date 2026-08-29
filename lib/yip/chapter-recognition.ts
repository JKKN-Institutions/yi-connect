// Best Chapter Performer — the ranking rule, as a pure function.
//
// Director ruling (2026-08-29): one performer recognised per chapter, sitting
// ABOVE the 15 competitive awards. It is a RECOGNITION layer — "just to
// recognise more" — not a 16th award. Its whole point is to reach individuals
// the 15 did not, so a member who already holds one of the 15 stands aside and
// the recognition passes to the next-highest scorer in their chapter.
//
// WHY THIS IS A SEPARATE, READ-ONLY TRACK AND NOT PART OF computeResults()
// ───────────────────────────────────────────────────────────────────────
// computeResults() assigns ONE award per student SCARCEST-POOL-FIRST, so that a
// role-locked award (Best Speaker — pool of 1) is placed before an open-merit
// award and cannot go empty. A per-chapter award is an ULTRA-scarce pool: only
// that chapter's own members. Folding it into that pass would therefore assign
// it FIRST across every chapter, take each chapter's top scorers, and leave the
// headline awards to whoever remained — Best Parliamentarian would stop going to
// the best parliamentarian. This module reads the computed results and never
// writes them, so the award pass is untouched.
//
// The 3-individual-awards-per-school cap deliberately does NOT apply here
// (Director declined it when offered): capping would defeat "recognise more".

/** One member of the House, as this rule needs to see them. */
export type ChapterPerformerRow = {
  participantId: string;
  participantName: string | null;
  /** Null until yip.participants.yi_chapter_id is populated. */
  chapterId: string | null;
  chapterName: string | null;
  /**
   * The House metric this recognition ranks on (avg_score).
   * null = no marks on record. Never coerce that to 0: in this system zero
   * marks means no result row at all, so a null score is an ABSENCE of a
   * result, not a bad one, and must never be rankable.
   */
  score: number | null;
  /**
   * False when the results engine kept this member out of the House ranking
   * entirely (incomplete attendance — computeResults leaves rank null and gives
   * them no award). Someone the House did not rank cannot be recognised by it.
   */
  rankedInHouse: boolean;
  /**
   * Award labels this member already holds — for DISPLAY only, so an organiser
   * can see at a glance why a name was passed over. It deliberately does NOT
   * drive the skip rule: results.award_category is an overloaded column that
   * also carries "Not ranked — …" text, and a reason string must never be
   * mistaken for an award. The authority for skipping is `alreadyAwarded`.
   */
  awardLabels: readonly string[];
};

/** A member's placing inside their own chapter. */
export type ChapterPerformerStanding = {
  /** 1-based placing within the chapter. */
  position: number;
  participantId: string;
  participantName: string | null;
  /**
   * The score this placing was earned on, or null when the caller withheld the
   * number from this viewer. The ranking itself is always computed on a real
   * number — null here only ever means "not shown", never "not scored".
   */
  score: number | null;
  awardLabels: readonly string[];
  /** True = already holds one of the 15, so cannot take the recognition. */
  holdsExistingAward: boolean;
  /** True on exactly one standing per chapter, or none at all. */
  isBestChapterPerformer: boolean;
};

/** Why a chapter has no Best Chapter Performer. Always stated, never implied. */
export type NoWinnerReason =
  | "all-eligible-members-already-awarded"
  | "no-eligible-members";

export type ChapterRecognition = {
  chapterId: string;
  chapterName: string | null;
  /** Members of this chapter who were scored AND ranked by the House. */
  eligibleMemberCount: number;
  /** Best five in the chapter, in order. Organiser-only — see the action. */
  topFive: ChapterPerformerStanding[];
  /** The designated performer, or null with `noWinnerReason` set. */
  winner: ChapterPerformerStanding | null;
  noWinnerReason: NoWinnerReason | null;
};

export type ChapterRecognitionResult = {
  /** One entry per chapter that had at least one eligible member. */
  chapters: ChapterRecognition[];
  /** Members carrying no chapter — chapters have not been assigned yet. */
  unassignedMemberCount: number;
  /** Members with no marks, or whom the House did not rank. */
  ineligibleMemberCount: number;
};

/**
 * How many members a chapter's organiser-only shortlist shows.
 * Five per the Director's ruling; the House and the students see only the one.
 */
export const CHAPTER_SHORTLIST_SIZE = 5;

/**
 * Why the screen has nothing to show, when it has nothing to show.
 *
 * These are kept apart on purpose. "No chapters assigned yet" and "nobody
 * qualified" look identical as an empty list but mean opposite things, and an
 * organiser who reads the first as the second concludes the recognition is
 * broken. Each state carries its own instruction in the UI.
 */
export type ChapterRecognitionState =
  | "ok"
  | "forbidden"
  | "no-results"
  | "chapters-not-assigned";

/** What the organiser screen renders, empty states included. */
export type ChapterRecognitionView = {
  state: ChapterRecognitionState;
  /**
   * Whether this viewer may see the numbers behind the order. Organisers get
   * the ranked five (Director, 2026-08-29) but raw marks remain restricted to
   * score-cleared roles, so standings come back with `score: null` for them.
   */
  scoresVisible: boolean;
  result: ChapterRecognitionResult;
};

/** The empty view, so every early return in the action has one shape. */
export function emptyChapterRecognitionView(
  state: ChapterRecognitionState
): ChapterRecognitionView {
  return {
    state,
    scoresVisible: false,
    result: {
      chapters: [],
      unassignedMemberCount: 0,
      ineligibleMemberCount: 0,
    },
  };
}

/**
 * Deterministic total order over a chapter's members: highest score first, then
 * name, then participant id.
 *
 * The tiebreak matters because two runs over the same data must produce the
 * same five names in the same order — an organiser who refreshes the page and
 * sees a different second place has no way to tell a tie from a bug. Score
 * alone is not a total order (scores tie), and name alone is not either (names
 * repeat), so participant id — unique by construction — is the final key and
 * makes the order total. Plain string comparison is used rather than
 * localeCompare so the order cannot shift with the server's locale data.
 */
function byStandingOrder(
  a: ChapterPerformerRow,
  b: ChapterPerformerRow
): number {
  // Only eligible rows are ever sorted, so both scores are real numbers here;
  // the ?? 0 is a type guard, not a scoring decision.
  const aScore = a.score ?? 0;
  const bScore = b.score ?? 0;
  if (aScore !== bScore) return bScore - aScore;

  const aName = a.participantName ?? "";
  const bName = b.participantName ?? "";
  if (aName !== bName) return aName < bName ? -1 : 1;

  return a.participantId < b.participantId ? -1 : 1;
}

/** A member can be recognised only if the House both marked and ranked them. */
function isEligible(row: ChapterPerformerRow): boolean {
  return row.rankedInHouse && typeof row.score === "number";
}

/**
 * Rank each chapter's members and designate one Best Chapter Performer.
 *
 * @param rows           every member of the event, chapter-tagged where known.
 * @param alreadyAwarded participant ids holding one of the 15 competitive
 *                       awards. Passed in rather than read off the rows so the
 *                       caller — which knows the round's real award set — owns
 *                       that judgement, and so no free-text column can ever be
 *                       mistaken for an award (see `awardLabels` above).
 *
 * Chapters come back ordered by name, then id, for the same
 * refresh-must-look-the-same reason as the standings.
 */
export function rankChapterPerformers(
  rows: readonly ChapterPerformerRow[],
  alreadyAwarded: ReadonlySet<string>
): ChapterRecognitionResult {
  let unassignedMemberCount = 0;
  let ineligibleMemberCount = 0;

  // Group by chapter, counting what we drop so the UI can say WHY a chapter is
  // thin rather than presenting a short list as if it were the whole story.
  const byChapter = new Map<
    string,
    { chapterName: string | null; members: ChapterPerformerRow[] }
  >();

  for (const row of rows) {
    if (!row.chapterId) {
      unassignedMemberCount++;
      continue;
    }
    if (!isEligible(row)) {
      ineligibleMemberCount++;
      continue;
    }
    const bucket = byChapter.get(row.chapterId);
    if (bucket) {
      bucket.members.push(row);
      // First non-null name wins — a chapter's name should not depend on which
      // of its members happened to be read first.
      if (!bucket.chapterName && row.chapterName) {
        bucket.chapterName = row.chapterName;
      }
    } else {
      byChapter.set(row.chapterId, {
        chapterName: row.chapterName,
        members: [row],
      });
    }
  }

  const chapters: ChapterRecognition[] = [];

  for (const [chapterId, bucket] of byChapter) {
    const ordered = [...bucket.members].sort(byStandingOrder);

    // The recognition goes to the highest-ranked member NOT already holding one
    // of the 15 — the whole point being to reach someone new.
    const winnerRow = ordered.find((m) => !alreadyAwarded.has(m.participantId));

    const topFive: ChapterPerformerStanding[] = ordered
      .slice(0, CHAPTER_SHORTLIST_SIZE)
      .map((m, index) => ({
        position: index + 1,
        participantId: m.participantId,
        participantName: m.participantName,
        score: m.score,
        awardLabels: m.awardLabels,
        holdsExistingAward: alreadyAwarded.has(m.participantId),
        isBestChapterPerformer: m.participantId === winnerRow?.participantId,
      }));

    // The designated performer is usually inside the shortlist, but need not be:
    // if all five leaders already hold awards the recognition passes to sixth
    // place or beyond. Build the winner from the row itself in that case so it
    // is never silently lost just for falling outside the top five.
    let winner: ChapterPerformerStanding | null = null;
    if (winnerRow) {
      winner =
        topFive.find((s) => s.participantId === winnerRow.participantId) ?? {
          position: ordered.indexOf(winnerRow) + 1,
          participantId: winnerRow.participantId,
          participantName: winnerRow.participantName,
          score: winnerRow.score,
          awardLabels: winnerRow.awardLabels,
          holdsExistingAward: false,
          isBestChapterPerformer: true,
        };
    }

    chapters.push({
      chapterId,
      chapterName: bucket.chapterName,
      eligibleMemberCount: ordered.length,
      topFive,
      winner,
      // A chapter with no performer is returned AS a chapter with a stated
      // reason. Forcing a winner would break the Director's rule; dropping the
      // chapter would read as "this chapter had nobody", which is not true.
      noWinnerReason: winner
        ? null
        : ordered.length === 0
          ? "no-eligible-members"
          : "all-eligible-members-already-awarded",
    });
  }

  chapters.sort((a, b) => {
    const aName = a.chapterName ?? "";
    const bName = b.chapterName ?? "";
    if (aName !== bName) return aName < bName ? -1 : 1;
    return a.chapterId < b.chapterId ? -1 : 1;
  });

  return { chapters, unassignedMemberCount, ineligibleMemberCount };
}
