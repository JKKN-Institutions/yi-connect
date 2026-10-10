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
 *
 * Lock: more than 5 tries for one username within 15 minutes refuses the
 * next ones until the oldest of them is 15 minutes old. A successful
 * sign-in clears that username's tries.
 */

export const TP_REVIEW_COOKIE = "tp_review";
export const TP_REVIEW_COOKIE_PATH = "/take-pride";

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
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
 * Records THIS attempt before anything is checked, then counts. Doing it in
 * that order closes the race where many requests sent at once all read
 * "no failures yet": each request's own row is in the table before it
 * counts, so at most MAX_FAILS of any burst get through.
 *
 * Returns the attempt's id when this attempt may go ahead, "locked" when
 * more than MAX_FAILS attempts for this username fall in the last 15
 * minutes (counting this one), or "error". FAIL CLOSED: if the attempt
 * cannot be written or counted, the caller refuses.
 */
async function claimAttempt(username: string): Promise<{ id: string } | "locked" | "error"> {
  const db = tpService();
  const { data: row, error: insErr } = await db.from("tp_review_attempts").insert({ username }).select("id").single();
  if (insErr || !row) return "error";
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await db
    .from("tp_review_attempts")
    .select("id", { count: "exact", head: true })
    .eq("username", username)
    .gte("attempted_at", since);
  if (error || count === null) return "error";
  return count > MAX_FAILS ? "locked" : { id: row.id as string };
}

async function housekeeping(): Promise<void> {
  // Old attempts are never needed again.
  await tpService()
    .from("tp_review_attempts")
    .delete()
    .lt("attempted_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
}

/**
 * The delegate and catalyst logins open a sample pass / sample partner page.
 * Those pages are not sandboxed: they can reach every delegate. So they are
 * allowed only while the target is a sample row AND there are no real
 * delegates yet. FAIL CLOSED on any read error.
 */
async function sampleTargetIsSafe(role: "delegate" | "catalyst", token: string): Promise<boolean> {
  const db = tpService();
  const target = await db
    .from(role === "delegate" ? "tp_delegates" : "tp_partners")
    .select("is_sample")
    .eq("token", token)
    .maybeSingle();
  if (target.error || !target.data || target.data.is_sample !== true) return false;
  const real = await db.from("tp_delegates").select("id", { count: "exact", head: true }).eq("is_sample", false);
  if (real.error || real.count === null) return false;
  return real.count === 0;
}

export type ReviewSignIn =
  | { ok: true; role: "admin"; sessionId: string; expiresAt: Date }
  | { ok: true; role: "delegate" | "catalyst"; targetToken: string }
  | { ok: false; reason: "bad" | "locked" | "closed" | "error" };

/** Checks a username + password. Never says which part was wrong. */
export async function reviewSignIn(rawUsername: unknown, rawPassword: unknown): Promise<ReviewSignIn> {
  const username = normaliseUsername(rawUsername);
  const password = typeof rawPassword === "string" ? rawPassword.slice(0, 200) : "";
  if (!username || !password) return { ok: false, reason: "bad" };

  const attempt = await claimAttempt(username);
  if (attempt === "error") return { ok: false, reason: "error" };
  if (attempt === "locked") return { ok: false, reason: "locked" };
  await housekeeping();

  const db = tpService();
  const { data: login, error } = await db
    .from("tp_review_logins")
    .select("id, password_hash, role, target_token, active, expires_at")
    .eq("username", username)
    .maybeSingle();
  if (error) return { ok: false, reason: "error" };

  const good = await verifyReviewPassword(password, (login?.password_hash as string | undefined) ?? (await getDummyHash()));
  const usable = !!login && login.active === true && new Date(login.expires_at as string).getTime() > Date.now();
  // A failed attempt keeps its row, so it counts toward the lock.
  if (!good || !usable) return { ok: false, reason: "bad" };
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
    if (!(await sampleTargetIsSafe(login.role, target))) return { ok: false, reason: "closed" };
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
