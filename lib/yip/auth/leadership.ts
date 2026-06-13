import "server-only";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireParticipantSession } from "@/lib/yip/auth/yip-session";

/**
 * Server-side gate for student LEADERSHIP actions (Speaker rules on motions,
 * ministers respond, etc.). A leadership action is reachable on yip.* tables
 * whose write policies are open, so this gate — NOT the UI hiding a screen — is
 * the authorization layer.
 *
 * Two checks, both fail-closed:
 *   1. requireParticipantSession: the caller's yip_session cookie owns
 *      `participantId` for `eventId` (can't act as another student).
 *   2. parliament_role ∈ allowed (re-fetched from the DB, never trusted from
 *      the client).
 */
export type LeadershipGate =
  | {
      ok: true;
      participant: {
        id: string;
        event_id: string;
        parliament_role: string | null;
        ministry: string | null;
        full_name: string;
      };
    }
  | { ok: false; error: string };

export async function requireLeadershipRole(
  participantId: string,
  eventId: string,
  allowed: readonly string[]
): Promise<LeadershipGate> {
  const sess = await requireParticipantSession(participantId, eventId);
  if (!sess.ok) return { ok: false, error: sess.error };

  const supabase = await createServiceClient();
  const { data: p } = await supabase
    .from("participants")
    .select("id, event_id, parliament_role, ministry, full_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!p) return { ok: false, error: "Participant not found for this event" };
  if (!p.parliament_role || !allowed.includes(p.parliament_role)) {
    return { ok: false, error: "Your role does not have access to this action." };
  }
  return { ok: true, participant: p };
}

/** Presiding officers who may process motions. nominated_speaker is a candidate, NOT presiding. */
export const PRESIDING_ROLES = ["speaker", "deputy_speaker"] as const;
