import { buildRejectionNotice } from "./submission-review";

// future.announcements is not in the generated types, so the client is loosely
// typed — the established pattern (see app/yi-future/actions/announcements.ts).
type LooseClient = any;

export type RejectionNoticeResult =
  | { ok: true; announcementId: string }
  | { ok: false; error: string };

/**
 * Saves the in-app notice that tells a team one of its phases was sent back.
 *
 * Stored exactly like a chapter admin's own team-targeted announcement:
 * audience "team", author_scope "chapter", with the team's own chapter and
 * edition. That is what the delegate feed (getDelegateAnnouncementFeed) reads —
 * it shows a team notice only to delegates on that team's team_members list, in
 * the same edition and chapter — so the notice reaches that team and nobody
 * else, and it also appears in the chapter's sent-announcements history.
 *
 * Takes the caller's service client. Never throws: it runs after the rejection
 * is saved, and failing to tell the team must not undo that. The caller logs a
 * failure.
 */
export async function insertRejectionNotice(
  svc: LooseClient,
  input: {
    teamId: string;
    phase: string;
    reason: string;
    authorUserId: string | null;
  }
): Promise<RejectionNoticeResult> {
  try {
    const { data: teamRow, error: teamError } = await svc
      .schema("future")
      .from("teams")
      .select("id, chapter_id, edition_id")
      .eq("id", input.teamId)
      .maybeSingle();
    if (teamError) {
      return { ok: false, error: `team lookup failed: ${teamError.message}` };
    }
    const team = teamRow as {
      id: string;
      chapter_id: string | null;
      edition_id: string | null;
    } | null;
    if (!team) return { ok: false, error: "team not found" };
    if (!team.edition_id) return { ok: false, error: "team has no edition" };

    let chapterName: string | null = null;
    if (team.chapter_id) {
      const { data: chapter } = await svc
        .schema("future")
        .from("chapters")
        .select("name")
        .eq("id", team.chapter_id)
        .maybeSingle();
      chapterName = (chapter as { name: string | null } | null)?.name ?? null;
    }

    const notice = buildRejectionNotice(input.phase, input.reason);
    const { data, error } = await svc
      .schema("future")
      .from("announcements")
      .insert({
        edition_id: team.edition_id,
        author_user_id: input.authorUserId,
        // Signed the way the chapter's own announcements are.
        author_name: chapterName
          ? `${chapterName} Chapter Team`
          : "Chapter Team",
        author_scope: "chapter",
        audience: "team",
        chapter_id: team.chapter_id,
        team_id: team.id,
        delegate_id: null,
        title: notice.title,
        body: notice.body,
        url: notice.url,
      })
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    const id = (data as { id: string } | null)?.id;
    if (!id) return { ok: false, error: "insert returned no row" };
    return { ok: true, announcementId: id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
