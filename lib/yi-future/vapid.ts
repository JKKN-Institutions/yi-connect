/**
 * VAPID (Voluntary Application Server Identification) key helpers.
 *
 * ── HOW TO GENERATE KEYS LOCALLY ─────────────────────────────────────
 * Run once, then add to Vercel env (and .env.local for dev):
 *
 *   node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k))"
 *
 * Produces: { "publicKey": "...", "privateKey": "..." }
 *
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY = publicKey   (exposed to client — required)
 *   VAPID_PRIVATE_KEY            = privateKey  (server-only — required)
 *   VAPID_SUBJECT                = mailto:admin@yiyuva.in  (contact for push service)
 * ─────────────────────────────────────────────────────────────────────
 */

export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return key && key.length > 0 ? key : null;
}

export function getVapidPrivateKey(): string | null {
  const key = process.env.VAPID_PRIVATE_KEY;
  return key && key.length > 0 ? key : null;
}

export function getVapidSubject(): string {
  return process.env.VAPID_SUBJECT || "mailto:admin@yiyuva.in";
}

export function hasVapidConfig(): boolean {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}
