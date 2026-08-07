// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — abuse guard for the PUBLIC delegate registration form.
//
// Why this exists: on 2026-08-07 an unattributed script posted ~800 rows/min
// to /yi-future/join for 3h17m, inserting ~65,000 fake delegates and ~65,000
// fake colleges into production. The form had no rate limit and no bot
// challenge — closing registration entirely was the only way to stop it.
//
// Three layers, cheapest first:
//   1. Per-IP cap    — 1,000 registrations / rolling 24h from one address.
//   2. Burst breaker — 400 registrations platform-wide / rolling 5 min.
//   3. Turnstile     — Cloudflare bot challenge, DORMANT until keys are set.
//
// Sizing is measured against real traffic, not guessed. Busiest genuine
// 5-minute window on record: 156 (2026-07-31). Attack windows: 3,214–4,268,
// with 31 of its 33 windows far above any genuine burst. The thresholds
// therefore sit above real peak demand — a campus sharing one NAT address is
// unaffected — while a script trips the breaker in its opening minutes.
//
// The burst breaker is the load-bearing control: per-IP limits alone do not
// stop an attacker who rotates addresses. It is self-healing (rolling window),
// so a tripped breaker clears on its own once the flood stops.
// ═══════════════════════════════════════════════════════════════════════

import { headers } from "next/headers";
import { verifyTurnstile } from "@/lib/yuva/turnstile";
import type { createServiceClient } from "@/lib/yi-future/supabase/server";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/** Registrations allowed from a single IP in a rolling 24h window.
 *
 *  1,000 is deliberately high because an entire campus shares one public NAT
 *  address: the largest genuine single-college day on record is 665 students
 *  (Vignan's Institute of Information Technology, 2026-07-31), with several
 *  others in the 130–195 range. A tighter cap — 40 was tried first — would have
 *  blocked ~625 real students on that one drive alone.
 *
 *  Its job is not to stop the fast flood (the burst breaker does that) but to
 *  bound a "low and slow" script that deliberately stays under the breaker:
 *  30 rows/min from one address is only 150 per 5-min window, yet 43,200/day.
 *  This caps that at 1,000. */
const MAX_PER_IP_PER_DAY = 1000;

/** Platform-wide circuit breaker: registrations allowed in a rolling window.
 *
 *  400 is measured, not guessed. The busiest genuine 5-minute window on record
 *  is 156 (2026-07-31 06:20, a real chapter drive that sustained 91–156 for
 *  ~25 minutes), so 120 — the first value tried here — would have blocked real
 *  students repeatedly mid-drive. 400 sits ~2.6x above that worst genuine burst
 *  while the attack ran 3,214–4,268 per window, so it still trips inside the
 *  attack's opening minutes and caps damage in the low hundreds of rows rather
 *  than the 64,616 that actually landed. */
const BURST_WINDOW_MINUTES = 5;
const MAX_PLATFORM_PER_BURST = 400;

const IP_ERROR =
  "Too many registrations from this network in the last 24 hours. " +
  "Please try again tomorrow, or ask your chapter team to register you directly.";

const BURST_ERROR =
  "Registrations are busy right now — please wait a minute and try again.";

const CHALLENGE_ERROR =
  "We couldn't verify that you're a person. Please refresh the page and try again.";

export type GuardResult =
  | { ok: true; ip: string | null }
  | { ok: false; error: string };

/** First hop of x-forwarded-for (precedent: app/youth-academy/actions/apply.ts). */
export async function callerIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = h.get("x-real-ip")?.trim();
  return real ? real.slice(0, 64) : null;
}

/**
 * Run every abuse check for a public registration attempt.
 *
 * Returns the caller IP on success so the caller can persist it on the new
 * delegate row — that column is what makes the per-IP cap durable, and it is
 * the forensic trail if this ever happens again.
 *
 * Fails CLOSED on the bot challenge (an unverifiable token is rejected) and
 * OPEN on counter-query errors: a transient database hiccup must not lock
 * genuine students out of registering, and the burst breaker still applies.
 */
export async function checkRegistrationAbuse(
  svc: ServiceClient,
  editionId: string,
  turnstileToken: string | null
): Promise<GuardResult> {
  const ip = await callerIp();

  // 1) Bot challenge. No-op returning true while TURNSTILE_SECRET_KEY is
  //    unset, so this is dormant until the keys are added in Vercel.
  if (!(await verifyTurnstile(turnstileToken, ip ?? undefined))) {
    return { ok: false, error: CHALLENGE_ERROR };
  }

  // 2) Platform-wide burst breaker. Checked before the per-IP cap because it
  //    is one indexed count and it is the control that stops a distributed
  //    script rotating through addresses. Scoped to the edition so it rides
  //    the existing idx_delegates_registered_at (edition_id, registered_at).
  const burstSince = new Date(
    Date.now() - BURST_WINDOW_MINUTES * 60_000
  ).toISOString();
  const { count: burstCount, error: burstErr } = await svc
    .schema("future")
    .from("delegates")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", editionId)
    .gte("registered_at", burstSince);

  if (!burstErr && (burstCount ?? 0) >= MAX_PLATFORM_PER_BURST) {
    return { ok: false, error: BURST_ERROR };
  }

  // 3) Per-IP cap over a rolling 24h window.
  if (ip) {
    const daySince = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: ipCount, error: ipErr } = await svc
      .schema("future")
      .from("delegates")
      .select("id", { count: "exact", head: true })
      .eq("registration_ip", ip)
      .gte("registered_at", daySince);

    if (!ipErr && (ipCount ?? 0) >= MAX_PER_IP_PER_DAY) {
      return { ok: false, error: IP_ERROR };
    }
  }

  return { ok: true, ip };
}
