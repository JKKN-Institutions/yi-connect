// Shared contract for moving colleges and teams between Yi chapters.
//
// Lives in lib/ rather than beside the server action because a "use server"
// file may export ONLY async functions — a type or a constant exported from one
// breaks the Vercel build.

export type TransferEntityType = "college" | "team";

/** One college in the source chapter, with how many delegates would follow it. */
export type TransferableCollege = {
  id: string;
  name: string;
  city: string | null;
  delegates: number;
  /** Delegates at this college who are also on a team. Those teams do NOT move
   *  unless the team is selected too — this is what warns the admin. */
  delegatesOnTeams: number;
  /**
   * Name of the college in the DESTINATION chapter that this one would be
   * merged into, or null when it can simply move.
   *
   * A college cannot always move: `uq_colleges_chapter_name_city` makes
   * (chapter, lower(name), lower(city)) unique, so if the destination already
   * has the same college the move is refused by the database. That is not an
   * edge case — the first real use of this screen hit it on 5 of 12 colleges.
   * When a twin exists the right answer is a MERGE, and the admin is told
   * which record their students will land in before they click.
   */
  mergesIntoName: string | null;
};

/** One team in the source chapter, with how many members would follow it. */
export type TransferableTeam = {
  id: string;
  name: string;
  members: number;
};

export type TransferPlanLine = {
  entityType: TransferEntityType;
  entityId: string;
  entityName: string;
  delegatesMoved: number;
  /** Set on a college that collides with one already in the destination: its
   *  students are repointed to this record and the source is soft-merged. */
  mergeTargetId?: string | null;
  mergeTargetName?: string | null;
};

/**
 * Nothing may move without a reason, and the reason is what makes the log
 * readable a year later. Kept short enough to fit a column comfortably.
 */
export const TRANSFER_REASON_MAX = 500;

/**
 * A guard against a mis-click wiping a chapter. A single submission moving more
 * than this many delegates is refused with a message rather than executed; a
 * genuinely larger move can be done in batches, which also keeps each one
 * reviewable in the log.
 */
export const TRANSFER_DELEGATE_CAP = 500;
