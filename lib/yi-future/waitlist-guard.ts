// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — abuse guard for the PUBLIC "notify me when registration
// reopens" waitlist on /yi-future/join.
//
// Why this exists: on 2026-08-07 between 16:56 and 19:10 UTC a script posted
// 2,358,427 faker.js addresses to future.registration_waitlist at ~440 rows a
// second, leaving the table 99.99% synthetic (2,358,610 rows, 183 genuine).
//
// The registration form next to it survived that same attack untouched,
// because it calls checkRegistrationAbuse(). The waitlist was added later and
// never called anything — it was the one public writer with no lock on it.
// That is the lesson worth keeping: a guard existing is not protection, a
// guard being CALLED is. Any new public writer must call one of these on the
// day it ships.
//
// Same three layers as registration-guard.ts, cheapest first:
//   1. Per-IP cap    — 200 sign-ups / rolling 24h from one address.
//   2. Burst breaker — 60 sign-ups platform-wide / rolling 5 min.
//   3. Turnstile     — Cloudflare bot challenge, DORMANT until keys are set.
// ═══════════════════════════════════════════════════════════════════════

import { verifyTurnstile } from "@/lib/yuva/turnstile";
import { callerIp, type GuardResult } from "@/lib/yi-future/registration-guard";
import type { createServiceClient } from "@/lib/yi-future/supabase/server";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/** Sign-ups allowed from a single IP in a rolling 24h window.
 *
 *  Generous on purpose: an entire campus shares one public NAT address, and
 *  the waitlist is exactly what a lecturer sharing the link in class produces
 *  — the busiest genuine cluster on record is 15 students in 9 minutes on
 *  2026-08-10, all from one region. 200 sits far above any plausible single
 *  campus while capping a "low and slow" script that deliberately stays under
 *  the burst breaker at 200 rows a day instead of the 2.36M that landed. */
const MAX_PER_IP_PER_DAY = 200;

/** Platform-wide circuit breaker.
 *
 *  60 is measured, not guessed. The busiest genuine 5-minute window across all
 *  213 real rows is 14 (2026-08-10 08:00, a college sharing the link), so 60
 *  sits ~4.3x above real peak demand and a genuine drive is never touched.
 *  The attack ran ~130,000 per 5-minute window, so it trips this within its
 *  first second and caps damage at dozens of rows rather than millions.
 *
 *  This is the load-bearing control: a per-IP cap alone does nothing against
 *  an attacker rotating addresses. It is self-healing (rolling window), so it
 *  clears on its own once a flood stops. */
const BURST_WINDOW_MINUTES = 5;
const MAX_PLATFORM_PER_BURST = 60;

/** Blocked responses are deliberately HONEST rather than the neutral
 *  "we've noted your email".
 *
 *  Silently returning success while discarding the row is the silent-failure
 *  pattern: a genuine student walks away believing they are on the list when
 *  they are not. Because the breaker sits 4.3x above real peak, a genuine
 *  student seeing this is rare — and when it happens they deserve to be told
 *  to try again rather than be lied to. */
const IP_ERROR =
  "Too many sign-ups from this network today. Please try again tomorrow.";
const BURST_ERROR =
  "We're getting a lot of sign-ups right now — please wait a minute and try again.";
const CHALLENGE_ERROR =
  "We couldn't verify that you're a person. Please refresh the page and try again.";

/**
 * Run every abuse check for a public waitlist sign-up.
 *
 * Returns the caller IP on success so it can be persisted on the new row —
 * that column is what makes the per-IP cap durable, and it is the forensic
 * trail if this happens again.
 *
 * Fails CLOSED on the bot challenge (an unverifiable token is rejected) and
 * OPEN on counter-query errors: a transient database hiccup must not stop a
 * genuine student leaving their email, and the burst breaker still applies.
 */
export async function checkWaitlistAbuse(
  svc: ServiceClient,
  editionId: string,
  turnstileToken: string | null
): Promise<GuardResult> {
  const ip = await callerIp();

  // 1) Bot challenge. No-op returning true while TURNSTILE_SECRET_KEY is
  //    unset, so this stays dormant until the keys are added in Vercel.
  if (!(await verifyTurnstile(turnstileToken, ip ?? undefined))) {
    return { ok: false, error: CHALLENGE_ERROR };
  }

  // 2) Platform-wide burst breaker. Checked first because it is one indexed
  //    count and it is the control that stops a distributed script rotating
  //    through addresses. Rides idx_waitlist_edition_created.
  const burstSince = new Date(
    Date.now() - BURST_WINDOW_MINUTES * 60_000
  ).toISOString();
  // `registration_waitlist` predates the last `supabase gen types` run and is
  // absent from Database["future"], so these two counts take the same cast the
  // insert in registration-window.ts uses.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: burstCount, error: burstErr } = await (svc as any)
    .schema("future")
    .from("registration_waitlist")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", editionId)
    .gte("created_at", burstSince);

  if (!burstErr && (burstCount ?? 0) >= MAX_PLATFORM_PER_BURST) {
    return { ok: false, error: BURST_ERROR };
  }

  // 3) Per-IP cap over a rolling 24h window. Rides idx_waitlist_ip_created.
  if (ip) {
    const daySince = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: ipCount, error: ipErr } = await (svc as any)
      .schema("future")
      .from("registration_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", daySince);

    if (!ipErr && (ipCount ?? 0) >= MAX_PER_IP_PER_DAY) {
      return { ok: false, error: IP_ERROR };
    }
  }

  return { ok: true, ip };
}
