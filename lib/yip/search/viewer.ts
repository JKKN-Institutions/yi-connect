import "server-only";

import { createClient } from "@/lib/yip/supabase/server";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import {
  getRegionalAdminZones,
  getYipChapterScopes,
} from "@/lib/yi/auth/yi-directory-roles";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import type { SearchGroupKey, SearchViewer } from "./types";

/**
 * Resolve WHO is searching and WHAT they may see.
 *
 * YIP has TWO separate login systems and the search must serve both:
 *
 *   1. Supabase Auth — national / regional admins, chapter chairs, organisers.
 *      Their scope comes from yi_directory.role_assignments and can span many
 *      events.
 *   2. The HMAC-signed `yip_session` cookie — jury, participants and
 *      volunteers, who never touch Supabase Auth. Their scope is exactly ONE
 *      event, the one their access code let them into.
 *
 * The dashboard's existing search only ever handled (1), so it answered "Not
 * authenticated" to every juror and student. Handling (2) is what makes search
 * available to everyone — and is precisely why the blindness rules below have
 * to be applied here rather than trusted to the page.
 *
 * FAIL CLOSED throughout: an unreadable session, a person with no scopes, or a
 * cookie for an event that no longer exists all resolve to `null` or to an
 * EMPTY event scope, never to "everything".
 */

/** Staff who may see everything about an event they are scoped to. */
const STAFF_GROUPS: readonly SearchGroupKey[] = [
  "events",
  "participants",
  "agenda",
  "parties",
  "committees",
  "bills",
  "questions",
  "motions",
  "jury",
  "volunteers",
  "ministries",
  "pages",
] as const;

/**
 * A juror may find the SESSIONS they are marking and jump to a delegate — but
 * only by the blind number label, never by name or school. That mirrors the
 * jury quick-jump bar, which already matches on constituency number only
 * (lib/yip/pii.ts + jury-scoring-client.tsx). Bills/questions/motions are
 * excluded: a juror has no page to act on them and their text can identify a
 * delegate.
 */
const JURY_GROUPS: readonly SearchGroupKey[] = [
  "agenda",
  "participants",
  "pages",
] as const;

/**
 * A student may look up the running order and their own party / committee.
 * They may NOT search other delegates — the roster is not theirs to browse.
 */
const PARTICIPANT_GROUPS: readonly SearchGroupKey[] = [
  "agenda",
  "parties",
  "committees",
  "pages",
] as const;

/** A volunteer runs a station: the running order and their own pages. */
const VOLUNTEER_GROUPS: readonly SearchGroupKey[] = ["agenda", "pages"] as const;

/**
 * Resolve the current searcher. Returns null when nobody is signed in by
 * EITHER mechanism — the caller must then refuse the search outright.
 */
export async function resolveSearchViewer(): Promise<SearchViewer | null> {
  // ── 1. Access-code session first ────────────────────────────────────────
  // Checked BEFORE Supabase Auth deliberately: a juror or student on a shared
  // device could carry a stale Supabase cookie, and the access-code session is
  // the more specific, event-scoped claim. It is HMAC-verified by
  // getYipSession(), so a forged cookie is rejected before we get here.
  const session = await getYipSession();
  if (session) {
    // The cookie names an event; confirm it still exists before trusting it as
    // a scope. A deleted event must not resolve to an empty-but-truthy scope.
    const svc = await createServiceClient();
    const { data: ev } = await svc
      .from("events")
      .select("id")
      .eq("id", session.eventId)
      .maybeSingle();
    if (!ev) return null;

    if (session.type === "jury") {
      return {
        kind: "jury",
        eventScope: [session.eventId],
        eventId: session.eventId,
        selfId: session.id,
        // The whole point of the blind label: a juror must never be shown a
        // delegate's real name, and search is not an exception.
        canSeeNames: false,
        groups: JURY_GROUPS,
      };
    }
    if (session.type === "participant") {
      return {
        kind: "participant",
        eventScope: [session.eventId],
        eventId: session.eventId,
        selfId: session.id,
        canSeeNames: false,
        groups: PARTICIPANT_GROUPS,
      };
    }
    return {
      kind: "volunteer",
      eventScope: [session.eventId],
      eventId: session.eventId,
      selfId: session.id,
      canSeeNames: false,
      groups: VOLUNTEER_GROUPS,
    };
  }

  // ── 2. Supabase Auth (staff) ────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isSuper = await isCurrentUserSuperAdmin();
  if (isSuper) {
    return {
      kind: "staff",
      eventScope: "all",
      canSeeNames: true,
      groups: STAFF_GROUPS,
    };
  }

  const [zones, chapters] = await Promise.all([
    getRegionalAdminZones("yip"),
    getYipChapterScopes("yip"),
  ]);

  // Resolve the concrete event id set once, here, rather than calling
  // getYipEventAccess() per candidate row (one round-trip per event).
  //
  // Chapter authority covers CHAPTER **and REGIONAL** events, matching
  // getYipEventAccess() (lib/yip/auth/event-access.ts — `event.level ===
  // "chapter" || event.level === "regional"`). The dashboard search predates
  // that and still scopes to level='chapter' only, so a chapter chair can OPEN
  // their regional event but cannot FIND it. Six regional rounds run this
  // season, so that gap is live; we match event-access here.
  const svc = await createServiceClient();
  let q = svc.from("events").select("id");
  const ors = [`created_by.eq.${user.id}`];
  if (zones.length > 0) {
    ors.push(`yi_zone_code.in.(${zones.map((z) => `"${z}"`).join(",")})`);
  }
  if (chapters.length > 0) {
    const list = chapters.map((c) => `"${c}"`).join(",");
    ors.push(`and(chapter_name.in.(${list}),level.in.("chapter","regional"))`);
  }
  q = q.or(ors.join(","));

  const { data: rows, error } = await q;
  // A failed scope query must NOT fall through to an unscoped search.
  if (error) return null;

  return {
    kind: "staff",
    eventScope: (rows ?? []).map((r) => r.id),
    canSeeNames: true,
    groups: STAFF_GROUPS,
  };
}

/** True when this viewer is allowed to receive rows from `group` at all. */
export function viewerAllowsGroup(
  viewer: SearchViewer,
  group: SearchGroupKey
): boolean {
  return viewer.groups.includes(group);
}

/**
 * Apply the viewer's event scope to a query builder column. Returns null when
 * the viewer is scoped to an EMPTY set, which the caller must treat as "no
 * results" — never as "no filter".
 */
export function scopedEventIds(viewer: SearchViewer): string[] | "all" | null {
  if (viewer.eventScope === "all") return "all";
  if (viewer.eventScope.length === 0) return null;
  return viewer.eventScope;
}
