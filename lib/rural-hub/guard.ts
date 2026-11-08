// ═══════════════════════════════════════════════════════════════════════
// Yi Rural Hub — abuse guard for the PUBLIC village feedback form.
//
// Same lesson as lib/yi-future/waitlist-guard.ts: on 2026-08-07 a script put
// 2.36M fake rows through a public writer that never called a guard. A guard
// existing is not protection; a guard being CALLED is. The feedback action
// calls this before every insert.
//
// Layers, cheapest first:
//   1. Honeypot  — a hidden field people never fill; bots that fill every
//                  input are refused.
//   2. Burst     — 60 forms per survey across everyone in a rolling 5 min.
//   3. Per-IP    — 150 forms from one address in a rolling 24h.
//
// Thresholds are generous on purpose. A village meeting is ~40 people sending
// at once, often on one mobile network that shares a public address (carrier
// NAT), so per-IP must sit well above a full hall. Blocked people get an
// HONEST message, never a fake "thank you" (that is the silent-failure trap).
// Counter errors fail OPEN: a database hiccup must not lose a villager's
// answers, and the burst breaker still applies on the next request.
// ═══════════════════════════════════════════════════════════════════════

import { callerIp } from "@/lib/yi-future/registration-guard";
import type { createAdminSupabaseClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

/** `rural_hub_feedback` is newer than the generated Database types, so it
 *  takes the same untyped cast the waitlist guard uses for its new table. */
export function ruralFeedbackTable(sb: AdminClient) {
  return (sb as any).schema("yi_connect").from("rural_hub_feedback");
}

const BURST_WINDOW_MINUTES = 5;
const MAX_PER_BURST = 60;
const MAX_PER_IP_PER_DAY = 150;

// [TAMIL_TBD] Tamil lines for these two messages, after native review.
const BURST_ERROR =
  "Many people are sending at once. Please wait a minute and try again.";
const IP_ERROR =
  "Too many forms from this network today. Please try again tomorrow.";
const BOT_ERROR = "Could not send. Please refresh the page and try again.";

export type RuralGuardResult =
  | { ok: true; ip: string | null }
  | { ok: false; error: string };

export async function checkRuralFeedbackAbuse(
  sb: AdminClient,
  surveyKey: string,
  honeypot: string
): Promise<RuralGuardResult> {
  if (honeypot.trim() !== "") return { ok: false, error: BOT_ERROR };

  const ip = await callerIp();

  const burstSince = new Date(
    Date.now() - BURST_WINDOW_MINUTES * 60_000
  ).toISOString();
  const { count: burst, error: burstErr } = await ruralFeedbackTable(sb)
    .select("id", { count: "exact", head: true })
    .eq("survey_key", surveyKey)
    .gte("created_at", burstSince);
  if (!burstErr && (burst ?? 0) >= MAX_PER_BURST) {
    return { ok: false, error: BURST_ERROR };
  }

  if (ip) {
    const daySince = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: perIp, error: ipErr } = await ruralFeedbackTable(sb)
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", daySince);
    if (!ipErr && (perIp ?? 0) >= MAX_PER_IP_PER_DAY) {
      return { ok: false, error: IP_ERROR };
    }
  }

  return { ok: true, ip };
}
