// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — Cloudflare Turnstile server verification (abuse hardening).
// Spec: Known Issue P2 — "CAPTCHA/Turnstile on public apply + OTP endpoints".
//
// ENV-GATED + graceful NO-OP:
//   • TURNSTILE_SECRET_KEY unset  → verifyTurnstile() returns true (no-op).
//     The public apply + OTP flows keep working exactly as before keys exist.
//   • TURNSTILE_SECRET_KEY set    → POST to Cloudflare siteverify and enforce
//     the result. Any failure (missing token, network error, non-2xx,
//     unparsable body) → false, so a real challenge is required.
//
// Never throws: callers can `if (!(await verifyTurnstile(token, ip)))` safely.
//
// Companion env var (client widget): NEXT_PUBLIC_TURNSTILE_SITE_KEY.
// Both must be set in Vercel for enforcement to take effect; with neither
// set the feature is fully dormant.
// ═══════════════════════════════════════════════════════════════════════

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * @param token  The widget response token from the client (or null/"").
 * @param ip     Optional caller IP (remoteip) for Cloudflare's check.
 * @returns      true if verification passes OR the feature is disabled
 *               (no secret); false only when enforcement is on and the
 *               token is missing/invalid or the request fails.
 */
export async function verifyTurnstile(
  token: string | null,
  ip?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Feature disabled → no-op. Live forms keep working until keys are added.
  if (!secret) return true;

  // Enforcement is ON from here: a missing token is an immediate fail.
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!res.ok) return false;

    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Network/parse error while enforcing → fail closed.
    return false;
  }
}
