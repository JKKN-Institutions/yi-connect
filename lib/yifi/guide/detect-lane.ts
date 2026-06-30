/**
 * YiFi guide — viewer → lane detection.
 *
 * The guide is ONE page that opens on the viewer's own lane. Detection reuses
 * YiFi's OWN auth surfaces only (NOT the dashboard's get_user_roles_detailed):
 *   - organiser:   a real Supabase session whose email is an organiser for the
 *                  current edition (yifi_check_organiser RPC).
 *   - participant: a signed `yifi_session` cookie (access-code sign-in).
 *
 * Priority (most-capable wins): organiser → participant → participant default.
 * A logged-out visitor sees the participant lane (YiFi's public entry is
 * "enter your code"), and organisers may also view the participant guide so
 * they can hand it to a founder.
 */
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import type { GuideLane } from "@/lib/yifi/guide/content";

export type DetectedLane = {
  /** The lane the page opens on. */
  lane: GuideLane;
  /** May this viewer switch to / view lanes other than their own? */
  canViewOtherLanes: boolean;
};

export async function detectGuideLane(): Promise<DetectedLane> {
  // Organiser? — a Supabase session whose email holds an organiser role.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) {
      const svc = await createServiceClient();
      const { data: edition } = await svc.rpc("yifi_current_edition");
      const editionId = edition?.id;
      if (editionId) {
        const { data: roles } = await svc.rpc("yifi_check_organiser", {
          p_email: user.email,
          p_edition_id: editionId,
        });
        if (Array.isArray(roles) && roles.length > 0) {
          return { lane: "organiser", canViewOtherLanes: true };
        }
      }
    }
  } catch {
    // fall through to participant
  }

  // Participant? — a founder carries a `yifi_session` cookie (no Supabase session).
  try {
    const cookieStore = await cookies();
    if (cookieStore.get("yifi_session")?.value) {
      return { lane: "participant", canViewOtherLanes: false };
    }
  } catch {
    // fall through
  }

  // Logged-out visitor → the public "how to attend" lane.
  return { lane: "participant", canViewOtherLanes: false };
}
