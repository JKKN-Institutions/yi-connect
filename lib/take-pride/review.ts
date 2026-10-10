import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { cookies } from "next/headers";
import { tpService } from "./supabase";

/*
 * Review logins: a few shared logins so outside organisers can try the app.
 *
 *   admin    -> a review desk session, SAMPLE DATA ONLY (see requireTpDesk)
 *   delegate -> sent to one sample delegate's pass
 *   catalyst -> sent to one sample partner's page
 *
 * Passwords are scrypt hashes with a random salt (never stored or logged in
 * plain text). Rows live in yi_connect.tp_review_logins and are seeded by
 * hand, not in a migration. NOT gated: callers decide what a result allows.
 */

export const TP_REVIEW_COOKIE = "tp_review";
export const TP_REVIEW_COOKIE_PATH = "/take-pride";

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const KEYLEN = 64;
const PARAMS = { N: 16384, r: 8, p: 1 } as const;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

/** "scrypt$N$r$p$saltHex$hashHex" */
export async function hashReviewPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("hex"), key.toString("hex")].join("$");
}

export async function verifyReviewPassword(password: string, stored: string): Promise<boolean> {
  const parts = (stored ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;
  try {
    const key = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// A real-looking hash so an unknown username costs the same time as a known one.
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashReviewPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

export function normaliseUsername(u: unknown): string {
  return typeof u === "string" ? u.trim().toLowerCase().slice(0, 64) : "";
}

/**
 * Locked when 5 failures fall within any 15 minutes and the 5th of them was
 * under 15 minutes ago. Returns when the lock lifts, or null.
 */
async function lockedUntil(username: string): Promise<Date | null | "error"> {
  const since = new Date(Date.now() - WINDOW_MS - LOCK_MS).toISOString();
  const { data, error } = await tpService()
    .from("tp_review_attempts")
    .select("attempted_at")
    .eq("username", username)
    .gte("attempted_at", since)
    .order("attempted_at", { ascending: true })
    .limit(200);
  // Fail closed: if the counter cannot be read, the caller refuses.
  if (error) return "error";
  const t = (data ?? []).map((r) => new Date(r.attempted_at as string).getTime());
  let until = 0;
  for (let i = MAX_FAILS - 1; i < t.length; i++) {
    if (t[i] - t[i - (MAX_FAILS - 1)] <= WINDOW_MS) until = Math.max(until, t[i] + LOCK_MS);
  }
  return until > Date.now() ? new Date(until) : null;
}

async function recordFailure(username: string): Promise<void> {
  const db = tpService();
  await db.from("tp_review_attempts").insert({ username });
  // Housekeeping: old attempts are never needed again.
  await db.from("tp_review_attempts").delete().lt("attempted_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
}

export type ReviewSignIn =
  | { ok: true; role: "admin"; sessionId: string; expiresAt: Date }
  | { ok: true; role: "delegate" | "catalyst"; targetToken: string }
  | { ok: false; reason: "bad" | "locked" | "error" };

/** Checks a username + password. Never says which part was wrong. */
export async function reviewSignIn(rawUsername: unknown, rawPassword: unknown): Promise<ReviewSignIn> {
  const username = normaliseUsername(rawUsername);
  const password = typeof rawPassword === "string" ? rawPassword.slice(0, 200) : "";
  if (!username || !password) return { ok: false, reason: "bad" };

  const lock = await lockedUntil(username);
  if (lock === "error") return { ok: false, reason: "error" };
  if (lock) return { ok: false, reason: "locked" };

  const db = tpService();
  const { data: login, error } = await db
    .from("tp_review_logins")
    .select("id, password_hash, role, target_token, active, expires_at")
    .eq("username", username)
    .maybeSingle();
  if (error) return { ok: false, reason: "error" };

  const good = await verifyReviewPassword(password, (login?.password_hash as string | undefined) ?? (await getDummyHash()));
  const usable = !!login && login.active === true && new Date(login.expires_at as string).getTime() > Date.now();
  if (!good || !usable) {
    await recordFailure(username);
    return { ok: false, reason: "bad" };
  }
  await db.from("tp_review_attempts").delete().eq("username", username);

  if (login.role === "admin") {
    const sessionId = randomBytes(16).toString("hex");
    const expiresAt = new Date(Math.min(new Date(login.expires_at as string).getTime(), Date.now() + SESSION_MS));
    await db.from("tp_review_sessions").delete().lt("expires_at", new Date().toISOString());
    const { error: sErr } = await db
      .from("tp_review_sessions")
      .insert({ id: sessionId, login_id: login.id, expires_at: expiresAt.toISOString() });
    if (sErr) return { ok: false, reason: "error" };
    return { ok: true, role: "admin", sessionId, expiresAt };
  }
  const target = login.target_token as string | null;
  if ((login.role === "delegate" || login.role === "catalyst") && target && /^[0-9a-f]{32}$/.test(target)) {
    return { ok: true, role: login.role, targetToken: target };
  }
  return { ok: false, reason: "error" };
}

/**
 * The current review ADMIN session, or null. Valid only while the session,
 * its login, and the login's expiry all hold and the login is active.
 * Fails closed on any error.
 */
export async function getReviewAdminSession(): Promise<{ sessionId: string } | null> {
  let id: string | undefined;
  try {
    id = (await cookies()).get(TP_REVIEW_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!id || !/^[0-9a-f]{32}$/.test(id)) return null;
  const now = new Date().toISOString();
  const { data, error } = await tpService()
    .from("tp_review_sessions")
    .select("id, expires_at, login:tp_review_logins!inner(role, active, expires_at)")
    .eq("id", id)
    .gt("expires_at", now)
    .maybeSingle();
  if (error || !data) return null;
  const login = (Array.isArray(data.login) ? data.login[0] : data.login) as
    | { role: string; active: boolean; expires_at: string }
    | undefined;
  if (!login || login.role !== "admin" || login.active !== true) return null;
  if (new Date(login.expires_at).getTime() <= Date.now()) return null;
  return { sessionId: data.id as string };
}

/** Deletes the session row (if any). The caller clears the cookie. */
export async function endReviewSession(sessionId: string | undefined): Promise<void> {
  if (!sessionId || !/^[0-9a-f]{32}$/.test(sessionId)) return;
  await tpService().from("tp_review_sessions").delete().eq("id", sessionId);
}
