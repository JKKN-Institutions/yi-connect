import "server-only";

/**
 * Yi-Future check-in DESK gate — fail closed, deny explicitly.
 *
 * A volunteer is not a Supabase Auth user: they hold a 6-character code and
 * carry a `yifuture_session` cookie with `{ type:"volunteer", id, edition_id,
 * name }` (the flat Yi-Future session shape — NOT YIP's discriminated union).
 * Everything that matters is therefore re-resolved from the DB on EVERY call:
 *
 *   • the volunteer row must still exist,
 *   • is_active must not be false,
 *   • access_code must still be issued (revoking = setting it NULL, and that
 *     must kill the live desk on the next tap, not at the next login),
 *   • edition_id must match the cookie (a stale cookie from a past edition
 *     cannot act on the current one),
 *   • the station must be one that serves check-in.
 *
 * Any of those being null/unknown DENIES. Nothing is trusted from the cookie
 * except "which volunteer row claims this session".
 *
 * Mirrors lib/yip/auth/volunteer-station.ts. Not a "use server" module: it
 * returns a live supabase client, which is not boundary-serialisable.
 */

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import {
  isCheckInStation,
  stationLabel,
  type VolunteerStation,
} from "@/lib/yi-future/volunteers";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export type DeskVolunteer = {
  id: string;
  full_name: string;
  chapter_id: string;
  edition_id: string;
  station: VolunteerStation;
};

/**
 * Why a desk request was refused. The UI maps these to a specific sentence —
 * a volunteer standing at a desk must never see a bare spinner or a bounce.
 */
export type DeskDenyReason =
  | "no_session" // not signed in, or signed in as someone else
  | "not_found" // volunteer row deleted
  | "inactive" // is_active = false
  | "revoked" // access_code cleared
  | "wrong_edition" // cookie is from another edition
  | "wrong_station"; // station does not serve check-in

export type DeskAuth =
  | { ok: true; volunteer: DeskVolunteer; supabase: ServiceClient }
  | { ok: false; reason: DeskDenyReason; error: string };

/**
 * Resolve the caller's volunteer identity. `requireCheckIn` adds the
 * station check — read-only screens can pass false, but anything that writes
 * attendance MUST leave it true.
 */
export async function requireDeskVolunteer(
  requireCheckIn = true
): Promise<DeskAuth> {
  const session = await readSession();
  if (!session || session.type !== "volunteer" || !session.id) {
    return {
      ok: false,
      reason: "no_session",
      error:
        "You are not signed in as a volunteer. Enter your 6-character volunteer code again.",
    };
  }

  const supabase = await createServiceClient();

  // future.volunteers is new and not in the generated types → loose client
  // (the established cross-schema pattern in this app).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .schema("future")
    .from("volunteers")
    .select(
      "id, full_name, chapter_id, edition_id, station, is_active, access_code"
    )
    .eq("id", session.id)
    .maybeSingle();

  const row = data as {
    id: string;
    full_name: string | null;
    chapter_id: string | null;
    edition_id: string | null;
    station: string | null;
    is_active: boolean | null;
    access_code: string | null;
  } | null;

  if (!row) {
    return {
      ok: false,
      reason: "not_found",
      error:
        "This volunteer record no longer exists. Ask your chapter chair to add you again.",
    };
  }
  if (row.is_active === false) {
    return {
      ok: false,
      reason: "inactive",
      error:
        "Your desk access was switched off. Ask your chapter chair to turn it back on.",
    };
  }
  if (!row.access_code) {
    return {
      ok: false,
      reason: "revoked",
      error:
        "Your volunteer code was revoked. Ask your chapter chair for a new code.",
    };
  }
  // Fail CLOSED: a null chapter or edition can never be matched, so it denies.
  if (!row.chapter_id || !row.edition_id || row.edition_id !== session.edition_id) {
    return {
      ok: false,
      reason: "wrong_edition",
      error:
        "This sign-in is for a different Future edition. Sign in again with your current code.",
    };
  }
  if (requireCheckIn && !isCheckInStation(row.station)) {
    return {
      ok: false,
      reason: "wrong_station",
      error: `Your station (${stationLabel(
        row.station
      )}) does not do check-in. Ask your chapter chair to move you to the Check-in Desk.`,
    };
  }

  return {
    ok: true,
    supabase,
    volunteer: {
      id: row.id,
      full_name: row.full_name ?? "Volunteer",
      chapter_id: row.chapter_id,
      edition_id: row.edition_id,
      station: (row.station ?? "floating") as VolunteerStation,
    },
  };
}

/**
 * Verify a phase_event belongs to the caller volunteer's own chapter + edition.
 * Fails closed on a null chapter/edition, so an unresolvable session denies.
 */
export async function assertSessionInMyChapter(
  supabase: ServiceClient,
  volunteer: DeskVolunteer,
  phaseEventId: string
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  if (!phaseEventId) {
    return { ok: false, error: "Pick a session first." };
  }
  const { data } = await supabase
    .schema("future")
    .from("phase_events")
    .select("id, title, chapter_id, edition_id")
    .eq("id", phaseEventId)
    .maybeSingle();

  const ev = data as unknown as {
    id: string;
    title: string | null;
    chapter_id: string | null;
    edition_id: string | null;
  } | null;

  if (
    !ev ||
    !ev.chapter_id ||
    !ev.edition_id ||
    ev.chapter_id !== volunteer.chapter_id ||
    ev.edition_id !== volunteer.edition_id
  ) {
    return {
      ok: false,
      error: "That session is not one of your chapter's sessions.",
    };
  }
  return { ok: true, title: ev.title ?? "Session" };
}

/**
 * Verify a delegate belongs to the caller volunteer's own chapter + edition.
 * The UI list is NOT the gate — this is.
 */
export async function assertDelegateInMyChapter(
  supabase: ServiceClient,
  volunteer: DeskVolunteer,
  delegateId: string
): Promise<{ ok: true; fullName: string } | { ok: false; error: string }> {
  if (!delegateId) {
    return { ok: false, error: "No delegate selected." };
  }
  const { data } = await supabase
    .schema("future")
    .from("delegates")
    .select("id, full_name, chapter_id, edition_id, is_active")
    .eq("id", delegateId)
    .maybeSingle();

  const d = data as unknown as {
    id: string;
    full_name: string | null;
    chapter_id: string | null;
    edition_id: string | null;
    is_active: boolean | null;
  } | null;

  if (
    !d ||
    !d.chapter_id ||
    !d.edition_id ||
    d.chapter_id !== volunteer.chapter_id ||
    d.edition_id !== volunteer.edition_id
  ) {
    return {
      ok: false,
      error: "That delegate is not registered in your chapter.",
    };
  }
  if (d.is_active === false) {
    return {
      ok: false,
      error: "That delegate's registration is not active — send them to the chair.",
    };
  }
  return { ok: true, fullName: d.full_name ?? "Delegate" };
}
