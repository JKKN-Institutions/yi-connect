import { TEAM_SIZE_MIN } from "@/lib/yi-future/constants";

/** Synchronous team-readiness check — safe to import into server components. */
export function validateTeamForSubmission(team: {
  members_count: number;
  captain_id: string | null;
  problem_statement_id: string | null;
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (team.members_count < TEAM_SIZE_MIN) {
    errors.push(`Team must have at least ${TEAM_SIZE_MIN} members.`);
  }
  if (!team.captain_id) errors.push("Captain not set.");
  if (!team.problem_statement_id) errors.push("Problem statement not picked.");
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}
