/**
 * A signed YIQ session whose data no longer exists.
 *
 * THE BUG THIS CLOSES. `requireStudentSession()` trusts the signed cookie
 * completely and never checks that the student is still there. The cookie is
 * long-lived, and an organiser can delete a team — so a student can be
 * holding a perfectly valid, correctly signed session that points at a row
 * that is gone.
 *
 * What that looked like before: /yiq/me rendered with an empty team name and
 * blank fields, and starting a paper failed with a message about the round
 * rather than about the real cause. The student had no way to understand it
 * and no way out, because signing out was not obviously the fix.
 *
 * WHY NOT VERIFY ON EVERY CALL. `requireStudentSession()` runs on the hottest
 * path in the platform — every single answer save, roughly 30 times per
 * student per paper. Adding a database read there to catch a rare condition
 * would tax the common case to serve the exception. Instead the check runs at
 * the ENTRY POINTS, where the student arrives and where a paper begins, which
 * is where they can actually be told something useful.
 *
 * FAIL OPEN, DELIBERATELY, AND ONLY HERE. If the verification query itself
 * errors, this returns `live`. A transient database blip must not lock a
 * student out of a round that is running — and if the row really is gone,
 * every subsequent query fails anyway and the student is no worse off than
 * before this check existed. This is the opposite of the restart gate's
 * posture, and for the opposite reason: there, failing open hands out free
 * time; here, failing closed takes away a student's paper.
 */

export type StaleSessionVerdict =
  | { live: true }
  | { live: false; reason: "student_gone" | "team_gone" };

/** What the student is told. One wording, so both entry points agree. */
export const STALE_SESSION_MESSAGE =
  "Your registration is no longer on the system, so this sign-in cannot be used. This usually means your team was removed or re-registered. Ask your teacher to check the team, then sign in again with your new access code.";

/** The heading version, for a page rather than a toast. */
export const STALE_SESSION_HEADING = "This sign-in is out of date";

/**
 * Is the student behind this session still present?
 *
 * `svc` is a service client already scoped to the yiq schema. Only two ids
 * are read and only their existence matters, so this is a cheap check.
 */
export async function checkStudentSessionLive(
  svc: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          col: string,
          val: string
        ) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
      };
    };
  },
  session: { id: string; teamId: string | null }
): Promise<StaleSessionVerdict> {
  try {
    const { data: student, error: sErr } = await svc
      .from("students")
      .select("id")
      .eq("id", session.id)
      .maybeSingle();

    // See the header: a failed READ is not evidence of a missing row.
    if (sErr) return { live: true };
    if (!student) return { live: false, reason: "student_gone" };

    if (session.teamId) {
      const { data: team, error: tErr } = await svc
        .from("teams")
        .select("id")
        .eq("id", session.teamId)
        .maybeSingle();
      if (tErr) return { live: true };
      if (!team) return { live: false, reason: "team_gone" };
    }

    return { live: true };
  } catch {
    return { live: true };
  }
}
