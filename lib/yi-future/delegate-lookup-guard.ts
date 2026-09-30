// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — abuse guard for the PUBLIC returning-delegate lookup on
// /yi-future/join (`lookupReturningDelegate`).
//
// Why this exists: #863 closed the actual leak — the lookup used to match on
// email OR phone, so one email address returned that student's phone number.
// It now requires email AND phone on the SAME row, which makes enumeration a
// 10^10 search. That PR closed with an explicit debt note: "No rate limiter on
// this action … a durable per-IP counter would need its own storage. Worth
// adding as defence-in-depth later." This is that counter.
//
// So this is a SECOND lock on a door that is already shut. Its job is not to
// stop enumeration (#863 did that) but to stop anyone hammering the endpoint:
// each call is a 4-way join across a 16,712-row table, and the 2026-08-07
// registration flood plus the 2,358,427-row waitlist flood are both on record
// as what an unmetered public writer on this exact page attracts.
//
// Two layers, cheapest first:
//   1. Per-IP cap    — 800 lookups / rolling 15 min from one address.
//   2. Burst breaker — 1,200 lookups platform-wide / rolling 5 min.
//
// Deliberately NO Turnstile layer, unlike its two sibling guards. The
// Turnstile widget only renders on section 4 of the form; the lookup fires on
// the section 1 → 2 transition, so there is no token to present. Wiring it in
// would silently break every lookup the day TURNSTILE_SECRET_KEY is set.
// ═══════════════════════════════════════════════════════════════════════

import { callerIp, type GuardResult } from "@/lib/yi-future/registration-guard";
import type { createServiceClient } from "@/lib/yi-future/supabase/server";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/** Lookups allowed from a single IP in a rolling 15-minute window.
 *
 *  800 is measured, not guessed. `future.delegates.registration_ip` is NULL on
 *  all 16,712 rows (the column landed after registrations closed), so the
 *  honest proxy for "how much genuine traffic arrives from one address" is the
 *  college: an entire campus shares one public NAT address. The busiest genuine
 *  campus burst on record is 259 registrations in a rolling 15 minutes
 *  (Vignan's Institute of Information Technology); the next two are 118 and 78.
 *
 *  Registrations undercount lookups — this action fires on every section 1 → 2
 *  transition, so page reloads and students who abandon before submitting all
 *  produce lookups with no row to show for it. Allowing 3 lookups per eventual
 *  registration puts the worst genuine campus at 259 x 3 = 777, so 800 is the
 *  first round number that never touches it, and it still caps a single-address
 *  script at 76,800/day instead of the unlimited it has today. */
const IP_WINDOW_MINUTES = 15;
const MAX_PER_IP_PER_WINDOW = 800;

/** Platform-wide circuit breaker: the load-bearing control, because a per-IP
 *  cap does nothing against a script rotating addresses.
 *
 *  1,200 is where two independent derivations meet. Measured: the busiest
 *  genuine platform-wide burst is 195 registrations per rolling 5 minutes
 *  (15,845 genuine rows, 2026-06-01 to 2026-08-10, excluding the 2026-08-07
 *  flood), so 1,200 sits 6.2x above real peak demand. Structural: the
 *  registration guard next door already admits 400 registrations per 5 minutes,
 *  and at 3 lookups per registration anything below 1,200 here would trip
 *  first — this guard would silently become the real, unmeasured cap on
 *  registration itself. Self-healing: a blocked request writes nothing, so the
 *  rolling count decays and the breaker releases once a flood stops. */
const BURST_WINDOW_MINUTES = 5;
const MAX_PLATFORM_PER_BURST = 1200;

/** Ceiling on rows one blocked address may add to the counter table.
 *
 *  Blocked per-IP attempts are recorded (an unrecorded block is invisible to
 *  whoever investigates the next incident), but recording them without a
 *  ceiling would let a hammering script grow this table the way the same page
 *  grew `registration_waitlist` to 2.36M rows. Past the ceiling the address
 *  stays blocked and simply stops being written down. */
const BLOCK_RECORD_MARGIN = 200;

/** Every rejection is HONEST and reaches the student.
 *
 *  Returning `null` — indistinguishable from "no previous registration found" —
 *  would be the silent-failure pattern: the form would quietly skip the
 *  Welcome-back pre-fill and nobody would ever know a limit exists. Because
 *  the caps sit 3x and 6.2x above measured peak demand a genuine student
 *  seeing these is rare, and when it happens they are told what happened. */
const IP_ERROR =
  "Too many lookups from this network just now. Please wait a few minutes — " +
  "you can keep filling in the form, nothing is lost.";
const BURST_ERROR =
  "We're checking a lot of registrations right now — please wait a minute. " +
  "You can keep filling in the form, nothing is lost.";
const UNAVAILABLE_ERROR =
  "We couldn't check for a previous registration just now. Please carry on " +
  "and fill in your details as normal.";

/**
 * Run every abuse check for a public returning-delegate lookup.
 *
 * Fails CLOSED throughout, which is the opposite of its two sibling guards and
 * is deliberate. Those gate REGISTRATION, where refusing a genuine student is
 * expensive, so they fail open on a counter hiccup. This gates an OPTIONAL
 * PRE-FILL: the worst a false denial costs is that a returning student types
 * details they could have had auto-filled, and the form carries on regardless.
 * Failing open here would instead make it possible for the guard to be quietly
 * inert — a guard existing is not protection, a guard running is.
 *
 * So: no resolvable caller IP → deny. Counter query errors → deny.
 */
export async function checkDelegateLookupAbuse(
  svc: ServiceClient
): Promise<GuardResult> {
  const ip = await callerIp();

  // 1) No identity, no lookup. On Vercel `x-forwarded-for` is always present on
  //    a real request, so a missing IP means something is proxying around the
  //    edge — exactly when a limit matters most.
  if (!ip) {
    return { ok: false, error: UNAVAILABLE_ERROR };
  }

  // `delegate_lookup_attempts` postdates the last `supabase gen types` run and
  // is absent from Database["future"], so these calls take the same cast the
  // waitlist counts use.
  const table = () => (svc as any).schema("future").from("delegate_lookup_attempts");

  // 2) Per-IP cap over a rolling window. Rides idx_dla_ip_created.
  const ipSince = new Date(Date.now() - IP_WINDOW_MINUTES * 60_000).toISOString();
  const { count: ipCount, error: ipErr } = await table()
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", ipSince);

  if (ipErr) return { ok: false, error: UNAVAILABLE_ERROR };

  const seen = ipCount ?? 0;
  if (seen >= MAX_PER_IP_PER_WINDOW) {
    // Record the refusal so a blocked address is attributable afterwards, but
    // only up to the ceiling, so the counter cannot be grown without bound.
    if (seen < MAX_PER_IP_PER_WINDOW + BLOCK_RECORD_MARGIN) {
      await table().insert({ ip, blocked: true });
    }
    return { ok: false, error: IP_ERROR };
  }

  // 3) Platform-wide burst breaker. Rides idx_dla_created.
  const burstSince = new Date(
    Date.now() - BURST_WINDOW_MINUTES * 60_000
  ).toISOString();
  const { count: burstCount, error: burstErr } = await table()
    .select("id", { count: "exact", head: true })
    .gte("created_at", burstSince);

  if (burstErr) return { ok: false, error: UNAVAILABLE_ERROR };

  if ((burstCount ?? 0) >= MAX_PLATFORM_PER_BURST) {
    // Deliberately NOT recorded: once this trips, every caller is blocked, so
    // writing a row per refusal would amplify the very flood that tripped it.
    // The flood is already visible in the count that did trip it.
    return { ok: false, error: BURST_ERROR };
  }

  // 4) Allowed — record it so it counts towards both windows.
  const { error: writeErr } = await table().insert({ ip, blocked: false });
  if (writeErr) return { ok: false, error: UNAVAILABLE_ERROR };

  return { ok: true, ip };
}
