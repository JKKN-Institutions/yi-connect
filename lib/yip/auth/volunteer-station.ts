// Shared FAIL-CLOSED per-station volunteer gate.
//
// Imported by the per-station tool actions in app/yip/actions/volunteer-station.ts
// (registration / help desk / jury support / runner) AND by the "Now Speaking"
// console actions in app/yip/actions/speakers.ts. It is NOT a "use server" module:
// it returns a live supabase client, so it must stay a plain async helper (a
// "use server" file may only export POST-able, boundary-serialisable actions).
//
// The volunteer session (yip_session type="volunteer") carries NO station — only
// { id, name, eventId }. Each tool therefore DB-looks-up volunteers.station by the
// session's volunteer id and gates FAIL-CLOSED: a null station, or a station not
// in the tool's `allowed` list, is DENIED (mirrors resolveRoomAuth in
// committee-room.ts). yip.volunteers has no permissive write policy for these
// callers — the action IS the gate.

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireVolunteerSession } from "@/lib/yip/auth/yip-session";
import type { VolunteerStation } from "@/lib/yip/volunteers";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export type StationAuthOk = {
  ok: true;
  volunteerId: string;
  name: string;
  station: VolunteerStation;
  supabase: ServiceClient;
};
export type StationAuthErr = { ok: false; error: string };

/**
 * Resolve the signed volunteer session, look up their assigned station, and DENY
 * unless it is non-null AND present in `allowed`. Null/unknown station → denied.
 *
 * `deniedMessage` customises ONLY the station-mismatch denial (e.g. the Now
 * Speaking console tells the volunteer which station to ask for); a failed
 * session still surfaces its own reason.
 */
export async function requireVolunteerStation(
  eventId: string,
  allowed: VolunteerStation[],
  deniedMessage = "This tool isn't available for your station."
): Promise<StationAuthOk | StationAuthErr> {
  const session = await requireVolunteerSession(eventId);
  if (!session.ok) return { ok: false, error: session.error };
  const supabase = await createServiceClient();

  const { data: vol } = await supabase
    .from("volunteers")
    .select("station")
    .eq("id", session.volunteerId)
    .maybeSingle();

  const station = (vol?.station ?? null) as VolunteerStation | null;
  // Fail closed: no station, or a station this tool doesn't serve, is denied.
  if (!station || !allowed.includes(station)) {
    return { ok: false, error: deniedMessage };
  }
  return {
    ok: true,
    volunteerId: session.volunteerId,
    name: session.name,
    station,
    supabase,
  };
}
